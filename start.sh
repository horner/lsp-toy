#!/usr/bin/env bash
set -e

echo "🚀 Building LSP-Toy Server..."
echo ""

# Install dependencies for main project
echo "📦 Installing main project dependencies..."
npm install

# Build TypeScript server
echo "📦 Compiling TypeScript..."
npm run compile

# Install dependencies and build Monaco web client
echo "🌐 Installing Monaco editor dependencies..."
cd web-client/monaco-editor
npm install
echo "🌐 Building Monaco editor web client..."
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
