import {
  CodeAction,
  CodeActionKind,
  CodeActionParams,
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  InsertTextFormat,
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
  WorkspaceEdit
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import * as fs from 'fs';
import * as path from 'path';

const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

const semanticLegend: SemanticTokensLegend = {
  tokenTypes: ['heading', 'bold', 'italic', 'link', 'code', 'todo'],
  tokenModifiers: [] as string[]
};

connection.onInitialize((_params: InitializeParams): InitializeResult => {
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

documents.onDidOpen((event: TextDocumentChangeEvent<TextDocument>) => {
  validateTextDocument(event.document);
});

documents.onDidChangeContent((change: TextDocumentChangeEvent<TextDocument>) => {
  validateTextDocument(change.document);
});

documents.onDidClose((event: TextDocumentChangeEvent<TextDocument>) => {
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return [];
  }

  const actions: CodeAction[] = [];

  for (const diagnostic of params.context.diagnostics) {
    const data = diagnostic.data as { kind?: string; label?: string } | undefined;
    if (data?.kind === 'todo') {
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

  return actions;
});

connection.onCompletion((params: CompletionParams): CompletionItem[] => {
  const trigger = params.context?.triggerCharacter;
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
    sectionHeaders.forEach((header, index) => {
      completions.push({
        label: header,
        kind: CompletionItemKind.Snippet,
        sortText: `1${index}`,
        insertText: `${header}\n`
      });
    });
  } else if (trigger === '[') {
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

  return completions;
});

connection.onHover((params: HoverParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const text = document.getText();
  const offset = document.offsetAt(params.position);
  const hoverInfo = getHoverInfo(text, offset, params.position, document);

  if (!hoverInfo) {
    return null;
  }

  return {
    contents: {
      kind: 'markdown',
      value: hoverInfo
    }
  } satisfies Hover;
});

connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | null => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return null;
  }

  const signature = buildSignatureHelp(document, params.position);
  return signature;
});

connection.languages.semanticTokens.on((params: SemanticTokensParams) => {
  const document = documents.get(params.textDocument.uri);
  if (!document) {
    return { data: [] };
  }

  const builder = new SemanticTokensBuilder();
  const lines = document.getText().split(/\r?\n/);

  lines.forEach((line: string, lineIndex: number) => {
    addHeadingToken(builder, line, lineIndex);
    addFormattedSpanTokens(builder, line, lineIndex, /\*\*([^*]+)\*\*/g, 'bold');
    addFormattedSpanTokens(builder, line, lineIndex, /_([^_]+)_/g, 'italic');
    addFormattedSpanTokens(builder, line, lineIndex, /`([^`]+)`/g, 'code');
    addLinkTokens(builder, line, lineIndex);
    addTodoTokens(builder, line, lineIndex);
  });

  return builder.build();
});

documents.listen(connection);
connection.listen();

function validateTextDocument(document: TextDocument): void {
  const diagnostics: Diagnostic[] = [];
  const text = document.getText();

  const todoRegex = /\bTODO\b/g;
  let match: RegExpExecArray | null;

  while ((match = todoRegex.exec(text)) !== null) {
    const range = Range.create(
      document.positionAt(match.index),
      document.positionAt(match.index + match[0].length)
    );
    diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      range,
      message: 'Found TODO item.',
      source: 'lsp-toy',
      code: 'todo',
      data: { kind: 'todo' }
    });
  }

  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = linkRegex.exec(text)) !== null) {
    const label = match[1];
    const target = match[2];

    if (!isLocalLink(target)) {
      continue;
    }

    if (!linkExists(document.uri, target)) {
      const range = Range.create(
        document.positionAt(match.index),
        document.positionAt(match.index + match[0].length)
      );
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range,
        message: `Broken link: ${target}`,
        source: 'lsp-toy',
        code: 'brokenLink',
        data: { kind: 'brokenLink', label, target }
      });
    }
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

function getHoverInfo(
  text: string,
  offset: number,
  position: Position,
  document: TextDocument
): string | null {
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

  const linkInfo = getLinkHover(text, position, document);
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

function getLinkHover(text: string, position: Position, document: TextDocument): string | null {
  const offset = document.offsetAt(position);
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      const label = match[1];
      const target = match[2];
      if (target.startsWith('http')) {
        return `**${label}** → ${target}`;
      }
      const exists = isLocalLink(target) ? linkExists(document.uri, target) : true;
      return exists
        ? `**${label}** → ${target}`
        : `**${label}** → ${target} _(broken link)_`;
    }
  }

  return null;
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

function addHeadingToken(builder: SemanticTokensBuilder, line: string, lineIndex: number): void {
  const headingMatch = /^\s{0,3}#{1,6}\s.*$/u.exec(line);
  if (!headingMatch) {
    return;
  }

  builder.push(lineIndex, line.indexOf('#'), line.trimEnd().length - line.indexOf('#'), getTokenTypeIndex('heading'), 0);
}

function addFormattedSpanTokens(
  builder: SemanticTokensBuilder,
  line: string,
  lineIndex: number,
  regex: RegExp,
  tokenType: string
): void {
  let match: RegExpExecArray | null;
  regex.lastIndex = 0;
  while ((match = regex.exec(line)) !== null) {
    const start = match.index;
    const length = match[0].length;
    builder.push(lineIndex, start, length, getTokenTypeIndex(tokenType), 0);
  }
}

function addLinkTokens(builder: SemanticTokensBuilder, line: string, lineIndex: number): void {
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    builder.push(lineIndex, match.index, match[0].length, getTokenTypeIndex('link'), 0);
  }
}

function addTodoTokens(builder: SemanticTokensBuilder, line: string, lineIndex: number): void {
  const regex = /\bTODO\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    builder.push(lineIndex, match.index, match[0].length, getTokenTypeIndex('todo'), 0);
  }
}

function getTokenTypeIndex(tokenType: string): number {
  const index = semanticLegend.tokenTypes.indexOf(tokenType);
  if (index === -1) {
    return 0;
  }
  return index;
}
