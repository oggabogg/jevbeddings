// A present-day inventory, not a retrospective trusted timestamp.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const paths = [];
const ignored = path => /(?:^|\/)(?:banking77-reproduction\.zip|evidence-manifest\.json|progress\.tmp|run\.lock|\.env)$/.test(path) || /(?:-wal|-shm)$/.test(path);
function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (ignored(path)) continue;
    if (entry.isDirectory()) visit(path);
    else if (entry.isFile()) paths.push(path);
    else throw new Error(`Unsupported archive entry: ${path}`);
  }
}
for (const directory of ['src','test','fixtures','public','scripts','docs','study','data/banking77']) visit(directory);
paths.push('package.json','README.md','.env.example','.gitignore','.gitattributes');
const files = Object.fromEntries(paths.sort().map(path => {
  const bytes = readFileSync(path);
  return [path, { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }];
}));
writeFileSync('study/results/evidence-manifest.json', JSON.stringify({
  generated_at: new Date().toISOString(),
  statement: 'Local inventory generated after the study. Hashes detect later byte changes; they do not prove when or by whom files were created.',
  excludes: ['This manifest itself', 'ZIP archives', 'SQLite WAL/SHM sidecars', 'Transient lock/progress files', 'Credentials', 'Local replay copies'],
  files,
}, null, 2) + '\n');
console.log(`Evidence inventory: ${paths.length} files.`);
