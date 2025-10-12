# Hover Hint Examples

This document shows the helpful hints that appear when hovering over code in fences with unsupported or unavailable language servers.

## Scenario 1: Language Not in Registry

**Code fence:**
````markdown
```ruby
def hello(name)
  puts "Hello, #{name}!"
end
```
````

**Hover message when you hover over `def hello`:**

---

### 🔍 Language Not Supported: `ruby`

This language is not yet configured in the embedded language registry.

**Supported languages:** typescript, python, rust, go, java, csharp, bash, sql, json, yaml

**To add support:** Update `embeddedRegistry.ts` with the language server configuration.

---

## Scenario 2: Language Supported But Server Not Installed (Python)

**Code fence:**
````markdown
```python
def process_data(items):
    return [x * 2 for x in items]
```
````

**Hover message when pyright is not installed:**

---

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

---

## Scenario 3: Language Supported But Server Not Installed (TypeScript)

**Code fence:**
````markdown
```typescript
interface User {
  id: number;
  name: string;
}
```
````

**Hover message when typescript-language-server is not installed:**

---

### ⚠️ Language Server Not Available: `typescript`

The language server failed to start. This usually means the server is not installed.

**Required command:** `typescript-language-server`

**Installation:**
```bash
npm install -g typescript typescript-language-server
```

**After installing:** Reload the VS Code window (Cmd/Ctrl+Shift+P → "Developer: Reload Window")

---

## Scenario 4: Typo in Language Name

**Code fence:**
````markdown
```typscript
// Typo: "typscript" instead of "typescript"
const x = 10;
```
````

**Hover message:**

---

### 🔍 Language Not Supported: `typscript`

This language is not yet configured in the embedded language registry.

**Did you mean?** `typescript`

**Supported languages:** typescript, python, rust, go, java, csharp, bash, sql, json, yaml

**To add support:** Update `embeddedRegistry.ts` with the language server configuration.

---

## Scenario 5: Ambiguous Language Name

**Code fence:**
````markdown
```shell
#!/bin/bash
echo "Hello"
```
````

**Hover message (if 'shell' not recognized):**

---

### 🔍 Language Not Supported: `shell`

This language is not yet configured in the embedded language registry.

**Did you mean?** `bash`

**Supported languages:** typescript, python, rust, go, java, csharp, bash, sql, json, yaml

**To add support:** Update `embeddedRegistry.ts` with the language server configuration.

---

## Scenario 6: Language Server Working ✅

**Code fence:**
````markdown
```typescript
interface User {
  id: number;
  name: string;
}

const user: User = { id: 1, name: "Jane", email: "jane@example.com" };
```
````

**When hovering over `User` (with typescript-language-server installed):**

You see the **actual TypeScript hover information**:
```
interface User {
  id: number;
  name: string;
}
```

No hint message needed! 🎉

---

## Implementation Details

### How It Works

1. **User hovers** over code inside a fence
2. **lsp-toy tries** to forward the hover request to the embedded language server
3. **If server fails** (not installed, crashed, unsupported):
   - `getLanguageHint()` is called
   - Returns a helpful Markdown message
   - Message is shown as hover tooltip
4. **If server succeeds**:
   - Real language server hover is shown
   - No hint needed

### Code Location

- **Hover capability**: `server/src/capabilities/hover.ts`
- **Hint generation**: `server/src/embedded/embeddedManager.ts::getLanguageHint()`

### Message Types

| Situation | Icon | Message Type |
|-----------|------|--------------|
| Language not in registry | 🔍 | "Language Not Supported" |
| Server spawn failed | ⚠️ | "Language Server Not Available" |
| Server working | ✅ | (Real hover from language server) |

### Suggestion Algorithm

The `findSimilarLanguages()` helper provides smart suggestions:

1. **Exact alias match**: `ts` → suggests `typescript`
2. **Same first letter**: `pythom` → suggests `python`
3. **Top 3 matches**: Shows up to 3 suggestions

---

**Benefits:**

1. ✅ **Self-documenting**: Users learn which languages are supported
2. ✅ **Actionable**: Clear installation instructions
3. ✅ **Discoverable**: No need to read docs first
4. ✅ **Helpful**: Catches typos and suggests corrections
5. ✅ **Non-intrusive**: Only shows when hover is triggered

**User Experience:**

```
User: *hovers over Python code*
lsp-toy: "⚠️ pyright not installed, here's how to install it..."
User: *follows instructions, installs pyright, reloads window*
User: *hovers again*
lsp-toy: *shows actual Python type information* ✅
```

---

**Last Updated:** October 12, 2025  
**Phase:** 1 Enhancement  
**Feature:** Contextual help hints in hover tooltips
