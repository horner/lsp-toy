# Adding Bundled Language Servers

This guide shows how to add new bundled language servers to LSP-Toy.

## Overview

Bundled servers provide language support without requiring external installations. They're compiled into self-contained JavaScript files and distributed with LSP-Toy.

## Step-by-Step Process

### 1. Create the Language Server

Create a new file in `src/bundled-servers/` (e.g., `json-server.ts`):

```typescript
import {
  createConnection,
  TextDocuments,
  InitializeResult,
  // ... other imports
} from 'vscode-languageserver/node';

class BundledLanguageServer {
  private connection = createConnection(ProposedFeatures.all);
  private documents = new TextDocuments(TextDocument);

  constructor() {
    this.setupHandlers();
  }

  private setupHandlers() {
    // Initialize capabilities
    this.connection.onInitialize((params) => {
      return {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          completionProvider: { triggerCharacters: ['"', ':'] },
          hoverProvider: true,
          // Add other capabilities as needed
        }
      };
    });

    // Implement handlers
    this.connection.onCompletion(this.handleCompletion.bind(this));
    this.connection.onHover(this.handleHover.bind(this));
    
    // Setup document listeners
    this.documents.listen(this.connection);
    this.connection.listen();
  }

  private handleCompletion(params): CompletionItem[] {
    // Language-specific completion logic
  }

  private handleHover(params): Hover | null {
    // Language-specific hover logic
  }
}

// Export and start server
if (require.main === module) {
  new BundledLanguageServer();
}
export { BundledLanguageServer };
```

### 2. Add to Build Configuration

Update `scripts/build-bundled-servers.js`:

```javascript
const BUNDLED_SERVERS = [
  // ... existing servers
  {
    name: 'your-language-server',
    entryPoint: './src/bundled-servers/your-language-server.ts',
    external: [
      'vscode-languageserver',
      'vscode-languageserver-textdocument',
    ]
  }
];
```

### 3. Update Registry

Update `server/src/embedded/embeddedRegistry.ts`:

```typescript
{
  id: 'your-language',
  aliases: ['lang', 'yourlang'],
  node: { 
    cmd: './dist/bundled-servers/your-language-server.js',
    args: ['--stdio'],
    bundled: true,
    fallback: { cmd: 'external-language-server', args: ['--stdio'] }
  },
  capabilities: {
    completion: true,
    hover: true,
    diagnostics: true,
    // ... other capabilities
  }
}
```

### 4. Build and Test

```bash
# Compile TypeScript
npm run compile

# Build bundled servers
npm run build:bundled

# Test the server directly
echo '{}' | node dist/bundled-servers/your-language-server.js --stdio

# Test integration
npm run test:bundled
```

### 5. Add to Sample File

Update `samples/sample-resume.lsptoy` with examples:

````markdown
### Your Language Example

```yourlang
// Example code that shows off completion and hover
const example = "test";
```
````

## Implementation Tips

### Language-Specific Considerations

**Simple Languages (JSON, YAML, TOML)**
- Focus on syntax validation and basic completion
- Small bundle size (~10KB)
- Fast implementation

**Complex Languages (Python, Go, Rust)**  
- May require large dependencies
- Consider web worker implementation
- Evaluate bundle size vs. external server

### Completion Strategies

```typescript
// Context-aware completion
const text = document.getText();
const beforeCursor = text.substring(0, offset);

if (beforeCursor.endsWith('.')) {
  // Method/property completion
} else if (beforeCursor.match(/^\s*$/)) {
  // Top-level completion
}
```

### Hover Information

```typescript
// Word-based hover
const wordRange = getWordRangeAtPosition(document, position);
const word = document.getText(wordRange);

const documentation = getDocumentationFor(word);
return {
  contents: {
    kind: MarkupKind.Markdown,
    value: `**${word}**\n\n${documentation}`
  },
  range: wordRange
};
```

### Error Handling

```typescript
// Graceful degradation
try {
  return this.languageService.getCompletions(uri, position);
} catch (error) {
  console.error('Completion failed:', error);
  return []; // Return empty instead of throwing
}
```

## Current Bundled Servers

| Language | Bundle Size | Status | Capabilities |
|----------|-------------|---------|--------------|
| TypeScript | 9.7MB | ✅ Complete | Completion, Hover, Diagnostics |
| JSON | 7KB | ✅ Complete | Completion, Hover, Validation |

## Future Candidates

**High Priority** (small, commonly used):
- YAML (structured data)
- CSS (styling)
- HTML (markup)

**Medium Priority** (moderate size):
- Python (popular, but large)
- Bash (scripting)

**Low Priority** (very large or specialized):
- Java (requires complex setup)
- C# (requires .NET)
- Rust (large toolchain)

## Benefits of Bundled Servers

1. **Zero Setup**: Works immediately after LSP-Toy installation
2. **Reliability**: No "server not found" errors
3. **Consistency**: Same behavior across all environments
4. **Offline**: Works without internet connectivity
5. **Performance**: No process spawning overhead

## Limitations

1. **Bundle Size**: Each server increases distribution size
2. **Feature Completeness**: May have fewer features than full servers
3. **Maintenance**: Need to maintain server implementations
4. **Memory Usage**: All servers loaded in same process

Choose bundled servers for languages that are:
- Commonly used in documentation/resumes
- Small implementation size
- Don't require complex external dependencies