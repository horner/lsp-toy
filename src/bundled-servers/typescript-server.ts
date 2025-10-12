/**
 * Bundled TypeScript Language Server
 * 
 * Self-contained TypeScript language server that can be bundled with LSP-Toy
 * instead of requiring external typescript-language-server installation.
 */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  HoverParams,
  Hover,
  MarkupKind
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as ts from 'typescript';

class BundledTypeScriptServer {
  private connection = createConnection(ProposedFeatures.all);
  private documents = new TextDocuments(TextDocument);
  private hasConfigurationCapability = false;
  private languageService: ts.LanguageService | null = null;
  private files = new Map<string, { content: string; version: number }>();
  private compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    lib: ['ES2020', 'DOM'],
    allowJs: true,
    checkJs: false,
    declaration: false,
    strict: false,
    esModuleInterop: true,
    skipLibCheck: true,
    forceConsistentCasingInFileNames: true
  };

  constructor() {
    this.setupHandlers();
    this.initializeLanguageService();
  }

  private setupHandlers() {
    this.connection.onInitialize((params: InitializeParams) => {
      const capabilities = params.capabilities;
      
      this.hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
      );

      const result: InitializeResult = {
        capabilities: {
          textDocumentSync: TextDocumentSyncKind.Incremental,
          completionProvider: {
            resolveProvider: true,
            triggerCharacters: ['.', '"', "'", '/', '@']
          },
          hoverProvider: true
        }
      };

      return result;
    });

    this.connection.onInitialized(() => {
      if (this.hasConfigurationCapability) {
        this.connection.client.register(DidChangeConfigurationNotification.type, undefined);
      }
    });

    this.connection.onCompletion(this.handleCompletion.bind(this));
    this.connection.onCompletionResolve(this.handleCompletionResolve.bind(this));
    this.connection.onHover(this.handleHover.bind(this));

    this.documents.onDidChangeContent(change => {
      this.updateDocument(change.document);
    });

    this.documents.onDidClose(e => {
      this.files.delete(e.document.uri);
    });

    this.documents.listen(this.connection);
    this.connection.listen();
  }

  private initializeLanguageService() {
    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => {
        // Return only normalized file names for TypeScript service
        const normalizedNames = Array.from(this.files.keys())
          .filter(uri => !uri.startsWith('embedded://'))  // Skip virtual URIs
          .concat(
            Array.from(this.files.keys())
              .filter(uri => uri.startsWith('embedded://'))
              .map(uri => this.normalizeUri(uri))
          );
        return [...new Set(normalizedNames)]; // Remove duplicates
      },
      getScriptVersion: (fileName) => {
        // Try normalized name first, then original
        let file = this.files.get(fileName);
        if (!file) {
          // Try to find by original URI
          for (const [uri, fileData] of this.files.entries()) {
            if (this.normalizeUri(uri) === fileName) {
              file = fileData;
              break;
            }
          }
        }
        return file?.version.toString() || '0';
      },
      getScriptSnapshot: (fileName) => {
        // Try normalized name first
        let file = this.files.get(fileName);
        if (!file) {
          // Try to find by original URI
          for (const [uri, fileData] of this.files.entries()) {
            if (this.normalizeUri(uri) === fileName) {
              file = fileData;
              break;
            }
          }
        }
        
        if (file) {
          return ts.ScriptSnapshot.fromString(file.content);
        }
        
        // Try to get default lib files
        if (fileName.includes('lib.') && fileName.endsWith('.d.ts')) {
          try {
            const libSource = ts.getDefaultLibFilePath(this.compilerOptions);
            if (libSource.includes(fileName)) {
              const content = ts.sys.readFile(libSource) || '';
              return ts.ScriptSnapshot.fromString(content);
            }
          } catch (e) {
            // Ignore lib file errors
          }
        }
        return undefined;
      },
      getCurrentDirectory: () => process.cwd(),
      getCompilationSettings: () => this.compilerOptions,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: (fileName) => this.files.has(fileName) || ts.sys.fileExists(fileName),
      readFile: (fileName) => {
        const file = this.files.get(fileName);
        if (file) {
          return file.content;
        }
        return ts.sys.readFile(fileName);
      },
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    };

    this.languageService = ts.createLanguageService(host, ts.createDocumentRegistry());
  }

  private updateDocument(document: TextDocument) {
    const existing = this.files.get(document.uri);
    this.files.set(document.uri, {
      content: document.getText(),
      version: existing ? existing.version + 1 : 1
    });
    
    // Also store with normalized filename for TypeScript service
    const normalizedUri = this.normalizeUri(document.uri);
    this.files.set(normalizedUri, {
      content: document.getText(),
      version: existing ? existing.version + 1 : 1
    });
  }

  private normalizeUri(uri: string): string {
    // Convert virtual URIs to TypeScript-friendly filenames
    if (uri.startsWith('embedded://')) {
      // embedded://file____path/fence_0_typescript -> /tmp/embedded_fence_0.ts
      const parts = uri.split('/');
      const fencePart = parts[parts.length - 1]; // fence_0_typescript
      const match = fencePart.match(/fence_(\d+)_(.+)/);
      if (match) {
        const [, fenceNum, lang] = match;
        const extension = lang === 'typescript' || lang === 'ts' ? '.ts' : 
                         lang === 'javascript' || lang === 'js' ? '.js' : '.txt';
        return `/tmp/embedded_fence_${fenceNum}${extension}`;
      }
    }
    return uri;
  }

  private handleCompletion(textDocumentPosition: TextDocumentPositionParams): CompletionItem[] {
    if (!this.languageService) {
      return [];
    }

    const document = this.documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
      return [];
    }

    const offset = document.offsetAt(textDocumentPosition.position);
    const normalizedUri = this.normalizeUri(textDocumentPosition.textDocument.uri);
    const completions = this.languageService.getCompletionsAtPosition(
      normalizedUri,
      offset,
      {
        includeExternalModuleExports: true,
        includeInsertTextCompletions: true,
      }
    );

    if (!completions) {
      return [];
    }

    return completions.entries.map((entry): CompletionItem => ({
      label: entry.name,
      kind: this.convertCompletionItemKind(entry.kind),
      detail: entry.kindModifiers,
      sortText: entry.sortText,
      insertText: entry.insertText || entry.name,
      data: {
        uri: textDocumentPosition.textDocument.uri,
        position: textDocumentPosition.position,
        name: entry.name
      }
    }));
  }

  private handleCompletionResolve(item: CompletionItem): CompletionItem {
    if (!this.languageService || !item.data) {
      return item;
    }

    try {
      const document = this.documents.get(item.data.uri);
      if (!document) {
        return item;
      }

      const offset = document.offsetAt(item.data.position);
      const details = this.languageService.getCompletionEntryDetails(
        item.data.uri,
        offset,
        item.data.name,
        {},
        undefined,
        undefined,
        undefined
      );

      if (details) {
        item.detail = ts.displayPartsToString(details.displayParts);
        item.documentation = {
          kind: MarkupKind.Markdown,
          value: ts.displayPartsToString(details.documentation)
        };
      }
    } catch (e) {
      // Ignore resolution errors
    }

    return item;
  }

  private handleHover(params: HoverParams): Hover | null {
    if (!this.languageService) {
      return null;
    }

    const document = this.documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    const offset = document.offsetAt(params.position);
    const normalizedUri = this.normalizeUri(params.textDocument.uri);
    const quickInfo = this.languageService.getQuickInfoAtPosition(normalizedUri, offset);

    if (!quickInfo) {
      return null;
    }

    const contents = ts.displayPartsToString(quickInfo.displayParts);
    const documentation = ts.displayPartsToString(quickInfo.documentation);

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: ['```typescript', contents, '```', documentation].filter(Boolean).join('\n\n')
      },
      range: {
        start: document.positionAt(quickInfo.textSpan.start),
        end: document.positionAt(quickInfo.textSpan.start + quickInfo.textSpan.length)
      }
    };
  }

  private convertCompletionItemKind(tsKind: ts.ScriptElementKind): CompletionItemKind {
    const kindMap: Record<string, CompletionItemKind> = {
      [ts.ScriptElementKind.primitiveType]: CompletionItemKind.Keyword,
      [ts.ScriptElementKind.keyword]: CompletionItemKind.Keyword,
      [ts.ScriptElementKind.alias]: CompletionItemKind.Reference,
      [ts.ScriptElementKind.classElement]: CompletionItemKind.Class,
      [ts.ScriptElementKind.interfaceElement]: CompletionItemKind.Interface,
      [ts.ScriptElementKind.typeElement]: CompletionItemKind.TypeParameter,
      [ts.ScriptElementKind.enumElement]: CompletionItemKind.Enum,
      [ts.ScriptElementKind.enumMemberElement]: CompletionItemKind.EnumMember,
      [ts.ScriptElementKind.variableElement]: CompletionItemKind.Variable,
      [ts.ScriptElementKind.localVariableElement]: CompletionItemKind.Variable,
      [ts.ScriptElementKind.functionElement]: CompletionItemKind.Function,
      [ts.ScriptElementKind.localFunctionElement]: CompletionItemKind.Function,
      [ts.ScriptElementKind.memberFunctionElement]: CompletionItemKind.Method,
      [ts.ScriptElementKind.memberGetAccessorElement]: CompletionItemKind.Property,
      [ts.ScriptElementKind.memberSetAccessorElement]: CompletionItemKind.Property,
      [ts.ScriptElementKind.memberVariableElement]: CompletionItemKind.Property,
      [ts.ScriptElementKind.constructorImplementationElement]: CompletionItemKind.Constructor,
      [ts.ScriptElementKind.callSignatureElement]: CompletionItemKind.Function,
      [ts.ScriptElementKind.indexSignatureElement]: CompletionItemKind.Property,
      [ts.ScriptElementKind.constructSignatureElement]: CompletionItemKind.Constructor,
      [ts.ScriptElementKind.parameterElement]: CompletionItemKind.Variable,
      [ts.ScriptElementKind.typeParameterElement]: CompletionItemKind.TypeParameter,
      [ts.ScriptElementKind.moduleElement]: CompletionItemKind.Module,
      [ts.ScriptElementKind.externalModuleName]: CompletionItemKind.Module,
      [ts.ScriptElementKind.directory]: CompletionItemKind.Folder,
      [ts.ScriptElementKind.scriptElement]: CompletionItemKind.File,
    };

    return kindMap[tsKind] || CompletionItemKind.Text;
  }
}

// Start the server
if (require.main === module) {
  new BundledTypeScriptServer();
}

export { BundledTypeScriptServer };