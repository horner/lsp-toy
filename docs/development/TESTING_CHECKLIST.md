# Phase 1 Testing Checklist

Use this checklist to verify the embedded language aggregation implementation.

## Prerequisites

### 1. Build the Extension

```bash
cd /Volumes/Case/prj/lsp-toy/lsp-toy
npm run compile
```

**Expected:** No compilation errors ✅

### 2. Install Language Servers

Choose at least 2 for testing:

```bash
# TypeScript (recommended for testing)
npm install -g typescript-language-server typescript

# Python (optional)
pip install pyright

# Rust (optional, if you have rustup)
rustup component add rust-analyzer

# JSON (optional)
npm install -g vscode-langservers-extracted
```

### 3. Enable Debug Logging

Add to VS Code settings or launch config:
```json
{
  "LSPTOY_DEBUG": "1"
}
```

Or set environment variable:
```bash
export LSPTOY_DEBUG=1
```

## Test Cases

### Test 1: TypeScript Completion ✅

**File:** `test-typescript.md`

````markdown
# TypeScript Test

```typescript
interface Point {
  x: number;
  y: number;
}

const point: Point = { x: 10, y: 20 };
point.
```
````

**Steps:**
1. Open file in VS Code
2. Place cursor after `point.`
3. Trigger completion (Ctrl+Space / Cmd+Space)

**Expected Results:**
- [ ] Completion menu appears
- [ ] Shows `x`, `y` properties
- [ ] Shows TypeScript object methods (e.g., `hasOwnProperty`)
- [ ] No Markdown completions (like "## Summary")

**Debug Log Check:**
```
[EMBED] detected fence lang=typescript lines=3-9
[EMBED] spawning lang=typescript cmd=typescript-language-server
[EMBED] initialized lang=typescript capabilities=[...]
[EMBED] forward completion lang=typescript pos=...
[EMBED] completion result lang=typescript count=...
```

---

### Test 2: TypeScript Hover ✅

**Same file as Test 1**

**Steps:**
1. Hover over `Point` in `const point: Point = ...`

**Expected Results:**
- [ ] Hover tooltip appears
- [ ] Shows interface definition
- [ ] Formatted as TypeScript code

**Debug Log Check:**
```
[EMBED] forward hover lang=typescript pos=...
[EMBED] hover result lang=typescript available=true
```

---

### Test 3: Host Markdown Completion (Outside Fence) ✅

**File:** `test-host.md`

```markdown
# Test Document

Some text here.

[
```

**Steps:**
1. Place cursor after `[`
2. Trigger completion

**Expected Results:**
- [ ] Markdown completions appear
- [ ] Shows "Insert link" suggestions
- [ ] No TypeScript/embedded completions

**Debug Log Check:**
- No `[EMBED]` messages (request not forwarded)

---

### Test 4: Python Completion ✅

**File:** `test-python.md`

````markdown
# Python Test

```python
class Calculator:
    def add(self, a: int, b: int) -> int:
        return a + b

calc = Calculator()
calc.
```
````

**Steps:**
1. Place cursor after `calc.`
2. Trigger completion

**Expected Results:**
- [ ] Python completions appear
- [ ] Shows `add` method
- [ ] May show dunder methods (`__init__`, etc.)

**Debug Log Check:**
```
[EMBED] detected fence lang=python lines=...
[EMBED] spawning lang=python cmd=pyright-langserver
[EMBED] initialized lang=python capabilities=[...]
[EMBED] forward completion lang=python pos=...
```

---

### Test 5: Multiple Fences Same Language (Server Reuse) ✅

**File:** `test-reuse.md`

````markdown
# Reuse Test

First fence:
```typescript
const x: number = 42;
```

Second fence:
```typescript
const y: string = "hello";
y.
```
````

**Steps:**
1. Trigger completion in first fence (after `x.`)
2. Trigger completion in second fence (after `y.`)

**Expected Results:**
- [ ] Both completions work
- [ ] Second completion reuses first server (no second spawn)

**Debug Log Check:**
```
[EMBED] spawning lang=typescript ...  (only once)
[EMBED] didOpen lang=typescript uri=...fence_0_typescript
[EMBED] didOpen lang=typescript uri=...fence_1_typescript
```

---

### Test 6: Unsupported Language (Graceful Skip) ✅

**File:** `test-unsupported.md`

````markdown
# Unsupported Test

```imaginary-lang
some code here
```
````

**Steps:**
1. Open file
2. Place cursor inside fence
3. Trigger completion

**Expected Results:**
- [ ] No crash
- [ ] Falls back to host Markdown completions
- [ ] Logged gracefully

**Debug Log Check:**
```
[EMBED] skip fence lang=imaginary-lang: unsupported/no backend
```

---

### Test 7: Server Not Installed (Error Handling) ✅

**File:** `test-missing-server.md`

````markdown
# Missing Server Test

```rust
fn main() {
    println!("Hello");
}
```
````

**Prerequisites:** Ensure `rust-analyzer` is NOT installed

**Steps:**
1. Open file
2. Place cursor inside fence
3. Trigger completion

**Expected Results:**
- [ ] No crash
- [ ] Falls back to host Markdown completions
- [ ] Error logged

**Debug Log Check:**
```
[EMBED] failed to spawn lang=rust: ENOENT
```

---

### Test 8: Hover Range Remapping ✅

**File:** `test-hover-range.md`

````markdown
# Hover Range Test

Some text before.

```typescript
const message: string = "Hello, world!";
```

Some text after.
````

**Steps:**
1. Hover over `message` variable

**Expected Results:**
- [ ] Hover appears
- [ ] Shows type information
- [ ] Highlight range is correct (not offset by fence line)

**Note:** Range should align with the word in the editor, not shifted.

---

### Test 9: Document Change (Fence Invalidation) ✅

**File:** `test-change.md`

````markdown
```typescript
const x = 42;
x.
```
````

**Steps:**
1. Trigger completion after `x.` → see number methods
2. Change to: `const x = "hello";`
3. Trigger completion after `x.` again

**Expected Results:**
- [ ] First completion shows number methods
- [ ] Second completion shows string methods
- [ ] Virtual doc updated (version incremented)

**Debug Log Check:**
```
[EMBED] invalidated N fence(s) for ...
[EMBED] didChange lang=typescript uri=... version=2
```

---

### Test 10: Document Close (Cleanup) ✅

**File:** Any test file with embedded code

**Steps:**
1. Open file with TypeScript fence
2. Trigger completion (spawns server)
3. Close file

**Expected Results:**
- [ ] No errors
- [ ] Server processes still running (not killed immediately)
- [ ] Virtual documents closed

**Debug Log Check:**
```
[EMBED] didClose lang=typescript uri=...
```

**Note:** Servers are kept alive for performance (future: idle timeout)

---

### Test 11: Multiple Languages ✅

**File:** `test-multi-lang.md`

````markdown
# Multi-Language Test

```typescript
const ts: string = "TypeScript";
ts.
```

```python
py: str = "Python"
# Hover over 'str'
```
````

**Steps:**
1. Trigger completion in TypeScript fence
2. Hover over `str` in Python fence

**Expected Results:**
- [ ] Both work independently
- [ ] Two servers spawned
- [ ] No interference

**Debug Log Check:**
```
[EMBED] spawning lang=typescript ...
[EMBED] spawning lang=python ...
```

---

### Test 12: Empty Fence (Edge Case) ✅

**File:** `test-empty.md`

````markdown
```typescript
```
````

**Steps:**
1. Open file
2. Check logs

**Expected Results:**
- [ ] No crash
- [ ] Fence detected but may be skipped (no code content)
- [ ] No errors

---

### Test 13: Fence Without Language (Edge Case) ✅

**File:** `test-no-lang.md`

````markdown
```
some code without language
```
````

**Steps:**
1. Open file
2. Check logs

**Expected Results:**
- [ ] Fence skipped
- [ ] Logged: "skip fence: no language specified"

**Debug Log Check:**
```
[EMBED] skip fence: no language specified
```

---

## Integration Tests

### Test 14: Extension Restart ✅

**Steps:**
1. With test files open
2. Restart VS Code / reload window
3. Repeat Test 1

**Expected Results:**
- [ ] Servers respawn correctly
- [ ] Completions still work
- [ ] No cached state issues

---

### Test 15: Workspace with Multiple Markdown Files ✅

**Setup:**
- Open workspace with 3-5 Markdown files
- Each contains different language fences

**Steps:**
1. Open all files
2. Trigger completions in various fences

**Expected Results:**
- [ ] All servers spawn on-demand
- [ ] No resource exhaustion
- [ ] Memory usage reasonable (<1GB total)

---

## Performance Tests

### Test 16: First Fence Latency ✅

**Measurement:** Time from completion trigger to results appearing

**Steps:**
1. Open fresh file with TypeScript fence
2. Trigger completion (first time)
3. Note perceived latency

**Expected Results:**
- [ ] <1 second on first trigger (spawn + init + complete)
- [ ] <200ms on subsequent triggers

---

### Test 17: Memory Usage ✅

**Steps:**
1. Open Activity Monitor / Task Manager
2. Spawn 3 different language servers
3. Monitor memory

**Expected Results:**
- [ ] Host server: ~50 MB
- [ ] Per language server: ~50-200 MB
- [ ] Total: <700 MB for 3 languages

---

## Regression Tests

### Test 18: Host Features Still Work ✅

**Verify these host features outside fences:**

- [ ] TODO diagnostics
- [ ] Broken link diagnostics
- [ ] Section header completions (`##`)
- [ ] Link snippet completions (`[`)
- [ ] Hover on tech terms (e.g., "Rust")
- [ ] Code actions (mark TODO as done)

**Expected:** All unchanged, working as before

---

### Test 19: Syntax Highlighting ✅

**Note:** Not implemented by LSP server (client responsibility)

**Verify:**
- [ ] Fenced code blocks still have syntax highlighting
- [ ] Host server doesn't interfere with client highlighting

---

## Failure Scenarios

### Test 20: Server Crash Recovery ✅

**Steps:**
1. Trigger completion (spawns server)
2. Manually kill server process: `kill <pid>`
3. Try completion again

**Expected Results:**
- [ ] First request after kill: fails gracefully
- [ ] Server marked dead
- [ ] No retry storm (logged once)

**Debug Log Check:**
```
[EMBED] process exited lang=typescript code=...
[EMBED] skip lang=typescript: marked dead
```

---

### Test 21: Invalid Server Command ✅

**Setup:** Modify registry temporarily (requires code change):
```typescript
{ id: 'test', node: { cmd: 'nonexistent-server' } }
```

**Expected Results:**
- [ ] Spawn fails
- [ ] Logged clearly
- [ ] Falls back to host

---

## Documentation Verification

### Test 22: Documentation Accuracy ✅

**Review:**
- [ ] EMBEDDED_README.md examples work as described
- [ ] EMBEDDED_QUICK_REF.md log messages match actual logs
- [ ] EMBEDDED_PHASE1.md architecture matches implementation
- [ ] Code comments are accurate

---

## Sign-Off

### Final Checklist

- [ ] All critical tests (1-13) passed
- [ ] At least 2 languages tested successfully
- [ ] No compilation errors
- [ ] Debug logs clear and helpful
- [ ] Host features unaffected (Test 18)
- [ ] Documentation reviewed
- [ ] Ready for Phase 2

### Test Results Summary

```
Date: _____________
Tester: ___________

Tests Passed: ___ / 22
Languages Tested: ________________
Issues Found: ____________________

Notes:
_________________________________
_________________________________
_________________________________
```

---

## Troubleshooting Failed Tests

### Completions not appearing
1. Check server installed: `which typescript-language-server`
2. Check debug logs for spawn errors
3. Verify cursor inside fence content (not on delimiters)
4. Ensure language ID matches registry (use `typescript` not `ts-node`)

### Hover not working
1. Verify server supports hover (check capabilities in log)
2. Try different symbol
3. Check if server stderr shows errors

### Server keeps crashing
1. Update server: `npm update -g typescript-language-server`
2. Check Node.js version compatibility
3. Review server documentation

### Memory usage too high
1. Close unused documents
2. Restart VS Code
3. Future: Phase 6 will add idle pruning

---

**Testing Guide Version:** 1.0  
**Phase:** 1  
**Last Updated:** October 12, 2025
