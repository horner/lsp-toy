/**
 * Embedded Language Registry
 * 
 * Manages language definitions with dual-mode support:
 * - Web mode: uses Web Workers / WASM modules (browser/modern runtime)
 * - Node mode: spawns native language server binaries (traditional LSP)
 * 
 * Resolution priority:
 * 1. Workspace .lsptoy-languages.json override
 * 2. Inline directive (<!-- lsptoy:add=python,sql -->)
 * 3. Default registry entries
 * 4. Alias mapping (js→javascript, py→python, etc.)
 */

export interface WebImpl {
  workerScript?: string;   // URL or relative path to worker module
  wasmModule?: string;     // Optional WASM module path
  initData?: any;          // Extra initialization payload
}

export interface NodeImpl {
  cmd: string;
  args?: string[];
  initializationOptions?: any;
  bundled?: boolean;  // Indicates this is a bundled server
  fallback?: NodeImpl; // Fallback to external server if bundled fails
}

export interface LangEntry {
  id: string;
  aliases?: string[];
  web?: WebImpl;
  node?: NodeImpl;
  capabilities?: {
    completion?: boolean;
    hover?: boolean;
    diagnostics?: boolean;
    documentSymbol?: boolean;
    signatureHelp?: boolean;
    inlayHint?: boolean;
    semanticTokens?: boolean;
    codeAction?: boolean;
  };
}

/**
 * Default language registry entries
 * Prefer web worker if runtime supports it; fallback to node binary
 */
const DEFAULT_ENTRIES: LangEntry[] = [
  {
    id: 'typescript',
    aliases: ['ts', 'javascript', 'js'],
    web: { workerScript: '/workers/tsWorker.js' },
    node: { 
      cmd: './dist/bundled-servers/typescript-server.js',
      args: ['--stdio'],
      bundled: true,
      fallback: { cmd: 'typescript-language-server', args: ['--stdio'] }
    },
    capabilities: {
      completion: true,
      hover: true,
      diagnostics: true,
      documentSymbol: true,
      signatureHelp: true,
      semanticTokens: true
    }
  },
  {
    id: 'python',
    aliases: ['py'],
    web: { workerScript: '/workers/pyrightWorker.js' },
    node: { cmd: 'pyright-langserver', args: ['--stdio'] },
    capabilities: {
      completion: true,
      hover: true,
      diagnostics: true,
      documentSymbol: true,
      signatureHelp: true
    }
  },
  {
    id: 'rust',
    aliases: ['rs'],
    web: { wasmModule: '/wasm/rust-analyzer.wasm' },
    node: { cmd: 'rust-analyzer' },
    capabilities: {
      completion: true,
      hover: true,
      diagnostics: true,
      documentSymbol: true,
      inlayHint: true,
      semanticTokens: true
    }
  },
  {
    id: 'go',
    aliases: ['golang'],
    // No stable web worker yet; only node
    node: { cmd: 'gopls' },
    capabilities: {
      completion: true,
      hover: true,
      diagnostics: true,
      documentSymbol: true,
      signatureHelp: true,
      semanticTokens: true
    }
  },
  {
    id: 'java',
    node: { cmd: 'jdtls' },
    capabilities: {
      completion: true,
      hover: true,
      diagnostics: true,
      documentSymbol: true,
      signatureHelp: true
    }
  },
  {
    id: 'csharp',
    aliases: ['cs', 'c#'],
    node: { cmd: 'omnisharp', args: ['--languageserver'] },
    capabilities: {
      completion: true,
      hover: true,
      diagnostics: true,
      documentSymbol: true,
      signatureHelp: true
    }
  },
  {
    id: 'bash',
    aliases: ['sh', 'shell'],
    node: { cmd: 'bash-language-server', args: ['start'] },
    capabilities: {
      completion: true,
      hover: true,
      diagnostics: false
    }
  },
  {
    id: 'sql',
    node: { cmd: 'sql-language-server', args: ['up', '--method', 'stdio'] },
    capabilities: {
      completion: true,
      hover: true
    }
  },
  {
    id: 'json',
    node: { 
      cmd: './dist/bundled-servers/json-server.js',
      args: ['--stdio'],
      bundled: true,
      fallback: { cmd: 'vscode-json-languageserver', args: ['--stdio'] }
    },
    capabilities: {
      completion: true,
      hover: true,
      diagnostics: true
    }
  },
  {
    id: 'yaml',
    aliases: ['yml'],
    node: { cmd: 'yaml-language-server', args: ['--stdio'] },
    capabilities: {
      completion: true,
      hover: true,
      diagnostics: true
    }
  }
];

// Build quick lookup maps (alias -> LangEntry)
const byName = new Map<string, LangEntry>();

function buildIndex() {
  byName.clear();
  for (const entry of DEFAULT_ENTRIES) {
    byName.set(entry.id.toLowerCase(), entry);
    entry.aliases?.forEach(alias => byName.set(alias.toLowerCase(), entry));
  }
}

buildIndex();

export type ResolvedRuntime =
  | { mode: 'web'; entry: LangEntry; impl: WebImpl }
  | { mode: 'node'; entry: LangEntry; impl: NodeImpl }
  | { mode: 'unsupported'; entry?: LangEntry };

/**
 * Resolve language by name or alias
 */
export function resolveLanguage(langRaw: string): LangEntry | undefined {
  return byName.get(langRaw.toLowerCase());
}

/**
 * Pick runtime implementation based on environment and language entry
 * Priority: web (if available in env) > node > unsupported
 */
export function pickRuntime(langRaw: string): ResolvedRuntime {
  const entry = resolveLanguage(langRaw);
  if (!entry) {
    return { mode: 'unsupported' };
  }

  // Detect if we're in a web environment
  // In Node.js, globalThis.process exists; in browser/worker, it doesn't
  const isWeb = typeof process === 'undefined' || !(process as any).versions?.node;

  // Prefer web if environment supports and web impl is present
  if (isWeb && entry.web) {
    return { mode: 'web', entry, impl: entry.web };
  }

  // Fallback to node if available (standard LSP binary)
  if (entry.node) {
    return { mode: 'node', entry, impl: entry.node };
  }

  // If only web impl exists but we're in node, mark unsupported
  if (entry.web) {
    return { mode: 'unsupported', entry };
  }

  return { mode: 'unsupported', entry };
}

/**
 * Merge user-provided registry with defaults
 * User entries override defaults by `id`
 */
export function mergeRegistry(userEntries: LangEntry[]): void {
  for (const userEntry of userEntries) {
    // Remove existing entry if present
    const existing = byName.get(userEntry.id.toLowerCase());
    if (existing) {
      byName.delete(userEntry.id.toLowerCase());
      existing.aliases?.forEach(alias => byName.delete(alias.toLowerCase()));
    }

    // Add new entry
    byName.set(userEntry.id.toLowerCase(), userEntry);
    userEntry.aliases?.forEach(alias => byName.set(alias.toLowerCase(), userEntry));
  }
}

/**
 * Get all registered language IDs (for debugging/introspection)
 */
export function getRegisteredLanguages(): string[] {
  const ids = new Set<string>();
  for (const entry of byName.values()) {
    ids.add(entry.id);
  }
  return Array.from(ids).sort();
}
