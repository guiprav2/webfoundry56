#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_PORT = Number(process.env.WF_SERVE_PORT || 8846);
const DEFAULT_HOST = process.env.WF_SERVE_HOST || '127.0.0.1';
const DEFAULT_CERT = process.env.WF_SERVE_CERT || path.resolve(__dirname, 'certs', 'cert.pem');
const DEFAULT_KEY = process.env.WF_SERVE_KEY || path.resolve(__dirname, 'certs', 'key.pem');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function readOptional(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function createServer({ root, host, port, certPath, keyPath }) {
  let handler = (req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath.endsWith('/')) urlPath += 'index.html';
    let filePath = path.join(root, urlPath);

    let sendFile = fp => {
      fs.stat(fp, (err, stats) => {
        if (err || !stats.isFile()) return sendIndex();
        let ext = path.extname(fp).toLowerCase();
        let mime = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
        fs.createReadStream(fp).pipe(res);
      });
    };

    let sendIndex = () => {
      let indexPath = path.join(root, 'index.html');
      fs.stat(indexPath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        fs.createReadStream(indexPath).pipe(res);
      });
    };

    sendFile(filePath);
  };

  let cert = readOptional(certPath);
  let key = readOptional(keyPath);
  if (cert && key) {
    https.createServer({ cert, key }, handler).listen(port, host, () => {
      console.log(`Serving ${root} on https://${host}:${port}`);
    });
  } else {
    http.createServer(handler).listen(port, host, () => {
      console.log(`Serving ${root} on http://${host}:${port}`);
    });
  }
}

createServer({
  root: DEFAULT_ROOT,
  host: DEFAULT_HOST,
  port: DEFAULT_PORT,
  certPath: DEFAULT_CERT,
  keyPath: DEFAULT_KEY,
});
