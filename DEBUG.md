# Debugging the LSP Extension

## Controlling Debug Output

Debug logging can be enabled/disabled using the `LSP_TOY_DEBUG` environment variable:

```bash
# Enable debug logging
export LSP_TOY_DEBUG=true

# Disable debug logging
export LSP_TOY_DEBUG=false
```

### In VS Code (F5 Debug)

The extension includes two launch configurations:

1. **"Extension"** - Debug logging **enabled** (default)
2. **"Extension (No Debug Logs)"** - Debug logging **disabled**

Select your preferred configuration from the debug dropdown before pressing F5.

### In Tests

```bash
# Run tests with debug logging (default)
npm test

# Run tests without debug logging (quiet mode)
npm run test:quiet

# Or manually control:
LSP_TOY_DEBUG=false npm test
```

### In Production

When packaging the extension, debug logging is disabled by default unless users set:
```bash
export LSP_TOY_DEBUG=true
```

## Output Comparison

### With Debug Logging (`LSP_TOY_DEBUG=true`)

```
[LSP-TOY SERVER] ========================================
[LSP-TOY SERVER] Debug logging ENABLED
[LSP-TOY SERVER] Server module loading...
[LSP-TOY SERVER] Resolving port...
[LSP-TOY SERVER] Port resolution result: null
[LSP-TOY SERVER] No port specified - using stdio mode
[LSP-TOY SERVER] Creating connection with stdin/stdout...
[LSP-TOY SERVER] initializeLanguageServer called
[LSP-TOY SERVER] Connection assigned
[LSP-TOY SERVER] TextDocuments created
[LSP-TOY SERVER] documentTrees map created
[LSP-TOY SERVER] About to initialize parser...
[LSP-TOY SERVER] Initializing web-tree-sitter...
[LSP-TOY SERVER] Parser.init() complete
[LSP-TOY SERVER] Parser instance created
[LSP-TOY SERVER] Loading WASM from: /path/to/wasm/tree-sitter-markdown.wasm
[LSP-TOY SERVER] Language loaded successfully
[LSP-TOY SERVER] Language set on parser
[LSP-TOY SERVER] Parser initialization complete!
[LSP-TOY SERVER] Parser initialized!
[LSP-TOY SERVER] Setting up document and connection listeners...
[LSP-TOY SERVER] Listeners setup complete - server is ready!
[LSP-TOY SERVER] onInitialize handler called
[LSP-TOY SERVER] Document opened: file:///path/to/file.lsptoy
[LSP-TOY SERVER] validateTextDocument called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Parsing document, length: 488 chars
[LSP-TOY SERVER]   ✓ Parse successful, cached tree
[LSP-TOY SERVER]   Scanning tree for diagnostics...
[LSP-TOY SERVER]   Scanned 11 inline nodes and 0 link nodes
[LSP-TOY SERVER]   ✓ Sending 1 diagnostics
[LSP-TOY SERVER]     - todo : Found TODO item. at line 8
...and much more detail for every LSP operation
```

### Without Debug Logging (`LSP_TOY_DEBUG=false`)

```
[LSP-TOY SERVER] Debug logging DISABLED (set LSP_TOY_DEBUG=true to enable)
Parser initialized successfully with WASM grammar
```

Only critical messages and errors are shown. This is the recommended mode for:
- Production use
- CI/CD pipelines
- Performance testing
- When debug output is too verbose

## Quick Start

1. Press **F5** to launch the extension in debug mode (logging enabled by default)
2. View debug output in the **Output** panel (View → Output)
3. Select **"LSP Toy Language Server"** from the dropdown
4. Open a `.lsptoy` file and interact with it

## Debug Output Channels

### Client Debug Messages
- **Console**: Look in the Debug Console (Ctrl+Shift+Y / Cmd+Shift+Y)
- **Prefix**: `[LSP-TOY CLIENT]`
- Shows: Extension activation, server startup, connection status

### Server Debug Messages
- **Output Panel**: View → Output, select "LSP Toy Language Server"
- **Prefix**: `[LSP-TOY SERVER]`
- Shows: Parser initialization, WASM loading, document handling, LSP requests

## What to Look For

### Normal Startup Sequence

**Client Side:**
```
[LSP-TOY CLIENT] Extension activating...
[LSP-TOY CLIENT] Server module path: <path>
[LSP-TOY CLIENT] Server options configured with stdio transport
[LSP-TOY CLIENT] LanguageClient created, starting...
[LSP-TOY CLIENT] Server started successfully!
```

**Server Side:**
```
[LSP-TOY SERVER] ========================================
[LSP-TOY SERVER] Server module loading...
[LSP-TOY SERVER] Resolving port...
[LSP-TOY SERVER] Port resolution result: null
[LSP-TOY SERVER] No port specified - using stdio mode
[LSP-TOY SERVER] Creating connection with stdin/stdout...
[LSP-TOY SERVER] stdio connection created, initializing language server...
[LSP-TOY SERVER] initializeLanguageServer called
[LSP-TOY SERVER] Connection assigned
[LSP-TOY SERVER] TextDocuments created
[LSP-TOY SERVER] documentTrees map created
[LSP-TOY SERVER] About to initialize parser...
[LSP-TOY SERVER] Initializing web-tree-sitter...
[LSP-TOY SERVER] Parser.init() complete
[LSP-TOY SERVER] Parser instance created
[LSP-TOY SERVER] Loading WASM from: <path>/wasm/tree-sitter-markdown.wasm
[LSP-TOY SERVER] Language loaded successfully
[LSP-TOY SERVER] Language set on parser
[LSP-TOY SERVER] Parser initialization complete!
[LSP-TOY SERVER] Parser initialized!
[LSP-TOY SERVER] Setting up document and connection listeners...
[LSP-TOY SERVER] Listeners setup complete - server is ready!
[LSP-TOY SERVER] onInitialize handler called
Parser initialized successfully with WASM grammar
```

### When You Open a .lsptoy File

```
[LSP-TOY SERVER] Document opened: file:///path/to/file.lsptoy
[LSP-TOY SERVER] validateTextDocument called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Parsing document, length: 488 chars
[LSP-TOY SERVER]   ✓ Parse successful, cached tree for file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Scanning tree for diagnostics...
[LSP-TOY SERVER]   Scanned 11 inline nodes and 0 link nodes
[LSP-TOY SERVER]   ✓ Sending 1 diagnostics
[LSP-TOY SERVER]     - todo : Found TODO item. at line 8
```

### When You Type and Trigger Completions

**Typing `#` to get section completions:**
```
[LSP-TOY SERVER] onCompletion called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Position: line 5, char 0
[LSP-TOY SERVER]   Trigger character: '#'
[LSP-TOY SERVER]   → Providing section header completions
[LSP-TOY SERVER]   ✓ Returning 4 completion items
```

**Typing `[` to get link completions:**
```
[LSP-TOY SERVER] onCompletion called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Position: line 12, char 5
[LSP-TOY SERVER]   Trigger character: '['
[LSP-TOY SERVER]   → Providing link and markdown format completions
[LSP-TOY SERVER]   ✓ Returning 7 completion items
```

**Manual completion (Ctrl+Space):**
```
[LSP-TOY SERVER] onCompletion called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Position: line 3, char 10
[LSP-TOY SERVER]   Trigger character: none (manual invoke)
[LSP-TOY SERVER]   → Providing all default completions (no trigger)
[LSP-TOY SERVER]   ✓ Returning 11 completion items
```

### When You Hover Over Text

**Hovering over a known keyword:**
```
[LSP-TOY SERVER] onHover called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Position: line 7, char 25
[LSP-TOY SERVER]   → Using cached parse tree
[LSP-TOY SERVER]   ✓ Returning hover info: **Rust** — a systems programming language...
```

**Hovering over plain text (no info):**
```
[LSP-TOY SERVER] onHover called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Position: line 2, char 8
[LSP-TOY SERVER]   → Using cached parse tree
[LSP-TOY SERVER]   ⊙ No hover info available at this position
```

### When You Get Code Actions (Quick Fixes)

**With TODO diagnostic present:**
```
[LSP-TOY SERVER] onCodeAction called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Range: {"start":{"line":8,"character":2},"end":{"line":8,"character":6}}
[LSP-TOY SERVER]   Diagnostics count: 1
[LSP-TOY SERVER]   → Creating "Mark TODO as done" action
[LSP-TOY SERVER]   ✓ Returning 1 code actions
```

**With broken link:**
```
[LSP-TOY SERVER] onCodeAction called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Range: {"start":{"line":14,"character":0},"end":{"line":14,"character":35}}
[LSP-TOY SERVER]   Diagnostics count: 1
[LSP-TOY SERVER]   → Creating "Remove broken link" action
[LSP-TOY SERVER]   ✓ Returning 1 code actions
```

### When Semantic Tokens Are Requested

```
[LSP-TOY SERVER] onSemanticTokens called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   → Using cached parse tree
[LSP-TOY SERVER]   Processing 20 lines for semantic tokens
[LSP-TOY SERVER]   ✓ Generated 15 semantic tokens: {"heading":2,"bold":3,"italic":1,"code":1,"link":2}
[LSP-TOY SERVER]   Data length: 75 integers
```

### When Signature Help Is Requested

**Inside a function call:**
```
[LSP-TOY SERVER] onSignatureHelp called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Position: line 18, char 15
[LSP-TOY SERVER]   ✓ Returning signature help with 1 signatures
```

**Outside function context:**
```
[LSP-TOY SERVER] onSignatureHelp called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Position: line 5, char 10
[LSP-TOY SERVER]   ⊙ No signature help available at this position
```

### Document Changes

```
[LSP-TOY SERVER] Document content changed: file:///path/to/file.lsptoy
[LSP-TOY SERVER] validateTextDocument called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Parsing document, length: 512 chars
[LSP-TOY SERVER]   ✓ Parse successful, cached tree for file:///path/to/file.lsptoy
[LSP-TOY SERVER]   Scanning tree for diagnostics...
[LSP-TOY SERVER]   Scanned 12 inline nodes and 1 link nodes
[LSP-TOY SERVER]   ✓ Sending 2 diagnostics
[LSP-TOY SERVER]     - todo : Found TODO item. at line 8
[LSP-TOY SERVER]     - brokenLink : Broken link: ./missing.md at line 14
```

## Debug Symbol Legend

The debug output uses these symbols for quick visual scanning:

- `✓` - Success/completion
- `✗` - Error/failure  
- `→` - Action being taken
- `⊙` - No result (but not an error)
- `-` - List item

## Common Issues

### No Debug Output Visible

1. **Check Debug Console** (Cmd+Shift+Y / Ctrl+Shift+Y)
   - Client logs appear here

2. **Check Output Panel** (Cmd+Shift+U / Ctrl+Shift+U)
   - Select "LSP Toy Language Server" from the dropdown
   - Server logs appear here

3. **Check Extension Host**
   - Look for "Extension Host" in the Output panel
   - Shows extension loading errors

### Server Not Starting

Look for error messages like:
```
[LSP-TOY CLIENT] Failed to start server: <error message>
```

Common causes:
- TypeScript not compiled (`npm run compile`)
- Server file missing at `server/out/server.js`
- Node.js version mismatch

### WASM Not Loading

Look for:
```
[LSP-TOY SERVER] ERROR: Failed to initialize parser: <error>
```

Common causes:
- WASM file missing from `wasm/` directory
- Incorrect path to WASM file
- Corrupted WASM file

## Testing Without VS Code

Run the stdio test to verify the server works:
```bash
npm test
```

This will show all debug output directly in the terminal.

## Debugging the Server Process

1. Press **F5** to start debugging
2. The server runs with `--inspect=6009`
3. In VS Code, go to **Run → Attach to Node Process**
4. Select the server process (PID with `--inspect=6009`)
5. Set breakpoints in `server/src/server.ts`

## Transport Modes

The extension uses **stdio** transport by default:
- Client communicates with server via stdin/stdout
- Most reliable for VS Code extensions
- All communication is logged

To use **TCP** mode (advanced):
```bash
export LSP_PORT=6010
node server/out/server.js
```

Then manually connect with a LSP client.

## Disabling Debug Logging

To reduce noise in production, comment out `logDebug()` calls or add a condition:

```typescript
const DEBUG = process.env.LSP_TOY_DEBUG === 'true';
function logDebug(message: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.error(`[LSP-TOY SERVER] ${message}`, ...args);
  }
}
```
