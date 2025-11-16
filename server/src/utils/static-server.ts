import * as fs from 'fs';
import * as path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { logDebug } from './logging';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf'
};

/**
 * Serves static files from a directory with SPA fallback
 */
export function serveStaticFiles(
  req: IncomingMessage,
  res: ServerResponse,
  staticDir: string,
  fallbackFile: string = 'index.html'
): void {
  const url = req.url || '/';
  
  // Remove query string and decode URI
  const pathname = decodeURIComponent(url.split('?')[0]);
  
  // Determine file path
  let filePath = path.join(staticDir, pathname === '/' ? fallbackFile : pathname);
  
  // Security check - prevent directory traversal
  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(path.normalize(staticDir))) {
    logDebug(`[Static] Path traversal attempt blocked: ${pathname}`);
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }
  
  // Check if file exists
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // File not found - for SPA, serve index.html for non-file routes
      const ext = path.extname(pathname);
      if (!ext || ext === '/') {
        // Looks like a route, not a file - serve index.html
        filePath = path.join(staticDir, fallbackFile);
        logDebug(`[Static] SPA fallback: ${pathname} -> ${fallbackFile}`);
        serveFile(filePath, res);
      } else {
        // Looks like a file that doesn't exist
        logDebug(`[Static] File not found: ${pathname}`);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      }
      return;
    }
    
    // File exists - serve it
    logDebug(`[Static] Serving file: ${pathname}`);
    serveFile(filePath, res);
  });
}

function serveFile(filePath: string, res: ServerResponse): void {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      logDebug(`[Static] Error reading file: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      return;
    }
    
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Content-Length': data.length,
      'Cache-Control': 'public, max-age=0' // No caching for development
    });
    res.end(data);
  });
}
