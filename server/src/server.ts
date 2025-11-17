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
import { serveStaticFiles } from './utils/static-server';
import type { MessageReader, MessageWriter } from 'vscode-languageserver/node';
import * as path from 'path';

// Helper to add JSON-RPC logging to any reader/writer pair
function addMessageLogging(reader: MessageReader, writer: MessageWriter, label: string) {
  const originalListen = reader.listen.bind(reader);
  reader.listen = (callback) => {
    logDebug(`[${label}] Reader.listen() called, wrapping callback`);
    let messageCount = 0;
    return originalListen((msg) => {
      messageCount++;
      const msgAny = msg as any;
      logDebug(`[${label} ← CLIENT #${messageCount}] Method: ${msgAny.method || 'response'}, ID: ${msgAny.id || 'N/A'}`);
      logDebug(`[${label} ← CLIENT #${messageCount}] Full message: ${JSON.stringify(msg).substring(0, 300)}...`);
      callback(msg);
      logDebug(`[${label}] Callback completed for message #${messageCount}`);
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
      
      logDebug(`[WebSocket] ====== Received ${buffer.length} bytes from client (mode: ${this.mode}) ======`);
      logDebug(`[WebSocket] First 50 chars: ${text.substring(0, 50)}`);
      
      if (this.mode === 'raw-jsonrpc') {
        // Check if message starts with '{' - if so, wrap it
        if (text.startsWith('{')) {
          // Wrap raw JSON-RPC in LSP protocol headers for StreamMessageReader
          const contentLength = Buffer.byteLength(text, 'utf-8');
          const wrapped = `Content-Length: ${contentLength}\r\n\r\n${text}`;
          logDebug(`[WebSocket] ✓ Wrapping JSON (${text.length} → ${wrapped.length} bytes)`);
          logDebug(`[WebSocket] Pushing to stream: ${wrapped.substring(0, 200)}${wrapped.length > 200 ? '...' : ''}`);
          const pushed = this.push(Buffer.from(wrapped, 'utf-8'));
          logDebug(`[WebSocket] Push returned: ${pushed} (false means buffer is full)`);
          return;
        }
        
        if (text.startsWith('Content-Length:')) {
          // Already has headers - pass through as-is
          // Verify the Content-Length header matches actual body length
          const headerMatch = text.match(/^Content-Length: (\d+)\r\n\r\n/);
          if (headerMatch) {
            const declaredLength = parseInt(headerMatch[1], 10);
            const headerLength = headerMatch[0].length;
            const bodyLength = text.length - headerLength;
            const actualBodyLength = Buffer.byteLength(text.substring(headerLength), 'utf-8');
            
            logDebug(`[WebSocket] ✓ Pass-through (has headers)`);
            logDebug(`[WebSocket]   Declared Content-Length: ${declaredLength}`);
            logDebug(`[WebSocket]   Header size: ${headerLength} bytes`);
            logDebug(`[WebSocket]   Body string length: ${bodyLength} chars`);
            logDebug(`[WebSocket]   Body byte length: ${actualBodyLength} bytes`);
            logDebug(`[WebSocket]   Total message: ${text.length} chars / ${buffer.length} bytes`);
            logDebug(`[WebSocket]   Content preview: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
            
            if (declaredLength !== actualBodyLength) {
              logDebug(`[WebSocket]   ⚠️  WARNING: Content-Length mismatch! Declared ${declaredLength} but actual is ${actualBodyLength}`);
            }
          } else {
            logDebug(`[WebSocket] ✓ Pass-through (has headers): ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
          }
          
          const pushed = this.push(buffer);
          logDebug(`[WebSocket] Push returned: ${pushed}`);
          return;
        }
        
        // Malformed message - log warning and drop it
        logDebug(`[WebSocket] ✗ WARNING: Malformed message (doesn't start with '{' or 'Content-Length:')`);
        logDebug(`[WebSocket] First 100 chars: ${text.substring(0, 100)}`);
        logDebug(`[WebSocket] Dropping malformed message`);
        return;
      } else {
        // LSP protocol mode - pass through as-is
        logDebug(`[WebSocket] Pass-through: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
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

  _read(size: number): void {
    // No-op: data is pushed when received
    logDebug(`[WebSocket] _read() called with size: ${size}`);
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
    
    // Determine which static directory to serve from based on route
    let staticDir: string;
    
    if (req.url?.startsWith('/editor')) {
      // Serve Monaco editor from /editor route
      staticDir = path.join(__dirname, '../../web-client/monaco-editor/dist');
      // Remove /editor prefix for file resolution
      req.url = req.url.replace(/^\/editor/, '') || '/';
    } else {
      // Serve info page and other static content from web-client root
      staticDir = path.join(__dirname, '../../web-client');
    }
    
    serveStaticFiles(req, res, staticDir);
  });

  const wss = new WebSocketServer({ 
    server: httpServer
  });

  wss.on('connection', (ws: WebSocket, request) => {
    const clientId = `WS-${++clientCounter}`;
    logDebug(`${clientId} connected via WebSocket`);

    const stream = new WebSocketDuplex(ws);
    
    // Add error handler to the stream itself to catch parse/protocol errors
    stream.on('error', (error) => {
      logDebug(`${clientId} Stream error:`, error.message);
      // Close the WebSocket on stream errors to prevent zombie connections
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    
    const reader = new StreamMessageReader(stream);
    const writer = new StreamMessageWriter(stream);
    addMessageLogging(reader, writer, clientId);
    
    const connection = createConnection(ProposedFeatures.all, reader, writer);

    logDebug(`${clientId} LSP connection created, waiting for initialize request...`);

    ws.on('close', () => {
      logDebug(`${clientId} disconnected`);
      // Ensure stream is properly closed
      stream.destroy();
    });

    ws.on('error', (error) => {
      logDebug(`${clientId} WebSocket error:`, error.message);
      // Destroy stream on WebSocket errors
      stream.destroy(error);
    });

    // Initialize and start listening immediately
    initializeLanguageServer(connection, stream).then(() => {
      // Start listening for messages only after handlers are registered
      logDebug(`${clientId} Starting connection.listen()...`);
      connection.listen();
      logDebug(`${clientId} connection.listen() started`);
    }).catch(error => {
      logDebug(`${clientId} initialization error:`, error);
      // Close WebSocket on initialization failure
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
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
