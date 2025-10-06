import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  InsertTextFormat,
  Connection,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  Hover,
  HoverParams,
  InitializeParams,
  InitializeResult,
  Position,
  ProposedFeatures,
  Range,
  SemanticTokensBuilder,
  SemanticTokensParams,
  SemanticTokensLegend,
  SignatureHelp,
  SignatureHelpParams,
  SignatureInformation,
  TextDocumentSyncKind,
  TextDocuments,
  TextEdit,
  TextDocumentChangeEvent,
  WorkspaceEdit,
  SocketMessageReader,
  SocketMessageWriter
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import { Parser, Language, Tree, Node } from 'web-tree-sitter';

type SyntaxNode = Node;

// Debug logging control
const DEBUG_ENABLED = process.env.LSP_TOY_DEBUG === 'true' || process.env.LSP_TOY_DEBUG === '1';

// Debug logging helper - use console.error so it goes to stderr and shows up in VS Code output
function logDebug(message: string, ...args: unknown[]): void {
  if (DEBUG_ENABLED) {
    console.error(`[LSP-TOY SERVER] ${message}`, ...args);
  }
}

if (DEBUG_ENABLED) {
  logDebug('========================================');
  logDebug('Debug logging ENABLED');
  logDebug('Server module loading...');
} else {
  console.error('[LSP-TOY SERVER] Debug logging DISABLED (set LSP_TOY_DEBUG=true to enable)');
}

let parser: Parser | null = null;
let markdownLanguage: Language | null = null;

// Initialize parser asynchronously
async function initializeParser(): Promise<void> {
  try {
    logDebug('Initializing web-tree-sitter...');
    await Parser.init();
    logDebug('Parser.init() complete');
    
    parser = new Parser();
    logDebug('Parser instance created');

    const wasmPath = path.join(__dirname, '..', '..', 'wasm', 'tree-sitter-markdown.wasm');
    logDebug('Loading WASM from:', wasmPath);
    
    markdownLanguage = await Language.load(wasmPath);
    logDebug('Language loaded successfully');
    
    parser.setLanguage(markdownLanguage);
    logDebug('Language set on parser');

    connection.console.log('Parser initialized successfully with WASM grammar');
    logDebug('Parser initialization complete!');
  } catch (error) {
    const errorMsg = `Failed to initialize parser: ${String(error)}`;
    connection.console.error(errorMsg);
    logDebug('ERROR:', errorMsg);
    throw error;
  }
}

let connection: Connection;
let documents: TextDocuments<TextDocument>;
let documentTrees: Map<string, Tree>;

const semanticLegend: SemanticTokensLegend = {
  tokenTypes: ['heading', 'bold', 'italic', 'link', 'code', 'todo'],
  tokenModifiers: [] as string[]
};

async function initializeLanguageServer(newConnection: Connection): Promise<void> {
  logDebug('initializeLanguageServer called');
  connection = newConnection;
  logDebug('Connection assigned');
  
  documents = new TextDocuments(TextDocument);
  logDebug('TextDocuments created');
  
  documentTrees = new Map<string, Tree>();
  logDebug('documentTrees map created');

  // Initialize parser before handling requests
  logDebug('About to initialize parser...');
  await initializeParser();
  logDebug('Parser initialized!');

  connection.onInitialize((_params: InitializeParams): InitializeResult => {
    logDebug('onInitialize handler called');
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        completionProvider: {
          triggerCharacters: ['#', '[']
        },
        hoverProvider: true,
        codeActionProvider: {
          resolveProvider: false
        },
        signatureHelpProvider: {
          triggerCharacters: ['(', ',']
        },
        semanticTokensProvider: {
          legend: semanticLegend,
          range: false,
          full: true
        }
      }
    };
  });

documents.onDidOpen(e => {
  logDebug('Document opened:', e.document.uri);
  validateTextDocument(e.document);
});documents.onDidChangeContent(e => {
  logDebug('Document content changed:', e.document.uri);
  validateTextDocument(e.document);
});  documents.onDidClose((event: TextDocumentChangeEvent<TextDocument>) => {
    documentTrees.delete(event.document.uri);
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
  });

  connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
    logDebug('onCodeAction called for:', params.textDocument.uri);
    logDebug('  Range:', JSON.stringify(params.range));
    logDebug('  Diagnostics count:', params.context.diagnostics.length);
    
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      logDebug('  ✗ Document not found');
      return [];
    }

    const actions: CodeAction[] = [];

    for (const diagnostic of params.context.diagnostics) {
      const data = diagnostic.data as { kind?: string; label?: string } | undefined;
      if (data?.kind === 'todo') {
        logDebug('  → Creating "Mark TODO as done" action');
        const edit: WorkspaceEdit = {
          changes: {
            [params.textDocument.uri]: [TextEdit.replace(diagnostic.range, 'Done')]
          }
        };
        actions.push({
          title: 'Mark TODO as done',
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit
        });
      } else if (data?.kind === 'brokenLink') {
        logDebug('  → Creating "Remove broken link" action');
        const replacement = data.label ?? '';
        const edit: WorkspaceEdit = {
          changes: {
            [params.textDocument.uri]: [TextEdit.replace(diagnostic.range, replacement)]
          }
        };
        actions.push({
          title: 'Remove broken link',
          kind: CodeActionKind.QuickFix,
          diagnostics: [diagnostic],
          edit
        });
      }
    }

    logDebug('  ✓ Returning', actions.length, 'code actions');
    return actions;
  });

  connection.onCompletion((params: CompletionParams): CompletionItem[] => {
    logDebug('onCompletion called for:', params.textDocument.uri);
    logDebug('  Position:', `line ${params.position.line}, char ${params.position.character}`);
    const trigger = params.context?.triggerCharacter;
    logDebug('  Trigger character:', trigger ? `'${trigger}'` : 'none (manual invoke)');
    const completions: CompletionItem[] = [];

    const sectionHeaders = ['## Summary', '## Skills', '## Contact', '## Projects'];
    const markdownFormats = ['**bold**', '_italic_', '`inline code`', '> Quote', '- List item'];
    const linkSnippets: CompletionItem[] = [
      {
        label: 'Markdown link',
        kind: CompletionItemKind.Snippet,
        sortText: '10',
        insertText: '[${1:Label}](https://${2:example.com})',
        insertTextFormat: InsertTextFormat.Snippet
      },
      {
        label: 'Relative link',
        kind: CompletionItemKind.Snippet,
        sortText: '11',
        insertText: '[${1:Label}](./${2:file.md})',
        insertTextFormat: InsertTextFormat.Snippet
      }
    ];

    if (trigger === '#') {
      logDebug('  → Providing section header completions');
      sectionHeaders.forEach((header, index) => {
        completions.push({
          label: header,
          kind: CompletionItemKind.Snippet,
          sortText: `1${index}`,
          insertText: `${header}\n`
        });
      });
    } else if (trigger === '[') {
      logDebug('  → Providing link and markdown format completions');
      completions.push(...linkSnippets);
      markdownFormats.forEach((snippet, index) => {
        completions.push({
          label: snippet,
          kind: CompletionItemKind.Keyword,
          sortText: `2${index}`,
          insertText: snippet
        });
      });
    }

    if (!trigger) {
      logDebug('  → Providing all default completions (no trigger)');
      sectionHeaders.forEach((header, index) => {
        completions.push({
          label: header,
          kind: CompletionItemKind.Snippet,
          sortText: `3${index}`,
          insertText: `${header}\n`
        });
      });

      markdownFormats.forEach((format, index) => {
        completions.push({
          label: format,
          kind: CompletionItemKind.Text,
          sortText: `4${index}`,
          insertText: format
        });
      });

      completions.push(...linkSnippets);
    }

    logDebug('  ✓ Returning', completions.length, 'completion items');
    return completions;
  });

  connection.onHover((params: HoverParams) => {
    logDebug('onHover called for:', params.textDocument.uri);
    logDebug('  Position:', `line ${params.position.line}, char ${params.position.character}`);
    
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      logDebug('  ✗ Document not found');
      return null;
    }

    const tree = getOrParseTree(document);
    if (!tree) {
      logDebug('  ✗ Parse tree not available');
      return null;
    }
    const hoverInfo = getHoverInfo(document, params.position, tree);

    if (!hoverInfo) {
      logDebug('  ⊙ No hover info available at this position');
      return null;
    }
    
    logDebug('  ✓ Returning hover info:', hoverInfo.substring(0, 50) + '...');

    return {
      contents: {
        kind: 'markdown',
        value: hoverInfo
      }
    } satisfies Hover;
  });

  connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | null => {
    logDebug('onSignatureHelp called for:', params.textDocument.uri);
    logDebug('  Position:', `line ${params.position.line}, char ${params.position.character}`);
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      logDebug('  ✗ Document not found');
      return null;
    }

    const signature = buildSignatureHelp(document, params.position);
    if (signature) {
      logDebug('  ✓ Returning signature help with', signature.signatures.length, 'signatures');
    } else {
      logDebug('  ⊙ No signature help available at this position');
    }
    return signature;
  });

  connection.languages.semanticTokens.on((params: SemanticTokensParams) => {
    logDebug('onSemanticTokens called for:', params.textDocument.uri);
    const document = documents.get(params.textDocument.uri);
    if (!document) {
      logDebug('  ✗ Document not found');
      return { data: [] };
    }

    const tree = getOrParseTree(document);
    const builder = new SemanticTokensBuilder();
    if (!tree) {
      logDebug('  ✗ Parse tree not available');
      return builder.build();
    }
    const lines = document.getText().split(/\r?\n/);
    logDebug('  Processing', lines.length, 'lines for semantic tokens');
    
    const tokenCounts: Record<string, number> = {};

    visitTree(tree.rootNode, node => {
      switch (node.type) {
        case 'heading_content':
          pushNodeToken(builder, document, lines, node, 'heading');
          tokenCounts['heading'] = (tokenCounts['heading'] || 0) + 1;
          break;
        case 'strong_emphasis':
          pushNodeToken(builder, document, lines, node, 'bold');
          tokenCounts['bold'] = (tokenCounts['bold'] || 0) + 1;
          break;
        case 'emphasis':
          pushNodeToken(builder, document, lines, node, 'italic');
          tokenCounts['italic'] = (tokenCounts['italic'] || 0) + 1;
          break;
        case 'code_span':
          pushNodeToken(builder, document, lines, node, 'code');
          tokenCounts['code'] = (tokenCounts['code'] || 0) + 1;
          break;
        case 'link':
          pushNodeToken(builder, document, lines, node, 'link');
          tokenCounts['link'] = (tokenCounts['link'] || 0) + 1;
          break;
        case 'text':
          highlightTodoTokens(builder, document, lines, node);
          // Note: TODO count tracked inside highlightTodoTokens
          break;
        default:
          break;
      }
    });

    const result = builder.build();
    const totalTokens = Object.values(tokenCounts).reduce((a, b) => a + b, 0);
    logDebug('  ✓ Generated', totalTokens, 'semantic tokens:', JSON.stringify(tokenCounts));
    logDebug('  Data length:', result.data.length, 'integers');
    return result;
  });

  logDebug('Setting up document and connection listeners...');
  documents.listen(connection);
  connection.listen();
  logDebug('Listeners setup complete - server is ready!');
}

logDebug('Resolving port...');
const requestedPort = resolvePort();
logDebug('Port resolution result:', requestedPort);

if (requestedPort !== null) {
  logDebug('Starting TCP server on port:', requestedPort);
  let activeSocket: net.Socket | null = null;
  const server = net.createServer(socket => {
    logDebug('TCP connection received');
    if (activeSocket) {
      logDebug('Already have active socket, rejecting new connection');
      socket.end();
      return;
    }

    logDebug('Accepting TCP connection');
    activeSocket = socket;
    const socketConnection = createConnection(
      ProposedFeatures.all,
      new SocketMessageReader(socket),
      new SocketMessageWriter(socket)
    );

    socket.on('close', () => {
      activeSocket = null;
      documentTrees?.clear();
    });

    initializeLanguageServer(socketConnection);
  });

  server.listen(requestedPort, () => {
    console.log(`[lsp-toy] Listening on port ${requestedPort}`);
  });

  server.on('error', error => {
    console.error('[lsp-toy] TCP server error', error);
  });
} else {
  logDebug('No port specified - using stdio mode');
  logDebug('Creating connection with stdin/stdout...');
  const stdioConnection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);
  logDebug('stdio connection created, initializing language server...');
  initializeLanguageServer(stdioConnection);
  logDebug('Language server initialization started (async)');
}

function resolvePort(): number | null {
  const fromArgs = parsePortFromArgs(process.argv.slice(2));
  if (fromArgs !== null) {
    return fromArgs;
  }

  const envCandidates = [process.env.LSP_PORT, process.env.PORT];
  for (const candidate of envCandidates) {
    const parsed = parsePort(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function parsePortFromArgs(args: string[]): number | null {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const equalsMatch = arg.match(/^--(?:lsp-)?port=(.+)$/);
    if (equalsMatch) {
      const parsed = parsePort(equalsMatch[1]);
      if (parsed !== null) {
        return parsed;
      }
      continue;
    }

    if (arg === '--port' || arg === '--lsp-port') {
      const next = args[i + 1];
      const parsed = parsePort(next);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

function parsePort(value: string | undefined | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed >= 65536) {
    return null;
  }

  return parsed;
}

function validateTextDocument(document: TextDocument): void {
  logDebug('validateTextDocument called for:', document.uri);
  const diagnostics: Diagnostic[] = [];
  const tree = parseDocument(document);
  
  if (!tree) {
    logDebug('  ✗ Parse tree not available, sending empty diagnostics');
    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] });
    return;
  }

  logDebug('  Scanning tree for diagnostics...');
  let inlineNodeCount = 0;
  let linkNodeCount = 0;
  
  visitTree(tree.rootNode, node => {
    // Check for TODO in inline nodes (tree-sitter-grammars uses 'inline' instead of 'text')
    if (node.type === 'inline') {
      inlineNodeCount++;
      addTodoDiagnostics(document, node, diagnostics);
    }

    if (node.type === 'link') {
      linkNodeCount++;
      addBrokenLinkDiagnostics(document, node, diagnostics);
    }
  });

  logDebug('  Scanned', inlineNodeCount, 'inline nodes and', linkNodeCount, 'link nodes');
  logDebug('  ✓ Sending', diagnostics.length, 'diagnostics');
  if (diagnostics.length > 0) {
    diagnostics.forEach(d => {
      logDebug('    -', d.code, ':', d.message, 'at line', d.range.start.line);
    });
  }
  connection.sendDiagnostics({ uri: document.uri, diagnostics });
}

function isLocalLink(target: string): boolean {
  return target.startsWith('./') || target.startsWith('../');
}

function linkExists(uri: string, target: string): boolean {
  const documentPath = URI.parse(uri).fsPath;
  const resolvedPath = path.resolve(path.dirname(documentPath), target);
  return fs.existsSync(resolvedPath);
}

function getHoverInfo(document: TextDocument, position: Position, tree: Tree): string | null {
  const text = document.getText();
  const offset = document.offsetAt(position);
  const glossary: Record<string, string> = {
    rust: '**Rust** — a systems programming language focused on safety and speed.',
    typescript: '**TypeScript** — JavaScript with static typing for scalable apps.',
    docker: '**Docker** — container platform for packaging applications.',
    kubernetes: '**Kubernetes** — orchestrates containerized workloads and services.',
    git: '**Git** — distributed version control system.'
  };

  const word = getWordAt(text, offset);
  if (word) {
    const entry = glossary[word.toLowerCase()];
    if (entry) {
      return entry;
    }
    if (word.toLowerCase() === 'todo') {
      return '**TODO** — reminder to complete this item.';
    }
  }

  const linkInfo = getLinkHover(document, position, tree);
  if (linkInfo) {
    return linkInfo;
  }

  return null;
}

function getWordAt(text: string, offset: number): string | null {
  if (offset < 0 || offset >= text.length) {
    return null;
  }

  const wordRegex = /[A-Za-z0-9_]+/g;
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      return match[0];
    }
    if (start > offset) {
      break;
    }
  }

  return null;
}

function getLinkHover(document: TextDocument, position: Position, tree: Tree): string | null {
  const node: SyntaxNode | null = tree.rootNode.descendantForPosition({
    row: position.line,
    column: position.character
  });

  if (!node) {
    return null;
  }

  let current: SyntaxNode | null = node;
  while (current && current.type !== 'link') {
    current = current.parent;
  }

  if (!current) {
    return null;
  }

  const labelNode = findNamedChild(current, 'link_text');
  const destinationNode = findNamedChild(current, 'link_destination');

  const label = labelNode ? labelNode.text.trim() : document.getText(rangeFromNode(document, current));
  const target = destinationNode ? destinationNode.text.trim() : '';

  if (!target) {
    return `**${label}**`;
  }

  if (target.startsWith('http')) {
    return `**${label}** → ${target}`;
  }

  const exists = isLocalLink(target) ? linkExists(document.uri, target) : true;
  return exists
    ? `**${label}** → ${target}`
    : `**${label}** → ${target} _(broken link)_`;
}

function buildSignatureHelp(document: TextDocument, position: Position): SignatureHelp | null {
  const text = document.getText();
  const offset = document.offsetAt(position);
  const before = text.slice(0, offset);
  const callIndex = before.lastIndexOf('contact(');

  if (callIndex === -1) {
    return null;
  }

  const openParenIndex = callIndex + 'contact'.length + 1;
  const closeIndex = before.indexOf(')', openParenIndex);
  if (closeIndex !== -1 && closeIndex < before.length) {
    return null;
  }

  const argsFragment = before.slice(openParenIndex);
  const commaCount = argsFragment.split(',').length - 1;
  const activeParameter = Math.min(Math.max(commaCount, 0), 1);

  const signature: SignatureInformation = {
    label: 'contact(firstName: string, lastName: string)',
    documentation: {
      kind: 'markdown',
      value: 'Creates a contact entry with a first and last name.'
    },
    parameters: [
      {
        label: 'firstName: string',
        documentation: 'Given name to display.'
      },
      {
        label: 'lastName: string',
        documentation: 'Family name to display.'
      }
    ]
  };

  return {
    signatures: [signature],
    activeSignature: 0,
    activeParameter
  };
}

function parseDocument(document: TextDocument): Tree | null {
  if (!parser) {
    console.error('[server] Parser not initialized');
    logDebug('  ✗ Parser not initialized!');
    return null;
  }
  const text = document.getText();
  logDebug('  Parsing document, length:', text.length, 'chars');
  const tree = parser.parse(text);
  if (tree) {
    documentTrees.set(document.uri, tree);
    logDebug('  ✓ Parse successful, cached tree for', document.uri);
  } else {
    logDebug('  ✗ Parse failed!');
  }
  return tree;
}

function getOrParseTree(document: TextDocument): Tree | null {
  const cached = documentTrees.get(document.uri);
  if (cached) {
    logDebug('  → Using cached parse tree');
    return cached;
  }
  logDebug('  → No cached tree, parsing now...');
  return parseDocument(document);
}

function visitTree(node: SyntaxNode, visitor: (node: SyntaxNode) => void): void {
  visitor(node);
  const childCount = typeof node.namedChildCount === 'number' ? node.namedChildCount : 0;
  for (let i = 0; i < childCount; i++) {
    const child = node.namedChild(i);
    if (child) {
      visitTree(child, visitor);
    }
  }
}

function findNamedChild(node: SyntaxNode, type: string): SyntaxNode | null {
  const childCount = typeof node.namedChildCount === 'number' ? node.namedChildCount : 0;
  for (let i = 0; i < childCount; i++) {
    const child = node.namedChild(i);
    if (child && child.type === type) {
      return child;
    }
  }
  return null;
}

function rangeFromNode(document: TextDocument, node: SyntaxNode): Range {
  return Range.create(document.positionAt(node.startIndex), document.positionAt(node.endIndex));
}

function pushNodeToken(
  builder: SemanticTokensBuilder,
  document: TextDocument,
  lines: string[],
  node: SyntaxNode,
  tokenType: string
): void {
  pushRange(builder, document, lines, node.startIndex, node.endIndex, tokenType);
}

function highlightTodoTokens(
  builder: SemanticTokensBuilder,
  document: TextDocument,
  lines: string[],
  node: SyntaxNode
): void {
  const text: string = node.text ?? '';
  let index = text.indexOf('TODO');
  while (index !== -1) {
    const start = node.startIndex + index;
    const end = start + 4;
    pushRange(builder, document, lines, start, end, 'todo');
    index = text.indexOf('TODO', index + 4);
  }
}

function pushRange(
  builder: SemanticTokensBuilder,
  document: TextDocument,
  lines: string[],
  startIndex: number,
  endIndex: number,
  tokenType: string
): void {
  if (endIndex <= startIndex) {
    return;
  }

  const startPos = document.positionAt(startIndex);
  const endPos = document.positionAt(endIndex);
  const tokenTypeIndex = getTokenTypeIndex(tokenType);

  if (startPos.line === endPos.line) {
    const length = endPos.character - startPos.character;
    if (length > 0) {
      builder.push(startPos.line, startPos.character, length, tokenTypeIndex, 0);
    }
    return;
  }

  const firstLine = lines[startPos.line] ?? '';
  const firstLength = firstLine.length - startPos.character;
  if (firstLength > 0) {
    builder.push(startPos.line, startPos.character, firstLength, tokenTypeIndex, 0);
  }

  for (let line = startPos.line + 1; line < endPos.line; line++) {
    const fullLength = lines[line]?.length ?? 0;
    if (fullLength > 0) {
      builder.push(line, 0, fullLength, tokenTypeIndex, 0);
    }
  }

  if (endPos.character > 0) {
    builder.push(endPos.line, 0, endPos.character, tokenTypeIndex, 0);
  }
}

function addTodoDiagnostics(
  document: TextDocument,
  node: SyntaxNode,
  diagnostics: Diagnostic[]
): void {
  const text: string = node.text ?? '';
  let index = text.indexOf('TODO');
  while (index !== -1) {
    const start = node.startIndex + index;
    const end = start + 4;
    const range = Range.create(document.positionAt(start), document.positionAt(end));
    diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      range,
      message: 'Found TODO item.',
      source: 'lsp-toy',
      code: 'todo',
      data: { kind: 'todo' }
    });
    index = text.indexOf('TODO', index + 4);
  }
}

function addBrokenLinkDiagnostics(
  document: TextDocument,
  linkNode: SyntaxNode,
  diagnostics: Diagnostic[]
): void {
  const destinationNode = findNamedChild(linkNode, 'link_destination');
  if (!destinationNode) {
    return;
  }

  const target = (destinationNode.text ?? '').trim();
  if (!target || !isLocalLink(target) || linkExists(document.uri, target)) {
    return;
  }

  const labelNode = findNamedChild(linkNode, 'link_text');
  const label = (labelNode?.text ?? '').trim();
  const range = rangeFromNode(document, linkNode);

  diagnostics.push({
    severity: DiagnosticSeverity.Warning,
    range,
    message: `Broken link: ${target}`,
    source: 'lsp-toy',
    code: 'brokenLink',
    data: { kind: 'brokenLink', label, target }
  });
}

function getTokenTypeIndex(tokenType: string): number {
  const index = semanticLegend.tokenTypes.indexOf(tokenType);
  if (index === -1) {
    return 0;
  }
  return index;
}
