# Debugging the LSP Extension

## Quick Start

1. Press **F5** to launch the extension in debug mode
2. View debug output in the **Output** panel (View → Output)
3. Select **"LSP Toy Language Server"** from the dropdown

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
[LSP-TOY SERVER] Document content changed: file:///path/to/file.lsptoy
```

### When LSP Features Are Used

```
[LSP-TOY SERVER] onCompletion called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER] onHover called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER] onCodeAction called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER] onSemanticTokens called for: file:///path/to/file.lsptoy
[LSP-TOY SERVER] onSignatureHelp called for: file:///path/to/file.lsptoy
```

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
