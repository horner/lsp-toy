# Tree Outline Feature

## Overview

The Tree Outline feature helps you visualize the parsed structure of your LSP-Toy documents using tree-sitter. This is useful for:

- **Debugging** - Understanding how tree-sitter parses your Markdown
- **Learning** - Seeing the node hierarchy and types
- **Development** - Verifying fence detection and position mapping

## Usage

### Method 1: Hover on Line 1 (Quick View)

1. Open any `.lsptoy` file
2. Hover your mouse over the **first line** (line 1) of the document
3. The tree outline appears in the hover tooltip
4. The full outline is also logged to the Output panel

### Method 2: Command Palette (Full View)

1. Open any `.lsptoy` file
2. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
3. Type "Show Document Tree Outline" or "tree outline"
4. Select **"LSP-Toy: Show Document Tree Outline"**
5. Check the **Output panel** (View → Output → LSP-Toy)

## Output Format

```
=== Document Tree Outline ===
URI: file:///path/to/document.lsptoy

Document Tree Outline (depth: 3):
document [0:0-278:0]
  ├─ atx_heading [0:0-0:10] "# Jane Doe"
  ├─ paragraph [2:0-3:75] "Senior Software Engineer..."
  ├─ atx_heading [5:0-5:10] "## Summary"
  ├─ paragraph [7:0-9:226]
  ├─ fenced_code_block [22:0-26:3]
  │  ├─ info_string [22:3-22:7] "ruby"
  │  └─ code_fence_content [23:0-25:3] "def greet..."
  ├─ fenced_code_block [28:0-40:3]
  │  ├─ info_string [28:3-28:13] "typescript"
  │  └─ code_fence_content [29:0-39:3] "interface..."
  └─ ...

=============================
```

## Understanding the Output

Each line shows:
- **Node type** - e.g., `atx_heading`, `fenced_code_block`, `paragraph`
- **Position range** - `[startLine:col-endLine:col]` in 0-indexed coordinates
- **Text preview** - First 50 characters of the node's text content

### Common Node Types

| Node Type | Description |
|-----------|-------------|
| `document` | Root node of the entire document |
| `atx_heading` | Markdown heading (# ## ###) |
| `paragraph` | Block of text |
| `fenced_code_block` | Code fence (```language) |
| `info_string` | Language identifier in code fence |
| `code_fence_content` | Actual code inside fence |
| `list` | Unordered or ordered list |
| `list_item` | Individual list item |
| `inline` | Inline content container |
| `emphasis` | *italic* text |
| `strong_emphasis` | **bold** text |
| `code_span` | `inline code` |

## Depth Control

The outline shows **3 levels** of nesting by default. This prevents overwhelming output for large documents.

To adjust the depth, modify the `maxDepth` parameter in:
- `server/src/utils/tree.ts` → `generateTreeOutline()` function
- `server/src/capabilities/hover.ts` → line 1 hover handler

## Performance Notes

- Tree outline generation is **disabled by default** during document parsing
- It only runs when explicitly requested (hover or command)
- Large documents (>500 lines) may take 1-2 seconds to generate
- Output is truncated after 50KB to prevent memory issues

## Troubleshooting

### "No tree available for document"
- The document failed to parse
- Check the Output panel for parser errors
- Verify the file is a valid `.lsptoy` file

### Hover shows normal hover instead of outline
- Make sure you're hovering on **line 1** (the very first line)
- The hover should show "📋 Document Tree Outline" header
- Check that the file is saved and parsed

### Command doesn't appear
- Reload the VS Code window (`Cmd+R` or `Ctrl+R`)
- Verify the extension is activated (check Output panel)
- Make sure you have a `.lsptoy` file open

## Technical Details

### Implementation Files

- `server/src/utils/tree.ts` → `generateTreeOutline()` function
- `server/src/utils/document.ts` → `showDocumentOutline()` helper
- `server/src/capabilities/hover.ts` → Line 1 hover integration
- `server/src/server.ts` → Command registration
- `client/src/extension.ts` → Client-side command handler
- `package.json` → Command contribution point

### Architecture

```
User Action (Hover/Command)
    ↓
Client Extension (extension.ts)
    ↓
LSP Server (server.ts)
    ↓
Document Manager (document.ts)
    ↓
Tree Utilities (tree.ts)
    ↓
Tree-Sitter Parser (web-tree-sitter)
    ↓
Generate ASCII Tree Outline
    ↓
Display in Hover / Log to Console
```

## Future Enhancements

- [ ] Add configuration setting for default depth
- [ ] Support filtering by node type
- [ ] Add syntax highlighting to outline
- [ ] Show node counts and statistics
- [ ] Export outline to file
- [ ] Interactive outline navigation
- [ ] Collapsible tree view in sidebar

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
- [TESTING_CHECKLIST.md](./TESTING_CHECKLIST.md) - Feature testing guide
- [README.md](./README.md) - Main project documentation
