# HTTP Information Page

## Overview

When the LSP-Toy language server runs in WebSocket mode (for browser-based VS Code), accessing the WebSocket port via HTTP displays a helpful information page instead of returning an error.

## Purpose

- **User-friendly**: Provides clear guidance when users accidentally access the WebSocket endpoint via HTTP
- **Debugging**: Confirms the server is running and shows the active port
- **Documentation**: Links to the GitHub repository for setup instructions
- **Informational**: Explains the difference between HTTP and WebSocket access

## Implementation

The server detects HTTP requests by creating an HTTP server that handles both:
1. **HTTP requests**: Serves an HTML information page
2. **WebSocket upgrades**: Handles LSP protocol communication

### Technical Details

**File**: `server/src/server.ts`

- Uses Node.js `http` module to create an HTTP server
- WebSocket server is attached to the HTTP server using the `server` option
- HTTP requests receive a styled HTML page with setup information
- WebSocket upgrade requests are handled normally for LSP communication

## Usage

### Starting the Server

```bash
# Start with a specific port
LSP_PORT=8080 node server/out/server.js

# Or use command-line argument
node server/out/server.js --port 8080
```

### Accessing the Information Page

Open a browser and navigate to:
```
http://localhost:8080
```

You'll see a page with:
- Server status (running on specified port)
- About section explaining the language server
- Setup instructions for VS Code
- Link to GitHub repository: https://github.com/horner/lsp-toy
- Helpful note explaining HTTP vs WebSocket access

### Testing

Run the automated test:
```bash
node scripts/test-http-page.js
```

This test:
1. Starts the language server on port 6009
2. Makes an HTTP GET request
3. Verifies the response contains:
   - Correct title
   - GitHub repository link
   - Port number
4. Automatically shuts down the server

## HTML Page Contents

The information page includes:

### Header
- 🔌 LSP-Toy Language Server title
- Server status box showing the active port

### About Section
- Brief description of the Language Server Protocol implementation
- Explanation of WebSocket communication

### Setup Instructions
1. Install the LSP-Toy extension in VS Code
2. Extension automatically connects to the WebSocket server
3. Open `.lsptoy` files to activate language features

### Documentation Link
Direct link to the GitHub repository for more information

### Footer Note
Explains why the page is shown (HTTP access instead of WebSocket)

## Benefits

1. **Better UX**: Users aren't confused by connection errors
2. **Self-documenting**: The page explains how to use the server
3. **Easy debugging**: Quickly verify the server is running
4. **Professional**: Polished experience for users exploring the project

## Related Files

- Implementation: `server/src/server.ts`
- Documentation: `README.md`, `scripts/README.md`
