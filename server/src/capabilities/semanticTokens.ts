import { Connection, SemanticTokensParams, SemanticTokensBuilder } from 'vscode-languageserver/node';
import { Node as SyntaxNode } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../types';
import { getOrParseTree } from '../utils/document';
import { visitTree } from '../utils/tree';
import { findTodoMatches } from '../utils/markdown';
import { semanticLegend } from '../parser';
import { logDebug } from '../utils/logging';

export function registerSemanticTokensProvider(connection: Connection, documentManager: DocumentManager): void {
  connection.languages.semanticTokens.on((params: SemanticTokensParams) => {
    logDebug('onSemanticTokens called for:', params.textDocument.uri);
    const document = documentManager.get(params.textDocument.uri);
    if (!document) {
      logDebug('  ✗ Document not found');
      return { data: [] };
    }

    const tree = getOrParseTree(document, documentManager);
    const builder = new SemanticTokensBuilder();
    if (!tree) {
      logDebug('  ✗ Parse tree not available');
      return builder.build();
    }
    const lines = document.getText().split(/\r?\n/);
    logDebug('  Processing', lines.length, 'lines for semantic tokens');
    
    const tokenCounts: Record<string, number> = {};

    visitTree(tree.rootNode, node => {
      switch (node.type) {
        case 'heading_content':
          tokenCounts['heading'] = (tokenCounts['heading'] || 0) + 1;
          pushNodeToken(builder, document, lines, node, 'heading');
          break;
        case 'strong_emphasis':
          tokenCounts['bold'] = (tokenCounts['bold'] || 0) + 1;
          pushNodeToken(builder, document, lines, node, 'bold');
          break;
        case 'emphasis':
          tokenCounts['italic'] = (tokenCounts['italic'] || 0) + 1;
          pushNodeToken(builder, document, lines, node, 'italic');
          break;
        case 'code_span':
          tokenCounts['code'] = (tokenCounts['code'] || 0) + 1;
          pushNodeToken(builder, document, lines, node, 'code');
          break;
        case 'link':
          tokenCounts['link'] = (tokenCounts['link'] || 0) + 1;
          pushNodeToken(builder, document, lines, node, 'link');
          break;
        case 'text':
          highlightTodoTokens(builder, document, lines, node);
          break;
        default:
          break;
      }
    });

    const result = builder.build();
    const totalTokens = Object.values(tokenCounts).reduce((a, b) => a + b, 0);
    logDebug('  ✓ Generated', totalTokens, 'semantic tokens:', JSON.stringify(tokenCounts));
    logDebug('  Data length:', result.data.length, 'integers');
    return result;
  });
}

function pushNodeToken(
  builder: SemanticTokensBuilder,
  document: TextDocument,
  lines: string[],
  node: SyntaxNode,
  tokenType: string
): void {
  pushRange(builder, document, lines, node.startIndex, node.endIndex, tokenType);
}

function highlightTodoTokens(
  builder: SemanticTokensBuilder,
  document: TextDocument,
  lines: string[],
  node: SyntaxNode
): void {
  const text: string = node.text ?? '';
  const matches = findTodoMatches(text);
  
  for (const match of matches) {
    const start = node.startIndex + match.index;
    const end = start + match.length;
    pushRange(builder, document, lines, start, end, 'todo');
  }
}

function pushRange(
  builder: SemanticTokensBuilder,
  document: TextDocument,
  lines: string[],
  startIndex: number,
  endIndex: number,
  tokenType: string
): void {
  if (endIndex <= startIndex) {
    return;
  }

  const startPos = document.positionAt(startIndex);
  const endPos = document.positionAt(endIndex);
  const tokenTypeIndex = getTokenTypeIndex(tokenType);

  if (startPos.line === endPos.line) {
    const length = endPos.character - startPos.character;
    if (length > 0) {
      builder.push(startPos.line, startPos.character, length, tokenTypeIndex, 0);
    }
    return;
  }

  const firstLine = lines[startPos.line] ?? '';
  const firstLength = firstLine.length - startPos.character;
  if (firstLength > 0) {
    builder.push(startPos.line, startPos.character, firstLength, tokenTypeIndex, 0);
  }

  for (let line = startPos.line + 1; line < endPos.line; line++) {
    const fullLength = lines[line]?.length ?? 0;
    if (fullLength > 0) {
      builder.push(line, 0, fullLength, tokenTypeIndex, 0);
    }
  }

  if (endPos.character > 0) {
    builder.push(endPos.line, 0, endPos.character, tokenTypeIndex, 0);
  }
}

function getTokenTypeIndex(tokenType: string): number {
  const index = semanticLegend.tokenTypes.indexOf(tokenType);
  if (index === -1) {
    return 0;
  }
  return index;
}
