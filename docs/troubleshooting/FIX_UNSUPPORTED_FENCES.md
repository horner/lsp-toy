# Fix: Store Unsupported Fences for Hints

## Problem Discovery

User hovered over Ruby code (line 22), but no hint appeared:

```
[EMBED] skip fence at line 21 lang=ruby: unsupported/no backend
→ findFenceAt: cached fences=6
→ Fence ranges:
   [0] typescript: lines 34-60
   [1] python: lines 67-103
   ...
→ No fence contains position 22
```

**Root Cause:** Ruby fence was skipped during extraction because `runtime.mode === 'unsupported'`, so it was never added to the fence cache. Without fence metadata, `findFenceAt()` returns nothing, and `getLanguageHint()` is never called.

## Solution

**Store ALL fences** (including unsupported languages) in the cache so hints can be shown.

### Before ❌

```typescript
const runtime = pickRuntime(langRaw);
if (runtime.mode === 'unsupported') {
  logDebug(`skip fence: unsupported/no backend`);
  return;  // ❌ Never cached!
}

fences.push({
  normalizedLang: runtime.entry!.id,  // Would crash if unsupported
  ...
});
```

### After ✅

```typescript
const runtime = pickRuntime(langRaw);

// Don't skip - store unsupported fences too!
const normalizedLang = runtime.mode === 'unsupported' 
  ? langRaw.toLowerCase()      // Use raw lang for unsupported
  : runtime.entry!.id;         // Use registry ID for supported

fences.push({
  normalizedLang: normalizedLang,
  ...
});

if (runtime.mode === 'unsupported') {
  logDebug(`detected fence lang=${langRaw} (unsupported)`);
} else {
  logDebug(`detected fence lang=${runtime.entry!.id}`);
}
```

## Flow Now Works

### Unsupported Language (Ruby)

```
User hovers at line 22
  ↓
findFenceAt(position=22)
  ↓
Find fence: ruby, lines 21-23 ✅
  ↓
forwardHover → ensureServer('ruby')
  ↓
pickRuntime('ruby') → { mode: 'unsupported' }
  ↓
Return null
  ↓
getLanguageHint('ruby')
  ↓
runtime.mode === 'unsupported' ✅
  ↓
Generate: "🔍 Language Not Supported: ruby"
  ↓
Show hint! 🎉
```

### Supported But Not Installed (TypeScript)

```
User hovers at line 34
  ↓
findFenceAt(position=34)
  ↓
Find fence: typescript, lines 34-60 ✅
  ↓
forwardHover → ensureServer('typescript')
  ↓
Spawn fails (ENOENT)
  ↓
Store dead server
  ↓
Return null
  ↓
getLanguageHint('typescript')
  ↓
server.dead === true ✅
  ↓
Generate: "⚠️ Language Server Not Available: typescript"
  ↓
Show hint! 🎉
```

## Expected Logs After Fix

### Ruby Fence (Unsupported)

```
[EMBED] detected fence lang=ruby (unsupported) lines=21-23 (fence at line 20)
[EMBED] extracted 7 fence(s)  // ← Now 7 instead of 6!

→ findFenceAt: cached fences=7
→ Fence ranges:
   [0] ruby: lines 21-23        // ← Ruby now cached!
   [1] typescript: lines 34-60
   ...
→ Found fence: lang=ruby, lines=21-23

→ Fence check: found=yes (ruby)
→ Position inside embedded fence lang=ruby
[EMBED] skip lang=ruby: no backend available
→ Embedded hover unavailable, showing helpful hint

(Hover shows: "🔍 Language Not Supported: ruby")
```

## Benefits

### 1. ✅ All Fences Cached
- Supported languages: cached for server spawn
- Unsupported languages: cached for hint generation
- No fences skipped

### 2. ✅ Consistent Behavior
- Every fence gets metadata
- Every fence can show hints
- No silent failures

### 3. ✅ Better UX
- Hover over Ruby → See "Language Not Supported" hint
- Hover over Python (not installed) → See install instructions
- Hover over TypeScript (installed) → See real hover info

### 4. ✅ Extensible
- Adding new unsupported language? Works automatically
- User types typo? Gets suggestion
- Unknown language? Gets full list of supported ones

## Testing

### Test Case 1: Ruby (Unsupported)

**Action:** Hover over `def greet` at line 22

**Expected Logs:**
```
[EMBED] detected fence lang=ruby (unsupported) lines=21-23
→ Found fence: lang=ruby, lines=21-23
→ Fence check: found=yes (ruby)
```

**Expected Hover:**
```markdown
🔍 Language Not Supported: ruby

This language is not yet configured in the embedded language registry.

Did you mean? rust

Supported languages: typescript, python, rust, go, java, 
csharp, bash, sql, json, yaml

To add support: Update embeddedRegistry.ts with the language 
server configuration.
```

### Test Case 2: Still Works for Supported Languages

**Action:** Hover over TypeScript code (without typescript-language-server installed)

**Expected:**
- ✅ Fence detected: `typescript: lines 34-60`
- ✅ Spawn fails → dead server stored
- ✅ Hint shown: "⚠️ Language Server Not Available: typescript"

## Code Changes Summary

**File:** `server/src/embedded/embeddedManager.ts`

**Location:** `extractFences()` method, fence detection logic

**Lines Changed:** ~15 lines

**Key Changes:**
1. Removed early return for unsupported languages
2. Use `langRaw.toLowerCase()` for unsupported languages
3. Use `runtime.entry!.id` for supported languages
4. Add conditional logging for unsupported vs supported
5. All fences now pushed to cache

**Compilation:** ✅ Clean (0 errors)

## Verification Checklist

- [x] Code compiles without errors
- [x] Unsupported fences no longer skipped
- [x] `normalizedLang` handles both modes
- [x] Logging differentiates supported/unsupported
- [ ] Hover over Ruby shows "Language Not Supported" (user to verify)
- [ ] Hover over TypeScript shows "Server Not Available" (user to verify)
- [ ] Hover over working server shows real info (user to verify)

## Next Steps

1. **Reload VS Code** to load the updated extension
2. **Hover over Ruby code** (line 22) in `sample-resume.lsptoy`
3. **Verify** you see: "🔍 Language Not Supported: ruby"
4. **Hover over TypeScript code** (line 34) if server not installed
5. **Verify** you see: "⚠️ Language Server Not Available: typescript"

---

**Status:** ✅ Fixed and ready for testing  
**Impact:** High - enables hints for unsupported languages  
**Risk:** Low - only changes cache population logic  
**Related:** FIX_SPAWN_HINTS.md, HOVER_HINTS_SUMMARY.md

**Test now:** Reload and hover over the Ruby code at line 22!
