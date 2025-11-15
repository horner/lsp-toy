import { workspace, ExtensionContext, window, commands } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions
} from 'vscode-languageclient/browser';

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext): void {
  console.log('[LSP-TOY CLIENT BROWSER] Extension activating...');
  void window.showInformationMessage('LSP-Toy browser extension is activating!');

  // Get WebSocket URL from configuration or use default
  const config = workspace.getConfiguration('lsptoy');
  const wsUrl = config.get<string>('websocketUrl') || 'ws://localhost:8080';
  
  console.log('[LSP-TOY CLIENT BROWSER] Connecting to WebSocket server:', wsUrl);

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: 'file', language: 'lsptoy' },
      { scheme: 'untitled', language: 'lsptoy' },
      { scheme: 'vscode-vfs', language: 'lsptoy' }
    ],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.lsptoy')
    }
  };

  // Create WebSocket transport
  const createWebSocket = (): Promise<WebSocket> => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => resolve(ws);
      ws.onerror = (event) => reject(new Error(`WebSocket connection failed: ${event}`));
    });
  };

  client = new LanguageClient(
    'lsptoyLanguageServer',
    'LSP Toy Language Server',
    clientOptions,
    createWebSocket
  );

  console.log('[LSP-TOY CLIENT BROWSER] LanguageClient created for WebSocket transport');
  context.subscriptions.push(client);

  // Register command before starting server
  const showTreeOutlineCommand = commands.registerCommand('lsptoy.showTreeOutline', () => {
    const editor = window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'lsptoy') {
      void window.showWarningMessage('Please open a .lsptoy file first');
      return;
    }
    
    void window.showInformationMessage('Hover over line 1 to see the tree outline, or check the Output panel');
  });
  context.subscriptions.push(showTreeOutlineCommand);

  client.start().then(() => {
    console.log('[LSP-TOY CLIENT BROWSER] Server connected successfully via WebSocket!');
    void window.showInformationMessage('LSP-Toy browser server connected!');
  }).catch((error: Error) => {
    console.error('[LSP-TOY CLIENT BROWSER] Failed to connect to server:', error);
    void window.showErrorMessage(`LSP-Toy browser server connection failed: ${error.message}`);
  });
}

export function deactivate(): Promise<void> | undefined {
  console.log('[LSP-TOY CLIENT BROWSER] Extension deactivating...');
  return client?.stop();
}
