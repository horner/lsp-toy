# Tree-sitter Grammar Notes

## Grammar Source

This project uses **tree-sitter-grammars/tree-sitter-markdown** (v0.5.1) instead of the original **ikatyang/tree-sitter-markdown** (v0.7.1).

### Why tree-sitter-grammars?

The tree-sitter-grammars organization maintains WASM-compatible versions of popular grammars. The original ikatyang/tree-sitter-markdown uses a complex C++ scanner that relies on symbols unavailable in WebAssembly environments (`tree_sitter_markdown_external_scanner_*` functions).

### Key Differences

#### Node Types

The tree-sitter-grammars version uses different node type names:

| Concept | ikatyang v0.7.1 | tree-sitter-grammars v0.5.1 |
|---------|-----------------|----------------------------|
| Text content | `text` | `inline` |
| Links | `link` | `link` (same) |

#### Code Impact

When implementing diagnostics, semantic tokens, or other tree-based features:

```typescript
// ❌ Old (ikatyang)
if (node.type === 'text') {
  // process text
}

// ✅ New (tree-sitter-grammars)
if (node.type === 'inline') {
  // process text
}
```

### WASM Files

The project includes two prebuilt WASM files:
- `wasm/tree-sitter-markdown.wasm` (412 KB) - Block-level markdown structures
- `wasm/tree-sitter-markdown_inline.wasm` (417 KB) - Inline markdown structures

Download from: https://github.com/tree-sitter-grammars/tree-sitter-markdown/releases

#### Automatic Download

Use the provided script to download or update WASM files:

```bash
# Download/update to latest version
npm run fetch:wasm
# or
npm run update:wasm

# Download a specific version
node scripts/fetch-wasm.js v0.5.1
```

The script will:
- ✓ Fetch the specified version (or latest) from GitHub releases
- ✓ Download both WASM files to the `wasm/` directory
- ✓ Verify files are valid WASM modules
- ✓ Skip download if files are already up-to-date
- ✓ Automatically update version in `GRAMMAR_NOTES.md`

### Updating the Grammar

To update to a newer version:

1. Check latest release: https://github.com/tree-sitter-grammars/tree-sitter-markdown/releases
2. Download the WASM files to `wasm/` directory
3. Verify node types haven't changed (run tests)
4. Update version in this document

### Available Node Types (v0.5.1)

From the sample document parsing:
- `document` (root)
- `section`
- `atx_heading`, `atx_h1_marker`, `atx_h2_marker`
- `paragraph`
- `inline` (contains text content)
- `block_quote`, `block_quote_marker`, `block_continuation`
- `list`, `list_item`, `list_marker_minus`

For a complete list, see the grammar source:
https://github.com/tree-sitter-grammars/tree-sitter-markdown/blob/main/grammar.js
