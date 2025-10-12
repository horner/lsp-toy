import { Tree } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Connection, TextDocuments, TextDocumentChangeEvent } from 'vscode-languageserver/node';
import { DocumentManager } from '../types';
import { getParser } from '../parser';
import { logDebug } from './logging';
import { generateTreeOutline } from './tree';

export function createDocumentManager(): DocumentManager & { textDocuments: TextDocuments<TextDocument> } {
  const textDocuments = new TextDocuments(TextDocument);
  const trees = new Map<string, Tree>();

  return {
    documents: new Map<string, TextDocument>(),
    trees,
    textDocuments,

    get(uri: string): TextDocument | undefined {
      return textDocuments.get(uri);
    },

    getTree(uri: string): Tree | undefined {
      return trees.get(uri);
    },

    setTree(uri: string, tree: Tree): void {
      trees.set(uri, tree);
    },

    deleteTree(uri: string): void {
      trees.delete(uri);
    },

    listen(connection: Connection): void {
      textDocuments.listen(connection);
    }
  };
}

export function parseDocument(document: TextDocument, documentManager: DocumentManager, showOutline: boolean = false): Tree | null {
  const parser = getParser();
  if (!parser) {
    console.error('[server] Parser not initialized');
    return null;
  }
  const text = document.getText();
  const tree = parser.parse(text);
  if (tree) {
    documentManager.setTree(document.uri, tree);
    
    // Show tree outline if requested (disabled by default for performance)
    if (showOutline) {
      try {
        const outline = generateTreeOutline(tree.rootNode, 3);
        console.log('\n' + outline + '\n');
      } catch (err) {
        console.error('[DEBUG] Tree outline generation failed:', err);
      }
    }
    
    // Phase 1: Extract embedded fences after parsing
    if (documentManager.embeddedManager) {
      try {
        documentManager.embeddedManager.extractFences(document.uri, tree, document);
      } catch (err) {
        logDebug('[EMBED] Fence extraction failed:', err);
      }
    }
  }
  return tree;
}

/**
 * Generate and log the tree outline for a document (for debugging purposes)
 */
export function showDocumentOutline(document: TextDocument, documentManager: DocumentManager): void {
  const tree = getOrParseTree(document, documentManager);
  if (!tree) {
    console.log('[DEBUG] No tree available for document:', document.uri);
    return;
  }
  
  try {
    const outline = generateTreeOutline(tree.rootNode, 3);
    console.log('\n=== Document Tree Outline ===');
    console.log('URI:', document.uri);
    console.log(outline);
    console.log('=============================\n');
  } catch (err) {
    console.error('[DEBUG] Failed to generate tree outline:', err);
  }
}

export function getOrParseTree(document: TextDocument, documentManager: DocumentManager): Tree | null {
  const cached = documentManager.getTree(document.uri);
  if (cached) {
    return cached;
  }
  return parseDocument(document, documentManager);
}
