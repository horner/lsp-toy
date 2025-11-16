#!/usr/bin/env bash
set -e

echo "🚀 Building LSP-Toy Server..."
echo ""

# Build TypeScript server
echo "📦 Compiling TypeScript..."
npm run compile

# Build Monaco web client
echo "🌐 Building Monaco editor web client..."
cd web-client/monaco-editor
npm run build
cd ../..

echo ""
echo "✅ Build complete!"
echo ""
echo "🔌 Starting WebSocket server..."
echo "   - Info page: http://localhost:8080/"
echo "   - Web editor: http://localhost:8080/editor"
echo "   - WebSocket: ws://localhost:8080"
echo ""

# Start the server with debug logging
npm run start:ws-server
