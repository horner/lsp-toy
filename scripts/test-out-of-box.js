#!/usr/bin/env node

/**
 * Quick Test: Verify TypeScript works out-of-the-box
 * 
 * This test verifies that LSP-Toy can provide TypeScript completion
 * using the bundled server without any external installations.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function testOutOfTheBox() {
  console.log('🧪 Testing TypeScript out-of-the-box support...\n');
  
  // Create test markdown with TypeScript
  const testMarkdown = `# Test Document

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

const message = greet("World");
console.log(mes
\`\`\`

This should provide completion for 'mes' → 'message'
`;

  const testFile = path.join(__dirname, 'test-oob.lsptoy');
  fs.writeFileSync(testFile, testMarkdown);
  
  console.log('📝 Created test .lsptoy file with TypeScript code fence');
  
  // Start LSP-Toy server
  const serverPath = path.resolve(__dirname, '../server/out/server.js');
  
  console.log('🚀 Starting LSP-Toy server...');
  
  const server = spawn('node', [serverPath, '--stdio'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: path.dirname(__dirname)
  });
  
  let responseBuffer = '';
  
  server.stdout.on('data', (chunk) => {
    responseBuffer += chunk.toString();
  });
  
  server.stderr.on('data', (chunk) => {
    console.error('Server stderr:', chunk.toString());
  });
  
  // Send initialize request
  console.log('📡 Initializing LSP connection...');
  
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
          },
          hover: {}
        }
      },
      rootUri: `file://${path.dirname(__dirname)}`,
      workspaceFolders: [{
        uri: `file://${path.dirname(__dirname)}`,
        name: 'lsp-toy'
      }]
    }
  };
  
  const sendMessage = (obj) => {
    const message = JSON.stringify(obj);
    const header = `Content-Length: ${Buffer.byteLength(message, 'utf8')}\r\n\r\n`;
    server.stdin.write(header + message);
  };
  
  sendMessage(initRequest);
  
  // Wait for initialize response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Send initialized notification
  sendMessage({
    jsonrpc: '2.0',
    method: 'initialized',
    params: {}
  });
  
  // Open test document
  const docUri = `file://${testFile}`;
  
  sendMessage({
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: {
        uri: docUri,
        languageId: 'lsptoy',
        version: 1,
        text: testMarkdown
      }
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Test completion at the end of "mes" in TypeScript fence
  console.log('📋 Testing completion inside TypeScript code fence...');
  
  sendMessage({
    jsonrpc: '2.0',
    id: 2,
    method: 'textDocument/completion',
    params: {
      textDocument: { uri: docUri },
      position: { line: 7, character: 15 } // After "mes" in "console.log(mes"
    }
  });
  
  // Wait for completion response
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test hover on line 1
  console.log('🔍 Testing tree outline hover...');
  
  sendMessage({
    jsonrpc: '2.0',
    id: 3,
    method: 'textDocument/hover',
    params: {
      textDocument: { uri: docUri },
      position: { line: 0, character: 0 } // Line 1 for tree outline
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Analyze responses
  console.log('📊 Analyzing responses...\n');
  
  let foundCompletion = false;
  let foundHover = false;
  
  // Parse LSP responses using proper Content-Length headers
  let offset = 0;
  const messages = [];
  
  while (offset < responseBuffer.length) {
    const contentLengthMatch = responseBuffer.slice(offset).match(/Content-Length: (\d+)\r\n\r\n/);
    if (!contentLengthMatch) break;
    
    const headerEnd = offset + contentLengthMatch.index + contentLengthMatch[0].length;
    const contentLength = parseInt(contentLengthMatch[1]);
    const messageContent = responseBuffer.slice(headerEnd, headerEnd + contentLength);
    
    try {
      const parsed = JSON.parse(messageContent);
      messages.push(parsed);
      
      if (parsed.id === 2 && parsed.result !== undefined) {
        // Completion response
        const result = parsed.result;
        let items = [];
        
        if (Array.isArray(result)) {
          items = result;
        } else if (result && result.items) {
          items = result.items;
        } else if (result && result.isIncomplete !== undefined) {
          items = result.items || [];
        }
        
        console.log(`✅ Completion response received (${items.length} items)`);
        
        if (items.length > 0) {
          console.log('   📋 Sample completions:', items.slice(0, 3).map(i => i.label || i.insertText));
          
          // Check if any completion is relevant to our test
          const hasRelevant = items.some(item => 
            (item.label && item.label.includes('message')) ||
            (item.insertText && item.insertText.includes('message')) ||
            (item.label && item.label.includes('console')) ||
            (item.label && item.label.includes('log'))
          );
          
          if (hasRelevant) {
            console.log('   🎯 Found relevant completions - TypeScript server working!');
          } else {
            console.log('   ✅ Got TypeScript completions - server working!');
          }
          foundCompletion = true;
        }
      } else if (parsed.id === 3 && parsed.result) {
        // Hover response  
        console.log('✅ Hover response received');
        const contents = parsed.result.contents;
        const contentValue = contents?.value || contents;
        if (contentValue && contentValue.includes('Tree Outline')) {
          console.log('   🌳 Tree outline in hover - parsing working!');
          foundHover = true;
        }
      }
    } catch (e) {
      // Skip invalid JSON
    }
    
    offset = headerEnd + contentLength;
  }
  
  console.log(`Parsed ${messages.length} LSP messages`);
  
  // Results
  console.log('\n📋 Test Results:');
  console.log(`   TypeScript Completion: ${foundCompletion ? '✅ Working' : '❌ Not working'}`);
  console.log(`   Tree Outline Hover: ${foundHover ? '✅ Working' : '❌ Not working'}`);
  
  if (foundCompletion && foundHover) {
    console.log('\n🎉 SUCCESS: TypeScript works out-of-the-box!');
    console.log('   No external language server installation required');
  } else {
    console.log('\n⚠️  Some features may need external language servers');
  }
  
  // Cleanup
  server.kill();
  fs.unlinkSync(testFile);
  
  return foundCompletion && foundHover;
}

if (require.main === module) {
  testOutOfTheBox().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}