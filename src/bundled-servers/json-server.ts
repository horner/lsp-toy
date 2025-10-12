/**
 * Bundled JSON Language Server
 * 
 * Self-contained JSON language server that can be bundled with LSP-Toy
 * instead of requiring external vscode-json-languageserver installation.
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
  MarkupKind,
  DiagnosticSeverity,
  Diagnostic
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

class BundledJSONServer {
  private connection = createConnection(ProposedFeatures.all);
  private documents = new TextDocuments(TextDocument);
  private hasConfigurationCapability = false;

  constructor() {
    this.setupHandlers();
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
            resolveProvider: false,
            triggerCharacters: ['"', ':', ',', '{', '[']
          },
          hoverProvider: true,
          documentSymbolProvider: true
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
    this.connection.onHover(this.handleHover.bind(this));

    this.documents.onDidChangeContent(change => {
      this.validateDocument(change.document);
    });

    this.documents.listen(this.connection);
    this.connection.listen();
  }

  private validateDocument(document: TextDocument) {
    const text = document.getText();
    const diagnostics: Diagnostic[] = [];

    try {
      JSON.parse(text);
      // Valid JSON - no diagnostics
    } catch (error) {
      // Parse error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const match = errorMessage.match(/position (\d+)/);
      const position = match ? parseInt(match[1]) : 0;
      const documentPosition = document.positionAt(position);
      
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: documentPosition,
          end: { line: documentPosition.line, character: documentPosition.character + 1 }
        },
        message: `JSON syntax error: ${errorMessage}`,
        source: 'json'
      });
    }

    this.connection.sendDiagnostics({
      uri: document.uri,
      diagnostics
    });
  }

  private handleCompletion(textDocumentPosition: TextDocumentPositionParams): CompletionItem[] {
    const document = this.documents.get(textDocumentPosition.textDocument.uri);
    if (!document) {
      return [];
    }

    const text = document.getText();
    const offset = document.offsetAt(textDocumentPosition.position);
    const beforeCursor = text.substring(0, offset);
    
    // Simple completion logic
    const completions: CompletionItem[] = [];

    // If we're after a quote, suggest property names
    if (beforeCursor.endsWith('"') || beforeCursor.match(/"[^"]*$/)) {
      completions.push(
        {
          label: 'name',
          kind: CompletionItemKind.Property,
          insertText: 'name": "'
        },
        {
          label: 'version',
          kind: CompletionItemKind.Property,
          insertText: 'version": "'
        },
        {
          label: 'description',
          kind: CompletionItemKind.Property,
          insertText: 'description": "'
        },
        {
          label: 'type',
          kind: CompletionItemKind.Property,
          insertText: 'type": "'
        }
      );
    }

    // If we're after a colon, suggest values
    if (beforeCursor.match(/:\s*$/)) {
      completions.push(
        {
          label: 'true',
          kind: CompletionItemKind.Value,
          insertText: 'true'
        },
        {
          label: 'false',
          kind: CompletionItemKind.Value,
          insertText: 'false'
        },
        {
          label: 'null',
          kind: CompletionItemKind.Value,
          insertText: 'null'
        }
      );
    }

    return completions;
  }

  private handleHover(params: HoverParams): Hover | null {
    const document = this.documents.get(params.textDocument.uri);
    if (!document) {
      return null;
    }

    const text = document.getText();
    const offset = document.offsetAt(params.position);
    
    // Find the word at cursor position
    const wordRange = this.getWordRangeAtPosition(document, params.position);
    if (!wordRange) {
      return null;
    }

    const word = text.substring(
      document.offsetAt(wordRange.start),
      document.offsetAt(wordRange.end)
    );

    // Provide hover information for JSON keywords
    const hoverInfo: Record<string, string> = {
      'true': 'Boolean value: true',
      'false': 'Boolean value: false',
      'null': 'Represents null value',
      'name': 'Package name property',
      'version': 'Version identifier',
      'description': 'Package description'
    };

    const info = hoverInfo[word];
    if (info) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: `**${word}**\n\n${info}`
        },
        range: wordRange
      };
    }

    return null;
  }

  private getWordRangeAtPosition(document: TextDocument, position: any) {
    const text = document.getText();
    const offset = document.offsetAt(position);
    
    let start = offset;
    let end = offset;
    
    // Find word boundaries
    while (start > 0 && /\w/.test(text[start - 1])) {
      start--;
    }
    
    while (end < text.length && /\w/.test(text[end])) {
      end++;
    }
    
    if (start === end) {
      return null;
    }
    
    return {
      start: document.positionAt(start),
      end: document.positionAt(end)
    };
  }
}

// Start the server
if (require.main === module) {
  new BundledJSONServer();
}

export { BundledJSONServer };