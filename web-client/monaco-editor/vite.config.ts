import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/editor',
  server: {
    port: 3000
  },
  optimizeDeps: {
    include: [
      'monaco-editor',
      'monaco-languageclient',
      'vscode-ws-jsonrpc'
    ]
  }
})
