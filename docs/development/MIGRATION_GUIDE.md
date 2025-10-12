# Migration Guide: Refactoring server.ts

## Overview
This guide explains how the original monolithic `server.ts` was refactored into a modular structure.

## Quick Reference: Where Did My Code Go?

| Original Location | New Location | Notes |
|------------------|--------------|-------|
| Debug logging setup | `utils/logging.ts` | `logDebug()`, `isDebugEnabled()` |
| Port resolution | `utils/network.ts` | `resolvePort()` and helpers |
| i18n initialization | `i18n.ts` | `initializeI18n()`, `t()` |
| Parser initialization | `parser.ts` | `initializeParser()`, `getParser()` |
| Document manager | `utils/document.ts` | `createDocumentManager()` |
| Tree traversal | `utils/tree.ts` | `visitTree()`, `findNamedChild()` |
| Markdown utilities | `utils/markdown.ts` | Link validation, TODO detection, glossary |
| Validation logic | `capabilities/diagnostics.ts` | TODO & broken link diagnostics |
| Completion | `capabilities/completion.ts` | All completion logic |
| Hover | `capabilities/hover.ts` | Hover information |
| Code actions | `capabilities/codeAction.ts` | Quick fixes |
| Semantic tokens | `capabilities/semanticTokens.ts` | Syntax highlighting |
| Signature help | `capabilities/signatureHelp.ts` | Parameter hints |
| Inlay hints | `capabilities/inlayHints.ts` | New capability (placeholder) |
| Document symbols | `capabilities/documentSymbols.ts` | New capability (outline) |

## Detailed Mapping

### 1. Logging Infrastructure

**Before** (in server.ts):
```typescript
const DEBUG_ENABLED = process.env.LSP_TOY_DEBUG === 'true';
function logDebug(message: string, ...args: unknown[]): void { ... }
```

**After** (`utils/logging.ts`):
```typescript
export function logDebug(message: string, ...args: unknown[]): void { ... }
export function isDebugEnabled(): boolean { ... }
```

### 2. Network/Port Resolution

**Before** (in server.ts):
```typescript
function resolvePort(): number | null { ... }
function parsePortFromArgs(args: string[]): number | null { ... }
function parsePort(value: string | undefined | null): number | null { ... }
```

**After** (`utils/network.ts`):
```typescript
export function resolvePort(): number | null { ... }
// Helper functions remain internal
```

### 3. Internationalization

**Before** (in server.ts):
```typescript
async function initializeI18n(locale?: string): Promise<void> { ... }
function t(key: string, options?: ...): string { ... }
```

**After** (`i18n.ts`):
```typescript
export async function initializeI18n(locale?: string): Promise<void> { ... }
export function t(key: string, options?: ...): string { ... }
```

### 4. Parser Setup

**Before** (in server.ts):
```typescript
let parser: Parser | null = null;
let markdownLanguage: Language | null = null;
const semanticLegend: SemanticTokensLegend = { ... };
async function initializeParser(): Promise<void> { ... }
function getParser(): Parser | null { ... }
```

**After** (`parser.ts`):
```typescript
export const semanticLegend: SemanticTokensLegend = { ... };
export async function initializeParser(): Promise<void> { ... }
export function getParser(): Parser | null { ... }
```

### 5. Document Management

**Before** (in server.ts):
```typescript
function createDocumentManager(): DocumentManager { ... }
function parseDocument(document, documentManager): Tree | null { ... }
function getOrParseTree(document, documentManager): Tree | null { ... }
```

**After** (`utils/document.ts`):
```typescript
export function createDocumentManager(): DocumentManager { ... }
export function parseDocument(...): Tree | null { ... }
export function getOrParseTree(...): Tree | null { ... }
```

### 6. Tree Utilities

**Before** (in server.ts):
```typescript
function visitTree(node, visitor): void { ... }
function findNamedChild(node, type): SyntaxNode | null { ... }
function rangeFromNode(document, node): Range { ... }
function getNodeAtPosition(root, position): SyntaxNode | null { ... }
```

**After** (`utils/tree.ts`):
```typescript
export function visitTree(node, visitor): void { ... }
export function findNamedChild(node, type): SyntaxNode | null { ... }
export function rangeFromNode(document, node): Range { ... }
export function getNodeAtPosition(root, position): SyntaxNode | null { ... }
```

### 7. Markdown Helpers

**Before** (in server.ts):
```typescript
function isLocalLink(target): boolean { ... }
function linkExists(uri, target): boolean { ... }
function getWordAt(text, offset): string | null { ... }
function getTodoKeywords(): string[] { ... }
function findTodoMatches(text): Array<...> { ... }
function getGlossary(): Record<string, string> { ... }
```

**After** (`utils/markdown.ts`):
```typescript
export function isLocalLink(target): boolean { ... }
export function linkExists(uri, target): boolean { ... }
export function getWordAt(text, offset): string | null { ... }
export function getTodoKeywords(): string[] { ... }
export function findTodoMatches(text): Array<...> { ... }
export function getGlossary(): Record<string, string> { ... }
```

### 8. Diagnostics

**Before** (in server.ts):
```typescript
function setupDocumentHandlers(connection, documentManager) { ... }
function validateTextDocument(...) { ... }
function addTodoDiagnostics(...) { ... }
function addBrokenLinkDiagnostics(...) { ... }
```

**After** (`capabilities/diagnostics.ts`):
```typescript
export function setupDocumentHandlers(connection, documentManager) { ... }
// Helper functions remain internal
```

### 9. Completion

**Before** (in server.ts):
```typescript
function registerCompletionProvider(connection, documentManager) {
  connection.onCompletion((params) => { ... });
}
```

**After** (`capabilities/completion.ts`):
```typescript
export function registerCompletionProvider(connection, documentManager) {
  connection.onCompletion((params) => { ... });
}
```

### 10. Hover

**Before** (in server.ts):
```typescript
function registerHoverProvider(connection, documentManager) {
  connection.onHover((params) => { ... });
}
function getHoverInfo(...) { ... }
function getLinkHover(...) { ... }
```

**After** (`capabilities/hover.ts`):
```typescript
export function registerHoverProvider(connection, documentManager) {
  connection.onHover((params) => { ... });
}
// Helper functions remain internal
```

### 11. Code Actions

**Before** (in server.ts):
```typescript
function registerCodeActionProvider(connection, documentManager) {
  connection.onCodeAction((params) => { ... });
}
```

**After** (`capabilities/codeAction.ts`):
```typescript
export function registerCodeActionProvider(connection, documentManager) {
  connection.onCodeAction((params) => { ... });
}
```

### 12. Semantic Tokens

**Before** (in server.ts):
```typescript
function registerSemanticTokensProvider(connection, documentManager) {
  connection.languages.semanticTokens.on((params) => { ... });
}
function pushNodeToken(...) { ... }
function highlightTodoTokens(...) { ... }
function pushRange(...) { ... }
function getTokenTypeIndex(tokenType): number { ... }
```

**After** (`capabilities/semanticTokens.ts`):
```typescript
export function registerSemanticTokensProvider(connection, documentManager) {
  connection.languages.semanticTokens.on((params) => { ... });
}
// Helper functions remain internal
```

### 13. Signature Help

**Before** (in server.ts):
```typescript
function registerSignatureHelpProvider(connection, documentManager) {
  connection.onSignatureHelp((params) => { ... });
}
function buildSignatureHelp(...) { ... }
```

**After** (`capabilities/signatureHelp.ts`):
```typescript
export function registerSignatureHelpProvider(connection, documentManager) {
  connection.onSignatureHelp((params) => { ... });
}
// Helper functions remain internal
```

### 14. New Capabilities

**Inlay Hints** (`capabilities/inlayHints.ts`):
```typescript
export function registerInlayHintsProvider(connection, documentManager) {
  connection.languages.inlayHint.on((params) => { ... });
}
```

**Document Symbols** (`capabilities/documentSymbols.ts`):
```typescript
export function registerDocumentSymbolsProvider(connection, documentManager) {
  connection.onDocumentSymbol((params) => { ... });
}
```

## Import Changes

### Before (everything in one file):
```typescript
// Everything was in the same file - no imports needed
```

### After (modular imports):
```typescript
// In server.ts
import { initializeParser, semanticLegend } from './parser';
import { initializeI18n } from './i18n';
import { createDocumentManager } from './utils/document';
import { logDebug, isDebugEnabled } from './utils/logging';
import { resolvePort } from './utils/network';
import { setupDocumentHandlers } from './capabilities/diagnostics';
// ... etc

// In capability files
import { DocumentManager } from '../types';
import { logDebug } from '../utils/logging';
import { getOrParseTree } from '../utils/document';
// ... etc
```

## Type Safety Improvements

### Before:
```typescript
// No centralized type definitions
// Types were implicit or inline
```

### After (`types.ts`):
```typescript
export interface DocumentManager {
  documents: Map<string, TextDocument>;
  trees: Map<string, Tree>;
  get(uri: string): TextDocument | undefined;
  getTree(uri: string): Tree | undefined;
  // ... etc
}

export interface Glossary {
  [key: string]: string;
}
```

## Adding a New Capability

### Before:
1. Find the right place in the 800+ line file
2. Add the handler function
3. Register it in `initializeLanguageServer`
4. Update capabilities in `onInitialize`

### After:
1. Create `capabilities/newCapability.ts`:
```typescript
import { Connection } from 'vscode-languageserver/node';
import { DocumentManager } from '../types';
import { logDebug } from '../utils/logging';

export function registerNewCapabilityProvider(
  connection: Connection, 
  documentManager: DocumentManager
): void {
  connection.onNewCapability((params) => {
    logDebug('onNewCapability called');
    // Implementation here
  });
}
```

2. Import and register in `server.ts`:
```typescript
import { registerNewCapabilityProvider } from './capabilities/newCapability';

// In initializeLanguageServer():
registerNewCapabilityProvider(connection, documentManager);
```

3. Update capabilities in `onInitialize` if needed:
```typescript
return {
  capabilities: {
    // ... existing capabilities
    newCapability: true
  }
};
```

## Testing Strategy

### Unit Testing Individual Capabilities

**Before**: Had to test everything together

**After**: Can test each capability independently

Example test for `capabilities/completion.ts`:
```typescript
import { registerCompletionProvider } from '../src/capabilities/completion';

describe('Completion Provider', () => {
  it('should provide header completions on # trigger', () => {
    const mockConnection = createMockConnection();
    const mockDocManager = createMockDocumentManager();
    
    registerCompletionProvider(mockConnection, mockDocManager);
    
    // Test specific scenarios
  });
});
```

## Common Patterns

### Pattern 1: Capability Registration
```typescript
export function registerXProvider(
  connection: Connection,
  documentManager: DocumentManager
): void {
  connection.onX((params: XParams) => {
    logDebug('onX called');
    
    const document = documentManager.get(params.textDocument.uri);
    if (!document) {
      logDebug('  ✗ Document not found');
      return null;
    }
    
    // Implementation
    
    return result;
  });
}
```

### Pattern 2: Tree-based Analysis
```typescript
const tree = getOrParseTree(document, documentManager);
if (!tree) {
  return null;
}

visitTree(tree.rootNode, node => {
  if (node.type === 'target_type') {
    // Process node
  }
});
```

### Pattern 3: Position-based Queries
```typescript
const offset = document.offsetAt(position);
const node = getNodeAtPosition(tree.rootNode, position);
```

## Rollback Instructions

If you need to rollback to the original monolithic structure:

```bash
cd /Volumes/Case/prj/lsp-toy/lsp-toy/server/src
rm server.ts
mv server.ts.backup server.ts
rm -rf capabilities/ utils/
rm parser.ts i18n.ts types.ts
npm run compile
```

## Benefits Realized

1. **Reduced file size**: ~150 lines per file vs 800+ lines
2. **Clear boundaries**: Each capability is isolated
3. **Easier navigation**: Find features by filename
4. **Better testing**: Unit test individual capabilities
5. **Parallel development**: Multiple developers can work simultaneously
6. **Reduced cognitive load**: Understand one capability at a time

## Questions?

See also:
- `REFACTORING_SUMMARY.md` - Overview of changes
- `ARCHITECTURE.md` - Visual architecture diagrams
- Original backup: `server/src/server.ts.backup`
