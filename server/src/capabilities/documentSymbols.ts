import { Connection, DocumentSymbolParams, DocumentSymbol, SymbolKind, Range } from 'vscode-languageserver/node';
import { DocumentManager } from '../types';
import { getOrParseTree } from '../utils/document';
import { visitTree, rangeFromNode } from '../utils/tree';
import { logDebug } from '../utils/logging';

export function registerDocumentSymbolsProvider(connection: Connection, documentManager: DocumentManager): void {
  connection.onDocumentSymbol((params: DocumentSymbolParams): DocumentSymbol[] => {
    logDebug('onDocumentSymbol called for:', params.textDocument.uri);
    
    const document = documentManager.get(params.textDocument.uri);
    if (!document) {
      logDebug('  ✗ Document not found');
      return [];
    }

    const tree = getOrParseTree(document, documentManager);
    if (!tree) {
      logDebug('  ✗ Parse tree not available');
      return [];
    }

    const symbols: DocumentSymbol[] = [];
    
    visitTree(tree.rootNode, node => {
      if (node.type === 'atx_heading' || node.type === 'setext_heading') {
        const headingText = node.text?.trim() || 'Heading';
        const range = rangeFromNode(document, node);
        
        symbols.push({
          name: headingText,
          kind: SymbolKind.String,
          range,
          selectionRange: range
        });
      }
    });

    logDebug('  ✓ Returning', symbols.length, 'document symbols');
    return symbols;
  });
}
