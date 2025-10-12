/**
 * Embedded Language Server Manager
 * 
 * Manages lifecycle of embedded language servers for fenced code blocks:
 * 1. Detects fences in Markdown documents via tree-sitter
 * 2. Spawns/reuses language servers for detected languages
 * 3. Projects cursor positions from host document to virtual embedded documents
 * 4. Forwards LSP requests (completion, hover, etc.) to embedded servers
 * 5. Remaps ranges/tokens back to host document coordinates
 * 
 * Phase 1: Focus on completion + hover with sync infrastructure
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {
  Connection,
  TextDocumentIdentifier,
  Position,
  CompletionParams,
  CompletionItem,
  HoverParams,
  Hover,
  InitializeParams,
  InitializeResult,
  DidOpenTextDocumentParams,
  DidChangeTextDocumentParams,
  TextDocumentContentChangeEvent
} from 'vscode-languageserver/node';
import {
  createMessageConnection,
  MessageConnection,
  StreamMessageReader,
  StreamMessageWriter
} from 'vscode-jsonrpc/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Tree } from 'web-tree-sitter';
import type { Node as SyntaxNode } from 'web-tree-sitter';
import { pickRuntime, LangEntry, NodeImpl } from './embeddedRegistry';
import { logDebug } from '../utils/logging';

/**
 * Metadata for a single fenced code block
 */
export interface FenceMeta {
  lang: string;                  // Detected language (raw from fence)
  normalizedLang: string;        // Normalized language id
  codeStart: number;             // Line where code starts (after opening fence)
  codeEnd: number;               // Line where code ends (before closing fence)
  text: string;                  // Actual code content
  virtUri: string;               // Virtual document URI for embedded server
  version: number;               // Document version for sync
}

/**
 * Embedded language server instance
 */
export interface EmbeddedServer {
  lang: string;
  mode: 'node' | 'web';
  proc?: ChildProcess;
  conn?: MessageConnection;
  worker?: any;  // Web Worker (future)
  initialized: boolean;
  capabilities?: InitializeResult['capabilities'];
  docs: Map<string, number>;  // virtUri -> version
  pending?: Promise<void>;    // Initialization promise
  failedAt?: number;          // Timestamp of last failure (for cooldown)
  dead?: boolean;             // Mark as permanently failed
}

export class EmbeddedLanguageManager {
  private servers = new Map<string, EmbeddedServer>();
  private fenceCache = new Map<string, FenceMeta[]>();
  private workspaceRoot: string | null = null;
  private hostConnection: Connection;

  constructor(connection: Connection, workspaceRoot?: string) {
    this.hostConnection = connection;
    this.workspaceRoot = workspaceRoot || null;
  }

  /**
   * Extract fences from document using tree-sitter parse tree
   */
  public extractFences(docUri: string, tree: Tree, document: TextDocument): FenceMeta[] {
    const fences: FenceMeta[] = [];
    let fenceIndex = 0;

    const traverse = (node: SyntaxNode) => {
      // Look for fenced_code_block nodes
      if (node.type === 'fenced_code_block') {
        const fenceStartLine = node.startPosition.row;
        
        // Find info_string child (language identifier)
        let infoNode: SyntaxNode | null = null;
        let codeNode: SyntaxNode | null = null;
        
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child?.type === 'info_string') {
            infoNode = child;
          } else if (child?.type === 'code_fence_content') {
            codeNode = child;
          }
        }
        
        const langRaw = infoNode?.text?.trim() || '';
        
        if (!langRaw) {
          logDebug(`[EMBED] skip fence at line ${fenceStartLine}: no language specified`);
          return;
        }

        const runtime = pickRuntime(langRaw);
        
        // Check if we found the code content node
        if (!codeNode) {
          logDebug(`[EMBED] skip fence at line ${fenceStartLine} lang=${langRaw}: no code node`);
          return;
        }

        const codeStart = codeNode.startPosition.row;
        const codeEnd = codeNode.endPosition.row;
        const codeText = codeNode.text;

        // Generate virtual URI for this fence
        // Use langRaw for unsupported languages, runtime.entry.id for supported ones
        const normalizedLang = runtime.mode === 'unsupported' ? langRaw.toLowerCase() : runtime.entry!.id;
        const virtUri = `embedded://${docUri.replace(/[^a-zA-Z0-9]/g, '_')}/fence_${fenceIndex}_${normalizedLang}`;

        fences.push({
          lang: langRaw,
          normalizedLang: normalizedLang,
          codeStart,
          codeEnd,
          text: codeText,
          virtUri,
          version: 1
        });

        // Only log unsupported languages (supported ones log on spawn)
        if (runtime.mode === 'unsupported') {
          logDebug(`[EMBED] ${langRaw} fence (unsupported) at line ${fenceStartLine}`);
        }
        
        fenceIndex++;
      }

      // Recurse to children
      for (let i = 0; i < node.childCount; i++) {
        traverse(node.child(i)!);
      }
    };

    traverse(tree.rootNode);
    this.fenceCache.set(docUri, fences);
    
    if (fences.length > 0) {
      logDebug(`[EMBED] Cached ${fences.length} fence(s)`);
    }
    return fences;
  }

  /**
   * Find fence containing given position
   */
  public findFenceAt(docUri: string, position: Position): FenceMeta | undefined {
    const fences = this.fenceCache.get(docUri) || [];
    
    const found = fences.find(
      f => position.line >= f.codeStart && position.line <= f.codeEnd
    );
    
    if (found) {
      logDebug(`  → Inside ${found.normalizedLang} fence at line ${position.line}`);
    }
    
    return found;
  }

  /**
   * Project position from host document to virtual embedded document
   */
  public projectPosition(hostPos: Position, fence: FenceMeta): Position {
    return {
      line: hostPos.line - fence.codeStart,
      character: hostPos.character
    };
  }

  /**
   * Remap position from embedded document back to host
   */
  public remapPosition(embeddedPos: Position, fence: FenceMeta): Position {
    return {
      line: embeddedPos.line + fence.codeStart,
      character: embeddedPos.character
    };
  }

  /**
   * Ensure embedded server is spawned and initialized
   */
  private async ensureServer(lang: string): Promise<EmbeddedServer | null> {
    const normalizedLang = lang.toLowerCase();
    
    // Check if already spawned
    if (this.servers.has(normalizedLang)) {
      const server = this.servers.get(normalizedLang)!;
      if (server.dead) {
        logDebug(`[EMBED] skip lang=${normalizedLang}: marked dead`);
        return null;
      }
      if (server.pending) {
        await server.pending;
      }
      return server;
    }

    const runtime = pickRuntime(normalizedLang);
    if (runtime.mode === 'unsupported') {
      logDebug(`[EMBED] skip lang=${normalizedLang}: no backend available`);
      return null;
    }

    if (runtime.mode === 'web') {
      // Web worker mode not yet implemented in Phase 1
      logDebug(`[EMBED] skip lang=${normalizedLang}: web worker mode not implemented yet`);
      return null;
    }

    // Spawn Node.js language server with fallback support
    const impl = runtime.impl as NodeImpl;
    const proc = await this.spawnWithFallback(normalizedLang, impl);
    
    if (!proc) {
      return null;
    }

    // Check for immediate spawn failure
    let spawnFailed = false;
    proc.on('error', (err) => {
      logDebug(`[EMBED] process error lang=${normalizedLang}: ${err.message}`);
      spawnFailed = true;
    });

    // Wait a tick to see if spawn fails immediately
    await new Promise(resolve => setImmediate(resolve));
    
    if (spawnFailed || !proc.stdout || !proc.stdin) {
      logDebug(`[EMBED] spawn failed immediately lang=${normalizedLang}`);
      proc.kill();
      
      // Store a dead server placeholder so getLanguageHint() can provide help
      const deadServer: EmbeddedServer = {
        lang: normalizedLang,
        mode: 'node',
        initialized: false,
        docs: new Map(),
        dead: true,
        failedAt: Date.now()
      };
      this.servers.set(normalizedLang, deadServer);
      
      return null;
    }

    try {
      const conn = createMessageConnection(
        new StreamMessageReader(proc.stdout),
        new StreamMessageWriter(proc.stdin)
      );

      const server: EmbeddedServer = {
        lang: normalizedLang,
        mode: 'node',
        proc,
        conn,
        initialized: false,
        docs: new Map(),
        pending: undefined
      };

      // Continue handling process errors after successful spawn
      proc.on('error', (err) => {
        logDebug(`[EMBED] process error lang=${normalizedLang}: ${err.message}`);
        server.dead = true;
        server.failedAt = Date.now();
      });

      proc.on('exit', (code) => {
        logDebug(`[EMBED] process exited lang=${normalizedLang} code=${code}`);
        server.dead = true;
        this.servers.delete(normalizedLang);
      });

      if (proc.stderr) {
        proc.stderr.on('data', (chunk) => {
          logDebug(`[EMBED] stderr lang=${normalizedLang}: ${chunk.toString().trim()}`);
        });
      }

      // Initialize the server
      server.pending = (async () => {
        try {
          conn.listen();

          const initParams: InitializeParams = {
            processId: process.pid,
            rootUri: this.workspaceRoot ? `file://${this.workspaceRoot}` : null,
            capabilities: {
              textDocument: {
                synchronization: {
                  dynamicRegistration: false,
                  willSave: false,
                  willSaveWaitUntil: false,
                  didSave: false
                },
                completion: {
                  dynamicRegistration: false,
                  completionItem: {
                    snippetSupport: true,
                    commitCharactersSupport: false,
                    documentationFormat: ['markdown', 'plaintext']
                  }
                },
                hover: {
                  dynamicRegistration: false,
                  contentFormat: ['markdown', 'plaintext']
                }
              }
            },
            workspaceFolders: null
          };

          logDebug(`[EMBED] sending initialize lang=${normalizedLang}`);
          const result = await conn.sendRequest('initialize', initParams) as InitializeResult;
          
          server.capabilities = result.capabilities;
          logDebug(`[EMBED] initialized lang=${normalizedLang} capabilities=${JSON.stringify(Object.keys(result.capabilities || {}))}`);

          conn.sendNotification('initialized', {});
          server.initialized = true;
        } catch (err) {
          logDebug(`[EMBED] initialization failed lang=${normalizedLang}: ${err}`);
          server.dead = true;
          server.failedAt = Date.now();
          throw err;
        }
      })();

      this.servers.set(normalizedLang, server);
      await server.pending;
      
      return server;
    } catch (err) {
      logDebug(`[EMBED] failed to spawn lang=${normalizedLang}: ${err}`);
      return null;
    }
  }

  /**
   * Sync virtual document to embedded server
   */
  private async syncDocument(server: EmbeddedServer, fence: FenceMeta): Promise<void> {
    if (!server.conn || !server.initialized) {
      return;
    }

    const existingVersion = server.docs.get(fence.virtUri);

    if (!existingVersion) {
      // First time seeing this document - send didOpen
      logDebug(`[EMBED] didOpen lang=${server.lang} uri=${fence.virtUri} version=${fence.version}`);
      
      const openParams: DidOpenTextDocumentParams = {
        textDocument: {
          uri: fence.virtUri,
          languageId: server.lang,
          version: fence.version,
          text: fence.text
        }
      };

      await server.conn.sendNotification('textDocument/didOpen', openParams);
      server.docs.set(fence.virtUri, fence.version);
    } else if (existingVersion !== fence.version) {
      // Document changed - send didChange (full text replacement)
      logDebug(`[EMBED] didChange lang=${server.lang} uri=${fence.virtUri} version=${fence.version}`);

      const changeParams: DidChangeTextDocumentParams = {
        textDocument: {
          uri: fence.virtUri,
          version: fence.version
        },
        contentChanges: [
          {
            text: fence.text
          } as TextDocumentContentChangeEvent
        ]
      };

      await server.conn.sendNotification('textDocument/didChange', changeParams);
      server.docs.set(fence.virtUri, fence.version);
    }
  }

  /**
   * Spawn language server with fallback support
   * Try bundled server first, fallback to external if bundled fails
   */
  private async spawnWithFallback(normalizedLang: string, impl: NodeImpl): Promise<ChildProcess | null> {
    const candidates = impl.fallback ? [impl, impl.fallback] : [impl];
    
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const isBundled = i === 0 && impl.bundled;
      const isLastAttempt = i === candidates.length - 1;
      
      logDebug(`[EMBED] attempting spawn lang=${normalizedLang} cmd=${candidate.cmd} ${isBundled ? '(bundled)' : '(external)'}`);

      try {
        // Resolve bundled server path relative to server root
        const cmdPath = isBundled && candidate.cmd.startsWith('./') 
          ? path.resolve(__dirname, '../../../', candidate.cmd)
          : candidate.cmd;

        const proc = spawn(cmdPath, candidate.args || [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env }
        });

        // Check for immediate spawn failure
        let spawnFailed = false;
        proc.on('error', (err: Error) => {
          logDebug(`[EMBED] process error lang=${normalizedLang}: ${err.message}`);
          spawnFailed = true;
        });

        // Wait a tick to see if spawn fails immediately
        await new Promise(resolve => setImmediate(resolve));
        
        if (spawnFailed || !proc.stdout || !proc.stdin) {
          logDebug(`[EMBED] spawn failed immediately lang=${normalizedLang} cmd=${cmdPath}`);
          proc.kill();
          
          if (!isLastAttempt) {
            logDebug(`[EMBED] trying fallback for lang=${normalizedLang}`);
            continue; // Try next candidate
          }
        } else {
          logDebug(`[EMBED] spawn successful lang=${normalizedLang} cmd=${cmdPath} ${isBundled ? '(bundled)' : '(external)'}`);
          return proc;
        }
      } catch (err) {
        logDebug(`[EMBED] spawn failed lang=${normalizedLang} cmd=${candidate.cmd}: ${err}`);
        
        if (!isLastAttempt) {
          logDebug(`[EMBED] trying fallback for lang=${normalizedLang}`);
          continue; // Try next candidate
        }
      }
    }

    // All spawn attempts failed - store dead server placeholder
    const deadServer: EmbeddedServer = {
      lang: normalizedLang,
      mode: 'node',
      initialized: false,
      docs: new Map(),
      dead: true,
      failedAt: Date.now()
    };
    this.servers.set(normalizedLang, deadServer);
    
    return null;
  }

  /**
   * Forward completion request to embedded server
   */
  public async forwardCompletion(
    params: CompletionParams,
    fence: FenceMeta
  ): Promise<CompletionItem[] | null> {
    const server = await this.ensureServer(fence.normalizedLang);
    if (!server || !server.conn || !server.capabilities?.completionProvider) {
      logDebug(`[EMBED] completion unavailable lang=${fence.normalizedLang} at line ${params.position.line}`);
      return null;
    }

    await this.syncDocument(server, fence);

    const embeddedPos = this.projectPosition(params.position, fence);
    const embeddedParams: CompletionParams = {
      textDocument: { uri: fence.virtUri },
      position: embeddedPos,
      context: params.context
    };

    logDebug(`[EMBED] forward completion lang=${fence.normalizedLang} at line ${params.position.line}:${params.position.character} → embedded ${embeddedPos.line}:${embeddedPos.character}`);

    try {
      const result = await server.conn.sendRequest('textDocument/completion', embeddedParams);
      
      if (!result) {
        return null;
      }

      // Handle both CompletionItem[] and CompletionList
      const items: CompletionItem[] = Array.isArray(result) ? result : (result as any).items || [];
      
      logDebug(`[EMBED] completion result lang=${fence.normalizedLang} count=${items.length} for line ${params.position.line}`);
      
      // TODO Phase 5: Remap textEdit ranges if present
      return items;
    } catch (err) {
      logDebug(`[EMBED] completion error lang=${fence.normalizedLang} at line ${params.position.line}: ${err}`);
      return null;
    }
  }

  /**
   * Forward hover request to embedded server
   */
  public async forwardHover(
    params: HoverParams,
    fence: FenceMeta
  ): Promise<Hover | null> {
    const server = await this.ensureServer(fence.normalizedLang);
    if (!server || !server.conn || !server.capabilities?.hoverProvider) {
      logDebug(`[EMBED] hover unavailable lang=${fence.normalizedLang} at line ${params.position.line}`);
      return null;
    }

    await this.syncDocument(server, fence);

    const embeddedPos = this.projectPosition(params.position, fence);
    const embeddedParams: HoverParams = {
      textDocument: { uri: fence.virtUri },
      position: embeddedPos
    };

    logDebug(`[EMBED] forward hover lang=${fence.normalizedLang} at line ${params.position.line}:${params.position.character} → embedded ${embeddedPos.line}:${embeddedPos.character}`);

    try {
      const result = await server.conn.sendRequest('textDocument/hover', embeddedParams) as Hover | null;
      
      if (!result) {
        return null;
      }

      // Remap range if present
      if (result.range) {
        result.range = {
          start: this.remapPosition(result.range.start, fence),
          end: this.remapPosition(result.range.end, fence)
        };
      }

      logDebug(`[EMBED] hover result lang=${fence.normalizedLang} available=${!!result.contents} for line ${params.position.line}`);
      return result;
    } catch (err) {
      logDebug(`[EMBED] hover error lang=${fence.normalizedLang} at line ${params.position.line}: ${err}`);
      return null;
    }
  }

  /**
   * Get helpful hint message for unsupported or unavailable language
   */
  public getLanguageHint(lang: string): string | null {
    const normalizedLang = lang.toLowerCase();
    const runtime = pickRuntime(normalizedLang);
    
    if (runtime.mode === 'unsupported') {
      // Language not in registry
      const suggestions = this.findSimilarLanguages(normalizedLang);
      let message = `### 🔍 Language Not Supported: \`${lang}\`\n\n`;
      message += `This language is not yet configured in the embedded language registry.\n\n`;
      
      if (suggestions.length > 0) {
        message += `**Did you mean?** ${suggestions.map(s => `\`${s}\``).join(', ')}\n\n`;
      }
      
      message += `**Supported languages:** typescript, python, rust, go, java, csharp, bash, sql, json, yaml\n\n`;
      message += `**To add support:** Update \`embeddedRegistry.ts\` with the language server configuration.`;
      
      return message;
    }
    
    // Check if server spawn failed
    const server = this.servers.get(normalizedLang);
    if (server?.dead) {
      const impl = runtime.impl as NodeImpl;
      let message = `### ⚠️ Language Server Not Available: \`${lang}\`\n\n`;
      message += `The language server failed to start. This usually means the server is not installed.\n\n`;
      message += `**Required command:** \`${impl.cmd}\`\n\n`;
      message += `**Installation:**\n`;
      
      // Provide specific installation instructions
      switch (normalizedLang) {
        case 'typescript':
        case 'javascript':
          message += `\`\`\`bash\nnpm install -g typescript typescript-language-server\n\`\`\``;
          break;
        case 'python':
          message += `\`\`\`bash\npip install pyright\n# or\nnpm install -g pyright\n\`\`\`\n\n`;
          message += `**Note:** You may need to create a symlink:\n`;
          message += `\`\`\`bash\nln -s $(which pyright) /usr/local/bin/pyright-langserver\n\`\`\``;
          break;
        case 'rust':
          message += `\`\`\`bash\nrustup component add rust-analyzer\n\`\`\``;
          break;
        case 'go':
          message += `\`\`\`bash\ngo install golang.org/x/tools/gopls@latest\n\`\`\``;
          break;
        case 'bash':
          message += `\`\`\`bash\nnpm install -g bash-language-server\n\`\`\``;
          break;
        case 'json':
          message += `\`\`\`bash\nnpm install -g vscode-langservers-extracted\n\`\`\``;
          break;
        case 'yaml':
          message += `\`\`\`bash\nnpm install -g yaml-language-server\n\`\`\``;
          break;
        default:
          message += `Check the documentation for \`${impl.cmd}\``;
      }
      
      message += `\n\n**After installing:** Reload the VS Code window (Cmd/Ctrl+Shift+P → "Developer: Reload Window")`;
      
      return message;
    }
    
    return null;
  }

  /**
   * Find similar language names for suggestions
   */
  private findSimilarLanguages(input: string): string[] {
    const allLanguages = ['typescript', 'javascript', 'python', 'rust', 'go', 'java', 'csharp', 'bash', 'sql', 'json', 'yaml'];
    const aliases: { [key: string]: string } = {
      'ts': 'typescript',
      'js': 'javascript',
      'py': 'python',
      'rs': 'rust',
      'sh': 'bash',
      'yml': 'yaml',
      'cs': 'csharp'
    };
    
    // Check exact alias match
    if (aliases[input]) {
      return [aliases[input]];
    }
    
    // Find languages that start with the same letter
    const sameLetter = allLanguages.filter(lang => lang[0] === input[0]);
    if (sameLetter.length > 0) {
      return sameLetter.slice(0, 3);
    }
    
    return [];
  }

  /**
   * Increment fence version (call when document changes)
   */
  public invalidateFences(docUri: string): void {
    const fences = this.fenceCache.get(docUri);
    if (fences) {
      fences.forEach(f => f.version++);
    }
  }

  /**
   * Cleanup when document is closed
   */
  public closeDocument(docUri: string): void {
    const fences = this.fenceCache.get(docUri);
    if (fences) {
      // Send didClose to each embedded server
      fences.forEach(async (fence) => {
        const server = this.servers.get(fence.normalizedLang);
        if (server?.conn && server.initialized) {
          await server.conn.sendNotification('textDocument/didClose', {
            textDocument: { uri: fence.virtUri }
          });
          server.docs.delete(fence.virtUri);
          logDebug(`[EMBED] didClose lang=${fence.normalizedLang} uri=${fence.virtUri}`);
        }
      });
      
      this.fenceCache.delete(docUri);
    }
  }

  /**
   * Shutdown all embedded servers
   */
  public async shutdown(): Promise<void> {
    logDebug(`[EMBED] shutting down ${this.servers.size} server(s)`);
    
    const shutdownPromises: Promise<void>[] = [];
    
    for (const [lang, server] of this.servers.entries()) {
      if (server.conn && server.initialized) {
        shutdownPromises.push(
          (async () => {
            try {
              await server.conn!.sendRequest('shutdown', null);
              server.conn!.sendNotification('exit', null);
              logDebug(`[EMBED] shutdown lang=${lang} complete`);
            } catch (err) {
              logDebug(`[EMBED] shutdown error lang=${lang}: ${err}`);
            }
          })()
        );
      }
      
      if (server.proc) {
        server.proc.kill();
      }
    }
    
    await Promise.all(shutdownPromises);
    this.servers.clear();
    this.fenceCache.clear();
  }

  /**
   * Get statistics (for debugging/monitoring)
   */
  public getStats() {
    return {
      activeServers: this.servers.size,
      languages: Array.from(this.servers.keys()),
      totalFences: Array.from(this.fenceCache.values()).reduce((sum, fences) => sum + fences.length, 0)
    };
  }
}
