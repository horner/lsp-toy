import * as path from 'path';
import { workspace, ExtensionContext, window } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext): void {
  console.log('[LSP-TOY CLIENT] Extension activating...');
  void window.showInformationMessage('LSP-Toy extension is activating!');
  
  const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));
  console.log('[LSP-TOY CLIENT] Server module path:', serverModule);

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.stdio
    },
    debug: {
      module: serverModule,
      transport: TransportKind.stdio,
      options: {
        execArgv: ['--nolazy', '--inspect=6009']
      }
    }
  };
  
  console.log('[LSP-TOY CLIENT] Server options configured with stdio transport');

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: 'file', language: 'lsptoy' }],
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher('**/*.lsptoy')
    }
  };

  client = new LanguageClient(
    'lsptoyLanguageServer',
    'LSP Toy Language Server',
    serverOptions,
    clientOptions
  );

  console.log('[LSP-TOY CLIENT] LanguageClient created, starting...');
  context.subscriptions.push(client);
  
  client.start().then(() => {
    console.log('[LSP-TOY CLIENT] Server started successfully!');
    void window.showInformationMessage('LSP-Toy server started!');
  }).catch((error: Error) => {
    console.error('[LSP-TOY CLIENT] Failed to start server:', error);
    void window.showErrorMessage(`LSP-Toy server failed to start: ${error.message}`);
  });
}

export function deactivate(): Promise<void> | undefined {
  console.log('[LSP-TOY CLIENT] Extension deactivating...');
  return client?.stop();
}
