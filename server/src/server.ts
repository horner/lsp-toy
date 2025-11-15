import * as net from 'net';
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
    return originalListen((msg) => {
      logDebug(`[${label} ← CLIENT] ${JSON.stringify(msg)}`);
      callback(msg);
    });
  };
  
  const originalWrite = writer.write.bind(writer);
  writer.write = (msg) => {
    logDebug(`[${label} → SERVER] ${JSON.stringify(msg)}`);
    return originalWrite(msg);
  };
}

// WebSocket to Stream adapter
class WebSocketDuplex extends Duplex {
  private ws: WebSocket;

  constructor(ws: WebSocket) {
    super();
    this.ws = ws;
    
    ws.on('message', (data: Buffer | string) => {
      const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
      this.push(buffer);
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
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(chunk, (error) => {
        callback(error || null);
      });
    } else {
      callback(new Error('WebSocket is not open'));
    }
  }

  _final(callback: (error?: Error | null) => void): void {
    this.ws.close();
    callback();
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
  const wss = new WebSocketServer({ port: requestedPort });

  wss.on('connection', (ws: WebSocket) => {
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

    initializeLanguageServer(connection).catch(error => {
      logDebug(`${clientId} initialization error:`, error);
    });
  });

  wss.on('error', (error) => {
    logDebug('WebSocket server error:', error);
  });

  logDebug(`WebSocket server listening on ws://localhost:${requestedPort}`);

  // Graceful shutdown
  const shutdown = () => {
    logDebug('Shutting down WebSocket server...');
    wss.close(() => {
      logDebug('WebSocket server closed');
      process.exit(0);
    });
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
