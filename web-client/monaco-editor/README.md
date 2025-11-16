# LSP Toy Monaco Editor Client

A modern web-based Monaco Editor client that connects to the LSP Toy language server via WebSocket.

## Features

- 🎨 Monaco Editor with full LSP support
- 🔌 WebSocket connection to LSP server
- 🌐 Served directly from the LSP server at `/editor`
- ⚡ Built with Vite for fast development
- ⚛️ React 18 with TypeScript
- 🎭 Tailwind CSS for styling
- 🔄 Real-time connection status indicator

## Access

The editor is automatically served by the LSP Toy WebSocket server:

```
http://localhost:8080/editor
```

When the LSP server is running, simply navigate to the `/editor` route in your browser. The server hosts both the WebSocket endpoint and the static files for this web client.

## Getting Started

### Prerequisites

Make sure the LSP Toy WebSocket server is running:

```bash
# From the project root
npm run compile && LSP_TOY_DEBUG=true npm run start:ws-server
```

The server will listen on port 8080 (or the port specified in `LSP_PORT` environment variable) and serve:
- WebSocket endpoint: `ws://localhost:8080`
- Info page: `http://localhost:8080/`
- Monaco editor: `http://localhost:8080/editor`

### Development (Optional)

For development with hot module reloading, you can run the Vite dev server:

```bash
cd web-client/monaco-editor
npm install
npm run dev
```

The standalone development server will be available at `http://localhost:3000`

### Build

Build the production bundle (automatically served by the LSP server):

```bash
npm run build
```

The built files are placed in `dist/` and served from the LSP server's `/editor` route.

## Project Structure

```
web-client/monaco-editor/
├── src/
│   ├── components/
│   │   └── MonacoEditorLSP.tsx  # Main editor component with LSP integration
│   ├── App.tsx                   # Root app component
│   ├── main.tsx                  # Application entry point
│   └── index.css                 # Global styles with Tailwind
├── index.html                    # HTML template
├── vite.config.ts                # Vite configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
└── package.json                  # Dependencies and scripts
```

## Usage

### Production (Recommended)

1. Start the LSP Toy WebSocket server:
   ```bash
   npm run compile && LSP_TOY_DEBUG=true npm run start:ws-server
   ```
2. Open `http://localhost:8080/editor` in your browser
3. The editor will automatically connect to the LSP server
4. Start typing to see LSP features like autocomplete, diagnostics, and more!

### Development Mode

1. Start the LSP Toy WebSocket server (port 8080)
2. Run the development server: `npm run dev`
3. Open `http://localhost:3000` in your browser
4. The editor will connect to the LSP server on port 8080

## Technologies

- **Vite**: Fast build tool and dev server
- **React 18**: UI framework
- **TypeScript**: Type-safe development
- **Monaco Editor**: VS Code's editor component
- **monaco-languageclient**: LSP client for Monaco
- **Tailwind CSS**: Utility-first CSS framework
- **WebSocket**: Real-time communication with LSP server
