#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const GRAMMAR_DIR = path.resolve(__dirname, '../grammars/tree-sitter-markdown');
const OUTPUT_DIR = path.resolve(__dirname, '../wasm');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'tree-sitter-markdown.wasm');

function checkEmscripten() {
  const result = spawnSync('emcc', ['--version'], { encoding: 'utf8' });
  return result.status === 0;
}

function checkDocker() {
  const result = spawnSync('docker', ['--version'], { encoding: 'utf8' });
  return result.status === 0;
}

function main() {
  const hasEmscripten = checkEmscripten();
  const hasDocker = checkDocker();
  
  if (!hasEmscripten && !hasDocker) {
    console.error('[build-wasm] Neither Emscripten nor Docker is available.');
    console.error('[build-wasm] Install one of the following:');
    console.error('[build-wasm]   - Emscripten: https://emscripten.org/docs/getting_started/downloads.html');
    console.error('[build-wasm]   - On macOS: brew install emscripten');
    console.error('[build-wasm]   - Docker: https://www.docker.com/get-started');
    process.exit(1);
  }

  if (!fs.existsSync(GRAMMAR_DIR)) {
    console.error('[build-wasm] Grammar directory not found:', GRAMMAR_DIR);
    console.error('[build-wasm] Cloning grammar...');
    const cloneResult = spawnSync('git', ['clone', '--depth', '1', 'https://github.com/ikatyang/tree-sitter-markdown.git', GRAMMAR_DIR], {
      stdio: 'inherit'
    });
    if (cloneResult.status !== 0) {
      console.error('[build-wasm] Failed to clone grammar.');
      process.exit(1);
    }
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('[build-wasm] Building tree-sitter-markdown WASM...');
  console.log('[build-wasm] This may take a few minutes...');
  
  const buildArgs = ['tree-sitter', 'build', '--wasm', '--output', OUTPUT_FILE];
  
  // Use Docker if Emscripten is not available
  if (!hasEmscripten && hasDocker) {
    console.log('[build-wasm] Using Docker (Emscripten not found locally)...');
    buildArgs.push('--docker');
  }
  
  const result = spawnSync('npx', buildArgs, {
    cwd: GRAMMAR_DIR,
    stdio: 'inherit',
    env: { ...process.env }
  });

  if (result.status !== 0) {
    console.error('[build-wasm] Build failed.');
    process.exit(result.status ?? 1);
  }

  if (fs.existsSync(OUTPUT_FILE)) {
    const stats = fs.statSync(OUTPUT_FILE);
    console.log(`[build-wasm] ✅ WASM file generated: ${OUTPUT_FILE}`);
    console.log(`[build-wasm] Size: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log('[build-wasm] Commit this file to your repository for distribution.');
  } else {
    console.error('[build-wasm] WASM file was not created.');
    process.exit(1);
  }
}

main();
