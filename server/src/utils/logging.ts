// Debug logging control
const DEBUG_ENABLED = process.env.LSP_TOY_DEBUG === 'true' || process.env.LSP_TOY_DEBUG === '1';

// Debug logging helper - use console.error so it goes to stderr and shows up in VS Code output
export function logDebug(message: string, ...args: unknown[]): void {
  if (DEBUG_ENABLED) {
    console.error(`[LSP-TOY SERVER] ${message}`, ...args);
  }
}

export function isDebugEnabled(): boolean {
  return DEBUG_ENABLED;
}

// Initialize debug logging
if (DEBUG_ENABLED) {
  logDebug('========================================');
  logDebug('Debug logging ENABLED');
  logDebug('Server module loading...');
} else {
  console.error('[LSP-TOY SERVER] Debug logging DISABLED (set LSP_TOY_DEBUG=true to enable)');
}
