# Embedded Language Support

> **Status:** Phase 1 Complete ✅  
> **Version:** 1.0.0

## What is it?

Embedded language support allows lsp-toy to provide rich IDE features (completions, hover info, etc.) for code inside Markdown fenced code blocks. Each programming language gets its own dedicated language server, providing the same experience as editing a standalone file.

## Quick Start

### 1. Install Language Servers

Install the language servers you want to use:

```bash
# TypeScript/JavaScript
npm install -g typescript-language-server typescript

# Python
pip install pyright

# Rust (if you have rustup)
rustup component add rust-analyzer

# Go
go install golang.org/x/tools/gopls@latest

# JSON
npm install -g vscode-langservers-extracted

# YAML
npm install -g yaml-language-server
```

### 2. Use Fenced Code Blocks

Just write normal Markdown with fenced code blocks:

````markdown
# My Document

Here's some TypeScript:

```typescript
interface User {
  name: string;
  email: string;
}

const user: User = {
  name: "Alice",
  // Place cursor here and type '.' for completions!
}
```
````

### 3. Get Rich IDE Features

- **Completions** - Trigger with Ctrl+Space or by typing (`.`, `->`, etc.)
- **Hover Info** - Hover over symbols to see type information, docs
- **Error Detection** - Syntax errors highlighted in real-time
- **More Coming** - Signature help, symbols, diagnostics in future phases

## Supported Languages

| Language | Install Command | Status |
|----------|----------------|--------|
| TypeScript/JavaScript | `npm i -g typescript-language-server` | ✅ Full support |
| Python | `pip install pyright` | ✅ Full support |
| Rust | `rustup component add rust-analyzer` | ✅ Full support |
| Go | `go install golang.org/x/tools/gopls@latest` | ✅ Full support |
| Java | Platform dependent | ✅ Full support |
| C# | Platform dependent | ✅ Full support |
| Bash/Shell | `npm i -g bash-language-server` | ⚠️ Basic support |
| SQL | `npm i -g sql-language-server` | ⚠️ Basic support |
| JSON | `npm i -g vscode-langservers-extracted` | ✅ Full support |
| YAML | `npm i -g yaml-language-server` | ✅ Full support |

### Language Aliases

These aliases are automatically recognized:

- `ts`, `javascript`, `js` → TypeScript
- `py` → Python
- `rs` → Rust
- `golang` → Go
- `cs`, `c#` → C#
- `sh`, `shell` → Bash
- `yml` → YAML

## How It Works

```
┌──────────────────────────────────────────────────┐
│  Your Markdown Document                          │
│                                                  │
│  # Title                                         │
│                                                  │
│  ```typescript                    ◄── Detected! │
│  const x: number = 42;                           │
│  ```                                             │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│  lsp-toy (Host Server)                           │
│                                                  │
│  1. Parse tree-sitter AST                       │
│  2. Extract fenced code blocks                  │
│  3. Spawn TypeScript server                     │
│  4. Forward requests inside fence               │
│  5. Return results to VS Code                   │
└──────────────────────────────────────────────────┘
                    ↓
┌──────────────────────────────────────────────────┐
│  TypeScript Language Server                      │
│                                                  │
│  Provides completions, hover, diagnostics, etc.  │
└──────────────────────────────────────────────────┘
```

## Features

### ✅ Phase 1 (Current)

- [x] Automatic fence detection
- [x] Language server spawning
- [x] Completion forwarding
- [x] Hover forwarding
- [x] Position mapping (host ↔ embedded)
- [x] Multi-language support
- [x] Server reuse across fences
- [x] Graceful fallback for unsupported languages

### 🔜 Phase 2 (Next)

- [ ] Document symbols
- [ ] Signature help
- [ ] Workspace configuration (.lsptoy-languages.json)
- [ ] Inline directives (<!-- lsptoy:add=python -->)
- [ ] Alias resolution

### 🔜 Phase 3

- [ ] Diagnostics forwarding
- [ ] Code actions

### 🔜 Phase 4

- [ ] Inlay hints
- [ ] Capability probing

### 🔜 Phase 5

- [ ] Semantic tokens
- [ ] Token merging

## Configuration

### Custom Language Servers

Create `.lsptoy-languages.json` in your workspace root:

```json
{
  "python": {
    "cmd": "pylsp",
    "args": []
  },
  "rust": {
    "cmd": "rust-analyzer"
  },
  "custom-lang": {
    "cmd": "/path/to/custom-language-server",
    "args": ["--stdio"]
  }
}
```

### Inline Directives (Coming in Phase 2)

Enable specific languages per document:

```markdown
<!-- lsptoy:add=python,rust,go -->

Your content here...
```

## Troubleshooting

### "No completions appearing"

**Cause:** Language server not installed or not in PATH

**Solution:**
1. Check if server is installed: `which typescript-language-server`
2. Install if missing (see Quick Start)
3. Restart VS Code
4. Check Output panel → lsp-toy for error messages

### "Server keeps crashing"

**Cause:** Incompatible version or missing dependencies

**Solution:**
1. Update language server to latest version
2. Check server documentation for dependencies
3. Enable debug logging: Set `LSPTOY_DEBUG=1` env var
4. Check logs for `[EMBED] stderr` messages

### "Wrong language detected"

**Cause:** Non-standard language identifier in fence

**Solution:**
Use standard language IDs:
- ✅ `typescript`, `python`, `rust`
- ❌ `ts-node`, `python3`, `rustlang`

Use aliases if preferred:
- ✅ `ts`, `py`, `rs`

### "Completions from wrong language"

**Cause:** Cursor position ambiguity

**Solution:**
Ensure cursor is clearly inside the fence content, not on fence delimiters (```).

## Performance

### Resource Usage

- Each language spawns one server process
- Servers are reused across multiple fences
- Typical memory: ~50-200MB per language server
- CPU: Minimal when idle, spikes on completion requests

### Optimization Tips

1. **Limit active languages** - Only install servers you need
2. **Close unused documents** - Servers shut down when no documents use them
3. **Future:** Idle timeout will automatically prune unused servers

## Debugging

### Enable Debug Logging

Set environment variable:
```bash
export LSPTOY_DEBUG=1
code .
```

Or in VS Code settings:
```json
{
  "lsp-toy.debug": true
}
```

### Check Logs

Look for `[EMBED]` prefixed messages:

```
[EMBED] detected fence lang=typescript lines=10-25
[EMBED] spawning lang=typescript cmd=typescript-language-server
[EMBED] initialized lang=typescript capabilities=["completion","hover"]
[EMBED] forward completion lang=typescript pos=5:10
[EMBED] completion result lang=typescript count=15
```

### Common Log Messages

| Message | Meaning | Action |
|---------|---------|--------|
| `skip fence: no language specified` | Empty fence | Add language: ```typescript |
| `skip lang=X: unsupported` | Language not in registry | Install server or add to config |
| `failed to spawn lang=X: ENOENT` | Command not found | Install language server |
| `process exited lang=X code=1` | Server crashed | Check stderr logs, update server |
| `skip lang=X reason=no backend` | Known but not installed | Install language server |

## Examples

See [samples/embedded-test.md](samples/embedded-test.md) for comprehensive test cases.

### Minimal Example

````markdown
```typescript
interface Todo {
  id: number;
  text: string;
  done: boolean;
}

const todo: Todo = {
  // Cursor here - try completions!
}
```
````

### Multi-Language Document

````markdown
## Backend API

```python
from flask import Flask

app = Flask(__name__)

@app.route('/api/health')
def health():
    return {'status': 'ok'}
```

## Frontend Client

```typescript
async function checkHealth() {
  const response = await fetch('/api/health');
  const data = await response.json();
  return data.status === 'ok';
}
```

## SQL Schema

```sql
CREATE TABLE todos (
  id SERIAL PRIMARY KEY,
  text VARCHAR(255) NOT NULL,
  done BOOLEAN DEFAULT FALSE
);
```
````

Each fence gets its own language server with proper context!

## Architecture

For detailed architecture documentation, see [EMBEDDED_PHASE1.md](EMBEDDED_PHASE1.md).

### Key Components

- **embeddedRegistry.ts** - Language definitions and runtime selection
- **embeddedManager.ts** - Server lifecycle and request forwarding
- **Fence detection** - Tree-sitter based AST traversal
- **Position projection** - Coordinate mapping between host and embedded docs
- **Virtual documents** - Each fence becomes a virtual file for the embedded server

## Contributing

To add support for a new language:

1. Add entry to `embeddedRegistry.ts`:
```typescript
{
  id: 'mylang',
  aliases: ['ml'],
  node: { cmd: 'mylang-ls', args: ['--stdio'] },
  capabilities: { completion: true, hover: true }
}
```

2. Test with sample document
3. Submit PR with updated documentation

## FAQ

**Q: Does this require VS Code extension changes?**  
A: No! This is purely server-side. Any LSP client works.

**Q: Can I use this with Neovim/Emacs?**  
A: Yes, as long as your editor supports LSP and Markdown.

**Q: What about nested code blocks?**  
A: Nested blocks are not currently supported. Only top-level fences are detected.

**Q: Does this work with GitHub-flavored Markdown?**  
A: Yes, the tree-sitter parser supports GFM syntax.

**Q: Can I disable embedded support?**  
A: Currently no configuration option, but Phase 2 will add enable/disable toggle.

**Q: What about monorepo workspaces?**  
A: Each fence is treated as a standalone file. Workspace-wide features (go to definition across files) will be addressed in future phases.

## Changelog

### v1.0.0 - Phase 1 (October 2025)
- ✅ Initial implementation
- ✅ Completion forwarding
- ✅ Hover forwarding
- ✅ 10 language registry entries
- ✅ Automatic fence detection
- ✅ Server lifecycle management
- ✅ Debug logging with [EMBED] prefix

## Roadmap

- **Q4 2025** - Phase 2: Symbols, signature help, configuration
- **Q1 2026** - Phase 3: Diagnostics, code actions
- **Q2 2026** - Phase 4: Inlay hints
- **Q3 2026** - Phase 5: Semantic tokens
- **Q4 2026** - Phase 6: Performance optimizations, idle pruning

## License

MIT - Same as lsp-toy project

---

**Need help?** Open an issue on GitHub or check [EMBEDDED_PHASE1.md](EMBEDDED_PHASE1.md) for technical details.
