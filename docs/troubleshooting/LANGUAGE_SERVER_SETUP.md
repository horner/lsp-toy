# Language Server Installation Guide

To test embedded language features in `lsp-toy`, you need to install the corresponding language servers globally.

## Quick Install Commands

### TypeScript/JavaScript
```bash
npm install -g typescript typescript-language-server
```

### Python
```bash
pip install pyright
# or
npm install -g pyright
```

### Rust
```bash
# Install via rustup (recommended)
rustup component add rust-analyzer

# Make sure it's in PATH
which rust-analyzer
```

### Go
```bash
go install golang.org/x/tools/gopls@latest

# Make sure $GOPATH/bin is in PATH
export PATH="$PATH:$(go env GOPATH)/bin"
```

### Java
```bash
# Download from https://download.eclipse.org/jdtls/milestones/
# Or install via VS Code extension, then symlink the binary
```

### C#
```bash
# Install .NET SDK first, then:
dotnet tool install --global csharp-ls
```

### Bash
```bash
npm install -g bash-language-server
```

### SQL
```bash
npm install -g sql-language-server
```

### JSON
```bash
npm install -g vscode-langservers-extracted
```

### YAML
```bash
npm install -g yaml-language-server
```

## Verify Installation

After installing, verify each language server is accessible:

```bash
# TypeScript
typescript-language-server --version

# Python
pyright --version

# Rust
rust-analyzer --version

# Go
gopls version

# Bash
bash-language-server --version

# JSON/YAML
vscode-json-language-server --version
yaml-language-server --version
```

## Testing in lsp-toy

1. **Install at least one language server** (e.g., TypeScript):
   ```bash
   npm install -g typescript typescript-language-server
   ```

2. **Reload VS Code window** (Cmd+Shift+P → "Developer: Reload Window")

3. **Open the test document**: `samples/sample-resume.lsptoy`

4. **Trigger completion** inside a code fence:
   - Place cursor after `user.` in the TypeScript example (line ~48)
   - Press `Ctrl+Space` (or `Cmd+Space` on macOS)
   - Should see: `id`, `name`, `email`, `role` completions

5. **Check the logs** (Output panel → lsp-toy):
   ```
   [EMBED] detected fence lang=typescript lines=23-48 (fence at line 21)
   [EMBED] spawning lang=typescript cmd=typescript-language-server
   [EMBED] initialized lang=typescript capabilities=[...]
   [EMBED] forward completion lang=typescript at line 48:8 → embedded 25:8
   [EMBED] completion result lang=typescript count=4 for line 48
   ```

## Troubleshooting

### "spawn typescript-language-server ENOENT"

**Problem**: The language server binary is not in your PATH.

**Solution**:
1. Check if installed: `which typescript-language-server`
2. If missing, install: `npm install -g typescript-language-server typescript`
3. Verify: `typescript-language-server --version`
4. Reload VS Code window

### "process error lang=python: spawn pyright-langserver ENOENT"

**Problem**: Pyright installed but binary name is wrong.

**Solution**: The registry uses `pyright-langserver`, but the actual command might be just `pyright`:

```bash
# Check what's installed
which pyright
which pyright-langserver

# If only 'pyright' exists, create a symlink
ln -s $(which pyright) /usr/local/bin/pyright-langserver
```

### Server crashes immediately

**Problem**: Server version incompatible or missing dependencies.

**Check logs**: Output panel → lsp-toy

Look for stderr output:
```
[EMBED] stderr lang=rust: Error: missing libfoo.so
```

**Solution**: Update the language server or install missing dependencies.

### No completions appear

**Checklist**:
1. ✅ Language server installed and in PATH?
2. ✅ Cursor inside a code fence (not in markdown text)?
3. ✅ Fence has valid language identifier (e.g., ` ```typescript `)?
4. ✅ VS Code window reloaded after installing server?
5. ✅ Check Output panel → lsp-toy for errors?

### Server spawns but initialization fails

**Problem**: LSP initialization handshake failed.

**Check logs**:
```
[EMBED] initialized lang=typescript capabilities=[...]  // ✅ Good
[EMBED] initialization failed lang=typescript: ...       // ❌ Bad
```

**Solution**: Ensure language server supports LSP 3.x protocol. Some tools (like linters) aren't LSP servers.

## Minimal Test Setup

If you want to test with minimal installation:

```bash
# Install only TypeScript support
npm install -g typescript typescript-language-server

# Open test document
code samples/sample-resume.lsptoy

# Place cursor at line 48, column 8 (after 'user.')
# Press Ctrl+Space
# Should see: id, name, email, role
```

Expected log output:
```
[EMBED] detected fence lang=typescript lines=23-48 (fence at line 21)
[EMBED] spawning lang=typescript cmd=typescript-language-server
[EMBED] sending initialize lang=typescript
[EMBED] initialized lang=typescript capabilities=["completionProvider","hoverProvider",...]
[EMBED] didOpen lang=typescript uri=embedded://...fence_0_typescript version=1
[EMBED] forward completion lang=typescript at line 48:8 → embedded 25:8
[EMBED] completion result lang=typescript count=4 for line 48
```

## Language Server Registry

The following language servers are pre-configured in `embeddedRegistry.ts`:

| Language   | Command                       | Aliases                  |
|------------|-------------------------------|--------------------------|
| TypeScript | `typescript-language-server`  | `ts`, `tsx`, `javascript`, `js`, `jsx` |
| Python     | `pyright-langserver`          | `py`                     |
| Rust       | `rust-analyzer`               | `rs`                     |
| Go         | `gopls`                       | `golang`                 |
| Java       | `jdtls`                       | -                        |
| C#         | `csharp-ls`                   | `cs`, `csharp`           |
| Bash       | `bash-language-server`        | `sh`, `shell`            |
| SQL        | `sql-language-server`         | -                        |
| JSON       | `vscode-json-language-server` | -                        |
| YAML       | `yaml-language-server`        | `yml`                    |

You can use any of the aliases in your code fences:
```typescript
// All of these work:
```typescript
```ts
```javascript
```js
```

---

**Last Updated**: October 12, 2025  
**Phase**: 1 Testing  
**Status**: Ready for manual testing
