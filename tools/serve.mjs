// Servidor estático mínimo para probar la app en local: node tools/serve.mjs [puerto]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = normalize(join(dirname(fileURLToPath(import.meta.url)), '..'));
const port = +process.argv[2] || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(root, p));
  const rel = file.slice(root.length);
  if (!file.startsWith(root) || /^[\\/](tools|\.)/.test(rel)) { res.writeHead(404); return res.end(); }
  try {
    const b = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(b);
  } catch (e) { res.writeHead(404); res.end('no encontrado'); }
}).listen(port, '127.0.0.1', () => console.log('http://localhost:' + port));
