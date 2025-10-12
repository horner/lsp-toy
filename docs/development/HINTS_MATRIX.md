# Hover Hints Decision Matrix

This document shows exactly when and what hints are displayed.

## Decision Tree

```
User hovers inside code fence
  ↓
Is language in registry?
  ├─ NO → 🔍 "Language Not Supported" + suggestions
  │
  └─ YES → Try to spawn language server
      ↓
      Did spawn succeed?
      ├─ NO → ⚠️ "Language Server Not Available" + install instructions
      │
      └─ YES → Is server initialized?
          ├─ NO → (wait for initialization)
          │
          └─ YES → Does server support hover?
              ├─ NO → ⚠️ "Language Server Not Available"
              │
              └─ YES → Forward hover request
                  ↓
                  Did server return hover info?
                  ├─ NO → (no hint, fall through to host)
                  │
                  └─ YES → ✅ Show real hover info
```

## Scenarios Matrix

| # | Language | In Registry? | Binary Installed? | Server Works? | Hint Type | Icon |
|---|----------|-------------|-------------------|---------------|-----------|------|
| 1 | `ruby` | ❌ No | N/A | N/A | Language Not Supported | 🔍 |
| 2 | `typescript` | ✅ Yes | ❌ No | ❌ No | Language Server Not Available | ⚠️ |
| 3 | `typescript` | ✅ Yes | ✅ Yes | ❌ Crashed | Language Server Not Available | ⚠️ |
| 4 | `typescript` | ✅ Yes | ✅ Yes | ✅ Yes | Real hover info | ✅ |
| 5 | `typscript` (typo) | ❌ No | N/A | N/A | Did you mean `typescript`? | 🔍 |
| 6 | `shell` | ❌ No | N/A | N/A | Did you mean `bash`? | 🔍 |
| 7 | `python` | ✅ Yes | ❌ No | ❌ No | Install pyright + symlink note | ⚠️ |
| 8 | `rust` | ✅ Yes | ❌ No | ❌ No | Install rust-analyzer | ⚠️ |

## Hint Message Templates

### Template 1: Language Not Supported 🔍

**Trigger:** Language identifier not in `embeddedRegistry.ts`

**Message:**
```markdown
### 🔍 Language Not Supported: `{lang}`

This language is not yet configured in the embedded language registry.

[IF suggestions available]
**Did you mean?** {suggestion1}, {suggestion2}

**Supported languages:** typescript, python, rust, go, java, csharp, bash, sql, json, yaml

**To add support:** Update `embeddedRegistry.ts` with the language server configuration.
```

**Variables:**
- `{lang}`: The language identifier from the fence (e.g., `ruby`)
- `{suggestion1}`, `{suggestion2}`: Similar language names

### Template 2: Language Server Not Available ⚠️

**Trigger:** Language in registry but spawn failed or server crashed

**Message:**
```markdown
### ⚠️ Language Server Not Available: `{lang}`

The language server failed to start. This usually means the server is not installed.

**Required command:** `{command}`

**Installation:**
```bash
{installCommand}
```

[IF special notes needed]
**Note:** {specialNote}

**After installing:** Reload the VS Code window (Cmd/Ctrl+Shift+P → "Developer: Reload Window")
```

**Variables:**
- `{lang}`: Language name (e.g., `typescript`)
- `{command}`: Binary name (e.g., `typescript-language-server`)
- `{installCommand}`: Language-specific install command
- `{specialNote}`: Optional extra instructions (e.g., Python symlink)

### Template 3: Working Server ✅

**Trigger:** Server running and hover succeeds

**Message:** (None - real hover info from language server)

## Code Path Analysis

### Path 1: Unsupported Language

```typescript
// embeddedRegistry.ts
pickRuntime('ruby')
  → { mode: 'unsupported' }

// embeddedManager.ts::ensureServer()
if (runtime.mode === 'unsupported') {
  return null;
}

// embeddedManager.ts::getLanguageHint()
if (runtime.mode === 'unsupported') {
  return "🔍 Language Not Supported: ruby...";
}

// hover.ts
const helpMessage = getLanguageHint('ruby');
if (helpMessage) {
  return { contents: { value: helpMessage } };
}
```

### Path 2: Spawn Failure (ENOENT)

```typescript
// embeddedManager.ts::ensureServer()
try {
  proc = spawn('typescript-language-server', ...);
} catch (err) {
  // ❌ ENOENT
  const deadServer = {
    lang: 'typescript',
    dead: true,
    failedAt: Date.now()
  };
  this.servers.set('typescript', deadServer);
  return null;
}

// embeddedManager.ts::getLanguageHint()
const server = this.servers.get('typescript');
if (server?.dead) {
  return "⚠️ Language Server Not Available: typescript...";
}

// hover.ts
const helpMessage = getLanguageHint('typescript');
if (helpMessage) {
  return { contents: { value: helpMessage } };
}
```

### Path 3: Working Server

```typescript
// embeddedManager.ts::ensureServer()
const server = await spawnAndInitialize('typescript');
// ✅ Success

// embeddedManager.ts::forwardHover()
const result = await server.conn.sendRequest('textDocument/hover', ...);
// ✅ Got hover info

// hover.ts
if (embeddedResult) {
  return embeddedResult;  // Real hover from TypeScript server
}
```

## Installation Commands Reference

Quick reference for all language-specific install commands shown in hints:

| Language | Command | Install Method |
|----------|---------|----------------|
| TypeScript | `typescript-language-server` | `npm install -g typescript typescript-language-server` |
| Python | `pyright-langserver` | `pip install pyright` + symlink |
| Rust | `rust-analyzer` | `rustup component add rust-analyzer` |
| Go | `gopls` | `go install golang.org/x/tools/gopls@latest` |
| Bash | `bash-language-server` | `npm install -g bash-language-server` |
| JSON | `vscode-json-language-server` | `npm install -g vscode-langservers-extracted` |
| YAML | `yaml-language-server` | `npm install -g yaml-language-server` |
| Java | `jdtls` | (Manual download from Eclipse) |
| C# | `csharp-ls` | `dotnet tool install --global csharp-ls` |
| SQL | `sql-language-server` | `npm install -g sql-language-server` |

## Testing Each Scenario

### Scenario 1: Ruby (Not Supported)

```markdown
```ruby
puts "Hello"
```
```

**Expected:** 🔍 "Language Not Supported: ruby" + suggests "rust"

### Scenario 2: TypeScript (Not Installed)

```bash
# Uninstall if installed
npm uninstall -g typescript-language-server
```

```markdown
```typescript
const x = 10;
```
```

**Expected:** ⚠️ "Language Server Not Available: typescript" + npm install command

### Scenario 3: TypeScript (Installed & Working)

```bash
npm install -g typescript typescript-language-server
# Reload VS Code
```

```markdown
```typescript
interface User { id: number; }
```
```

**Expected:** ✅ Real TypeScript hover showing interface definition

### Scenario 4: Typo (typscript)

```markdown
```typscript
const x = 10;
```
```

**Expected:** 🔍 "Language Not Supported: typscript" + "Did you mean? typescript"

### Scenario 5: Alias (shell)

```markdown
```shell
echo "Hello"
```
```

**Expected:** 🔍 "Language Not Supported: shell" + "Did you mean? bash"

## State Management

### Server States

| State | Stored in Map? | `dead` Flag | `initialized` Flag | Behavior |
|-------|---------------|------------|-------------------|----------|
| Not attempted | ❌ No | N/A | N/A | Try spawn |
| Spawn failed | ✅ Yes | ✅ true | ❌ false | Show hint, no retry |
| Spawning | ✅ Yes | ❌ false | ❌ false | Wait for init |
| Initialized | ✅ Yes | ❌ false | ✅ true | Forward requests |
| Crashed | ✅ Yes | ✅ true | N/A | Show hint, no retry |

### Cleanup Events

| Event | Action |
|-------|--------|
| Document closed | Remove fence from cache |
| VS Code reload | Clear all servers (new process) |
| Server exit | Mark as dead, remove from map |
| Extension deactivate | Shutdown all servers |

## User Journey

### First-Time User (No Servers Installed)

```
1. Open .lsptoy file with TypeScript fence
2. Hover over code
3. See: "⚠️ typescript-language-server not installed"
4. Copy install command from tooltip
5. Run: npm install -g typescript typescript-language-server
6. Reload VS Code
7. Hover again
8. See: Real TypeScript hover info ✅
```

### Experienced User (Has Some Servers)

```
1. Add Python code fence
2. Hover to check
3. See: "⚠️ pyright-langserver not installed"
4. Already knows what to do
5. Install pyright
6. Continue working
```

### Power User (Wants New Language)

```
1. Add Ruby code fence
2. Hover to check
3. See: "🔍 Language Not Supported: ruby"
4. Read: "Update embeddedRegistry.ts"
5. Add Ruby config to registry
6. Add ruby-lsp to registry
7. Now Ruby works ✅
```

---

**Key Insight:** The hint system provides **progressive disclosure**:
- Beginners: See clear installation instructions
- Intermediate: Quick reference for missing tools
- Advanced: Guidance on extending the system

**Last Updated:** October 12, 2025  
**Status:** ✅ Complete and ready for testing
