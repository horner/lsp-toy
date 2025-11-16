# LSP-Toy Server Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          VS Code Client                         │
│                      (Language Client)                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    LSP Protocol (stdio/TCP)
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                         server.ts                               │
│                    (Main Entry Point)                           │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  • Connection setup (stdio/TCP)                        │     │
│  │  • Parser initialization                               │     │
│  │  • i18n initialization                                 │     │
│  │  • Capability registration                             │     │
│  └────────────────────────────────────────────────────────┘     │
└───────────────────────┬──────────────┬──────────────────────────┘
                        │              │
        ┌───────────────┴──────┐       └─────────────┐
        │                      │                     │
┌───────▼───────┐      ┌───────▼────────┐    ┌-──────▼─────┐
│   parser.ts   │      │    i18n.ts     │    │   types.ts  │
│               │      │                │    │             │
│ • Tree-sitter │      │ • i18next      │    │ • Shared    │
│ • WASM loader │      │ • Translations │    │   interfaces│
│ • Semantic    │      │ • Locales      │    │             │
│   legend      │      │                │    │             │
└───────────────┘      └────────────────┘    └─────────────┘
        │
        │
┌───────▼───────────────────────────────────────────────────────┐
│                      Capabilities Layer                       │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐      │
│  │ diagnostics  │  │  completion  │  │     hover       │      │
│  │              │  │              │  │                 │      │
│  │ • TODO       │  │ • Snippets   │  │ • Glossary      │      │
│  │ • Broken     │  │ • Triggers   │  │ • Links         │      │
│  │   links      │  │              │  │ • TODO info     │      │
│  └──────────────┘  └──────────────┘  └─────────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐      │
│  │  codeAction  │  │ semanticTok- │  │  signatureHelp  │      │
│  │              │  │   ens        │  │                 │      │
│  │ • Quick      │  │              │  │ • Parameters    │      │
│  │   fixes      │  │ • Headings   │  │ • Docs          │      │
│  │              │  │ • Bold/Italic│  │                 │      │
│  └──────────────┘  └──────────────┘  └─────────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐                           │
│  │ inlayHints   │  │ documentSym- │                           │
│  │              │  │   bols       │                           │
│  │ • Placeholder│  │              │                           │
│  │              │  │ • Outline    │                           │
│  │              │  │ • Headings   │                           │
│  └──────────────┘  └──────────────┘                           │
│                                                               │
└──────────────┬───────────────────────────────────────┬────────┘
               │                                       │
               │                                       │
┌──────────────▼───────────┐              ┌────────────▼─────────┐
│    Utils - Document      │              │   Utils - Helpers    │
│                          │              │                      │
│ • document.ts            │              │ • tree.ts            │
│   - Document manager     │              │   - Tree traversal   │
│   - Parse caching        │              │   - Node finding     │
│   - Tree operations      │              │                      │
│                          │              │ • markdown.ts        │
│ • logging.ts             │              │   - Link validation  │
│   - Debug output         │              │   - TODO detection   │
│                          │              │   - Glossary         │
│ • network.ts             │              │                      │
│   - Port resolution      │              │                      │
│                          │              │                      │
└──────────────────────────┘              └──────────────────────┘

                    ┌─────────────────────┐
                    │  External Resources │
                    │                     │
                    │ • WASM parsers      │
                    │ • Translation files │
                    │ • Config files      │
                    └─────────────────────┘
```

## Data Flow

### 1. Document Opens/Changes
```
VS Code Client
    │
    ├─→ server.ts (receives event)
    │       │
    │       ├─→ DocumentManager (caches document)
    │       │
    │       └─→ diagnostics.ts
    │               │
    │               ├─→ parser.ts (parse to AST)
    │               │
    │               ├─→ tree.ts (traverse nodes)
    │               │
    │               └─→ markdown.ts (validate content)
    │
    └─← Diagnostics sent back
```

### 2. Completion Request
```
VS Code Client (user types trigger char)
    │
    ├─→ completion.ts
    │       │
    │       ├─→ DocumentManager (get document)
    │       │
    │       └─→ i18n.ts (localized labels)
    │
    └─← Completion items returned
```

### 3. Hover Request
```
VS Code Client (user hovers over text)
    │
    ├─→ hover.ts
    │       │
    │       ├─→ DocumentManager (get document + tree)
    │       │
    │       ├─→ tree.ts (find node at position)
    │       │
    │       └─→ markdown.ts (get glossary/link info)
    │
    └─← Hover content returned
```

## Module Responsibilities

| Module | Lines | Responsibility |
|--------|-------|----------------|
| `server.ts` | ~150 | Connection setup, initialization, capability registration |
| `parser.ts` | ~50 | Tree-sitter initialization, WASM loading |
| `i18n.ts` | ~50 | Translation loading, locale management |
| `types.ts` | ~20 | Shared TypeScript interfaces |
| `capabilities/diagnostics.ts` | ~120 | Validation, TODO & link checking |
| `capabilities/completion.ts` | ~80 | Completion items generation |
| `capabilities/hover.ts` | ~100 | Hover information for links, TODOs, glossary |
| `capabilities/codeAction.ts` | ~50 | Quick fixes for diagnostics |
| `capabilities/semanticTokens.ts` | ~150 | Semantic highlighting |
| `capabilities/signatureHelp.ts` | ~70 | Function signature hints |
| `capabilities/inlayHints.ts` | ~20 | Placeholder for inlay hints |
| `capabilities/documentSymbols.ts` | ~40 | Document outline generation |
| `utils/document.ts` | ~60 | Document & tree management |
| `utils/tree.ts` | ~40 | Tree traversal utilities |
| `utils/markdown.ts` | ~100 | Markdown-specific logic |
| `utils/logging.ts` | ~30 | Debug logging |
| `utils/network.ts` | ~50 | Port resolution |

**Total**: ~1,180 lines (organized) vs ~800 lines (monolithic)

The slight increase in line count is due to:
- Module exports/imports
- Better documentation
- Clearer separation with whitespace
- Type safety improvements
