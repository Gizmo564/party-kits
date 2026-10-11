#!/usr/bin/env node
// The proof that the packages work: typecheck and test every package, check what each tarball contains, then make a game with
// create-game --local (it installs the packed tarballs, like a real install), and typecheck, test and build THAT game.
//
//   node scripts/verify.mjs            packages + a generated game (typecheck, tests, build)
//   node scripts/verify.mjs --e2e      ... then `wrangler dev` and the end-to-end WebSocket check
//   node scripts/verify.mjs --tv       ... then the real-browser TV-screen check (needs a Chromium; set CHROMIUM=/path if Playwright has none)
//   node scripts/verify.mjs --keep     leave the generated game in place (its path is printed)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const steps = [];
const report = () => { console.log('\n---- verify summary'); for (const [l, ok] of steps) console.log(`${ok ? 'ok  ' : 'FAIL'} ${l}`); };
function run(label, cmd, argv, cwd) {
  process.stdout.write(`\n== ${label}\n`);
  const r = spawnSync(cmd, argv, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  steps.push([label, r.status === 0]);
  if (r.status !== 0) { report(); process.exit(1); }
}

if (!existsSync(join(ROOT, 'node_modules'))) run('install repo dependencies', 'npm', ['install', '--no-audit', '--no-fund'], ROOT);
run('packages: typecheck', 'npx', ['tsc', '-p', '.'], ROOT);
run('packages: unit tests', 'npx', ['vitest', 'run'], ROOT);

// what ships: no test files, every export target exists
process.stdout.write('\n== tarball contents\n');
let bad = [];
for (const d of readdirSync(join(ROOT, 'packages')).sort()) {
  const dir = join(ROOT, 'packages', d);
  if (!existsSync(join(dir, 'package.json'))) continue;
  const r = spawnSync('npm', ['pack', '--dry-run', '--json'], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) { bad.push(`${d}: npm pack failed`); continue; }
  const files = JSON.parse(r.stdout)[0].files.map((f) => f.path);
  for (const f of files.filter((x) => !x.startsWith('template/'))) if (/\.test\.(ts|tsx)$/.test(f) || /^test\//.test(f) || (/(^|\/)testing\//.test(f) && f !== 'server/testing/toy-logic.ts')) bad.push(`${d}: ships ${f}`);
  const pj = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  for (const [k, v] of Object.entries(pj.exports ?? {})) if (typeof v === 'string' && !files.includes(v.replace(/^\.\//, ''))) bad.push(`${d}: export ${k} -> ${v} is not in the tarball`);
}
steps.push(['tarballs: no tests shipped, every export present', bad.length === 0]);
if (bad.length) { console.log(bad.join('\n')); report(); process.exit(1); }

const tmp = mkdtempSync(join(tmpdir(), 'party-kits-verify-'));
const game = join(tmp, 'verify-game');
run('create-game --local (packs every package)', 'node', [join(ROOT, 'packages/create-game/create-game.mjs'), 'Verify Game', '--dir', game, '--local', ROOT], ROOT);
run('generated game: npm install (from tarballs)', 'npm', ['install', '--no-audit', '--no-fund'], game);
run('generated game: typecheck', 'npm', ['run', 'typecheck'], game);
run('generated game: tests', 'npm', ['test'], game);
run('generated game: vite build', 'npm', ['run', 'build'], game);

async function withServer(fn) {
  const server = join(game, 'packages', 'server');
  spawnSync('node', ['-e', "require('fs').copyFileSync('.dev.vars.example','.dev.vars')"], { cwd: server });
  const wr = spawn('npx', ['wrangler', 'dev', '--port', '8799', '--local', '--var', 'STATS_URL:'], { cwd: server, stdio: 'ignore' });
  let up = false;
  for (let i = 0; i < 60 && !up; i++) { await new Promise((r) => setTimeout(r, 1000)); try { up = (await fetch('http://localhost:8799/api/nap')).ok; } catch { /* not up yet */ } }
  if (!up) { wr.kill(); steps.push(['wrangler dev started', false]); report(); process.exit(1); }
  try { await fn(); } finally { wr.kill(); }
}
if (args.has('--e2e') || args.has('--tv')) {
  await withServer(async () => {
    if (args.has('--e2e')) {
      const r = spawnSync('node', ['scripts/e2e.mjs', 'http://localhost:8799'], { cwd: game, stdio: 'inherit' });
      steps.push(['e2e: real Worker + Durable Objects over WebSockets', r.status === 0]);
      if (r.status !== 0) { report(); process.exit(1); }
    }
    if (args.has('--tv')) {
      spawnSync('npm', ['i', '-D', 'playwright-core', '--no-audit', '--no-fund'], { cwd: game, stdio: 'ignore' });
      const r = spawnSync('node', ['scripts/tv-check.mjs', 'http://localhost:8799'], { cwd: game, stdio: 'inherit' });
      steps.push(['tv-check: TV screens fit in a real browser', r.status === 0]);
      if (r.status !== 0) { report(); process.exit(1); }
    }
  });
}
report();
if (args.has('--keep')) console.log(`\nkept: ${game}`); else rmSync(tmp, { recursive: true, force: true });
