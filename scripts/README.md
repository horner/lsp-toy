# Language Server Support

🚀 **LSP-Toy includes bundled language servers that work out-of-the-box!**

## Built-in (No Installation Required)
- **TypeScript/JavaScript**: Full completion, hover, and diagnostics support

## Optional External Language Servers

Want support for more languages? Install these manually:

### Node.js/npm Languages
```bash
# Python
npm install -g pyright

# JSON & YAML  
npm install -g vscode-json-languageserver yaml-language-server

# Shell scripting
npm install -g bash-language-server

# SQL
npm install -g sql-language-server
```

### Other Language Toolchains
```bash
# Rust (requires Rust toolchain)
cargo install rust-analyzer

# Go (requires Go toolchain)  
go install golang.org/x/tools/gopls@latest
```

### Complex Installations
- **Java**: Use VS Code Java extension pack or download Eclipse JDT Language Server
- **C#**: Install .NET SDK, then `dotnet tool install -g omnisharp`

## Testing Language Support

Create a `.lsptoy` file to test:

```markdown
# Test Document

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

1. Open this file in VS Code with LSP-Toy extension
2. Hover over line 1 to see tree outline
3. Try completion inside the TypeScript code fence

## Troubleshooting

### Permission Errors
On Unix systems, you may need to run with elevated permissions:
```bash
sudo ./scripts/install-language-servers.sh
```

### PATH Issues
After installation, restart your terminal or VS Code to ensure new language servers are in your PATH.

### Language Server Not Found
If a language server isn't detected after installation:
1. Check it's in your PATH: `which typescript-language-server`
2. Restart VS Code
3. Check LSP-Toy output panel for connection errors

### Network Issues
If npm installations fail:
```bash
# Try using different registry
npm config set registry https://registry.npmjs.org/
```

## Verification

The scripts automatically verify installations. You can also manually check:

```bash
# Check individual language servers
typescript-language-server --version
pyright-langserver --version  
rust-analyzer --version
gopls version
```

## Supported Languages

| Language | LSP Server | Installation Method |
|----------|------------|-------------------|
| TypeScript/JavaScript | typescript-language-server | npm (auto) |
| Python | pyright | npm (auto) |
| Rust | rust-analyzer | cargo (manual) |
| Go | gopls | go install (manual) |
| Java | jdtls | Download/VS Code (manual) |
| C# | omnisharp | dotnet tool (manual) |
| Bash/Shell | bash-language-server | npm (auto) |
| JSON | vscode-json-languageserver | npm (auto) |
| YAML | yaml-language-server | npm (auto) |
| SQL | sql-language-server | npm (auto) |

## Customization

You can customize language server configurations by creating a `.lsptoy-languages.json` file in your workspace root. See the [Embedded Language Guide](../docs/features/EMBEDDED_README.md) for details.