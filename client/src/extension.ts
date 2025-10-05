import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient | undefined;

export function activate(context: ExtensionContext): void {
  const serverModule = context.asAbsolutePath(path.join('server', 'out', 'server.js'));

  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.ipc
    },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6009']
      }
    }
  };

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

  context.subscriptions.push(client);
  void client.start();
}

export function deactivate(): Promise<void> | undefined {
  return client?.stop();
}
