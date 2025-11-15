import {
  createConnection,
  ProposedFeatures,
  BrowserMessageReader,
  BrowserMessageWriter
} from 'vscode-languageserver/browser';

// Import core modules
import { initializeLanguageServer } from './initialization';

// Browser/Web Worker entry point - uses postMessage for communication
declare const self: any;

console.log('[lsp-toy] Browser server starting in Web Worker mode (postMessage)...');

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(
  ProposedFeatures.all,
  messageReader,
  messageWriter
);

console.log('[lsp-toy] Browser LSP connection created, initializing language server...');

initializeLanguageServer(connection).catch(error => {
  console.error('[lsp-toy] Browser server initialization error:', error);
});

console.log('[lsp-toy] Browser server ready (postMessage mode)');
