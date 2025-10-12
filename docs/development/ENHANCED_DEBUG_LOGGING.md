# Enhanced Debug Logging - Line Number Tracking

## Changes Made

Updated all `[EMBED]` debug log messages in `embeddedManager.ts` to include line numbers (and columns where relevant) for better debugging and troubleshooting.

## New Log Format Examples

### Fence Detection

**Before:**
```
[EMBED] skip fence: no language specified
[EMBED] skip fence lang=xyz: unsupported/no backend
[EMBED] detected fence lang=typescript lines=12-20
```

**After:**
```
[EMBED] skip fence at line 5: no language specified
[EMBED] skip fence at line 15 lang=xyz: unsupported/no backend
[EMBED] detected fence lang=typescript lines=12-20 (fence at line 10)
```

### Completion Requests

**Before:**
```
[EMBED] completion unavailable lang=typescript
[EMBED] forward completion lang=typescript pos=5:10
[EMBED] completion result lang=typescript count=25
[EMBED] completion error lang=typescript: <error>
```

**After:**
```
[EMBED] completion unavailable lang=typescript at line 15
[EMBED] forward completion lang=typescript at line 15:10 → embedded 5:10
[EMBED] completion result lang=typescript count=25 for line 15
[EMBED] completion error lang=typescript at line 15: <error>
```

### Hover Requests

**Before:**
```
[EMBED] hover unavailable lang=python
[EMBED] forward hover lang=python pos=3:8
[EMBED] hover result lang=python available=true
[EMBED] hover error lang=python: <error>
```

**After:**
```
[EMBED] hover unavailable lang=python at line 25
[EMBED] forward hover lang=python at line 25:8 → embedded 3:8
[EMBED] hover result lang=python available=true for line 25
[EMBED] hover error lang=python at line 25: <error>
```

## Benefits

### 1. **Easier Debugging**
When multiple fences exist in a document, you can immediately identify which fence is being processed:

```
[EMBED] detected fence lang=typescript lines=12-20 (fence at line 10)
[EMBED] detected fence lang=python lines=35-45 (fence at line 33)
[EMBED] detected fence lang=typescript lines=60-75 (fence at line 58)
```

### 2. **Position Tracking**
The arrow notation (`→`) clearly shows position projection from host to embedded coordinates:

```
[EMBED] forward completion lang=typescript at line 15:10 → embedded 5:10
```

This makes it easy to verify that position mapping is working correctly:
- Host position: line 15, character 10
- Projected to: line 5, character 10 (in the virtual embedded document)

### 3. **Error Location**
Errors now include the exact line where the problem occurred:

```
[EMBED] completion error lang=rust at line 42: ENOENT
```

You can immediately jump to line 42 in the document to investigate.

### 4. **Multi-Fence Documents**
When debugging documents with many code blocks, line numbers help correlate logs with visual inspection:

```
Document structure:
- Line 10: ```typescript fence
- Line 33: ```python fence
- Line 58: ```typescript fence (reuses server)

Logs show:
[EMBED] detected fence lang=typescript lines=12-20 (fence at line 10)
[EMBED] spawning lang=typescript cmd=typescript-language-server
[EMBED] detected fence lang=python lines=35-45 (fence at line 33)
[EMBED] spawning lang=python cmd=pyright-langserver
[EMBED] detected fence lang=typescript lines=60-75 (fence at line 58)
[EMBED] didOpen lang=typescript uri=...fence_2_typescript version=1
```

You can see that the third fence reused the TypeScript server (no second spawn).

## Example Debug Session

### Scenario: User reports completion not working at line 42

**Debug logs with line numbers:**
```
[EMBED] detected fence lang=rust lines=40-50 (fence at line 38)
[EMBED] spawning lang=rust cmd=rust-analyzer
[EMBED] failed to spawn lang=rust: spawn rust-analyzer ENOENT
[EMBED] completion unavailable lang=rust at line 42
```

**Immediate insights:**
1. Line 42 is inside a Rust fence (lines 40-50)
2. Server spawn failed
3. Problem: `rust-analyzer` not installed
4. Solution: Install rust-analyzer

Without line numbers, you'd have to:
1. Search the document for Rust fences
2. Count which fence contains line 42
3. Correlate with log timestamps
4. Much more time-consuming!

## Format Conventions

### Line Numbers
- **Host document line:** Always 1-indexed (matches editor line numbers)
- **Fence start line:** The line with the opening ``` delimiter
- **Code lines:** The actual content lines (after opening fence)

### Position Format
- Single line: `line 42`
- Line + column: `line 42:10`
- Position mapping: `line 42:10 → embedded 5:10`

### Consistent Structure
All position-related logs follow this pattern:
```
[EMBED] <action> lang=<language> at line <hostLine>[:<hostCol>] [→ embedded <embeddedLine>:<embeddedCol>]
```

## Testing the Enhanced Logging

### Enable Debug Mode
```bash
export LSPTOY_DEBUG=1
code your-document.md
```

### Trigger Operations
1. Open a document with code fences
2. Place cursor inside a fence
3. Trigger completion or hover
4. Check Output panel → lsp-toy

### Expected Output
```
[EMBED] detected fence lang=typescript lines=12-20 (fence at line 10)
[EMBED] spawning lang=typescript cmd=typescript-language-server
[EMBED] initialized lang=typescript capabilities=[...]
[EMBED] didOpen lang=typescript uri=embedded://... version=1
[EMBED] forward completion lang=typescript at line 15:25 → embedded 5:25
[EMBED] completion result lang=typescript count=18 for line 15
```

Now you can easily see:
- Fence detected at document line 10
- Code spans lines 12-20
- User triggered completion at host line 15, character 25
- Projected to embedded line 5, character 25
- Received 18 completion items

## Future Enhancements (Phase 2+)

Consider adding to other operations:

### Document Symbols
```
[EMBED] forward documentSymbol lang=typescript for fence at line 10
[EMBED] symbols found: 5 items for fence at line 10
```

### Signature Help
```
[EMBED] forward signatureHelp lang=python at line 38:15 → embedded 5:15
[EMBED] signature result lang=python signatures=1 for line 38
```

### Diagnostics (Phase 3)
```
[EMBED] forward diagnostics lang=typescript for fence at line 10
[EMBED] diagnostics: 2 errors at lines 14, 17 (embedded 4, 7)
```

---

**Updated:** October 12, 2025  
**Phase:** 1 Enhancement  
**Files Modified:** `server/src/embedded/embeddedManager.ts`  
**Build Status:** ✅ Zero compilation errors
