import { Tree } from 'web-tree-sitter';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Connection, TextDocuments, TextDocumentChangeEvent } from 'vscode-languageserver/node';
import { DocumentManager } from '../types';
import { getParser } from '../parser';
import { logDebug } from './logging';

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

export function parseDocument(document: TextDocument, documentManager: DocumentManager): Tree | null {
  const parser = getParser();
  if (!parser) {
    console.error('[server] Parser not initialized');
    logDebug('  ✗ Parser not initialized!');
    return null;
  }
  const text = document.getText();
  logDebug('  Parsing document, length:', text.length, 'chars');
  const tree = parser.parse(text);
  if (tree) {
    documentManager.setTree(document.uri, tree);
    logDebug('  ✓ Parse successful, cached tree for', document.uri);
  } else {
    logDebug('  ✗ Parse failed!');
  }
  return tree;
}

export function getOrParseTree(document: TextDocument, documentManager: DocumentManager): Tree | null {
  const cached = documentManager.getTree(document.uri);
  if (cached) {
    logDebug('  → Using cached parse tree');
    return cached;
  }
  logDebug('  → No cached tree, parsing now...');
  return parseDocument(document, documentManager);
}
