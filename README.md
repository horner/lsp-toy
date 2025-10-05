# lsp-toy

A VS Code language server that helps you author resume-style Markdown documents inside `.lsptoy` files.

## ✨ Features

| Capability | Description | Example Behavior |
| --- | --- | --- |
| Diagnostics | Warns on `TODO` comments and relative links that do not resolve on disk. | Highlights `TODO` lines and `[Project](./missing.md)` as warnings. |
| Code Actions | Offers focused quick fixes for diagnostics. | “Mark TODO as done” or “Remove broken link”. |
| Completions | Suggests resume sections and Markdown formatting as you type. | Trigger with `#` or `[` for headings, links, and formatting snippets. |
| Hover | Displays helpful tooltips for well-known technologies and links. | Hover `Rust` to see a short description. |
| Signature Help | Guides pseudo calls such as `contact("Jane", "Doe")`. | Shows parameter names and descriptions while typing. |
| Semantic Tokens | Adds semantic coloring for headings, emphasis, links, code spans, and TODOs. | Headings/bold/links receive dedicated token types. |

## 🚀 Getting started

```bash
npm install
npm run compile
```

Open `samples/sample-resume.lsptoy`, press <kbd>F5</kbd> to launch the Extension Development Host, and explore diagnostics, completions, hovers, and semantic colors in action.

## 🧪 Sample document

Use `samples/sample-resume.lsptoy` as a playground. It intentionally includes a `TODO` and a broken relative link so you can try the quick fixes. Typing `#` or `[` will surface completion suggestions tailored for résumé authoring.

## 🔧 Development

- `npm run compile` – build both the client and the server once.
- `npm run watch` – rebuild on every change.

The extension entry point lives in `client/src/extension.ts`. The language server logic is implemented in `server/src/server.ts`.

## 📄 License

This project is released under the MIT License.
