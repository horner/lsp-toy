# Change Log

All notable changes to the "lsp-toy" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

- Migrated server parsing to `tree-sitter-markdown` for more reliable diagnostics, semantic tokens, and hovers.
- Documented Tree-sitter build requirements in the README.
- Added optional TCP mode for the language server (set `LSP_PORT` or pass `--port`).
- Added a command-line stdio smoke test (`npm test`) that opens the sample document and verifies diagnostics.
- Added `npm run rebuild:tree-sitter` helper to rebuild native bindings for VS Code’s Node runtime.

## [0.1.0] - 2025-10-05

- Introduced a full Markdown-inspired language server for `.lsptoy` files, including diagnostics, code actions, completions, hovers, signature help, and semantic tokens.
- Added sample document (`samples/sample-resume.lsptoy`) to showcase the language features.