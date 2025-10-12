import * as fs from 'fs';
import * as path from 'path';
import { URI } from 'vscode-uri';

export function isLocalLink(target: string): boolean {
  return target.startsWith('./') || target.startsWith('../');
}

export function linkExists(uri: string, target: string): boolean {
  const documentPath = URI.parse(uri).fsPath;
  const resolvedPath = path.resolve(path.dirname(documentPath), target);
  return fs.existsSync(resolvedPath);
}

export function getWordAt(text: string, offset: number): string | null {
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

// Get TODO keywords for all supported languages
export function getTodoKeywords(): string[] {
  return [
    // Universal
    'TODO', 'FIXME', 'HACK', 'NOTE',
    // English
    'TODO', 'FIXME', 'BUG', 'HACK', 'NOTE', 'WARNING',
    // Spanish
    'PENDIENTE', 'ARREGLAR', 'CORREGIR', 'NOTA', 'ADVERTENCIA',
    // French
    'AFAIRE', 'À FAIRE', 'CORRIGER', 'RÉPARER', 'NOTE', 'ATTENTION',
    // Polish
    'ZROBIĆ', 'NAPRAWIĆ', 'POPRAWIĆ', 'UWAGA', 'NOTATKA'
  ];
}

// Find all TODO-like keywords in text
export function findTodoMatches(text: string): Array<{ keyword: string; index: number; length: number }> {
  const keywords = getTodoKeywords();
  const matches: Array<{ keyword: string; index: number; length: number }> = [];
  
  for (const keyword of keywords) {
    let index = text.indexOf(keyword);
    while (index !== -1) {
      // Check if it's a whole word (not part of another word)
      const before = index > 0 ? text[index - 1] : ' ';
      const after = index + keyword.length < text.length ? text[index + keyword.length] : ' ';
      const isWholeWord = /\s|^/.test(before) && /\s|$|:/.test(after);
      
      if (isWholeWord) {
        matches.push({ keyword, index, length: keyword.length });
      }
      index = text.indexOf(keyword, index + 1);
    }
  }
  
  // Sort by index to process in order
  return matches.sort((a, b) => a.index - b.index);
}

export function getGlossary(): Record<string, string> {
  return {
    rust: '**Rust** — a systems programming language focused on safety and speed.',
    typescript: '**TypeScript** — JavaScript with static typing for scalable apps.',
    docker: '**Docker** — container platform for packaging applications.',
    kubernetes: '**Kubernetes** — orchestrates containerized workloads and services.',
    git: '**Git** — distributed version control system.'
  };
}
