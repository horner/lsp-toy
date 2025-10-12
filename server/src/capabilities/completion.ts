import { Connection, CompletionParams, CompletionItem, CompletionItemKind, InsertTextFormat } from 'vscode-languageserver/node';
import { DocumentManager } from '../types';
import { t } from '../i18n';
import { logDebug } from '../utils/logging';

export function registerCompletionProvider(connection: Connection, documentManager: DocumentManager): void {
  connection.onCompletion((params: CompletionParams): CompletionItem[] => {
    logDebug('onCompletion called for:', params.textDocument.uri);
    logDebug('  Position:', `line ${params.position.line}, char ${params.position.character}`);
    const trigger = params.context?.triggerCharacter;
    logDebug('  Trigger character:', trigger ? `'${trigger}'` : 'none (manual invoke)');
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
      logDebug('  → Providing section header completions');
      sectionHeaders.forEach((header, index) => {
        completions.push({
          label: header,
          kind: CompletionItemKind.Snippet,
          sortText: `1${index}`,
          insertText: `${header}\n`
        });
      });
    } else if (trigger === '[') {
      logDebug('  → Providing link and markdown format completions');
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
      logDebug('  → Providing all default completions (no trigger)');
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

    logDebug('  ✓ Returning', completions.length, 'completion items');
    return completions;
  });
}
