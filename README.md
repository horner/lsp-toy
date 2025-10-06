# lsp-toy

A VS Code LSP server that helps you author resume-style Markdown documents inside `.lsptoy` files.

## ✨ Features

| Capability | Description | Example Behavior |
| --- | --- | --- |
| Diagnostics | Warns on `TODO` comments and relative links that do not resolve on disk. | Highlights `TODO` lines and `[Project](./missing.md)` as warnings. |
| Code Actions | Offers focused quick fixes for diagnostics. | "Mark TODO as done" or "Remove broken link". |
| Completions | Suggests resume sections and Markdown formatting as you type. | Trigger with `#` or `[` for headings, links, and formatting snippets. |
| Hover | Displays helpful tooltips for well-known technologies and links. | Hover `Rust` to see a short description. |
| Signature Help | Guides pseudo calls such as `contact("Jane", "Doe")`. | Shows parameter names and descriptions while typing. |
| Semantic Tokens | Adds semantic coloring for headings, emphasis, links, code spans, and TODOs. | Headings/bold/links receive dedicated token types. |
| Tree-sitter AST | Uses the `tree-sitter-markdown` grammar (via WASM) for parsing instead of regex heuristics. | Diagnostics and tokens stay in sync with the Markdown structure. |

## 🚀 Getting started

```bash
npm install
npm run fetch:wasm   # Download prebuilt WASM files
npm run compile
```

### WASM Grammar Files

The language server uses `tree-sitter-markdown` compiled to WebAssembly for cross-platform parsing. **Prebuilt WASM files are included**, so you don't need to compile anything!

#### Quick Setup (Recommended)

Download the latest prebuilt WASM files:
```bash
npm run fetch:wasm
# or update to latest version
npm run update:wasm
```

The script automatically:
- ✓ Downloads both WASM files from GitHub releases
- ✓ Verifies they're valid WebAssembly modules
- ✓ Updates version information in documentation
- ✓ Skips download if files are already current

#### Advanced: Building WASM Yourself

If you need to build from source (usually unnecessary):

```bash
npm run build:wasm
```

Requirements:
- Emscripten: `brew install emscripten` (macOS) or https://emscripten.org/docs/getting_started/downloads.html
- Or Docker (automatically detected by build script)

**Note**: The original `ikatyang/tree-sitter-markdown` grammar cannot compile to WASM. This project uses prebuilt files from `tree-sitter-grammars/tree-sitter-markdown` which is WASM-compatible. See `GRAMMAR_NOTES.md` for details.

###

## ✨ Features

| Capability | Description | Example Behavior |
| --- | --- | --- |
| Diagnostics | Warns on `TODO` comments and relative links that do not resolve on disk. | Highlights `TODO` lines and `[Project](./missing.md)` as warnings. |
| Code Actions | Offers focused quick fixes for diagnostics. | “Mark TODO as done” or “Remove broken link”. |
| Completions | Suggests resume sections and Markdown formatting as you type. | Trigger with `#` or `[` for headings, links, and formatting snippets. |
| Hover | Displays helpful tooltips for well-known technologies and links. | Hover `Rust` to see a short description. |
| Signature Help | Guides pseudo calls such as `contact("Jane", "Doe")`. | Shows parameter names and descriptions while typing. |
| Semantic Tokens | Adds semantic coloring for headings, emphasis, links, code spans, and TODOs. | Headings/bold/links receive dedicated token types. |
| Tree-sitter AST | Uses the `tree-sitter-markdown` grammar for parsing instead of regex heuristics. | Diagnostics and tokens stay in sync with the Markdown structure. |

## 🚀 Getting started

```bash
npm install
npm run compile
```

> **Note**
> The language server depends on Tree-sitter’s native bindings. If `npm install` fails with a C++ compiler error, rerun the command with `CXXFLAGS="-std=c++20" npm install` to enable C++20 support during the build.

If you see a `NODE_MODULE_VERSION` mismatch when launching the extension (for example when using <kbd>F5</kbd>), rebuild the native bindings against the Node runtime bundled with VS Code:

```bash
npm run rebuild:tree-sitter
```

The script will try to detect your VS Code CLI (`code`) automatically. If that is not on your PATH, set `VSCODE_EXECUTABLE_PATH` or `LSP_TOY_NODE_TARGET` before running the command to point at the correct runtime.

### Running the server directly

Compile first, then start the language server over stdio (default) or bind it to a TCP port:

```bash
node server/out/server.js            # stdio mode
LSP_PORT=2087 node server/out/server.js  # TCP socket on port 2087
# or node server/out/server.js --port 2087
```

Open `samples/sample-resume.lsptoy`, press <kbd>F5</kbd> to launch the Extension Development Host, and explore diagnostics, completions, hovers, and semantic colors in action.

## 🧪 Sample document

Use `samples/sample-resume.lsptoy` as a playground. It intentionally includes a `TODO` and a broken relative link so you can try the quick fixes. Typing `#` or `[` will surface completion suggestions tailored for résumé authoring.

## 🔧 Development

- `npm run compile` – build both the client and the server once.
- `npm run watch` – rebuild on every change.
- `npm test` – run the command-line stdio smoke test against the sample document.
- `npm run fetch:wasm` – download the latest prebuilt WASM files.
- `npm run build:wasm` – build WASM from source (requires Emscripten or Docker).

The extension entry point lives in `client/src/extension.ts`. The language server logic is implemented in `server/src/server.ts`.

## 📄 License

This project is released under the MIT License.
