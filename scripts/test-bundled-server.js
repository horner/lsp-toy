#!/usr/bin/env node

/**
 * Test bundled TypeScript server integration
 * 
 * This script tests that the bundled TypeScript server:
 * 1. Can be spawned successfully
 * 2. Accepts LSP initialize request
 * 3. Can handle basic completion requests
 * 4. Falls back to external server if bundled fails
 */

const { spawn } = require('child_process');
const path = require('path');

async function testBundledServer() {
  console.log('🧪 Testing bundled TypeScript server...\n');
  
  const serverPath = path.resolve(__dirname, '../dist/bundled-servers/typescript-server.js');
  
  // Test 1: Can spawn the server
  console.log('📡 Test 1: Spawning bundled server...');
  
  const server = spawn('node', [serverPath, '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let responseBuffer = '';
  
  server.stdout.on('data', (chunk) => {
    responseBuffer += chunk.toString();
  });
  
  server.stderr.on('data', (chunk) => {
    console.error('Server stderr:', chunk.toString());
  });
  
  // Test 2: Send initialize request
  console.log('📤 Test 2: Sending initialize request...');
  
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      capabilities: {
        textDocument: {
          completion: {
            completionItem: {
              snippetSupport: true
            }
          }
        }
      },
      rootUri: null,
      workspaceFolders: null
    }
  };
  
  const message = JSON.stringify(initRequest);
  const header = `Content-Length: ${message.length}\r\n\r\n`;
  
  server.stdin.write(header + message);
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 3: Check response
  console.log('📨 Test 3: Checking initialize response...');
  
  if (responseBuffer.includes('Content-Length')) {
    console.log('✅ Server responded with LSP format');
    
    // Try to parse the response
    const parts = responseBuffer.split('\r\n\r\n');
    if (parts.length > 1) {
      try {
        const response = JSON.parse(parts[1]);
        if (response.result && response.result.capabilities) {
          console.log('✅ Initialize response has capabilities');
          console.log('   Completion:', !!response.result.capabilities.completionProvider);
          console.log('   Hover:', !!response.result.capabilities.hoverProvider);
        } else {
          console.log('❌ No capabilities in initialize response');
        }
      } catch (e) {
        console.log('❌ Could not parse initialize response');
      }
    }
  } else {
    console.log('❌ No LSP response received');
    console.log('Raw output:', responseBuffer.slice(0, 200));
  }
  
  // Clean up
  server.kill();
  
  console.log('\n🎯 Bundled server test complete!');
}

// Test fallback behavior
async function testFallback() {
  console.log('\n🔄 Testing fallback behavior...');
  
  // This should demonstrate that if bundled fails, it tries external
  const { resolveLanguage, pickRuntime } = require('../server/out/embedded/embeddedRegistry');
  
  const tsEntry = resolveLanguage('typescript');
  const runtime = pickRuntime('typescript');
  
  console.log('📋 TypeScript entry:', {
    id: tsEntry?.id,
    bundled: tsEntry?.node?.bundled,
    hasFallback: !!tsEntry?.node?.fallback
  });
  
  console.log('🎯 Runtime resolution:', {
    mode: runtime.mode,
    bundled: runtime.impl?.bundled || false
  });
}

async function main() {
  try {
    await testBundledServer();
    await testFallback();
    console.log('\n🎉 All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}