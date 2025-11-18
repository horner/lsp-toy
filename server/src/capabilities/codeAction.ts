import { Connection, CodeActionParams, CodeAction, CodeActionKind, TextEdit, WorkspaceEdit } from 'vscode-languageserver/node';
import { DocumentManager } from '../types';
import { logDebug } from '../utils/logging';

export function registerCodeActionProvider(connection: Connection, documentManager: DocumentManager): void {
  connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
    logDebug('onCodeAction called for:', params.textDocument.uri);
    logDebug('  Range:', JSON.stringify(params.range));
    logDebug('  Diagnostics count:', params.context.diagnostics.length);
    
    const document = documentManager.get(params.textDocument.uri);
    if (!document) {
      logDebug('  ✗ Document not found');
      return [];
    }

    const actions: CodeAction[] = [];

    for (const diagnostic of params.context.diagnostics) {
      logDebug('  Diagnostic:', JSON.stringify(diagnostic));
      const data = diagnostic.data as { kind?: string; label?: string; keyword?: string } | undefined;
      logDebug('  Diagnostic data:', JSON.stringify(data));
      if (data?.kind === 'todo') {
        logDebug('  → Creating "Mark TODO as done" action');
        const edit: WorkspaceEdit = {
          changes: {
            [params.textDocument.uri]: [TextEdit.replace(diagnostic.range, '[X]')]
          }
        };
        actions.push({
          title: 'Mark TODO as done',
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit
        });
      } else if (data?.kind === 'brokenLink') {
        logDebug('  → Creating "Remove broken link" action');
        const replacement = data.label ?? '';
        const edit: WorkspaceEdit = {
          changes: {
            [params.textDocument.uri]: [TextEdit.replace(diagnostic.range, replacement)]
          }
        };
        actions.push({
          title: 'Remove broken link',
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit
        });
      }
    }

    logDebug('  ✓ Returning', actions.length, 'code actions');
    return actions;
  });
}
