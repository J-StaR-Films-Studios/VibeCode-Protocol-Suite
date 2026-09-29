import { createServer } from 'node:http';
import { createReadStream, realpathSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

const [directory, portArgument = '30123'] = process.argv.slice(2);
const port = Number(portArgument);
if (!directory || !Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Usage: node serve.mjs <pages-directory> [localhost-port]');
  process.exit(1);
}
const root = realpathSync(resolve(directory));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  const requested = resolve(root, `.${pathname}`);
  try {
    if (!requested.startsWith(root + sep) || !statSync(requested).isFile()) throw new Error('Not found');
    const file = realpathSync(requested);
    if (!file.startsWith(root + sep)) throw new Error('Not found');
    res.writeHead(200, {
      'Content-Type': types[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1');
