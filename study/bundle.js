import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, statSync } from 'node:fs';
if (!existsSync('study/results/audit.json')) throw new Error('Complete the result audit first.');
const inventory = spawnSync(process.execPath, ['study/evidence-manifest.js'], { encoding: 'utf8' });
if (inventory.status !== 0) throw new Error(inventory.stderr || 'Evidence inventory failed');
const temporary = 'data/banking77-reproduction.zip';
// Explicit public-data and source paths. The credential-containing project root is never archived.
const selected = ['src','test','fixtures','public','scripts','docs','study','data/banking77','package.json','README.md','.env.example','.gitignore','.gitattributes'];
const executable = process.platform === 'win32' ? 'tar.exe' : 'bsdtar';
const packed = spawnSync(executable, ['-a','-c','-f',temporary,'--exclude=.env','--exclude=banking77-reproduction.zip','--exclude=*-wal','--exclude=*-shm','--exclude=run.lock','--exclude=progress.tmp', ...selected], { encoding: 'utf8' });
if (packed.status !== 0) throw new Error(packed.stderr || packed.error?.message || 'Archive creation failed. Requires Windows tar or bsdtar.');
const listing = spawnSync(executable, ['-t','-f',temporary], { encoding: 'utf8' });
if (listing.status !== 0 || listing.stdout.split(/\r?\n/).some(path => path.split(/[\\/]/).includes('.env'))) throw new Error('Archive inspection failed');
copyFileSync(temporary, 'study/results/banking77-reproduction.zip');
console.log(JSON.stringify({ path: 'study/results/banking77-reproduction.zip', bytes: statSync(temporary).size,
  entries: listing.stdout.trim().split(/\r?\n/).length, credential_file_included: false }));
