# Visual Example: Hover Hints in Action

This document shows exactly what you'll see when you hover over code in different scenarios.

## Scenario 1: Ruby (Not Supported)

**Your code fence:**
````markdown
```ruby
def greet(name)
  puts "Hello, #{name}!"
end
```
````

**You hover your mouse over `def` and see:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Language Not Supported: ruby                                 │
│                                                                   │
│ This language is not yet configured in the embedded language     │
│ registry.                                                         │
│                                                                   │
│ Did you mean? rust                                               │
│                                                                   │
│ Supported languages: typescript, python, rust, go, java,         │
│ csharp, bash, sql, json, yaml                                    │
│                                                                   │
│ To add support: Update embeddedRegistry.ts with the language     │
│ server configuration.                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Scenario 2: Python (Not Installed)

**Your code fence:**
````markdown
```python
def process_data(items):
    return [x * 2 for x in items]
```
````

**You hover over `def` and see:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Language Server Not Available: python                        │
│                                                                   │
│ The language server failed to start. This usually means the      │
│ server is not installed.                                          │
│                                                                   │
│ Required command: pyright-langserver                             │
│                                                                   │
│ Installation:                                                     │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ pip install pyright                                       │   │
│ │ # or                                                      │   │
│ │ npm install -g pyright                                    │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│ Note: You may need to create a symlink:                          │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ ln -s $(which pyright) /usr/local/bin/pyright-langserver │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│ After installing: Reload the VS Code window (Cmd/Ctrl+Shift+P   │
│ → "Developer: Reload Window")                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Scenario 3: TypeScript (Working! ✅)

**Your code fence:**
````markdown
```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const user: User = { id: 1, name: "Jane", email: "jane@example.com" };
```
````

**You hover over `User` and see:**

```
┌─────────────────────────────────────────────────────────────────┐
│ interface User                                                    │
│                                                                   │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ interface User {                                          │   │
│ │   id: number;                                             │   │
│ │   name: string;                                           │   │
│ │   email: string;                                          │   │
│ │ }                                                         │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Real TypeScript hover info - no hint needed!** 🎉

## Scenario 4: Typo (typscript)

**Your code fence with typo:**
````markdown
```typscript
const x = 10;
```
````

**You hover over `const` and see:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Language Not Supported: typscript                            │
│                                                                   │
│ This language is not yet configured in the embedded language     │
│ registry.                                                         │
│                                                                   │
│ Did you mean? typescript                                         │
│                                                                   │
│ Supported languages: typescript, python, rust, go, java,         │
│ csharp, bash, sql, json, yaml                                    │
│                                                                   │
│ To add support: Update embeddedRegistry.ts with the language     │
│ server configuration.                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Scenario 5: Shell/Bash Alias

**Your code fence:**
````markdown
```shell
echo "Hello World"
```
````

**You hover over `echo` and see:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔍 Language Not Supported: shell                                │
│                                                                   │
│ This language is not yet configured in the embedded language     │
│ registry.                                                         │
│                                                                   │
│ Did you mean? bash                                               │
│                                                                   │
│ Supported languages: typescript, python, rust, go, java,         │
│ csharp, bash, sql, json, yaml                                    │
│                                                                   │
│ To add support: Update embeddedRegistry.ts with the language     │
│ server configuration.                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Fix:** Change `shell` to `bash` and reload!

## Scenario 6: Rust (Not Installed)

**Your code fence:**
````markdown
```rust
fn main() {
    println!("Hello, world!");
}
```
````

**You hover over `fn` and see:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Language Server Not Available: rust                          │
│                                                                   │
│ The language server failed to start. This usually means the      │
│ server is not installed.                                          │
│                                                                   │
│ Required command: rust-analyzer                                  │
│                                                                   │
│ Installation:                                                     │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ rustup component add rust-analyzer                        │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│ After installing: Reload the VS Code window (Cmd/Ctrl+Shift+P   │
│ → "Developer: Reload Window")                                    │
└─────────────────────────────────────────────────────────────────┘
```

## Scenario 7: JSON (Not Installed)

**Your code fence:**
````markdown
```json
{
  "name": "lsp-toy",
  "version": "0.0.1"
}
```
````

**You hover over a key and see:**

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ Language Server Not Available: json                          │
│                                                                   │
│ The language server failed to start. This usually means the      │
│ server is not installed.                                          │
│                                                                   │
│ Required command: vscode-json-language-server                    │
│                                                                   │
│ Installation:                                                     │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ npm install -g vscode-langservers-extracted               │   │
│ └───────────────────────────────────────────────────────────┘   │
│                                                                   │
│ After installing: Reload the VS Code window (Cmd/Ctrl+Shift+P   │
│ → "Developer: Reload Window")                                    │
└─────────────────────────────────────────────────────────────────┘
```

## The User Journey

### First Time User

```
1. Open sample-resume.lsptoy
2. See TypeScript code fence
3. Hover over `interface User`
4. See: "⚠️ Language Server Not Available"
5. Copy install command from tooltip
6. Run: npm install -g typescript typescript-language-server
7. Reload VS Code (Cmd+Shift+P → Reload Window)
8. Hover again
9. See: Real TypeScript hover info! ✅
10. Success! Feature is now working
```

### Experienced User

```
1. Add new Python code fence
2. Hover to check what's available
3. See: "⚠️ pyright not installed"
4. Already know what to do
5. Install pyright
6. Continue working
```

### Power User

```
1. Add Ruby code fence
2. Hover to check
3. See: "🔍 Language Not Supported"
4. Read: "Update embeddedRegistry.ts"
5. Add Ruby to registry
6. Configure ruby-lsp command
7. Now Ruby works!
```

## Copy-Paste Ready

For testing, copy these into `samples/sample-resume.lsptoy`:

```markdown
### Test: Unsupported Language

```ruby
puts "Hello, Ruby!"
```

### Test: Missing Server (change to python if you have it installed)

```python
print("Hello, Python!")
```

### Test: Typo

```typscript
const x = 10;
```

### Test: Alias

```shell
echo "Test"
```
```

Then hover over code in each fence to see the different hints!

---

**Visual Design Notes:**

- 🔍 icon = "Not found/Not supported" (search metaphor)
- ⚠️ icon = "Missing dependency" (warning metaphor)
- ✅ icon = "Working correctly" (success metaphor)

**Markdown Formatting:**

- Headers: `###` with emoji for visual hierarchy
- Code blocks: Indented for installation commands
- Bold: `**Required command:**` for emphasis
- Inline code: `` `command` `` for technical terms

**User-Friendly Elements:**

- Clear problem statement
- Actionable solution
- Next steps (reload window)
- "Did you mean?" suggestions
- List of supported languages

---

**Last Updated:** October 12, 2025  
**Status:** Ready for testing  
**Try it:** Open `samples/sample-resume.lsptoy` and hover over the Ruby code!
