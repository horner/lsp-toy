# LSP-Toy Bundled Distribution Architecture

## Overview
Transform LSP-Toy into a self-contained distribution that works in both Node.js and web environments, with bundled language servers and web worker support.

## Distribution Structure

```
lsp-toy-bundle/
├── package.json                    # Main package
├── dist/
│   ├── node/
│   │   ├── server.js              # Node.js LSP server
│   │   ├── bundled-servers/       # Embedded language servers
│   │   │   ├── typescript-server.js
│   │   │   ├── pyright-server.js
│   │   │   ├── json-server.js
│   │   │   └── yaml-server.js
│   │   └── wasm/
│   │       ├── tree-sitter-markdown.wasm
│   │       └── tree-sitter-markdown_inline.wasm
│   └── web/
│       ├── server.js              # Web worker LSP server
│       ├── workers/               # Language server workers
│       │   ├── tsWorker.js        # TypeScript web worker
│       │   ├── pyrightWorker.js   # Python web worker
│       │   ├── jsonWorker.js      # JSON web worker
│       │   └── yamlWorker.js      # YAML web worker
│       └── wasm/
│           ├── tree-sitter-markdown.wasm
│           ├── typescript.wasm    # TypeScript compiler WASM
│           └── pyright.wasm       # Pyright WASM (if available)
└── tools/
    └── bundle-servers.js          # Build script
```

## Runtime Detection & Mode Selection

```typescript
// Enhanced runtime detection
export function detectRuntime(): 'web' | 'node' {
  if (typeof window !== 'undefined' || typeof importScripts !== 'undefined') {
    return 'web';
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    return 'node';
  }
  return 'web'; // Default fallback
}

// Enhanced registry with bundled paths
const BUNDLED_ENTRIES: LangEntry[] = [
  {
    id: 'typescript',
    aliases: ['ts', 'javascript', 'js'],
    web: { 
      workerScript: './workers/tsWorker.js',
      wasmModule: './wasm/typescript.wasm'
    },
    node: { 
      // Use bundled server instead of external dependency
      cmd: './bundled-servers/typescript-server.js',
      args: ['--stdio']
    },
    capabilities: {
      completion: true,
      hover: true,
      diagnostics: true,
      documentSymbol: true,
      signatureHelp: true,
      semanticTokens: true
    }
  }
];
```

## Phase 1: Bundle Node.js Language Servers

### 1.1 Extract Core Language Server Logic
Many language servers can be bundled as modules:

```javascript
// bundled-servers/typescript-server.js
const ts = require('typescript');
const { createConnection, TextDocuments } = require('vscode-languageserver/node');

class BundledTypeScriptServer {
  constructor() {
    this.connection = createConnection();
    this.documents = new TextDocuments();
    this.setupHandlers();
  }

  setupHandlers() {
    this.connection.onCompletion((params) => {
      // Direct TypeScript API usage
      const document = this.documents.get(params.textDocument.uri);
      return this.getCompletions(document, params.position);
    });
  }

  getCompletions(document, position) {
    // Use TypeScript compiler API directly
    const program = ts.createProgram([document.uri], {});
    const sourceFile = program.getSourceFile(document.uri);
    const completions = ts.languageService.getCompletionsAtPosition(
      sourceFile, 
      document.offsetAt(position), 
      {}
    );
    return completions;
  }
}

// Can be spawned as child process or imported directly
if (require.main === module) {
  new BundledTypeScriptServer();
} else {
  module.exports = BundledTypeScriptServer;
}
```

### 1.2 Bundle Build Process
```javascript
// tools/bundle-servers.js
const webpack = require('webpack');
const path = require('path');

const serverConfigs = [
  {
    name: 'typescript-server',
    entry: './src/bundled-servers/typescript.ts',
    external: false, // Bundle everything
    target: 'node'
  },
  {
    name: 'pyright-server',
    entry: './src/bundled-servers/pyright.ts', 
    external: ['fsevents'], // OS-specific externals only
    target: 'node'
  }
];

// Build each server as standalone bundle
serverConfigs.forEach(config => {
  webpack({
    entry: config.entry,
    target: config.target,
    externals: config.external,
    output: {
      path: path.resolve(__dirname, '../dist/node/bundled-servers'),
      filename: `${config.name}.js`,
      libraryTarget: 'commonjs2'
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
  }).run((err, stats) => {
    console.log(`Built ${config.name}: ${stats.compilation.errors.length} errors`);
  });
});
```

## Phase 2: Web Worker Language Servers

### 2.1 TypeScript Web Worker
```javascript
// workers/tsWorker.js
import * as ts from 'typescript/lib/tsserverlibrary';

class TypeScriptWorker {
  constructor() {
    this.languageService = null;
    this.setupMessageHandling();
  }

  setupMessageHandling() {
    self.onmessage = (event) => {
      const { id, method, params } = event.data;
      
      try {
        const result = this.handleRequest(method, params);
        self.postMessage({ id, result });
      } catch (error) {
        self.postMessage({ id, error: error.message });
      }
    };
  }

  handleRequest(method, params) {
    switch (method) {
      case 'completion':
        return this.getCompletions(params);
      case 'hover':
        return this.getHover(params);
      case 'initialize':
        return this.initialize(params);
    }
  }

  initialize(params) {
    // Create in-memory TypeScript language service
    const files = new Map();
    
    const host = {
      getScriptFileNames: () => Array.from(files.keys()),
      getScriptVersion: (fileName) => files.get(fileName)?.version || '0',
      getScriptSnapshot: (fileName) => {
        const content = files.get(fileName)?.content || '';
        return ts.ScriptSnapshot.fromString(content);
      },
      getCurrentDirectory: () => '/',
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: (fileName) => files.has(fileName),
      readFile: (fileName) => files.get(fileName)?.content
    };

    this.languageService = ts.createLanguageService(host);
    this.files = files;
    
    return { capabilities: { completion: true, hover: true } };
  }

  updateDocument(uri, content, version) {
    this.files.set(uri, { content, version });
  }

  getCompletions(params) {
    const completions = this.languageService.getCompletionsAtPosition(
      params.textDocument.uri,
      params.position.character,
      {}
    );
    
    return {
      isIncomplete: false,
      items: completions?.entries.map(entry => ({
        label: entry.name,
        kind: this.convertCompletionKind(entry.kind),
        detail: entry.kindModifiers,
        insertText: entry.insertText || entry.name
      })) || []
    };
  }

  convertCompletionKind(tsKind) {
    // Convert TypeScript completion kinds to LSP CompletionItemKind
    const kindMap = {
      [ts.ScriptElementKind.functionElement]: 3, // Function
      [ts.ScriptElementKind.variableElement]: 6, // Variable
      [ts.ScriptElementKind.classElement]: 7,    // Class
      // ... more mappings
    };
    return kindMap[tsKind] || 1; // Text fallback
  }
}

new TypeScriptWorker();
```

### 2.2 Enhanced EmbeddedLanguageManager for Web Workers
```typescript
// Enhanced manager with web worker support
class EmbeddedLanguageManager {
  private workers = new Map<string, Worker>();
  private nodeServers = new Map<string, ChildProcess>();

  async ensureServer(lang: string): Promise<ServerHandle> {
    const runtime = pickRuntime(lang);
    
    switch (runtime.mode) {
      case 'web':
        return this.ensureWebWorker(lang, runtime);
      case 'node':
        return this.ensureNodeServer(lang, runtime);
      default:
        throw new Error(`Unsupported runtime for ${lang}`);
    }
  }

  private async ensureWebWorker(lang: string, runtime: ResolvedRuntime) {
    let worker = this.workers.get(lang);
    
    if (!worker) {
      // Create worker from bundled script
      const workerPath = path.resolve(__dirname, runtime.impl.workerScript);
      worker = new Worker(workerPath);
      
      // Initialize worker with LSP capabilities
      const initResult = await this.sendWorkerMessage(worker, {
        method: 'initialize',
        params: {
          capabilities: {
            textDocument: {
              completion: { dynamicRegistration: false },
              hover: { dynamicRegistration: false }
            }
          }
        }
      });
      
      this.workers.set(lang, worker);
    }
    
    return {
      type: 'worker',
      instance: worker,
      send: (message) => this.sendWorkerMessage(worker, message)
    };
  }

  private sendWorkerMessage(worker: Worker, message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36);
      
      const handler = (event: MessageEvent) => {
        if (event.data.id === id) {
          worker.removeEventListener('message', handler);
          if (event.data.error) {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.result);
          }
        }
      };
      
      worker.addEventListener('message', handler);
      worker.postMessage({ id, ...message });
    });
  }
}
```

## Phase 3: WASM Integration

### 3.1 Language Server WASM Modules
Some language servers are being ported to WASM:

```typescript
// WASM language server loader
class WasmLanguageServer {
  private wasmModule: WebAssembly.Module | null = null;
  
  async initialize(wasmPath: string) {
    const wasmBytes = await fetch(wasmPath).then(r => r.arrayBuffer());
    this.wasmModule = await WebAssembly.compile(wasmBytes);
    
    const instance = await WebAssembly.instantiate(this.wasmModule, {
      // Provide required imports
      env: {
        memory: new WebAssembly.Memory({ initial: 256 }),
        // ... other WASI/environment functions
      }
    });
    
    return instance;
  }
}
```

## Build Process Integration

### Package.json Scripts
```json
{
  "scripts": {
    "build": "npm run build:node && npm run build:web",
    "build:node": "webpack --config webpack.node.js",
    "build:web": "webpack --config webpack.web.js",
    "bundle:servers": "node tools/bundle-servers.js",
    "package": "npm run build && npm run bundle:servers && npm run package:dist"
  }
}
```

### Webpack Configuration
```javascript
// webpack.web.js
module.exports = {
  target: 'webworker',
  entry: './src/server.ts',
  output: {
    path: path.resolve(__dirname, 'dist/web'),
    filename: 'server.js',
    library: 'LSPToyServer',
    libraryTarget: 'umd'
  },
  resolve: {
    fallback: {
      // Polyfills for Node.js modules in browser
      "path": require.resolve("path-browserify"),
      "fs": false,
      "child_process": false
    }
  }
};
```

## Benefits of This Architecture

1. **Self-Contained**: No external language server dependencies
2. **Cross-Platform**: Works in Node.js, browsers, and web workers  
3. **Performance**: Faster startup, no process spawning overhead
4. **Reliability**: Consistent behavior across environments
5. **Distribution**: Single package covers all use cases
6. **Offline**: Works without internet after initial download

## Implementation Challenges

1. **Bundle Size**: Language servers can be large
2. **WASM Availability**: Not all language servers have WASM versions
3. **Feature Parity**: Web workers may have limited capabilities
4. **Memory Management**: In-memory language services need careful handling
5. **File System Access**: Web environments have limited file access

## Migration Strategy

1. **Phase 1**: Bundle Node.js servers (current external → bundled internal)
2. **Phase 2**: Add web worker implementations for core languages  
3. **Phase 3**: WASM integration where available
4. **Phase 4**: Hybrid fallback system (bundled → external → unsupported)

Would you like me to start implementing Phase 1 (bundling Node.js language servers) or focus on a specific aspect of this architecture?