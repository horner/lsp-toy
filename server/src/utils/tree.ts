import { Node as SyntaxNode } from 'web-tree-sitter';
import { Range, Position } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

export function visitTree(node: SyntaxNode, visitor: (node: SyntaxNode) => void): void {
  visitor(node);
  const childCount = typeof node.namedChildCount === 'number' ? node.namedChildCount : 0;
  for (let i = 0; i < childCount; i++) {
    const child = node.namedChild(i);
    if (child) {
      visitTree(child, visitor);
    }
  }
}

export function findNamedChild(node: SyntaxNode, type: string): SyntaxNode | null {
  const childCount = typeof node.namedChildCount === 'number' ? node.namedChildCount : 0;
  for (let i = 0; i < childCount; i++) {
    const child = node.namedChild(i);
    if (child && child.type === type) {
      return child;
    }
  }
  return null;
}

export function rangeFromNode(document: TextDocument, node: SyntaxNode): Range {
  return Range.create(document.positionAt(node.startIndex), document.positionAt(node.endIndex));
}

export function getNodeAtPosition(root: SyntaxNode, position: Position): SyntaxNode | null {
  return root.descendantForPosition({
    row: position.line,
    column: position.character
  });
}
