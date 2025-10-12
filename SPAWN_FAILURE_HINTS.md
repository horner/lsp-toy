# Testing Spawn Failure Hints

## Expected Behavior

When a language server binary is not found (ENOENT), the system should:

1. ✅ Detect spawn failure immediately
2. ✅ Store a "dead server" placeholder in the servers map
3. ✅ Return `null` from `ensureServer()`
4. ✅ Call `getLanguageHint()` in hover handler
5. ✅ Display helpful installation message

## Flow Trace

### Before Fix ❌

```
User hovers → forwardHover → ensureServer
  ↓
  Spawn fails (ENOENT)
  ↓
  Return null (no server stored)
  ↓
  getLanguageHint() called
  ↓
  servers.get(lang) → undefined ❌
  ↓
  No hint shown (falls through to host)
```

### After Fix ✅

```
User hovers → forwardHover → ensureServer
  ↓
  Spawn fails (ENOENT)
  ↓
  Create dead server placeholder
  ↓
  Store in servers.set(lang, deadServer) ✅
  ↓
  Return null
  ↓
  getLanguageHint() called
  ↓
  servers.get(lang) → deadServer ✅
  ↓
  deadServer.dead === true
  ↓
  Generate installation hint
  ↓
  Show hint to user! 🎉
```

## Code Changes

### 1. Immediate Spawn Failure

**Location:** `ensureServer()` after spawn error handler

**Before:**
```typescript
if (spawnFailed || !proc.stdout || !proc.stdin) {
  logDebug(`[EMBED] spawn failed immediately lang=${normalizedLang}`);
  proc.kill();
  return null;  // ❌ No server stored
}
```

**After:**
```typescript
if (spawnFailed || !proc.stdout || !proc.stdin) {
  logDebug(`[EMBED] spawn failed immediately lang=${normalizedLang}`);
  proc.kill();
  
  // Store dead server placeholder
  const deadServer: EmbeddedServer = {
    lang: normalizedLang,
    mode: 'node',
    initialized: false,
    docs: new Map(),
    dead: true,
    failedAt: Date.now()
  };
  this.servers.set(normalizedLang, deadServer);
  
  return null;  // ✅ Server stored for hint lookup
}
```

### 2. Exception During Spawn

**Location:** `ensureServer()` catch block

**Before:**
```typescript
catch (err) {
  logDebug(`[EMBED] spawn failed lang=${normalizedLang}: ${err}`);
  return null;  // ❌ No server stored
}
```

**After:**
```typescript
catch (err) {
  logDebug(`[EMBED] spawn failed lang=${normalizedLang}: ${err}`);
  
  // Store dead server placeholder
  const deadServer: EmbeddedServer = {
    lang: normalizedLang,
    mode: 'node',
    initialized: false,
    docs: new Map(),
    dead: true,
    failedAt: Date.now()
  };
  this.servers.set(normalizedLang, deadServer);
  
  return null;  // ✅ Server stored for hint lookup
}
```

## Testing

### Test Case: TypeScript Not Installed

**Setup:**
```bash
# Ensure typescript-language-server is NOT installed
which typescript-language-server  # Should return: not found
```

**Steps:**
1. Open `samples/sample-resume.lsptoy`
2. Find TypeScript code fence (line ~23)
3. Hover over `interface User`

**Expected Logs:**
```
[EMBED] detected fence lang=typescript lines=23-48 (fence at line 21)
[EMBED] spawning lang=typescript cmd=typescript-language-server
[EMBED] process error lang=typescript: spawn typescript-language-server ENOENT
[EMBED] spawn failed immediately lang=typescript
[EMBED] hover unavailable lang=typescript at line 24
```

**Expected Hover Message:**
```markdown
### ⚠️ Language Server Not Available: `typescript`

The language server failed to start. This usually means the server is not installed.

**Required command:** `typescript-language-server`

**Installation:**
```bash
npm install -g typescript typescript-language-server
```

**After installing:** Reload the VS Code window (Cmd/Ctrl+Shift+P → "Developer: Reload Window")
```

### Test Case: Python Not Installed

**Setup:**
```bash
# Ensure pyright is NOT installed
which pyright  # Should return: not found
which pyright-langserver  # Should return: not found
```

**Steps:**
1. Hover over Python code (line ~60)

**Expected Hover Message:**
```markdown
### ⚠️ Language Server Not Available: `python`

The language server failed to start. This usually means the server is not installed.

**Required command:** `pyright-langserver`

**Installation:**
```bash
pip install pyright
# or
npm install -g pyright
```

**Note:** You may need to create a symlink:
```bash
ln -s $(which pyright) /usr/local/bin/pyright-langserver
```

**After installing:** Reload the VS Code window (Cmd/Ctrl+Shift+P → "Developer: Reload Window")
```

## Edge Cases Handled

### 1. Multiple Hover Attempts
**Scenario:** User hovers multiple times on same language

**Behavior:**
- First hover: Spawn fails → Store dead server → Show hint
- Second hover: Check servers map → Find dead server → Show hint (no re-spawn)

**Code:**
```typescript
if (this.servers.has(normalizedLang)) {
  const server = this.servers.get(normalizedLang)!;
  if (server.dead) {
    return null;  // Don't retry immediately
  }
}
```

### 2. Dead Server Cooldown
**Current:** Dead servers are never retried (permanent failure)

**Future Enhancement:** Add retry cooldown
```typescript
if (server.dead && server.failedAt) {
  const cooldown = 60_000; // 1 minute
  if (Date.now() - server.failedAt < cooldown) {
    return null;  // Still in cooldown
  }
  // Clear dead flag and retry
  this.servers.delete(normalizedLang);
}
```

### 3. Server Installed After Failure
**Scenario:** User installs server after seeing hint

**Current Behavior:**
- Dead server remains in map
- User must reload window to clear state

**Expected After Reload:**
- servers map cleared (new process)
- Spawn will succeed
- Real hover info shown ✅

## Verification Checklist

- [ ] TypeScript spawn failure shows installation hint
- [ ] Python spawn failure shows installation hint
- [ ] Rust spawn failure shows installation hint
- [ ] Hint includes correct command name
- [ ] Hint includes language-specific install command
- [ ] Hint mentions reload window
- [ ] Second hover on same language doesn't re-spawn
- [ ] Installing server and reloading fixes the issue

## Debug Verification

**Check the Output panel (lsp-toy) for:**
```
✅ [EMBED] spawn failed immediately lang=typescript
✅ [EMBED] hover unavailable lang=typescript at line 24
✅ (Hint should appear in hover tooltip)
```

**Check the hover tooltip for:**
```
✅ "⚠️ Language Server Not Available: typescript"
✅ "Required command: typescript-language-server"
✅ Installation instructions
✅ "Reload the VS Code window"
```

---

**Status:** ✅ Fixed and ready for testing  
**Files Modified:** 1 (`embeddedManager.ts`)  
**Lines Changed:** +24 (dead server placeholder storage)  
**Compilation:** ✅ Clean (0 errors)

**Next Step:** Reload VS Code and test hovering over TypeScript code with typescript-language-server not installed!
