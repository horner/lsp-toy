import { Connection, HoverParams, Hover, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Tree, Node as SyntaxNode } from 'web-tree-sitter';
import { DocumentManager } from '../types';
import { getOrParseTree } from '../utils/document';
import { findNamedChild, rangeFromNode, generateTreeOutline, generateDetailedTreeOutline } from '../utils/tree';
import { getWordAt, getTodoKeywords, isLocalLink, linkExists, getGlossary } from '../utils/markdown';
import { t } from '../i18n';
import { logDebug } from '../utils/logging';

export function registerHoverProvider(connection: Connection, documentManager: DocumentManager): void {
  connection.onHover(async (params: HoverParams) => {
    const document = documentManager.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    // Special case: Show tree outline on line 1 (line 0 in 0-indexed)
    if (params.position.line === 0) {
      const tree = getOrParseTree(document, documentManager);
      if (tree) {
        try {
          const outline = generateTreeOutline(tree.rootNode, 2); // Depth 2 to keep it small
          
          // Log detailed tree with content mapping (safe because we use logDebug, not console.log)
          const detailedOutline = generateDetailedTreeOutline(tree.rootNode); // No depth limit
          logDebug('\n' + detailedOutline);
          
          return {
            contents: {
              kind: 'markdown',
              value: '### Document Tree Outline\n\n```\n' + outline + '\n```\n\n*Hover shows first 2 levels. Check Debug Console for detailed view with content.*'
            }
          } satisfies Hover;
        } catch (err) {
          logDebug('[HOVER] Tree outline generation failed:', err);
        }
      }
    }

    // Phase 1: Check if position is inside an embedded fence
    if (documentManager.embeddedManager) {
      const fence = documentManager.embeddedManager.findFenceAt(
        params.textDocument.uri,
        params.position
      );

      if (fence) {
        const embeddedResult = await documentManager.embeddedManager.forwardHover(params, fence);
        
        if (embeddedResult) {
          return embeddedResult;
        }
        
        // If embedded server fails or doesn't support hover, provide helpful message
        const helpMessage = documentManager.embeddedManager.getLanguageHint(fence.normalizedLang);
        if (helpMessage) {
          return {
            contents: {
              kind: 'markdown',
              value: helpMessage
            }
          } satisfies Hover;
        }
        
        // Fall through to host if no help message available
      }
    }

    const tree = getOrParseTree(document, documentManager);
    if (!tree) {
      return null;
    }
    const hoverInfo = getHoverInfo(document, params.position, tree);

    if (!hoverInfo) {
      return null;
    }

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
