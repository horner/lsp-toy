# Embedded Languages - Quick Reference

## Supported Languages

| Language | Fence ID | Aliases | Install Command |
|----------|----------|---------|----------------|
| TypeScript | `typescript` | `ts`, `javascript`, `js` | `npm i -g typescript-language-server` |
| Python | `python` | `py` | `pip install pyright` |
| Rust | `rust` | `rs` | `rustup component add rust-analyzer` |
| Go | `go` | `golang` | `go install golang.org/x/tools/gopls@latest` |
| Java | `java` | - | Platform dependent (jdtls) |
| C# | `csharp` | `cs`, `c#` | Platform dependent (omnisharp) |
| Bash | `bash` | `sh`, `shell` | `npm i -g bash-language-server` |
| SQL | `sql` | - | `npm i -g sql-language-server` |
| JSON | `json` | - | `npm i -g vscode-langservers-extracted` |
| YAML | `yaml` | `yml` | `npm i -g yaml-language-server` |

## Phase Status

| Feature | Phase | Status | Notes |
|---------|-------|--------|-------|
| Completion | 1 | ✅ | Full trigger support |
| Hover | 1 | ✅ | With range remapping |
| Document Sync | 1 | ✅ | Incremental + virtual docs |
| Server Lifecycle | 1 | ✅ | Spawn, reuse, shutdown |
| Diagnostics | 3 | 🔜 | Planned |
| Code Actions | 3 | 🔜 | Planned |
| Document Symbols | 2 | 🔜 | Next |
| Signature Help | 2 | 🔜 | Next |
| Inlay Hints | 4 | 🔜 | Future |
| Semantic Tokens | 5 | 🔜 | Future |

## Fence Syntax

````markdown
```<language-id>
<code content>
```
````

Examples:
- ` ```typescript ` → TypeScript server
- ` ```python ` → Python server  
- ` ```rs ` → Rust server (alias)
- ` ```js ` → TypeScript server (alias)

## Logging

Enable debug logs: `LSPTOY_DEBUG=1`

### Log Prefixes

- `[EMBED]` - Embedded language operations
- `[server]` - Host server operations
- No prefix - Generic logging

### Common Messages

```
[EMBED] detected fence lang=typescript lines=10-25
  ➜ Fence found, language identified

[EMBED] spawning lang=typescript cmd=typescript-language-server
  ➜ First use of language, spawning server

[EMBED] initialized lang=typescript capabilities=[...]
  ➜ Server ready, capabilities discovered

[EMBED] didOpen lang=typescript uri=embedded://... version=1
  ➜ Virtual document created

[EMBED] forward completion lang=typescript pos=5:10
  ➜ Completion request forwarded to embedded server

[EMBED] completion result lang=typescript count=25
  ➜ Received results from embedded server

[EMBED] skip lang=xyz: unsupported/no backend
  ➜ Language not in registry or server not installed
```

## Position Mapping

### Host → Embedded

```
Host document:
1:  # Title
2:
3:  ```typescript
4:  const x = 42;    ← cursor at line 4, char 8
5:  ```

Fence metadata:
- codeStart: 4 (line after opening fence)
- codeEnd: 4

Projected position:
- line: 4 - 4 = 0
- char: 8 (unchanged)
```

### Embedded → Host

```
Embedded response range: {start: {0, 6}, end: {0, 7}}
Fence codeStart: 4

Remapped range: {start: {4, 6}, end: {4, 7}}
```

## Capability Detection

Each server declares capabilities during initialization:

```typescript
{
  completionProvider: { triggerCharacters: ['.', '->'] },
  hoverProvider: true,
  signatureHelpProvider: { triggerCharacters: ['(', ','] },
  // ... more
}
```

Manager checks capability before forwarding:
```typescript
if (!server.capabilities?.completionProvider) {
  // Fall back to host Markdown completions
}
```

## Error Handling

### Spawn Failure
```
[EMBED] failed to spawn lang=python: ENOENT
```
**Cause:** Server binary not found  
**Fix:** Install language server

### Crash Detection
```
[EMBED] process exited lang=typescript code=1
[EMBED] stderr lang=typescript: <error message>
```
**Cause:** Server incompatibility or bug  
**Fix:** Check stderr, update server, report issue

### Graceful Degradation
- Unsupported language → Host Markdown features
- Server crash → Mark dead, prevent retry storm
- Missing capability → Fall back to host

## Performance

### Server Lifecycle

```
Document opened
  ↓
First fence detected (lang=typescript)
  ↓
Server spawned (lazy)
  ↓
Server initialized (~100-500ms)
  ↓
Requests forwarded
  ↓
... (server reused for all typescript fences)
  ↓
Document closed
  ↓
Virtual docs closed (server kept alive)
  ↓
(Future: idle timeout → shutdown)
```

### Resource Usage

Per language server:
- **Memory:** 50-200 MB
- **CPU:** <1% idle, 5-20% active
- **Startup:** 100-500ms first fence

## Troubleshooting

### No Completions

1. Check server installed: `which typescript-language-server`
2. Check logs for spawn errors
3. Verify fence language ID (use `typescript` not `ts-node`)
4. Ensure cursor inside fence content, not on delimiters

### Wrong Language

1. Use standard IDs: `typescript`, `python`, `rust`
2. Or use aliases: `ts`, `py`, `rs`
3. Check registry: `getRegisteredLanguages()`

### Server Keeps Crashing

1. Update server: `npm update -g typescript-language-server`
2. Check dependencies (Node.js version, Python version)
3. Enable debug logs to see stderr
4. Check server docs for known issues

## Configuration (Future)

### Workspace Override

`.lsptoy-languages.json`:
```json
{
  "python": {
    "cmd": "pylsp",
    "args": []
  },
  "rust": {
    "cmd": "/custom/path/to/rust-analyzer"
  }
}
```

### Inline Directive

```markdown
<!-- lsptoy:add=python,sql,lua -->
```

## API Reference

### Registry

```typescript
resolveLanguage(langRaw: string): LangEntry | undefined
pickRuntime(langRaw: string): ResolvedRuntime
mergeRegistry(userEntries: LangEntry[]): void
getRegisteredLanguages(): string[]
```

### Manager

```typescript
extractFences(docUri, tree, document): FenceMeta[]
findFenceAt(docUri, position): FenceMeta | undefined
projectPosition(hostPos, fence): Position
remapPosition(embeddedPos, fence): Position
forwardCompletion(params, fence): Promise<CompletionItem[] | null>
forwardHover(params, fence): Promise<Hover | null>
invalidateFences(docUri): void
closeDocument(docUri): void
shutdown(): Promise<void>
getStats(): { activeServers, languages, totalFences }
```

## Testing

### Manual Test

1. Create `test.md`:
````markdown
```typescript
const x: number = 42;
x. // ← trigger completion here
```
````

2. Open in VS Code
3. Trigger completion after dot
4. Verify TypeScript methods appear (toFixed, toString, etc.)

### Verify Logs

```bash
LSPTOY_DEBUG=1 code test.md
```

Check Output panel → lsp-toy for:
- Fence detection
- Server spawn
- Completion forwarding
- Result count

## Limitations (Phase 1)

- ❌ Diagnostics not forwarded
- ❌ Code actions not forwarded
- ❌ Semantic tokens not merged
- ❌ Symbols not aggregated
- ❌ Web worker mode not implemented
- ❌ Workspace config not loaded
- ❌ Inline directive not parsed
- ❌ Idle server pruning not implemented

## Next Steps

See [EMBEDDED_PHASE1.md](EMBEDDED_PHASE1.md) for detailed implementation plan.

---

**Last Updated:** October 12, 2025  
**Phase:** 1  
**Version:** 1.0.0
