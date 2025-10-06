#!/usr/bin/env node

const { spawn } = require('node:child_process');
const { StreamMessageReader, StreamMessageWriter } = require('vscode-jsonrpc/node');
const { URI } = require('vscode-uri');
const path = require('node:path');
const fs = require('node:fs');

// Enable debug logging by default for tests (can override with LSP_TOY_DEBUG=false)
if (process.env.LSP_TOY_DEBUG === undefined) {
  process.env.LSP_TOY_DEBUG = 'true';
}

const SERVER_ENTRY = path.resolve(__dirname, '..', 'server/out/server.js');
const SAMPLE_FILE = path.resolve(__dirname, '..', 'samples', 'sample-resume.lsptoy');
const TEST_TIMEOUT_MS = 10000;

function ensurePrerequisites() {
  if (!fs.existsSync(SERVER_ENTRY)) {
    console.error('[stdio-smoke] Missing server build. Run "npm run compile" first.');
    process.exitCode = 1;
    process.exit();
  }

  if (!fs.existsSync(SAMPLE_FILE)) {
    console.error('[stdio-smoke] Sample document not found:', SAMPLE_FILE);
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

  serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  const reader = new StreamMessageReader(serverProcess.stdout);
  const writer = new StreamMessageWriter(serverProcess.stdin);

  const pendingRequests = new Map();
  const notificationWatchers = [];

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
      return;
    }

    if (typeof message.method === 'string') {
      const watcherIndex = notificationWatchers.findIndex(w => w.method === message.method && w.filter(message.params));
      if (watcherIndex !== -1) {
        const watcher = notificationWatchers.splice(watcherIndex, 1)[0];
        watcher.resolve(message.params);
        return;
      }

      if (message.method === 'window/logMessage' && message.params?.message) {
        console.log(`[server] ${message.params.type ?? ''} ${message.params.message}`.trim());
      }
    }
  });

  let nextRequestId = 1;

  function sendRequest(method, params) {
    const id = nextRequestId++;
    const deferred = createDeferred();
    pendingRequests.set(id, deferred);
    writer.write({ jsonrpc: '2.0', id, method, params });
    return deferred.promise;
  }

  function sendNotification(method, params) {
    writer.write({ jsonrpc: '2.0', method, params });
  }

  function waitForNotification(method, filter = () => true, timeoutMs = 5000) {
    const deferred = createDeferred();
    const timeout = setTimeout(() => {
      const index = notificationWatchers.indexOf(entry);
      if (index !== -1) {
        notificationWatchers.splice(index, 1);
      }
      deferred.reject(new Error(`Timed out waiting for notification ${method}`));
    }, timeoutMs);

    const entry = {
      method,
      filter,
      resolve: params => {
        clearTimeout(timeout);
        const index = notificationWatchers.indexOf(entry);
        if (index !== -1) {
          notificationWatchers.splice(index, 1);
        }
        deferred.resolve(params);
      },
      reject: error => {
        clearTimeout(timeout);
        const index = notificationWatchers.indexOf(entry);
        if (index !== -1) {
          notificationWatchers.splice(index, 1);
        }
        deferred.reject(error);
      }
    };

    notificationWatchers.push(entry);
    return deferred.promise;
  }

  const diagnosticsPromise = waitForNotification(
    'textDocument/publishDiagnostics',
    params => params?.uri === URI.file(SAMPLE_FILE).toString(),
    TEST_TIMEOUT_MS
  );

  const initializeParams = {
    processId: process.pid,
    rootUri: URI.file(path.resolve(__dirname, '..')).toString(),
    capabilities: {},
    workspaceFolders: null,
    locale: process.env.LSP_LOCALE || 'en-US',
    clientInfo: {
      name: 'lsp-toy-test-client',
      version: '0.0.1'
    }
  };

  await sendRequest('initialize', initializeParams);
  sendNotification('initialized', {});

  const sampleContent = fs.readFileSync(SAMPLE_FILE, 'utf8');
  const documentUri = URI.file(SAMPLE_FILE).toString();

  sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: documentUri,
      languageId: 'lsptoy',
      version: 1,
      text: sampleContent
    }
  });

  const diagnostics = await diagnosticsPromise;

  const todoDiagnostic = diagnostics.diagnostics?.find(diag => diag.code === 'todo');
  if (!todoDiagnostic) {
    throw new Error('Expected TODO diagnostic was not reported.');
  }

  await sendRequest('shutdown', null);
  sendNotification('exit');

  const exitCode = await new Promise(resolve => {
    serverProcess.on('exit', code => resolve(code));
  });

  if (exitCode !== 0) {
    throw new Error(`Server exited with code ${exitCode}`);
  }

  console.log('[stdio-smoke] Diagnostics received successfully.');
}

main().catch(error => {
  console.error('[stdio-smoke] Test failed:', error?.message ?? error);
  process.exitCode = 1;
}).finally(() => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  setTimeout(() => process.exit(), 0);
});
