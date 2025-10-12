# Phase 2 Roadmap - Document Symbols & Signature Help

**Target Completion:** TBD  
**Prerequisites:** Phase 1 complete ✅  
**Estimated Effort:** 1-2 days

## Goals

1. Forward document symbol requests to embedded servers
2. Aggregate symbols: host Markdown + embedded code
3. Forward signature help requests
4. Load workspace configuration (.lsptoy-languages.json)
5. Parse inline directives from HTML comments
6. Implement alias resolution tests

## Detailed Tasks

### Task 1: Document Symbols Forwarding (4-6 hours)

#### 1.1 Add forwardDocumentSymbols Method

**File:** `server/src/embedded/embeddedManager.ts`

```typescript
public async forwardDocumentSymbols(
  params: DocumentSymbolParams,
  fence: FenceMeta
): Promise<DocumentSymbol[] | SymbolInformation[] | null> {
  const server = await this.ensureServer(fence.normalizedLang);
  if (!server?.conn || !server.capabilities?.documentSymbolProvider) {
    return null;
  }

  await this.syncDocument(server, fence);

  const embeddedParams: DocumentSymbolParams = {
    textDocument: { uri: fence.virtUri }
  };

  try {
    const result = await server.conn.sendRequest(
      'textDocument/documentSymbol',
      embeddedParams
    );

    if (!result) return null;

    // Remap ranges if DocumentSymbol[] (hierarchy)
    if (Array.isArray(result) && result[0]?.range) {
      return this.remapDocumentSymbols(result, fence);
    }

    // Remap locations if SymbolInformation[] (flat)
    if (Array.isArray(result) && result[0]?.location) {
      return this.remapSymbolInformation(result, fence);
    }

    return result;
  } catch (err) {
    logDebug(`[EMBED] documentSymbol error lang=${fence.normalizedLang}: ${err}`);
    return null;
  }
}

private remapDocumentSymbols(
  symbols: DocumentSymbol[],
  fence: FenceMeta
): DocumentSymbol[] {
  return symbols.map(sym => ({
    ...sym,
    range: {
      start: this.remapPosition(sym.range.start, fence),
      end: this.remapPosition(sym.range.end, fence)
    },
    selectionRange: {
      start: this.remapPosition(sym.selectionRange.start, fence),
      end: this.remapPosition(sym.selectionRange.end, fence)
    },
    children: sym.children ? this.remapDocumentSymbols(sym.children, fence) : undefined
  }));
}

private remapSymbolInformation(
  symbols: SymbolInformation[],
  fence: FenceMeta
): SymbolInformation[] {
  return symbols.map(sym => ({
    ...sym,
    location: {
      uri: sym.location.uri, // Keep virtual URI or change to host?
      range: {
        start: this.remapPosition(sym.location.range.start, fence),
        end: this.remapPosition(sym.location.range.end, fence)
      }
    }
  }));
}
```

#### 1.2 Update documentSymbols Capability Handler

**File:** `server/src/capabilities/documentSymbols.ts`

```typescript
export function registerDocumentSymbolsProvider(
  connection: Connection,
  documentManager: DocumentManager
): void {
  connection.onDocumentSymbol(async (params: DocumentSymbolParams) => {
    const document = documentManager.get(params.textDocument.uri);
    if (!document) return null;

    const tree = getOrParseTree(document, documentManager);
    if (!tree) return null;

    // Collect host Markdown symbols
    const hostSymbols = extractMarkdownSymbols(tree, document);

    // Phase 2: Collect embedded symbols from all fences
    const embeddedSymbols: DocumentSymbol[] = [];
    
    if (documentManager.embeddedManager) {
      const fences = documentManager.embeddedManager.extractFences(
        params.textDocument.uri,
        tree,
        document
      );

      for (const fence of fences) {
        const symbols = await documentManager.embeddedManager.forwardDocumentSymbols(
          params,
          fence
        );

        if (symbols && Array.isArray(symbols) && symbols.length > 0) {
          // Wrap embedded symbols under a parent node
          const containerSymbol: DocumentSymbol = {
            name: `[${fence.normalizedLang}]`,
            detail: `lines ${fence.codeStart}-${fence.codeEnd}`,
            kind: SymbolKind.Module,
            range: {
              start: { line: fence.codeStart, character: 0 },
              end: { line: fence.codeEnd, character: 0 }
            },
            selectionRange: {
              start: { line: fence.codeStart, character: 0 },
              end: { line: fence.codeStart, character: 0 }
            },
            children: symbols as DocumentSymbol[]
          };

          embeddedSymbols.push(containerSymbol);
        }
      }
    }

    // Merge: host symbols + embedded symbols, sorted by line
    const allSymbols = [...hostSymbols, ...embeddedSymbols].sort(
      (a, b) => a.range.start.line - b.range.start.line
    );

    return allSymbols;
  });
}
```

**Testing:**
- Open document with TypeScript fence defining interface
- Check Outline view → should show Markdown headings + TypeScript symbols
- Verify ranges are correct (click symbol → jumps to right line)

---

### Task 2: Signature Help Forwarding (2-3 hours)

#### 2.1 Add forwardSignatureHelp Method

**File:** `server/src/embedded/embeddedManager.ts`

```typescript
public async forwardSignatureHelp(
  params: SignatureHelpParams,
  fence: FenceMeta
): Promise<SignatureHelp | null> {
  const server = await this.ensureServer(fence.normalizedLang);
  if (!server?.conn || !server.capabilities?.signatureHelpProvider) {
    return null;
  }

  await this.syncDocument(server, fence);

  const embeddedPos = this.projectPosition(params.position, fence);
  const embeddedParams: SignatureHelpParams = {
    textDocument: { uri: fence.virtUri },
    position: embeddedPos,
    context: params.context
  };

  logDebug(
    `[EMBED] forward signatureHelp lang=${fence.normalizedLang} pos=${embeddedPos.line}:${embeddedPos.character}`
  );

  try {
    const result = await server.conn.sendRequest(
      'textDocument/signatureHelp',
      embeddedParams
    ) as SignatureHelp | null;

    if (result) {
      logDebug(
        `[EMBED] signatureHelp result lang=${fence.normalizedLang} signatures=${result.signatures.length}`
      );
    }

    return result;
  } catch (err) {
    logDebug(`[EMBED] signatureHelp error lang=${fence.normalizedLang}: ${err}`);
    return null;
  }
}
```

#### 2.2 Update signatureHelp Handler

**File:** `server/src/capabilities/signatureHelp.ts`

```typescript
export function registerSignatureHelpProvider(
  connection: Connection,
  documentManager: DocumentManager
): void {
  connection.onSignatureHelp(async (params: SignatureHelpParams) => {
    // Phase 2: Check embedded context first
    if (documentManager.embeddedManager) {
      const fence = documentManager.embeddedManager.findFenceAt(
        params.textDocument.uri,
        params.position
      );

      if (fence) {
        const embeddedResult = await documentManager.embeddedManager.forwardSignatureHelp(
          params,
          fence
        );

        if (embeddedResult) {
          return embeddedResult;
        }
      }
    }

    // Host Markdown signature help (existing demo)
    // ... existing code ...
  });
}
```

**Testing:**
- Type `Math.max(` in TypeScript fence → signature help appears
- Type `print(` in Python fence → signature help appears
- Verify parameter highlighting updates as you type

---

### Task 3: Workspace Configuration Loading (3-4 hours)

#### 3.1 Add Config Loader

**File:** `server/src/embedded/configLoader.ts` (new)

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { LangEntry, mergeRegistry } from './embeddedRegistry';
import { logDebug } from '../utils/logging';

const CONFIG_FILENAME = '.lsptoy-languages.json';

/**
 * Search upward from docPath for .lsptoy-languages.json
 */
export function findWorkspaceConfig(docPath: string): string | null {
  let dir = path.dirname(docPath);
  const root = path.parse(dir).root;

  while (dir !== root) {
    const configPath = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(configPath)) {
      logDebug(`[EMBED] found config: ${configPath}`);
      return configPath;
    }
    dir = path.dirname(dir);
  }

  return null;
}

/**
 * Load and parse workspace configuration
 */
export function loadWorkspaceConfig(configPath: string): LangEntry[] {
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const json = JSON.parse(content);

    // Convert object format to LangEntry[]
    const entries: LangEntry[] = [];

    for (const [id, config] of Object.entries(json)) {
      const cfg = config as any;
      
      const entry: LangEntry = {
        id,
        aliases: cfg.aliases,
        node: cfg.cmd ? { cmd: cfg.cmd, args: cfg.args } : undefined,
        web: cfg.workerScript || cfg.wasmModule
          ? { workerScript: cfg.workerScript, wasmModule: cfg.wasmModule }
          : undefined,
        capabilities: cfg.capabilities
      };

      entries.push(entry);
    }

    logDebug(`[EMBED] loaded ${entries.length} language(s) from config`);
    return entries;
  } catch (err) {
    logDebug(`[EMBED] failed to load config ${configPath}: ${err}`);
    return [];
  }
}
```

#### 3.2 Integrate Config Loading

**File:** `server/src/embedded/embeddedManager.ts`

```typescript
import { findWorkspaceConfig, loadWorkspaceConfig } from './configLoader';

export class EmbeddedLanguageManager {
  private configLoaded = false;

  // ... existing code ...

  private loadConfigIfNeeded(docUri: string): void {
    if (this.configLoaded) return;

    const docPath = docUri.replace('file://', '');
    const configPath = findWorkspaceConfig(docPath);

    if (configPath) {
      const userEntries = loadWorkspaceConfig(configPath);
      if (userEntries.length > 0) {
        mergeRegistry(userEntries);
        logDebug('[EMBED] registry updated with workspace config');
      }
    }

    this.configLoaded = true;
  }

  public extractFences(/* ... */): FenceMeta[] {
    this.loadConfigIfNeeded(docUri);
    // ... existing fence extraction ...
  }
}
```

**Testing:**
- Create `.lsptoy-languages.json` in workspace:
  ```json
  {
    "python": {
      "cmd": "pylsp",
      "args": []
    }
  }
  ```
- Open document with Python fence
- Verify `pylsp` is spawned instead of `pyright-langserver`

---

### Task 4: Inline Directive Parsing (2-3 hours)

#### 4.1 Add Directive Parser

**File:** `server/src/embedded/directiveParser.ts` (new)

```typescript
import { logDebug } from '../utils/logging';

const DIRECTIVE_PATTERN = /<!--\s*lsptoy:add=([^\s]+)\s*-->/gi;

/**
 * Parse inline directives from Markdown document
 * Example: <!-- lsptoy:add=python,sql,lua -->
 */
export function parseInlineDirectives(text: string): string[] {
  const languages = new Set<string>();
  let match;

  while ((match = DIRECTIVE_PATTERN.exec(text)) !== null) {
    const langList = match[1];
    const langs = langList.split(',').map(l => l.trim());
    
    langs.forEach(lang => {
      if (lang) {
        languages.add(lang);
        logDebug(`[EMBED] inline directive: add=${lang}`);
      }
    });
  }

  return Array.from(languages);
}
```

#### 4.2 Integrate Directive Parsing

**File:** `server/src/embedded/embeddedManager.ts`

```typescript
import { parseInlineDirectives } from './directiveParser';

export class EmbeddedLanguageManager {
  private enabledLanguages = new Set<string>();

  public extractFences(/* ... */): FenceMeta[] {
    this.loadConfigIfNeeded(docUri);

    // Parse inline directives
    const docText = document.getText();
    const directives = parseInlineDirectives(docText);
    directives.forEach(lang => this.enabledLanguages.add(lang));

    // ... existing fence extraction ...
    // When checking pickRuntime, also check enabledLanguages
  }
}
```

**Testing:**
- Add `<!-- lsptoy:add=lua -->` to document
- Add Lua fence
- Verify Lua server spawned (if installed) or gracefully skipped

---

### Task 5: Alias Resolution Tests (1-2 hours)

**File:** `test/embedded-registry.test.js` (new)

```javascript
const { resolveLanguage, pickRuntime } = require('../server/src/embedded/embeddedRegistry');

describe('Embedded Language Registry', () => {
  it('resolves standard language IDs', () => {
    expect(resolveLanguage('typescript')).toBeDefined();
    expect(resolveLanguage('python')).toBeDefined();
    expect(resolveLanguage('rust')).toBeDefined();
  });

  it('resolves aliases', () => {
    expect(resolveLanguage('ts')?.id).toBe('typescript');
    expect(resolveLanguage('js')?.id).toBe('typescript');
    expect(resolveLanguage('py')?.id).toBe('python');
    expect(resolveLanguage('rs')?.id).toBe('rust');
  });

  it('returns undefined for unknown languages', () => {
    expect(resolveLanguage('unknown')).toBeUndefined();
  });

  it('picks node runtime in non-web environment', () => {
    const result = pickRuntime('typescript');
    expect(result.mode).toBe('node');
    expect(result.impl.cmd).toBe('typescript-language-server');
  });
});
```

**Run tests:**
```bash
npm test
```

---

## Updated Architecture

```
Phase 2 Architecture:
┌─────────────────────────────────────────────────────────────┐
│                  Host LSP Server (Markdown)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │       EmbeddedLanguageManager (Phase 2)            │    │
│  │  • Fence detection (✅ Phase 1)                    │    │
│  │  • Completion forwarding (✅ Phase 1)              │    │
│  │  • Hover forwarding (✅ Phase 1)                   │    │
│  │  • Document symbols forwarding (✨ NEW)            │    │
│  │  • Signature help forwarding (✨ NEW)              │    │
│  │  • Config loading (✨ NEW)                         │    │
│  │  • Directive parsing (✨ NEW)                      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │       Document Symbols Aggregation                  │   │
│  │  Host symbols (headings) + Embedded symbols         │   │
│  │  Sorted by line, namespaced under [lang] nodes     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Success Criteria (Phase 2)

- [ ] Document symbols show both Markdown headings and embedded code symbols
- [ ] Clicking embedded symbol in outline jumps to correct line
- [ ] Signature help works inside TypeScript/Python fences
- [ ] Workspace config (.lsptoy-languages.json) overrides defaults
- [ ] Inline directive enables additional languages
- [ ] Alias resolution tests pass
- [ ] No regressions in Phase 1 features
- [ ] Documentation updated

## Documentation Updates

### Update Files:
1. **EMBEDDED_PHASE1.md** → Rename to EMBEDDED_PHASE1-2.md, add Phase 2 details
2. **EMBEDDED_README.md** → Update feature matrix, add symbols/signature examples
3. **EMBEDDED_QUICK_REF.md** → Add symbols/signature sections
4. **README.md** → Update capabilities list

### New Sections:
- Symbol aggregation example with screenshot
- Signature help example with screenshot
- Config file format specification
- Inline directive syntax guide

## Testing Plan

### Unit Tests
- [ ] Registry alias resolution
- [ ] Config loading (valid/invalid JSON)
- [ ] Directive parsing (various formats)

### Integration Tests
- [ ] Document symbols with mixed content
- [ ] Signature help in multiple languages
- [ ] Config override behavior
- [ ] Directive enable/disable

### Regression Tests
- [ ] All Phase 1 tests still pass
- [ ] Performance unchanged

## Rollout Strategy

1. **Development** (1-2 days)
   - Implement tasks 1-5
   - Manual testing

2. **Testing** (0.5 days)
   - Run automated tests
   - Manual verification of all features

3. **Documentation** (0.5 days)
   - Update all docs
   - Create examples

4. **Release** (Alpha)
   - Tag v1.1.0-alpha
   - Request feedback

## Potential Issues & Mitigations

| Issue | Likelihood | Mitigation |
|-------|-----------|------------|
| Symbol range mismatch | Medium | Extensive range remapping tests |
| Config JSON parse errors | High | Try-catch with clear error messages |
| Directive false positives | Low | Strict regex pattern |
| Symbol merge conflicts | Low | Sort by line, clear namespacing |

## Performance Considerations

- Symbol requests may be slower (1 request per fence)
- Mitigation: Cache symbol results, invalidate on change
- Expected: <500ms for document with 5 fences

## Phase 3 Preview

After Phase 2 completion, next phase will add:
- Diagnostics forwarding from embedded servers
- Code actions derived from embedded diagnostics
- Diagnostic range remapping
- Problem panel integration

---

**Phase 2 Target:** Q4 2025  
**Estimated Duration:** 1-2 days development + 0.5 day testing  
**Dependencies:** Phase 1 complete ✅
