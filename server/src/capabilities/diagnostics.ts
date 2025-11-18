import { Connection, Diagnostic, DiagnosticSeverity, TextDocumentChangeEvent } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Node as SyntaxNode } from 'web-tree-sitter';
import { DocumentManager } from '../types';
import { parseDocument, getOrParseTree } from '../utils/document';
import { visitTree, findNamedChild, rangeFromNode } from '../utils/tree';
import { findTodoMatches, isLocalLink, linkExists } from '../utils/markdown';
import { t } from '../i18n';
import { logDebug } from '../utils/logging';

export function setupDocumentHandlers(connection: Connection, documentManager: DocumentManager & { textDocuments: any }): void {
  documentManager.textDocuments.onDidOpen((e: TextDocumentChangeEvent<TextDocument>) => {
    logDebug('Document opened:', e.document.uri);
    // Note: onDidChangeContent is also fired when a document is opened, so validation happens there
  });

  documentManager.textDocuments.onDidChangeContent((e: TextDocumentChangeEvent<TextDocument>) => {
    logDebug('Document content changed:', e.document.uri);
    
    // Phase 1: Invalidate embedded fences (increment versions)
    if (documentManager.embeddedManager) {
      documentManager.embeddedManager.invalidateFences(e.document.uri);
    }
    
    validateTextDocument(e.document, connection, documentManager);
  });

  documentManager.textDocuments.onDidClose((event: TextDocumentChangeEvent<TextDocument>) => {
    documentManager.deleteTree(event.document.uri);
    
    // Phase 1: Cleanup embedded documents
    if (documentManager.embeddedManager) {
      documentManager.embeddedManager.closeDocument(event.document.uri);
    }
    
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
  });
}

function validateTextDocument(document: TextDocument, connection: Connection, documentManager: DocumentManager): void {
  logDebug('validateTextDocument called for:', document.uri);
  const diagnostics: Diagnostic[] = [];
  const tree = parseDocument(document, documentManager); // Tree outline disabled by default
  
  if (!tree) {
    logDebug('  ✗ Parse tree not available, sending empty diagnostics');
    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
    return;
  }

  logDebug('  Scanning tree for diagnostics...');
  let inlineNodeCount = 0;
  let linkNodeCount = 0;
  
  const seenInlineNodes = new Set<string>(); // Track visited inline nodes
  
  visitTree(tree.rootNode, node => {
    // Check for TODO in inline nodes (tree-sitter-grammars uses 'inline' instead of 'text')
    if (node.type === 'inline') {
      inlineNodeCount++;
      const nodeKey = `${node.startIndex}-${node.endIndex}`;
      if (seenInlineNodes.has(nodeKey)) {
        logDebug(`  ⚠️  Skipping duplicate inline node at ${node.startIndex}-${node.endIndex}: "${node.text?.substring(0, 50)}"`);
        return; // Skip processing this duplicate node
      }
      seenInlineNodes.add(nodeKey);
      addTodoDiagnostics(document, node, diagnostics);
    }

    if (node.type === 'link') {
      linkNodeCount++;
      addBrokenLinkDiagnostics(document, node, diagnostics);
    }
  });

  logDebug('  Scanned', inlineNodeCount, 'inline nodes and', linkNodeCount, 'link nodes');
  logDebug('  ✓ Sending', diagnostics.length, 'diagnostics');
  if (diagnostics.length > 0) {
    diagnostics.forEach(d => {
      logDebug('    -', d.code, ':', d.message, 'at line', d.range.start.line);
    });
  }
  connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

function addTodoDiagnostics(
  document: TextDocument,
  node: SyntaxNode,
  diagnostics: Diagnostic[]
): void {
  const text: string = node.text ?? '';
  const matches = findTodoMatches(text);
  
  for (const match of matches) {
    const start = node.startIndex + match.index;
    const end = start + match.length;
    const range = { 
      start: document.positionAt(start), 
      end: document.positionAt(end) 
    };
    diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      range,
      message: t('diagnostics.todo.message'),
      source: 'lsp-toy',
      code: 'todo',
      data: { kind: 'todo', keyword: match.keyword }
    });
  }
}

function addBrokenLinkDiagnostics(
  document: TextDocument,
  linkNode: SyntaxNode,
  diagnostics: Diagnostic[]
): void {
  const destinationNode = findNamedChild(linkNode, 'link_destination');
  if (!destinationNode) {
    return;
  }

  const target = (destinationNode.text ?? '').trim();
  if (!target || !isLocalLink(target) || linkExists(document.uri, target)) {
    return;
  }

  const labelNode = findNamedChild(linkNode, 'link_text');
  const label = (labelNode?.text ?? '').trim();
  const range = rangeFromNode(document, linkNode);

  const brokenLinkMsg = t('diagnostics.brokenLink.message');
  diagnostics.push({
    severity: DiagnosticSeverity.Warning,
    range,
    message: `${brokenLinkMsg}: ${target}`,
    source: 'lsp-toy',
    code: 'brokenLink',
    data: { kind: 'brokenLink', label, target }
  });
}
