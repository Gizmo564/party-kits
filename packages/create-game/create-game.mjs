#!/usr/bin/env node
// Make a new 0801564.xyz party game: a working starter (engine, Worker + Durable Object, React web app, tests) that
// installs the @gizmo564/* kit packages from npm instead of copying them in.
//
//   npx @gizmo564/create-game "Lucky Draw" [--dir <folder>] [--letters XYZ] [--force]
//   node create-game.mjs "Lucky Draw" --local <path to the party-kits repo>     (tests the unreleased packages: packs them and installs the tarballs)
//
// No dependencies: plain Node 18+.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, 'template');
const DEFAULT_LETTERS = 'XYZ';
const TEXT = /\.(ts|tsx|js|mjs|json|jsonc|html|css|md|example|txt)$|^_gitignore$|_headers$/;

const HELP = `create-game: make a new party game from the @gizmo564 kit packages

Usage:
  npx @gizmo564/create-game <name> [options]

  <name>               "Lucky Draw", lucky-draw, ... (becomes the id, the Worker name and the subdomain)
Options:
  --dir <folder>       where to create it (default ./<id>); must be empty or missing
  --letters <ABC>      first letters of this game's room codes (default ${DEFAULT_LETTERS}, a DEV PLACEHOLDER:
                       real letters must be claimed in the shared roster before deploy, see docs/NEW_GAME_CHECKLIST.md)
  --local <repo>       use the packages in a local party-kits checkout instead of npm (packs them into <dir>/.vendor)
  --force              allow a non-empty --dir (files are overwritten)
  --help               this text
`;
const die = (m) => { console.error(`create-game: ${m}`); process.exit(1); };

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h') || argv.length === 0) { console.log(HELP); process.exit(argv.length ? 0 : 1); }
const opt = { dir: '', letters: DEFAULT_LETTERS, local: '', force: false };
const rest = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--dir') opt.dir = argv[++i] ?? die('--dir needs a folder');
  else if (a === '--letters') opt.letters = (argv[++i] ?? die('--letters needs letters')).toUpperCase();
  else if (a === '--local') opt.local = resolve(argv[++i] ?? die('--local needs the party-kits folder'));
  else if (a === '--force') opt.force = true;
  else if (a.startsWith('--')) die(`unknown option ${a} (try --help)`);
  else rest.push(a);
}
const rawName = rest.join(' ').trim();
if (!rawName) die('give the game a name, e.g. create-game "Lucky Draw"');
const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
if (!/^[a-z][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) die(`"${rawName}" does not make a usable id (letters, digits and dashes, starting with a letter)`);
const title = rawName.includes(' ') || rawName !== rawName.toLowerCase() ? rawName.replace(/\s+/g, ' ') : slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
if (!/^[A-HJ-NP-Z]{1,8}$/.test(opt.letters)) die('--letters must be 1 to 8 of the 24 code letters (no I and no O)');
const dest = resolve(opt.dir || slug);
if (existsSync(dest) && readdirSync(dest).length && !opt.force) die(`${dest} is not empty (use --force to overwrite files)`);
if (!existsSync(TEMPLATE)) die(`template not found at ${TEMPLATE}`);

const subs = { __SLUG__: slug, __NAME__: title, __LETTERS__: opt.letters };
const fill = (t) => t.replace(/__SLUG__|__NAME__|__LETTERS__/g, (m) => subs[m]);
function* walk(dir) { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) yield* walk(p); else yield p; } }
function put(file, data) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, data); }

let count = 0;
for (const f of walk(TEMPLATE)) {
  let rel = relative(TEMPLATE, f);
  if (basename(rel) === '_gitignore') rel = join(dirname(rel), '.gitignore');
  const out = join(dest, rel);
  if (TEXT.test(basename(f))) put(out, fill(readFileSync(f, 'utf8'))); else { mkdirSync(dirname(out), { recursive: true }); cpSync(f, out); }
  count++;
}

let note = '';
if (opt.local) {
  // pack every package in the repo and point the game at the tarballs
  const pkgsDir = join(opt.local, 'packages');
  if (!existsSync(pkgsDir)) die(`${pkgsDir} not found`);
  const vendor = join(dest, '.vendor');
  mkdirSync(vendor, { recursive: true });
  const pjPath = join(dest, 'package.json');
  const pj = JSON.parse(readFileSync(pjPath, 'utf8'));
  const tar = {};
  for (const d of readdirSync(pkgsDir)) {
    if (d === 'create-game' || !existsSync(join(pkgsDir, d, 'package.json'))) continue;
    const meta = JSON.parse(readFileSync(join(pkgsDir, d, 'package.json'), 'utf8'));
    const r = spawnSync('npm', ['pack', '--pack-destination', vendor, '--silent'], { cwd: join(pkgsDir, d), encoding: 'utf8' });
    if (r.status !== 0) die(`npm pack ${meta.name} failed:\n${r.stderr}`);
    tar[meta.name] = `file:.vendor/${r.stdout.trim().split('\n').pop()}`;
  }
  for (const n of Object.keys(pj.dependencies ?? {})) if (tar[n]) pj.dependencies[n] = tar[n];
  pj.overrides = { ...(pj.overrides ?? {}), ...tar };
  writeFileSync(pjPath, JSON.stringify(pj, null, 2) + '\n');
  note = `\n  (--local: kit packages installed from tarballs in .vendor/)`;
}

console.log(`\nCreated "${title}" (${slug}) in ${dest}\n  ${count} files; kit packages: @gizmo564/* (see package.json)\n  room-code letters: ${opt.letters}  (dev placeholder: see packages/engine/src/roster.ts)${note}\n`);
console.log(`Next:\n  cd ${relative(process.cwd(), dest) || '.'}\n  npm install\n  npm test && npm run typecheck\n  npm run dev:server     # then open http://localhost:8787\n\nBefore deploying, work through docs/NEW_GAME_CHECKLIST.md.`);
