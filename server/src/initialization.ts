import {
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind
} from 'vscode-languageserver/node';

// Import core modules
import { initializeParser, semanticLegend } from './parser';
import { initializeI18n } from './i18n';
import { createDocumentManager } from './utils/document';
import { logDebug } from './utils/logging';

// Import capability handlers
import { setupDocumentHandlers } from './capabilities/diagnostics';
import { registerCompletionProvider } from './capabilities/completion';
import { registerHoverProvider } from './capabilities/hover';
import { registerCodeActionProvider } from './capabilities/codeAction';
import { registerSemanticTokensProvider } from './capabilities/semanticTokens';
import { registerSignatureHelpProvider } from './capabilities/signatureHelp';
import { registerInlayHintsProvider } from './capabilities/inlayHints';
import { registerDocumentSymbolsProvider } from './capabilities/documentSymbols';

// Phase 1: Import embedded language support
import { EmbeddedLanguageManager } from './embedded/embeddedManager';

export async function initializeLanguageServer(connection: any, stream?: any): Promise<void> {
  logDebug('initializeLanguageServer called');
  
  const documentManager = createDocumentManager();
  logDebug('DocumentManager created');

  // Register onInitialize handler FIRST before any async work
  connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
    logDebug('onInitialize handler called');
    logDebug(`Initialize params: ${JSON.stringify(params)}`);
    
    // Check for custom transport property in clientInfo
    // @ts-ignore - custom extension to LSP protocol
    const rpcHeader = params.clientInfo?.transport?.['rpc-header'];
    if (rpcHeader === false && stream?.setMode) {
      stream.setMode('raw-jsonrpc');
      logDebug('Client requested awesome mode (raw JSON-RPC without headers)');
    } else if (stream?.setMode) {
      stream.setMode('lsp-protocol');
      logDebug('Using standard LSP protocol mode (with Content-Length headers)');
    }
    
    // Initialize parser on first initialize request
    logDebug('About to initialize parser...');
    await initializeParser();
    
    // Safe console logging that won't crash if connection closes
    try {
      connection.console.log('Parser initialized successfully');
    } catch (error) {
      logDebug('Failed to send console message (connection may be closed):', error);
    }
    logDebug('Parser initialized!');
    
    // Capture client locale preferences
    const clientLocale = params.locale;
    if (clientLocale) {
      logDebug('Client locale:', clientLocale);
      try {
        connection.console.log(`Client locale: ${clientLocale}`);
      } catch (error) {
        logDebug('Failed to send console message (connection may be closed)');
      }
    } else {
      logDebug('No locale information provided by client');
    }
    
    // Initialize i18n with the client's locale
    await initializeI18n(clientLocale);
    
    // Log other useful client info
    if (params.clientInfo) {
      logDebug('Client info:', `${params.clientInfo.name} ${params.clientInfo.version || 'unknown version'}`);
    }

    // Phase 1: Initialize embedded language manager
    const workspaceRoot = params.workspaceFolders?.[0]?.uri.replace('file://', '') || 
                         params.rootUri?.replace('file://', '') || 
                         undefined;
    
    documentManager.embeddedManager = new EmbeddedLanguageManager(connection, workspaceRoot);
    logDebug('[EMBED] Manager initialized, workspace:', workspaceRoot);
    try {
      connection.console.log('[lsp-toy] Embedded language support enabled');
    } catch (error) {
      logDebug('Failed to send console message (connection may be closed)');
    }
    
    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: [' ', '.', '-', '#', '[']
        },
        hoverProvider: true,
        codeActionProvider: {
          resolveProvider: false
        },
        inlayHintProvider: true,
        documentSymbolProvider: true,
        signatureHelpProvider: {
          triggerCharacters: ['(', ',']
        },
        semanticTokensProvider: {
          legend: semanticLegend,
          range: false,
          full: true
        }
        // Note: Command handled client-side, not via executeCommandProvider
      }
    };
    
    logDebug(`Returning initialize result: ${JSON.stringify(result)}`);
    return result;
  });

  // Register all capability handlers
  logDebug('Registering capability handlers...');
  setupDocumentHandlers(connection, documentManager);
  registerCompletionProvider(connection, documentManager);
  registerHoverProvider(connection, documentManager);
  registerCodeActionProvider(connection, documentManager);
  registerSemanticTokensProvider(connection, documentManager);
  registerSignatureHelpProvider(connection, documentManager);
  registerInlayHintsProvider(connection, documentManager);
  registerDocumentSymbolsProvider(connection, documentManager);
  logDebug('All handlers registered');

  // Phase 1: Register shutdown handler for embedded servers
  connection.onShutdown(async () => {
    logDebug('Shutdown requested');
    if (documentManager.embeddedManager) {
      await documentManager.embeddedManager.shutdown();
    }
  });

  logDebug('Setting up document and connection listeners...');
  documentManager.listen(connection);
  // Note: connection.listen() is now called in server.ts immediately after connection creation
  logDebug('Listeners setup complete - server is ready!');
}
