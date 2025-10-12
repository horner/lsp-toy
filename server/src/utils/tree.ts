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

/**
 * Generate a tree outline visualization (for debugging)
 * Limits depth and sanitizes text to prevent protocol errors
 */
export function generateTreeOutline(node: SyntaxNode, maxDepth: number = 3): string {
  const lines: string[] = [];
  const MAX_LINES = 200; // Prevent overwhelming output
  
  function sanitizeText(text: string): string {
    // Remove non-printable characters and limit length
    return text
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .replace(/\n/g, ' ') // Replace newlines with space
      .replace(/\s+/g, ' ') // Collapse whitespace
      .trim()
      .substring(0, 40);
  }
  
  function traverse(node: SyntaxNode, depth: number, prefix: string = '') {
    if (depth > maxDepth || lines.length >= MAX_LINES) {
      return;
    }
    
    const indent = '  '.repeat(depth);
    const nodeInfo = `${node.type}`;
    const position = `[${node.startPosition.row}:${node.startPosition.column}-${node.endPosition.row}:${node.endPosition.column}]`;
    
    // Show sanitized text preview for leaf nodes only
    let preview = '';
    if (node.namedChildCount === 0 && node.text.length > 0 && node.text.length <= 100) {
      const text = sanitizeText(node.text);
      if (text.length > 0) {
        preview = ` "${text}"`;
      }
    }
    
    lines.push(`${indent}${prefix}${nodeInfo} ${position}${preview}`);
    
    // Recurse to named children (using plain ASCII for LSP protocol safety)
    const childCount = node.namedChildCount || 0;
    for (let i = 0; i < childCount && lines.length < MAX_LINES; i++) {
      const child = node.namedChild(i);
      if (child) {
        const isLast = i === childCount - 1;
        const childPrefix = isLast ? '`-- ' : '|-- '; // Plain ASCII tree characters
        traverse(child, depth + 1, childPrefix);
      }
    }
  }
  
  lines.push('Document Tree Outline:');
  traverse(node, 0);
  
  if (lines.length >= MAX_LINES) {
    lines.push('... (output truncated)');
  }
  
  return lines.join('\n');
}

/**
 * Generate a detailed tree outline with content excerpts (for debug logging)
 * Shows actual document text to make tree structure mapping clear
 */
export function generateDetailedTreeOutline(node: SyntaxNode): string {
  const lines: string[] = [];
  const MAX_LINES = 150; // Allow more lines for detailed output
  
  function getContentPreview(text: string, maxLength: number = 60): string {
    // Clean and preview the content
    const cleaned = text
      .replace(/\r\n/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleaned.length === 0) return '[empty]';
    if (cleaned.length <= maxLength) return `"${cleaned}"`;
    return `"${cleaned.substring(0, maxLength)}..."`;
  }
  
  function getLineByLineContent(text: string, startRow: number, maxLines: number = 10): string[] {
    const textLines = text.split('\n');
    const result: string[] = [];
    
    for (let i = 0; i < Math.min(textLines.length, maxLines); i++) {
      const lineNum = startRow + i;
      const content = textLines[i].trim();
      if (content.length > 0) {
        const preview = content.length > 70 ? content.substring(0, 70) + '...' : content;
        result.push(`      Line ${lineNum}: ${preview}`);
      } else {
        result.push(`      Line ${lineNum}: [blank]`);
      }
    }
    
    if (textLines.length > maxLines) {
      result.push(`      ... (${textLines.length - maxLines} more lines)`);
    }
    
    return result;
  }
  
  function traverse(node: SyntaxNode, depth: number, prefix: string = '') {
    if (lines.length >= MAX_LINES) {
      return;
    }
    
    const indent = '  '.repeat(depth);
    const nodeType = node.type;
    const startPos = `${node.startPosition.row}:${node.startPosition.column}`;
    const endPos = `${node.endPosition.row}:${node.endPosition.column}`;
    const position = `[${startPos}-${endPos}]`;
    const lineCount = node.endPosition.row - node.startPosition.row + 1;
    
    // Determine if this is a block-level node that should show line-by-line content
    const blockLevelNodes = [
      'section', 'atx_heading', 'paragraph', 'fenced_code_block', 
      'list', 'list_item', 'block_quote', 'thematic_break'
    ];
    const isBlockLevel = blockLevelNodes.includes(nodeType);
    
    // Get content preview - show more for leaf nodes, less for containers
    let content = '';
    if (node.namedChildCount === 0) {
      // Leaf node - show full preview
      content = ` = ${getContentPreview(node.text, 80)}`;
    } else if (node.text.length < 100) {
      // Small container - show preview
      content = ` = ${getContentPreview(node.text, 60)}`;
    } else {
      // Large container - show size
      content = ` (${lineCount} line${lineCount === 1 ? '' : 's'}, ${node.text.length} chars)`;
    }
    
    lines.push(`${indent}${prefix}${nodeType} ${position}${content}`);
    
    // For block-level nodes with multiple lines, show line-by-line breakdown
    if (isBlockLevel && lineCount > 1 && lineCount <= 20 && depth <= 2) {
      const lineBreakdown = getLineByLineContent(node.text, node.startPosition.row, 15);
      lines.push(...lineBreakdown);
    }
    
    // Recurse to named children
    const childCount = node.namedChildCount || 0;
    if (childCount > 0 && lines.length < MAX_LINES) {
      for (let i = 0; i < childCount && lines.length < MAX_LINES; i++) {
        const child = node.namedChild(i);
        if (child) {
          const isLast = i === childCount - 1;
          const childPrefix = isLast ? '`-- ' : '|-- ';
          traverse(child, depth + 1, childPrefix);
        }
      }
    }
  }
  
  lines.push('=== DETAILED DOCUMENT TREE (with line-level content) ===');
  lines.push('');
  traverse(node, 0);
  
  if (lines.length >= MAX_LINES) {
    lines.push('');
    lines.push('... (output truncated for brevity)');
  }
  
  lines.push('');
  lines.push('Legend:');
  lines.push('  [start:col-end:col] = position range (0-indexed)');
  lines.push('  "text..." = actual content from document');
  lines.push('  (N lines, M chars) = container node size');
  lines.push('  Line N: ... = line-by-line breakdown for block nodes');
  lines.push('=========================================================');
  
  return lines.join('\n');
}
