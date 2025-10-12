# Architecture Diagrams - Embedded Language Aggregation

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code Client                            │
│                     (No changes required)                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ LSP Protocol (JSON-RPC)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                      lsp-toy Host Server                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Request Router                             │    │
│  │  1. Parse request (completion, hover, etc.)            │    │
│  │  2. Check: is cursor inside fence?                     │    │
│  │     YES → Forward to EmbeddedLanguageManager           │    │
│  │     NO  → Handle with host Markdown capabilities       │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         EmbeddedLanguageManager                         │    │
│  │                                                         │    │
│  │  Fence Detection (tree-sitter):                        │    │
│  │    • Traverse AST for fenced_code_block nodes          │    │
│  │    • Extract language, code content, line range        │    │
│  │    • Create virtual URI for each fence                 │    │
│  │                                                         │    │
│  │  Server Lifecycle:                                     │    │
│  │    • Spawn on first use (lazy)                         │    │
│  │    • Reuse across multiple fences                      │    │
│  │    • Mark "dead" on failures                           │    │
│  │    • Clean shutdown on document close                  │    │
│  │                                                         │    │
│  │  Request Forwarding:                                   │    │
│  │    • Project position (host → embedded)                │    │
│  │    • Sync virtual document                             │    │
│  │    • Forward to child server                           │    │
│  │    • Remap ranges (embedded → host)                    │    │
│  │    • Return to client                                  │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ TypeScript   │  │   Python     │  │     Rust     │         │
│  │   Server     │  │   Server     │  │   Server     │  ...    │
│  │              │  │              │  │              │         │
│  │ • stdio IPC  │  │ • stdio IPC  │  │ • stdio IPC  │         │
│  │ • Spawned    │  │ • Spawned    │  │ • Spawned    │         │
│  │ • Persistent │  │ • Persistent │  │ • Persistent │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└──────────────────────────────────────────────────────────────────┘
```

## Request Flow - Completion Example

```
Step 1: User Action
┌─────────────────────────────────────┐
│  User types in Markdown file:       │
│                                      │
│  # Document                          │
│  ```typescript                       │
│  const user = { name: "Alice" };     │
│  user.█ ← cursor here                │
│  ```                                 │
└─────────────────────────────────────┘
                 │
                 ▼
Step 2: LSP Request
┌─────────────────────────────────────┐
│  textDocument/completion             │
│  {                                   │
│    uri: "file:///doc.md",            │
│    position: { line: 4, char: 5 }   │
│  }                                   │
└─────────────────────────────────────┘
                 │
                 ▼
Step 3: Fence Detection
┌─────────────────────────────────────┐
│  findFenceAt(uri, {line:4, char:5}) │
│                                      │
│  Found fence:                        │
│  - lang: "typescript"                │
│  - codeStart: 3                      │
│  - codeEnd: 4                        │
│  - text: "const user = ..."          │
└─────────────────────────────────────┘
                 │
                 ▼
Step 4: Position Projection
┌─────────────────────────────────────┐
│  Host position: {line: 4, char: 5}  │
│  Fence starts at line: 3             │
│  Projected: {line: 1, char: 5}       │
│                                      │
│  (Line 4 - line 3 = line 1 in fence)│
└─────────────────────────────────────┘
                 │
                 ▼
Step 5: Server Spawn (if needed)
┌─────────────────────────────────────┐
│  First TypeScript fence?             │
│  YES → spawn typescript-language-    │
│        server process                │
│  NO  → reuse existing server         │
│                                      │
│  Wait for initialization...          │
│  Receive capabilities                │
└─────────────────────────────────────┘
                 │
                 ▼
Step 6: Document Sync
┌─────────────────────────────────────┐
│  Virtual URI:                        │
│  embedded://doc_md/fence_0_typescript│
│                                      │
│  Send: textDocument/didOpen          │
│  {                                   │
│    uri: "embedded://...",            │
│    text: "const user = ...",         │
│    version: 1                        │
│  }                                   │
└─────────────────────────────────────┘
                 │
                 ▼
Step 7: Forward Request
┌─────────────────────────────────────┐
│  textDocument/completion             │
│  {                                   │
│    uri: "embedded://...",            │
│    position: { line: 1, char: 5 }   │
│  }                                   │
│                                      │
│  Sent to TypeScript server via stdio │
└─────────────────────────────────────┘
                 │
                 ▼
Step 8: TypeScript Processing
┌─────────────────────────────────────┐
│  TypeScript server analyzes:         │
│  "user." at position {1, 5}          │
│                                      │
│  Returns completions:                │
│  - name (property)                   │
│  - toString (method)                 │
│  - hasOwnProperty (method)           │
│  ... (25 items total)                │
└─────────────────────────────────────┘
                 │
                 ▼
Step 9: Range Remapping (future)
┌─────────────────────────────────────┐
│  For each completion item:           │
│  If textEdit.range exists:           │
│    Remap to host coordinates         │
│    {1,0}→{4,0}, {1,5}→{4,5}         │
│                                      │
│  Phase 1: Skip (not critical)        │
└─────────────────────────────────────┘
                 │
                 ▼
Step 10: Response
┌─────────────────────────────────────┐
│  Return to VS Code:                  │
│  [                                   │
│    { label: "name", kind: Property },│
│    { label: "toString", ... },       │
│    ...                               │
│  ]                                   │
└─────────────────────────────────────┘
                 │
                 ▼
Step 11: Display
┌─────────────────────────────────────┐
│  VS Code shows completion menu:      │
│                                      │
│  user.█                              │
│     ┌─────────────────┐             │
│     │ ● name          │             │
│     │ ○ toString()    │             │
│     │ ○ hasOwnProperty│             │
│     └─────────────────┘             │
└─────────────────────────────────────┘
```

## Data Flow - Document Changes

```
Event: User edits fence content
┌─────────────────────────────────────┐
│  Before:                             │
│  const x = 42;                       │
│                                      │
│  After:                              │
│  const x = "hello";                  │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  textDocument/didChange              │
│  (Incremental sync from client)      │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Host server receives change         │
│  1. Invalidate cached parse tree     │
│  2. Re-parse with tree-sitter        │
│  3. Extract fences (updated content) │
│  4. Increment fence versions         │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  For each affected fence:            │
│  fence.version++  (1 → 2)            │
│  fence.text = "const x = \"hello\";" │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Next completion request triggers:   │
│  textDocument/didChange to           │
│  TypeScript server                   │
│  {                                   │
│    uri: "embedded://...",            │
│    version: 2,                       │
│    text: "const x = \"hello\";"      │
│  }                                   │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  TypeScript server updates its cache │
│  Future completions use new content  │
└─────────────────────────────────────┘
```

## State Management

```
Host Server State:
┌─────────────────────────────────────────────┐
│  DocumentManager                             │
│  ├─ documents: Map<uri, TextDocument>       │
│  ├─ trees: Map<uri, Tree>                   │
│  └─ embeddedManager: EmbeddedLanguageManager│
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│  EmbeddedLanguageManager                     │
│                                              │
│  servers: Map<lang, EmbeddedServer>         │
│  ├─ "typescript" → {                        │
│  │    proc: ChildProcess,                   │
│  │    conn: MessageConnection,              │
│  │    initialized: true,                    │
│  │    capabilities: {...},                  │
│  │    docs: Map<virtUri, version>           │
│  │  }                                       │
│  └─ "python" → { ... }                      │
│                                              │
│  fenceCache: Map<docUri, FenceMeta[]>       │
│  └─ "file:///doc.md" → [                    │
│       {                                      │
│         lang: "typescript",                  │
│         codeStart: 3,                        │
│         codeEnd: 10,                         │
│         text: "const x = ...",               │
│         virtUri: "embedded://...",           │
│         version: 2                           │
│       },                                     │
│       { ... fence 2 ... }                    │
│     ]                                        │
└─────────────────────────────────────────────┘
```

## Error Handling Flow

```
Scenario: Language server not installed
┌─────────────────────────────────────┐
│  Fence detected: lang="rust"         │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  pickRuntime("rust")                 │
│  → Entry found in registry           │
│  → cmd: "rust-analyzer"              │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  spawn("rust-analyzer", ...)         │
│  → ENOENT error (not found)          │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  catch error:                        │
│  log: "[EMBED] failed to spawn       │
│        lang=rust: ENOENT"            │
│  return null                         │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  forwardCompletion checks result:    │
│  if (!server) return null            │
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  Completion handler fallback:        │
│  Return host Markdown completions    │
│  (User sees "## Summary", links, etc)│
└─────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  ✓ No crash, graceful degradation    │
└─────────────────────────────────────┘
```

## Lifecycle Diagram

```
Document Lifecycle with Embedded Support:

1. Document Opened
   ├─ Host: didOpen event received
   ├─ Parse with tree-sitter
   └─ Extract fences
      ├─ Fence 1: TypeScript
      ├─ Fence 2: Python
      └─ Fence 3: TypeScript (reuses server)

2. First Interaction with Fence 1
   ├─ User triggers completion
   ├─ Spawn typescript-language-server
   ├─ Initialize (100-500ms)
   ├─ Send didOpen for virtual doc
   └─ Forward completion request

3. Subsequent Interactions
   ├─ Server already running
   ├─ Sync if content changed
   └─ Forward request (~10-100ms)

4. Document Edited
   ├─ Host: didChange event
   ├─ Invalidate fences (version++)
   └─ Next request syncs updated content

5. Document Closed
   ├─ Host: didClose event
   ├─ Send didClose for all virtual docs
   ├─ Remove from fenceCache
   └─ Servers kept alive (idle timeout future)

6. Server Shutdown
   ├─ Host: shutdown request
   ├─ For each embedded server:
   │  ├─ Send shutdown request
   │  ├─ Send exit notification
   │  └─ Kill process
   └─ Clear all caches
```

## Registry System

```
Language Resolution Flow:

User fence: ```js
     │
     ▼
┌─────────────────────────────┐
│  resolveLanguage("js")       │
│  → Check byName map          │
│  → "js" → LangEntry          │
│     {                        │
│       id: "typescript",      │
│       aliases: ["ts", "js"], │
│       node: { cmd: "..." }   │
│     }                        │
└─────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│  pickRuntime(entry)          │
│  → Check environment         │
│  → Not web → use node impl   │
│  → Return: {                 │
│      mode: "node",           │
│      impl: { cmd: "..." }    │
│    }                         │
└─────────────────────────────┘
     │
     ▼
┌─────────────────────────────┐
│  Spawn server with cmd       │
└─────────────────────────────┘

Registry Structure:
┌─────────────────────────────────────┐
│  Default Registry (embeddedRegistry)│
│  ├─ typescript                      │
│  ├─ python                          │
│  ├─ rust                            │
│  └─ ... (10 total)                  │
└─────────────────────────────────────┘
            │
            ▼ (Phase 2: mergeRegistry)
┌─────────────────────────────────────┐
│  User Config (.lsptoy-languages.json)│
│  Overrides/extends defaults          │
└─────────────────────────────────────┘
            │
            ▼ (Phase 2: parseDirectives)
┌─────────────────────────────────────┐
│  Inline Directives                   │
│  <!-- lsptoy:add=lua,perl -->        │
│  Enables additional languages        │
└─────────────────────────────────────┘
```

---

**These diagrams map directly to the implementation in:**
- `server/src/embedded/embeddedManager.ts`
- `server/src/embedded/embeddedRegistry.ts`
- `server/src/capabilities/completion.ts`
- `server/src/capabilities/hover.ts`

**Visual Style:** ASCII art for maximum compatibility and documentation readability.
