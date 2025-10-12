import { Parser, Language } from 'web-tree-sitter';
import * as path from 'path';
import { SemanticTokensLegend } from 'vscode-languageserver/node';
import { logDebug } from './utils/logging';

let parser: Parser | null = null;
let markdownLanguage: Language | null = null;

export const semanticLegend: SemanticTokensLegend = {
  tokenTypes: ['heading', 'bold', 'italic', 'link', 'code', 'todo'],
  tokenModifiers: [] as string[]
};

// Initialize parser asynchronously
export async function initializeParser(): Promise<void> {
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

    logDebug('Parser initialization complete!');
  } catch (error) {
    const errorMsg = `Failed to initialize parser: ${String(error)}`;
    logDebug('ERROR:', errorMsg);
    throw error;
  }
}

export function getParser(): Parser | null {
  return parser;
}
