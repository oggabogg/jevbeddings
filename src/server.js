import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { Store } from './store.js';
import { JevClient } from './jev.js';
import { RetrievalService } from './service.js';
import { AppError, assert, knownKeys, object } from './validation.js';

const staticFiles = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
async function readBody(request) {
  assert((request.headers['content-type'] ?? '').split(';')[0] === 'application/json', 'Use Content-Type: application/json', 415);
  const chunks = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; assert(size <= 8 * 1024 * 1024, 'Request body exceeds 8 MiB', 413); chunks.push(chunk); }
  try { return object(JSON.parse(Buffer.concat(chunks).toString('utf8')), 'body'); }
  catch (error) { if (error instanceof AppError) throw error; throw new AppError('Invalid JSON'); }
}
export function createApp({ store, client, demo = false }) {
  const service = new RetrievalService(store, client);
  return createServer(async (req, res) => {
    const send = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const host = req.headers.host ?? '';
      assert(/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host), 'This MVP only accepts localhost hosts', 403);
      if (req.headers.origin) assert(req.headers.origin === `http://${host}`, 'Cross-origin requests are not allowed', 403);
      const path = new URL(req.url, `http://${host}`).pathname;
      if (req.method === 'GET' && staticFiles[path]) {
        const [name, mime] = staticFiles[path];
        const content = await readFile(new URL(`../public/${name}`, import.meta.url));
        res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` }); res.end(content); return;
      }
      if (req.method === 'GET' && path === '/health') return send(200, { status: 'ok', jev_configured: Boolean(client.apiKey), model: client.model, demo, ...store.stats() });
      if (req.method === 'GET' && path === '/features') return send(200, { ...store.schema(), history: store.schemaHistory() });
      if (req.method === 'GET' && path === '/documents') return send(200, { documents: store.documents().map(({ body, features, ...d }) => d) });
      const docMatch = /^\/documents\/([\w.-]+)(?:\/(features|index))?$/.exec(path);
      if (req.method === 'GET' && docMatch && docMatch[2] !== 'index') return send(200, store.document(docMatch[1]));
      if (req.method !== 'POST') return send(404, { error: 'Not found' });
      const body = await readBody(req);
      if (path === '/search') {
        knownKeys(body, ['query', 'requirements', 'limit', 'allow_partial'], 'search');
        if (demo && body.query !== undefined) throw new AppError('Offline demo uses explicit feature requirements. Start the live server with a JEV key for natural-language search.', 503, 'demo_mode');
        return send(200, await service.search(body));
      }
      if (demo) throw new AppError('The fixture demo is read-only. Use the live server to index documents or change the schema.', 403);
      if (path === '/documents') return send(201, store.createDocument(body));
      if (path === '/documents/bulk') {
        knownKeys(body, ['documents'], 'bulk');
        assert(Array.isArray(body.documents) && body.documents.length > 0 && body.documents.length <= 1000, 'Provide 1–1000 documents');
        return send(201, { documents: store.transaction(() => body.documents.map(d => store.createDocument(d))) });
      }
      if (docMatch?.[2] === 'index') { knownKeys(body, ['feature_ids', 'force'], 'index'); return send(200, await service.index(docMatch[1], body)); }
      if (path === '/index') { knownKeys(body, ['feature_ids'], 'backfill'); return send(200, await service.backfill(body.feature_ids)); }
      if (path === '/features') return send(201, store.addFeature(body));
      if (path === '/features/weights') { knownKeys(body, ['weights'], 'weight update'); object(body.weights, 'weights'); return send(200, store.updateWeights(body.weights)); }
      if (path === '/features/backfill') { knownKeys(body, ['feature_ids'], 'backfill'); return send(200, await service.backfill(body.feature_ids)); }
      return send(404, { error: 'Not found' });
    } catch (error) {
      if (!(error instanceof AppError)) console.error('Request failed:', error.name);
      send(error.status ?? 500, { error: error instanceof AppError ? error.message : 'Internal server error', code: error.code ?? 'internal_error' });
    }
  });
}

export function start({ dbPath = process.env.DB_PATH || './data/retrieval.sqlite', port = Number(process.env.PORT || 3210), demo = false } = {}) {
  const store = new Store(dbPath);
  const client = new JevClient({ apiKey: demo ? undefined : process.env.TYPESAFE_API_KEY || process.env.JEV_API_KEY, onCall: call => store.recordCall(call) });
  const server = createApp({ store, client, demo });
  server.listen(port, '127.0.0.1', () => console.log(`jevbeddings: http://127.0.0.1:${server.address().port} (${demo ? 'offline fixtures' : 'live JEV'})`));
  const shutdown = () => server.close(() => { store.close(); process.exit(0); });
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) start();
