import { Connection, CompletionParams, CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver/node';
import { DocumentManager } from '../types';
import { t } from '../i18n';

export function registerCompletionProvider(connection: Connection, documentManager: DocumentManager): void {
  connection.onCompletion(async (params: CompletionParams): Promise<CompletionItem[]> => {
    const trigger = params.context?.triggerCharacter;

    // Phase 1: Check if position is inside an embedded fence
    if (documentManager.embeddedManager) {
      const fence = documentManager.embeddedManager.findFenceAt(
        params.textDocument.uri,
        params.position
      );

      if (fence) {
        const embeddedResult = await documentManager.embeddedManager.forwardCompletion(params, fence);
        
        if (embeddedResult) {
          return embeddedResult;
        }
      }
    }

    // Host Markdown completions
    const completions: CompletionItem[] = [];

    const sectionHeaders = ['## Summary', '## Skills', '## Contact', '## Projects'];
    const markdownFormats = ['**bold**', '_italic_', '`inline code`', '> Quote', '- List item'];
    const linkSnippets: CompletionItem[] = [
      {
        label: t('completion.link.label'),
        detail: t('completion.link.detail'),
        documentation: t('completion.link.documentation'),
        kind: CompletionItemKind.Snippet,
        sortText: '10',
        insertText: '[${1:Label}](https://${2:example.com})',
        insertTextFormat: InsertTextFormat.Snippet
      },
      {
        label: 'Relative link',
        kind: CompletionItemKind.Snippet,
        sortText: '11',
        insertText: '[${1:Label}](./${2:file.md})',
        insertTextFormat: InsertTextFormat.Snippet
      }
    ];

    if (trigger === '#') {
      sectionHeaders.forEach((header, index) => {
        completions.push({
          label: header,
          kind: CompletionItemKind.Snippet,
          sortText: `1${index}`,
          insertText: `${header}\n`
        });
      });
    } else if (trigger === '[') {
      completions.push(...linkSnippets);
      markdownFormats.forEach((snippet, index) => {
        completions.push({
          label: snippet,
          kind: CompletionItemKind.Keyword,
          sortText: `2${index}`,
          insertText: snippet
        });
      });
    }

    if (!trigger) {
      sectionHeaders.forEach((header, index) => {
        completions.push({
          label: header,
          kind: CompletionItemKind.Snippet,
          sortText: `3${index}`,
          insertText: `${header}\n`
        });
      });

      markdownFormats.forEach((format, index) => {
        completions.push({
          label: format,
          kind: CompletionItemKind.Text,
          sortText: `4${index}`,
          insertText: format
        });
      });

      completions.push(...linkSnippets);
    }

    return completions;
  });
}
