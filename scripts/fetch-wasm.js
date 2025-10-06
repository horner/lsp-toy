#!/usr/bin/env node

/**
 * Fetches prebuilt WASM files from tree-sitter-grammars/tree-sitter-markdown
 * 
 * Usage:
 *   node scripts/fetch-wasm.js [version]
 * 
 * If no version is specified, fetches the latest release.
 * Version can be:
 *   - "latest" (default)
 *   - A specific tag like "v0.5.1"
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const REPO = 'tree-sitter-grammars/tree-sitter-markdown';
const WASM_FILES = [
  'tree-sitter-markdown.wasm',
  'tree-sitter-markdown_inline.wasm'
];

function httpsGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const requestOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'lsp-toy-fetch-wasm',
        ...options.headers
      }
    };

    https.get(requestOptions, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // Follow redirect
        return httpsGet(res.headers.location, options).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }

      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks);
        if (options.binary) {
          resolve(data);
        } else {
          resolve(data.toString('utf-8'));
        }
      });
    }).on('error', reject);
  });
}

async function getLatestRelease() {
  console.log('Fetching latest release info...');
  const apiUrl = `https://api.github.com/repos/${REPO}/releases/latest`;
  const response = await httpsGet(apiUrl);
  const release = JSON.parse(response);
  return {
    version: release.tag_name,
    assets: release.assets.map(a => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size
    }))
  };
}

async function getReleaseByTag(tag) {
  console.log(`Fetching release info for ${tag}...`);
  const apiUrl = `https://api.github.com/repos/${REPO}/releases/tags/${tag}`;
  const response = await httpsGet(apiUrl);
  const release = JSON.parse(response);
  return {
    version: release.tag_name,
    assets: release.assets.map(a => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size
    }))
  };
}

async function downloadFile(url, destPath) {
  console.log(`  Downloading ${path.basename(destPath)}...`);
  const data = await httpsGet(url, { binary: true });
  
  // Create directory if it doesn't exist
  const dir = path.dirname(destPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(destPath, data);
  const sizeKB = (data.length / 1024).toFixed(0);
  console.log(`  ✓ Saved ${path.basename(destPath)} (${sizeKB} KB)`);
  return data.length;
}

async function verifyWasmFile(filePath) {
  const data = fs.readFileSync(filePath);
  
  // Check WASM magic number: 0x00 0x61 0x73 0x6D (\\0asm)
  if (data.length < 4) {
    throw new Error(`File too small: ${filePath}`);
  }
  
  if (data[0] !== 0x00 || data[1] !== 0x61 || data[2] !== 0x73 || data[3] !== 0x6D) {
    throw new Error(`Invalid WASM magic number in ${filePath}`);
  }
  
  // Check version (should be 1)
  if (data[4] !== 0x01 || data[5] !== 0x00 || data[6] !== 0x00 || data[7] !== 0x00) {
    console.warn(`  ⚠ Warning: Unexpected WASM version in ${path.basename(filePath)}`);
  }
  
  console.log(`  ✓ Verified ${path.basename(filePath)} is valid WASM`);
}

async function updateGrammarNotes(version) {
  const notesPath = path.join(__dirname, '..', 'GRAMMAR_NOTES.md');
  
  if (!fs.existsSync(notesPath)) {
    console.log('  ⚠ GRAMMAR_NOTES.md not found, skipping update');
    return;
  }
  
  let content = fs.readFileSync(notesPath, 'utf-8');
  
  // Update version in the header
  content = content.replace(
    /tree-sitter-grammars\/tree-sitter-markdown\*\* \(v[\d.]+\)/,
    `tree-sitter-grammars/tree-sitter-markdown** (${version})`
  );
  
  // Update version in the comparison table
  content = content.replace(
    /tree-sitter-grammars v[\d.]+/g,
    `tree-sitter-grammars ${version}`
  );
  
  // Update version in "Available Node Types" section
  content = content.replace(
    /### Available Node Types \(v[\d.]+\)/,
    `### Available Node Types (${version})`
  );
  
  fs.writeFileSync(notesPath, content);
  console.log(`  ✓ Updated GRAMMAR_NOTES.md with version ${version}`);
}

async function main() {
  const args = process.argv.slice(2);
  const versionArg = args[0] || 'latest';
  
  console.log('='.repeat(60));
  console.log('Fetching WASM files from tree-sitter-grammars/tree-sitter-markdown');
  console.log('='.repeat(60));
  console.log();
  
  try {
    // Get release info
    const release = versionArg === 'latest' 
      ? await getLatestRelease()
      : await getReleaseByTag(versionArg);
    
    console.log(`Found release: ${release.version}`);
    console.log();
    
    // Check for required WASM files
    const wasmDir = path.join(__dirname, '..', 'wasm');
    let totalSize = 0;
    
    for (const wasmFile of WASM_FILES) {
      const asset = release.assets.find(a => a.name === wasmFile);
      
      if (!asset) {
        console.error(`  ✗ ${wasmFile} not found in release assets`);
        continue;
      }
      
      const destPath = path.join(wasmDir, wasmFile);
      
      // Check if file already exists
      if (fs.existsSync(destPath)) {
        const existingSize = fs.statSync(destPath).size;
        if (existingSize === asset.size) {
          console.log(`  ⊙ ${wasmFile} already up-to-date (${(asset.size / 1024).toFixed(0)} KB)`);
          totalSize += existingSize;
          continue;
        }
      }
      
      const size = await downloadFile(asset.url, destPath);
      await verifyWasmFile(destPath);
      totalSize += size;
    }
    
    console.log();
    console.log('='.repeat(60));
    console.log(`Total WASM size: ${(totalSize / 1024).toFixed(0)} KB`);
    
    // Update GRAMMAR_NOTES.md
    console.log();
    await updateGrammarNotes(release.version);
    
    console.log();
    console.log('✓ Done! WASM files are ready.');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error();
    console.error('✗ Error:', error.message);
    console.error();
    process.exit(1);
  }
}

main();
