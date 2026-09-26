import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const server = createServer((req, res) => {
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host ?? '')) { res.writeHead(403); res.end(); return; }
  const path = new URL(req.url, 'http://127.0.0.1').pathname;
  const artifacts = {
    '/REPORT.md': ['REPORT.md', 'text/plain'], '/results.json': ['results.json','application/json'],
    '/progress.json': ['progress.json','application/json'], '/explanations.json': ['explanations.json','application/json'],
    '/e1-summary.csv': ['e1-summary.csv','text/csv'], '/e3-queries.json': ['e3-queries.json','application/json'],
  };
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
  if (artifacts[path]) {
    const [file, mime] = artifacts[path], filePath = `study/results/${file}`;
    if (!existsSync(filePath)) { res.writeHead(404); res.end('Not yet generated'); return; }
    res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` }); res.end(readFileSync(filePath)); return;
  }
  if (path !== '/') { res.writeHead(404); res.end('Not found'); return; }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (existsSync('study/results/report.html')) { res.end(readFileSync('study/results/report.html')); return; }
  const p = existsSync('study/results/progress.json') ? JSON.parse(readFileSync('study/results/progress.json', 'utf8')) : { counts: {} };
  const completed = (p.counts.train ?? 0) + (p.counts.test ?? 0), percent = (completed / 13083 * 100).toFixed(1);
  res.end(`<!doctype html><html lang="nb"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="15"><title>jevbeddings · BANKING77 · Studie pågår</title><style>body{font:17px/1.7 system-ui;max-width:850px;margin:70px auto;padding:0 25px;background:#f6f8f3;color:#273f31}h1{font:52px/1.1 Georgia}progress{width:100%;height:25px;accent-color:#356a4c}.stats{display:flex;gap:30px;flex-wrap:wrap}.stats b{display:block;font-size:32px}small{color:#63796a}.panel{padding:25px;border:1px solid #d6e0d3;border-radius:8px;background:white}li{margin:10px 0}</style><small>jevbeddings / BANKING77</small><h1>Studien kjører.</h1><p>34 forståelige egenskaper. 77 nærliggende intents. Hele datasettet.</p><div class="panel"><div class="stats"><div><b>${completed.toLocaleString('nb-NO')}</b>av 13 083 tekster</div><div><b>${p.interpreted_queries ?? 0} / 100</b>sammensatte søk</div><div><b>${percent} %</b>tekster ferdig</div></div><progress value="${completed}" max="13083"></progress><p>Status: ${escape(p.state ?? 'venter')} · Oppdatert ${escape(p.updated_at ?? '')}</p>${p.error ? `<p>${escape(p.error)}</p>` : ''}</div><h2>Dette måler vi</h2><ol><li>Gjenfinning av riktig intent på 3 080 testsøk.</li><li>BM25 mot JEV + cosinus, dot product og vektet relevans.</li><li>100 bredere semantiske søk.</li><li>Positive krav, negative preferanser og harde filtre.</li><li>Hva som skjer når hver feature og featurefamilie fjernes.</li></ol><p>Rapporten vises her når beregningene er fullført. Ingen foreløpige kvalitetstall brukes til å endre skjemaet.</p></html>`);
});
server.listen(3212, '127.0.0.1', () => console.log('Study status/report: http://127.0.0.1:3212'));
