import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const prefix = '/indiana-debt-forecaster/';
const files = new Set([
  'index.html', 'overview.html', 'app.js', 'overview.js', 'styles.css',
  'site-data.json', 'assets/core-logo-registered.png', 'assets/core-symbol.png',
]);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === prefix.slice(0, -1)) {
      response.writeHead(308, { Location: prefix + url.search }).end();
      return;
    }
    const pathname = decodeURIComponent(url.pathname);
    const file = (pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.slice(1)) || 'index.html';
    if (!files.has(file)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('File not found.');
      return;
    }
    const body = await readFile(resolve(root, file));
    response.writeHead(200, {
      'Content-Type': types[extname(file)], 'Content-Length': body.length,
      'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 500).end('Could not load this file.');
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => {
  console.log(`Indiana dashboard: http://127.0.0.1:${server.address().port}/`);
  console.log(`GitHub-style preview: http://127.0.0.1:${server.address().port}${prefix}`);
  console.log('Press Ctrl+C to stop.');
});
