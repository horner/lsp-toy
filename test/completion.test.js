#!/usr/bin/env node

/**
 * Test completion item localization
 * Verifies that completion items are translated based on locale
 */

const { spawn } = require('node:child_process');
const { StreamMessageReader, StreamMessageWriter } = require('vscode-jsonrpc/node');
const { URI } = require('vscode-uri');
const path = require('node:path');
const fs = require('node:fs');

// Quiet mode for cleaner test output
process.env.LSP_TOY_DEBUG = 'false';

const SERVER_ENTRY = path.resolve(__dirname, '..', 'server/out/server.js');
const TEST_TIMEOUT_MS = 5000;
const locale = process.env.LSP_LOCALE || 'en-US';

function ensurePrerequisites() {
  if (!fs.existsSync(SERVER_ENTRY)) {
    console.error('[test-completion] Missing server build. Run "npm run compile" first.');
    process.exitCode = 1;
    process.exit();
  }
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let serverProcess = null;

async function main() {
  ensurePrerequisites();
  
  console.log(`[test-completion] Testing completion localization with locale: ${locale}`);

  serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  const reader = new StreamMessageReader(serverProcess.stdout);
  const writer = new StreamMessageWriter(serverProcess.stdin);

  const pendingRequests = new Map();
  let nextRequestId = 1;

  reader.listen(message => {
    if (message === null || typeof message !== 'object') {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(message, 'id')) {
      const { id } = message;
      const pending = pendingRequests.get(id);
      if (!pending) {
        return;
      }
      pendingRequests.delete(id);
      if (Object.prototype.hasOwnProperty.call(message, 'error')) {
        pending.reject(message.error);
      } else {
        pending.resolve(message.result);
      }
    }
  });

  function sendRequest(method, params) {
    const id = nextRequestId++;
    const deferred = createDeferred();
    pendingRequests.set(id, deferred);
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      deferred.reject(new Error(`Request timeout: ${method}`));
    }, TEST_TIMEOUT_MS);
    
    deferred.promise.finally(() => clearTimeout(timeout));
    writer.write({ jsonrpc: '2.0', id, method, params });
    return deferred.promise;
  }

  function sendNotification(method, params) {
    writer.write({ jsonrpc: '2.0', method, params });
  }

  // Initialize
  const initializeParams = {
    processId: process.pid,
    rootUri: URI.file(path.resolve(__dirname, '..')).toString(),
    capabilities: {},
    locale: locale,
    clientInfo: {
      name: 'completion-test-client',
      version: '1.0.0'
    }
  };

  await sendRequest('initialize', initializeParams);
  sendNotification('initialized', {});

  // Open a test document
  const testUri = URI.file(path.join(__dirname, 'test-doc.lsptoy')).toString();
  sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: testUri,
      languageId: 'lsptoy',
      version: 1,
      text: '# Test\n[\n'
    }
  });

  // Request completion (trigger with '[')
  const completions = await sendRequest('textDocument/completion', {
    textDocument: { uri: testUri },
    position: { line: 1, character: 1 },
    context: { triggerKind: 2, triggerCharacter: '[' }
  });

  if (!completions || completions.length === 0) {
    throw new Error('No completion items returned');
  }

  // Find the link completion item
  const linkItem = completions.find(item => 
    item.label.toLowerCase().includes('link') || 
    item.label.toLowerCase().includes('enlace') ||
    item.label.toLowerCase().includes('lien')
  );

  if (!linkItem) {
    throw new Error('Link completion item not found');
  }

  console.log('[test-completion] ✓ Link completion item:');
  console.log(`[test-completion]   Label: "${linkItem.label}"`);
  console.log(`[test-completion]   Detail: "${linkItem.detail}"`);
  console.log(`[test-completion]   Documentation: "${linkItem.documentation}"`);

  // Verify translation
  let success = true;
  if (locale.startsWith('es')) {
    if (linkItem.label.toLowerCase().includes('enlace')) {
      console.log('[test-completion] ✓ Spanish translation verified!');
    } else {
      console.error('[test-completion] ✗ Spanish translation missing');
      success = false;
    }
  } else if (locale.startsWith('fr')) {
    if (linkItem.label.toLowerCase().includes('lien')) {
      console.log('[test-completion] ✓ French translation verified!');
    } else {
      console.error('[test-completion] ✗ French translation missing');
      success = false;
    }
  } else {
    if (linkItem.label.toLowerCase().includes('link')) {
      console.log('[test-completion] ✓ English (default) verified!');
    } else {
      console.error('[test-completion] ✗ English translation missing');
      success = false;
    }
  }

  await sendRequest('shutdown', null);
  sendNotification('exit');

  const exitCode = await new Promise(resolve => {
    serverProcess.on('exit', code => resolve(code));
  });

  if (exitCode !== 0) {
    throw new Error(`Server exited with code ${exitCode}`);
  }

  if (!success) {
    throw new Error('Translation verification failed');
  }

  console.log('[test-completion] ✓ Test passed!');
}

main().catch(error => {
  console.error('[test-completion] ✗ Test failed:', error?.message ?? error);
  process.exitCode = 1;
}).finally(() => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});
