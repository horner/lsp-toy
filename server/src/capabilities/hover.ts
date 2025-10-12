import { Connection, HoverParams, Hover, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Tree, Node as SyntaxNode } from 'web-tree-sitter';
import { DocumentManager } from '../types';
import { getOrParseTree } from '../utils/document';
import { findNamedChild, rangeFromNode } from '../utils/tree';
import { getWordAt, getTodoKeywords, isLocalLink, linkExists, getGlossary } from '../utils/markdown';
import { t } from '../i18n';
import { logDebug } from '../utils/logging';

export function registerHoverProvider(connection: Connection, documentManager: DocumentManager): void {
  connection.onHover((params: HoverParams) => {
    logDebug('onHover called for:', params.textDocument.uri);
    logDebug('  Position:', `line ${params.position.line}, char ${params.position.character}`);
    
    const document = documentManager.get(params.textDocument.uri);
    if (!document) {
      logDebug('  ✗ Document not found');
      return null;
    }

    const tree = getOrParseTree(document, documentManager);
    if (!tree) {
      logDebug('  ✗ Parse tree not available');
      return null;
    }
    const hoverInfo = getHoverInfo(document, params.position, tree);

    if (!hoverInfo) {
      logDebug('  ⊙ No hover info available at this position');
      return null;
    }
    
    logDebug('  ✓ Returning hover info:', hoverInfo.substring(0, 50) + '...');

    return {
      contents: {
        kind: 'markdown',
        value: hoverInfo
      }
    } satisfies Hover;
  });
}

function getHoverInfo(document: TextDocument, position: Position, tree: Tree): string | null {
  const text = document.getText();
  const offset = document.offsetAt(position);
  const glossary = getGlossary();

  const word = getWordAt(text, offset);
  if (word) {
    const entry = glossary[word.toLowerCase()];
    if (entry) {
      return entry;
    }
    // Check if word is any TODO-like keyword
    const todoKeywords = getTodoKeywords().map(k => k.toLowerCase());
    if (todoKeywords.includes(word.toLowerCase())) {
      return t('hover.todo');
    }
  }

  const linkInfo = getLinkHover(document, position, tree);
  if (linkInfo) {
    return linkInfo;
  }

  return null;
}

function getLinkHover(document: TextDocument, position: Position, tree: Tree): string | null {
  const node: SyntaxNode | null = tree.rootNode.descendantForPosition({
    row: position.line,
    column: position.character
  });

  if (!node) {
    return null;
  }

  let current: SyntaxNode | null = node;
  while (current && current.type !== 'link') {
    current = current.parent;
  }

  if (!current) {
    return null;
  }

  const labelNode = findNamedChild(current, 'link_text');
  const destinationNode = findNamedChild(current, 'link_destination');

  const label = labelNode ? labelNode.text.trim() : document.getText(rangeFromNode(document, current));
  const target = destinationNode ? destinationNode.text.trim() : '';

  if (!target) {
    return `**${label}**`;
  }

  if (target.startsWith('http')) {
    return `**${label}** → ${target}`;
  }

  const exists = isLocalLink(target) ? linkExists(document.uri, target) : true;
  return exists
    ? `**${label}** → ${target}`
    : `**${label}** → ${target} _(broken link)_`;
}
