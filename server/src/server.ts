import * as net from 'net';
import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Duplex } from 'stream';
import {
  createConnection,
  ProposedFeatures,
  SocketMessageReader,
  SocketMessageWriter,
  StreamMessageReader,
  StreamMessageWriter
} from 'vscode-languageserver/node';

// Import core modules
import { logDebug } from './utils/logging';
import { resolvePort } from './utils/network';
import { initializeLanguageServer } from './initialization';
import type { MessageReader, MessageWriter } from 'vscode-languageserver/node';

// Helper to add JSON-RPC logging to any reader/writer pair
function addMessageLogging(reader: MessageReader, writer: MessageWriter, label: string) {
  const originalListen = reader.listen.bind(reader);
  reader.listen = (callback) => {
    logDebug(`[${label}] Reader.listen() called, wrapping callback`);
    return originalListen((msg) => {
      logDebug(`[${label} ← CLIENT] ${JSON.stringify(msg)}`);
      callback(msg);
    });
  };
  
  const originalWrite = writer.write.bind(writer);
  writer.write = (msg) => {
    logDebug(`[${label} → CLIENT] ${JSON.stringify(msg)}`);
    return originalWrite(msg);
  };
}

// WebSocket to Stream adapter with configurable message format
class WebSocketDuplex extends Duplex {
  private ws: WebSocket;
  private mode: 'lsp-protocol' | 'raw-jsonrpc' = 'lsp-protocol';
  private firstResponse: boolean = true;

  constructor(ws: WebSocket) {
    super();
    this.ws = ws;
    
    ws.on('message', (data: Buffer | string) => {
      const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
      const text = buffer.toString('utf-8');
      
      logDebug(`[WebSocket] Received ${buffer.length} bytes from client (${this.mode})`);
      
      if (this.mode === 'raw-jsonrpc') {
        // Wrap raw JSON-RPC in LSP protocol headers for StreamMessageReader
        const contentLength = Buffer.byteLength(text, 'utf-8');
        const wrapped = `Content-Length: ${contentLength}\r\n\r\n${text}`;
        logDebug(`[WebSocket] Wrapping: ${text.substring(0, 100)}`);
        this.push(Buffer.from(wrapped, 'utf-8'));
      } else {
        // LSP protocol mode - pass through as-is
        logDebug(`[WebSocket] Pass-through: ${text.substring(0, 100)}`);
        this.push(buffer);
      }
    });

    ws.on('close', () => {
      this.push(null);
    });

    ws.on('error', (error) => {
      this.destroy(error);
    });
  }

  _read(_size: number): void {
    // No-op: data is pushed when received
  }

  _write(chunk: any, _encoding: string, callback: (error?: Error | null) => void): void {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);


    logDebug(`[WebSocket] WRITE: ${buffer.length} bytes (${this.mode}), this: ${this.firstResponse ? 'first response' : 'subsequent response'}  `);
    
    if (this.mode === 'raw-jsonrpc') {
      // Strip LSP headers and send only JSON body
      const text = buffer.toString('utf-8');
      const headerEnd = text.indexOf('\r\n\r\n');
      
      if (headerEnd !== -1) {
        const jsonBody = text.substring(headerEnd + 4);
        
        if (jsonBody.length === 0) {
          // This is just the headers chunk from StreamMessageWriter's first write
          // Skip it - we'll send when we get the body chunk
          logDebug(`[WebSocket] Skipping headers-only chunk in raw-jsonrpc mode`);
          callback();
          return;
        }
        
        // For the first response in awesome mode, send with Content-Length header
        if (this.firstResponse) {
          this.firstResponse = false;
          const contentLength = Buffer.byteLength(jsonBody, 'utf-8');
          const messageWithHeader = `Content-Length: ${contentLength}\r\n\r\n${jsonBody}`;
          logDebug(`[WebSocket] Sending FIRST response with header (${messageWithHeader.length} bytes): ${jsonBody.substring(0, 100)}`);
          
          if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(messageWithHeader, (error) => {
              callback(error || null);
            });
          } else {
            callback(new Error('WebSocket is not open'));
          }
        } else {
          // Subsequent responses - send only JSON
          logDebug(`[WebSocket] Sending JSON (${jsonBody.length} bytes): ${jsonBody.substring(0, 100)}`);
          
          if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(jsonBody, (error) => {
              callback(error || null);
            });
          } else {
            callback(new Error('WebSocket is not open'));
          }
        }
      } else {
        // No headers found - this is the body-only chunk from StreamMessageWriter's second write
        if (text.trim().length === 0) {
          logDebug(`[WebSocket] Skipping empty chunk`);
          callback();
          return;
        }
        
        // For the first response in awesome mode, send with Content-Length header
        if (this.firstResponse) {
          this.firstResponse = false;
          const contentLength = Buffer.byteLength(text, 'utf-8');
          const messageWithHeader = `Content-Length: ${contentLength}\r\n\r\n${text}`;
          logDebug(`[WebSocket] Sending FIRST response with header (${messageWithHeader.length} bytes): ${text.substring(0, 100)}`);
          
          if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(messageWithHeader, (error) => {
              callback(error || null);
            });
          } else {
            callback(new Error('WebSocket is not open'));
          }
        } else {
          // Subsequent responses - send only JSON
          logDebug(`[WebSocket] Sending body-only chunk (${text.length} bytes): ${text.substring(0, 100)}`);
          if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(text, (error) => {
              callback(error || null);
            });
          } else {
            callback(new Error('WebSocket is not open'));
          }
        }
      }
    } else {
      // LSP protocol mode - send with headers
      logDebug(`[WebSocket] Sending with headers (${buffer.length} bytes)`);
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(buffer, (error) => {
          callback(error || null);
        });
      } else {
        callback(new Error('WebSocket is not open'));
      }
    }
  }

  _final(callback: (error?: Error | null) => void): void {
    this.ws.close();
    callback();
  }

  setMode(mode: 'lsp-protocol' | 'raw-jsonrpc'): void {
    this.mode = mode;
    logDebug(`[WebSocket] Mode set to: ${mode}`);
  }
}

// Main entry point
logDebug('Resolving port...');
const requestedPort = resolvePort();
logDebug('Port resolution result:', requestedPort);

if (requestedPort !== null) {
  // WebSocket mode - for browser-based VS Code over network
  logDebug('Starting WebSocket server on port:', requestedPort);
  
  let clientCounter = 0;
  
  // Create HTTP server to handle both HTTP and WebSocket requests
  const httpServer = http.createServer((req, res) => {
    logDebug(`HTTP request from ${req.socket.remoteAddress}: ${req.method} ${req.url}`);
    
    // Serve informational page for HTTP requests
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LSP-Toy Language Server</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 60px auto;
      padding: 0 20px;
      line-height: 1.6;
      color: #333;
    }
    h1 { color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
    .info-box {
      background: #f5f5f5;
      border-left: 4px solid #0066cc;
      padding: 15px 20px;
      margin: 20px 0;
    }
    code {
      background: #e8e8e8;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .port { font-weight: bold; color: #0066cc; }
  </style>
</head>
<body>
  <h1>🔌 LSP-Toy Language Server</h1>
  
  <div class="info-box">
    <p><strong>WebSocket Server Running</strong></p>
    <p>Port: <span class="port">${requestedPort}</span></p>
  </div>
  
  <h2>About</h2>
  <p>This is a Language Server Protocol (LSP) implementation for the LSP-Toy language. 
     The server communicates via WebSocket and is designed to work with VS Code and other LSP-compatible editors.</p>
  
  <h2>Setup</h2>
  <p>To use this language server:</p>
  <ol>
    <li>Install the LSP-Toy extension in VS Code</li>
    <li>The extension will automatically connect to this WebSocket server</li>
    <li>Open any <code>.lsptoy</code> file to activate language features</li>
  </ol>
  
  <h2>Documentation</h2>
  <p>For more information, setup instructions, and documentation:</p>
  <p>📚 <a href="https://github.com/horner/lsp-toy" target="_blank">https://github.com/horner/lsp-toy</a></p>
  
  <hr style="margin: 40px 0; border: none; border-top: 1px solid #ddd;">
  <p style="color: #666; font-size: 14px;">
    💡 <em>This page is shown because you accessed the WebSocket port via HTTP. 
    Language server clients should connect using the WebSocket protocol (ws://).</em>
  </p>
</body>
</html>`);
  });

  const wss = new WebSocketServer({ 
    server: httpServer
  });

  wss.on('connection', (ws: WebSocket, request) => {
    const clientId = `WS-${++clientCounter}`;
    logDebug(`${clientId} connected via WebSocket`);

    const stream = new WebSocketDuplex(ws);
    
    const reader = new StreamMessageReader(stream);
    const writer = new StreamMessageWriter(stream);
    addMessageLogging(reader, writer, clientId);
    
    const connection = createConnection(ProposedFeatures.all, reader, writer);

    logDebug(`${clientId} LSP connection created, waiting for initialize request...`);

    ws.on('close', () => {
      logDebug(`${clientId} disconnected`);
    });

    ws.on('error', (error) => {
      logDebug(`${clientId} error:`, error.message);
    });

    // Initialize and start listening immediately
    initializeLanguageServer(connection, stream).catch(error => {
      logDebug(`${clientId} initialization error:`, error);
    });
    
    // Start listening for messages right away
    logDebug(`${clientId} Starting connection.listen()...`);
    connection.listen();
    logDebug(`${clientId} connection.listen() started`);
  });

  wss.on('error', (error) => {
    logDebug('WebSocket server error:', error);
  });

  // Start the HTTP server
  httpServer.listen(requestedPort, () => {
    logDebug(`HTTP/WebSocket server listening on port ${requestedPort}`);
    logDebug(`- WebSocket: ws://localhost:${requestedPort}`);
    logDebug(`- HTTP Info Page: http://localhost:${requestedPort}`);
  });

  // Graceful shutdown with double Ctrl-C to force quit
  let shutdownRequested = false;
  const shutdown = () => {
    if (shutdownRequested) {
      logDebug('Force shutdown - exiting immediately');
      process.exit(1);
    }
    
    shutdownRequested = true;
    logDebug('Shutting down HTTP/WebSocket server... (press Ctrl-C again to force quit)');
    
    wss.close(() => {
      httpServer.close(() => {
        logDebug('HTTP/WebSocket server closed');
        process.exit(0);
      });
    });
    
    // If graceful shutdown takes too long, force exit after 2 seconds
    setTimeout(() => {
      logDebug('Shutdown timeout - forcing exit');
      process.exit(1);
    }, 2000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  logDebug('No port specified - using stdio mode');
  logDebug('Creating connection with stdin/stdout...');
  
  const reader = new StreamMessageReader(process.stdin);
  const writer = new StreamMessageWriter(process.stdout);
  addMessageLogging(reader, writer, 'STDIO');
  
  const stdioConnection = createConnection(ProposedFeatures.all, reader, writer);
  
  logDebug('stdio connection created with logging, initializing language server...');
  initializeLanguageServer(stdioConnection);
  logDebug('Language server initialization started (async)');
}
