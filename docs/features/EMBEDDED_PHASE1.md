# Embedded Language Aggregation - Phase 1 Implementation

**Status:** ✅ Complete  
**Date:** October 12, 2025  
**Version:** 1.0.0

## Overview

Phase 1 implements the core infrastructure for embedded language server support within Markdown fenced code blocks. The system detects language-specific code blocks and forwards LSP requests to appropriate child language servers, providing rich IDE features without client modifications.

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Host LSP Server                         │
│                     (lsp-toy/Markdown)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         EmbeddedLanguageManager                     │    │
│  │  • Fence detection via tree-sitter                 │    │
│  │  • Position projection (host ↔ embedded)           │    │
│  │  • Server lifecycle management                     │    │
│  │  • Request forwarding & range remapping            │    │
│  └────────────────────────────────────────────────────┘    │
│                          ↓                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ TypeScript   │  │   Python     │  │     Rust     │     │
│  │   Server     │  │   Server     │  │   Server     │ ... │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Components

1. **embeddedRegistry.ts** - Language registry with dual-mode support (web/node)
2. **embeddedManager.ts** - Core manager for spawning and coordinating servers
3. **server.ts** - Integration with main LSP server
4. **Capability handlers** - Updated to check for embedded contexts

## Phase 1 Capabilities

| Capability | Status | Notes |
|------------|--------|-------|
| textDocumentSync (Incremental) | ✅ | Virtual docs synced with full-text replacement |
| completionProvider | ✅ | Forwarded with context preservation |
| hoverProvider | ✅ | Forwarded with range remapping |
| codeActionProvider | 🔜 Phase 3 | Requires diagnostics forwarding |
| inlayHintProvider | 🔜 Phase 4 | Requires capability probing |
| documentSymbolProvider | 🔜 Phase 2 | Symbol tree merging |
| signatureHelpProvider | 🔜 Phase 2 | Simple forwarding |
| semanticTokensProvider | 🔜 Phase 5 | Token merging with offset adjustment |

## Supported Languages (Default Registry)

| Language | Aliases | Web Support | Node Command | Capabilities |
|----------|---------|-------------|--------------|--------------|
| TypeScript | ts, js, javascript | ✅ Worker | typescript-language-server | Full |
| Python | py | ✅ Worker | pyright-langserver | Full |
| Rust | rs | 🧪 WASM | rust-analyzer | Full + inlay |
| Go | golang | ❌ | gopls | Full |
| Java | - | ❌ | jdtls | Full |
| C# | cs, c# | ❌ | omnisharp | Full |
| Bash | sh, shell | ❌ | bash-language-server | Completion/hover |
| SQL | - | ❌ | sql-language-server | Completion/hover |
| JSON | - | ❌ | vscode-json-languageserver | Full |
| YAML | yml | ❌ | yaml-language-server | Full |

**Note:** Web worker implementations are registered but not yet active in Phase 1 (gracefully degrade to node).

## Usage Examples

### Basic Fenced Code Block

```markdown
# My Project

Here's some TypeScript code:

\```typescript
interface User {
  name: string;
  email: string;
}

const user: User = {
  name: "Alice",
  // Hover over 'name' → embedded TypeScript hover
  // Type '.' after user → embedded completions
}
\```
```

**Behavior:**
- Cursor inside fence → TypeScript completions/hover
- Cursor outside fence → Markdown completions/hover
- No client configuration needed

### Multiple Languages

```markdown
## Backend Code

\```python
def calculate_tax(amount: float) -> float:
    # Hover over 'float' → Python type info
    return amount * 0.15
\```

## Frontend Code

\```typescript
function formatPrice(amount: number): string {
    // Type '.' after 'amount' → TypeScript number methods
    return `$${amount.toFixed(2)}`;
}
\```
```

**Behavior:**
- Each fence spawns independent language server
- Server reused across multiple fences of same language
- Proper isolation between fence contexts

## Request Flow

### Completion Request Example

```
1. User types in TypeScript fence at line 15, char 10
2. Client sends: textDocument/completion { uri: doc.md, position: {15,10} }
3. Host server receives request
4. Manager checks: findFenceAt(uri, {15,10}) → finds TypeScript fence
5. Manager projects: position {15,10} → {3,10} (fence starts at line 12)
6. Manager ensures: TypeScript server spawned & initialized
7. Manager syncs: didOpen/didChange for virtual doc (embedded://doc_md/fence_0_typescript)
8. Manager forwards: completion { uri: embedded://..., position: {3,10} }
9. TypeScript server responds: [CompletionItem, ...]
10. Manager remaps: ranges adjusted back to host coordinates (future)
11. Host server returns: completion items to client
```

### Hover Request Example

```
1. User hovers over TypeScript code at line 14, char 5
2. Client sends: textDocument/hover { uri: doc.md, position: {14,5} }
3. Manager projects: {14,5} → {2,5} in embedded doc
4. Manager forwards to TypeScript server
5. TypeScript responds: { contents: "...", range: {...} }
6. Manager remaps: range {2,5}-{2,10} → {14,5}-{14,10}
7. Host returns remapped hover to client
```

## Logging

All embedded operations use consistent `[EMBED]` prefix:

```
[EMBED] detected fence lang=typescript lines=12-20
[EMBED] spawning lang=typescript cmd=typescript-language-server
[EMBED] initialized lang=typescript capabilities=["completion","hover",...]
[EMBED] didOpen lang=typescript uri=embedded://doc_md/fence_0_typescript version=1
[EMBED] forward completion lang=typescript pos=3:10
[EMBED] completion result lang=typescript count=25
[EMBED] skip lang=go reason=no backend available
```

Enable debug logging with `LSPTOY_DEBUG=1` environment variable.

## Configuration

### Workspace Registry (.lsptoy-languages.json)

Override or extend default languages in workspace root:

```json
{
  "sql": {
    "cmd": "sql-language-server",
    "args": ["up", "--method", "stdio"]
  },
  "lua": {
    "cmd": "lua-language-server"
  },
  "python": {
    "workerScript": "/workers/pyrightWorker.js"
  }
}
```

### Inline Directive (Future - Phase 2)

Enable additional languages per document:

```markdown
<!-- lsptoy:add=python,sql,rust -->

Your document content with ```python blocks...
```

## Error Handling

### Spawn Failures
- Logged: `[EMBED] failed to spawn lang=X: <error>`
- Server marked "dead" to prevent retry storms
- Future: cooldown period before retry

### Unsupported Languages
- Logged: `[EMBED] skip lang=X: unsupported/no backend`
- Gracefully falls back to host Markdown features
- No errors surfaced to user

### Capability Unavailable
- Check: `server.capabilities?.completionProvider` before forwarding
- Logged: `[EMBED] completion unavailable lang=X`
- Falls back to host handler

### Range Remap Failures (Future)
- Out-of-bounds ranges dropped
- Logged with warning
- Continue processing remaining items

## Performance Considerations

### Lazy Spawning
- Servers only spawned when cursor enters fence
- Reused across multiple fences of same language
- Minimal overhead for documents without embedded code

### Sync Strategy
- Virtual documents use full-text replacement (simple, reliable)
- Version numbers prevent redundant syncs
- Incremental sync considered for Phase 6

### Resource Management
- Each language server runs as separate process
- Future: idle prune after N minutes inactivity
- Future: configurable memory/CPU limits

## Testing

### Manual Testing

1. Create test document:

```markdown
# Test Document

\```typescript
interface Point {
  x: number;
  y: number;
}

const p: Point = { x: 0, y: 0 };
// Test: hover over 'Point' - should show interface definition
// Test: type 'p.' - should show x and y completions
\```

\```python
def greet(name: str) -> str:
    return f"Hello, {name}!"

# Test: hover over 'str' - should show Python type info
# Test: type after '.' - should show string methods
\```
```

2. Open in VS Code with lsp-toy extension
3. Verify completion/hover behavior inside fences
4. Check debug logs for `[EMBED]` messages

### Automated Testing (Future)

```bash
npm run test:embedded
```

Test suite will verify:
- Fence detection accuracy
- Position projection correctness
- Server spawn/shutdown lifecycle
- Request forwarding & response mapping
- Error handling & fallback behavior

## Known Limitations (Phase 1)

1. **Web worker mode** - Registered but not implemented (node-only)
2. **TextEdit range remapping** - Completion edits not yet adjusted
3. **Diagnostics** - Not forwarded from embedded servers
4. **Workspace registry** - Defined but not loaded
5. **Inline directive** - Spec'd but not parsed
6. **Symbol aggregation** - Phase 2
7. **Semantic token merging** - Phase 5

## Next Steps (Phase 2)

1. Implement document symbols forwarding
2. Add symbol tree aggregation (host + embedded)
3. Implement signature help forwarding
4. Parse inline directive from HTML comments
5. Load workspace `.lsptoy-languages.json` registry
6. Add alias resolution (js→javascript, py→python)
7. Write automated test suite

## Migration Guide

### For Extension Users
- **No changes required** - feature is transparent
- Install language servers you want to use (e.g., `npm i -g typescript-language-server`)
- Restart LSP after installing new language servers

### For Contributors
- New files in `server/src/embedded/`
- Updated: `types.ts`, `server.ts`, completion/hover handlers
- Follow `[EMBED]` logging convention for consistency

## Troubleshooting

### Language server not found
**Symptom:** `[EMBED] failed to spawn lang=X: ENOENT`  
**Solution:** Install language server binary:
```bash
# TypeScript
npm install -g typescript-language-server

# Python
pip install pyright

# Rust
rustup component add rust-analyzer
```

### Completions not appearing
**Symptom:** No completions inside fence  
**Check:**
1. Language server installed? → Check terminal for spawn errors
2. Correct language id? → Use standard names (typescript, python, rust)
3. Server capabilities? → Check `[EMBED] initialized` log for capabilities list

### Server crashes
**Symptom:** `[EMBED] process exited lang=X code=1`  
**Check:**
1. Server stderr → Look for `[EMBED] stderr lang=X: ...`
2. Binary compatibility → Ensure server matches your OS/arch
3. Workspace issues → Some servers require valid workspace root

## API Reference

### EmbeddedLanguageManager

```typescript
class EmbeddedLanguageManager {
  constructor(connection: Connection, workspaceRoot?: string);
  
  // Fence management
  extractFences(docUri: string, tree: Tree, document: TextDocument): FenceMeta[];
  findFenceAt(docUri: string, position: Position): FenceMeta | undefined;
  
  // Position mapping
  projectPosition(hostPos: Position, fence: FenceMeta): Position;
  remapPosition(embeddedPos: Position, fence: FenceMeta): Position;
  
  // Request forwarding
  forwardCompletion(params: CompletionParams, fence: FenceMeta): Promise<CompletionItem[] | null>;
  forwardHover(params: HoverParams, fence: FenceMeta): Promise<Hover | null>;
  
  // Lifecycle
  invalidateFences(docUri: string): void;
  closeDocument(docUri: string): void;
  shutdown(): Promise<void>;
  
  // Diagnostics
  getStats(): { activeServers: number; languages: string[]; totalFences: number };
}
```

### Registry Functions

```typescript
// Language resolution
function resolveLanguage(langRaw: string): LangEntry | undefined;
function pickRuntime(langRaw: string): ResolvedRuntime;

// Registry modification
function mergeRegistry(userEntries: LangEntry[]): void;
function getRegisteredLanguages(): string[];
```

## References

- [LSP Specification](https://microsoft.github.io/language-server-protocol/)
- [Tree-sitter Markdown Grammar](https://github.com/tree-sitter-grammars/tree-sitter-markdown)
- [VSCode Language Server Node](https://github.com/microsoft/vscode-languageserver-node)

---

**Contributors:** GitHub Copilot  
**License:** MIT  
**Project:** lsp-toy
