#!/usr/bin/env node
// Publish every package whose current version is not on npm yet (independent versions: bump a package's "version" in its
// package.json in the same pull request as the fix). Run by .github/workflows/publish.yml after merge to main.
//   node scripts/publish-changed.mjs            publish for real (needs NODE_AUTH_TOKEN)
//   node scripts/publish-changed.mjs --dry      only list what would be published
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dry = process.argv.includes('--dry');
const dir = new URL('../packages/', import.meta.url).pathname;
let failed = 0, todo = 0;
for (const d of readdirSync(dir).sort()) {
  const p = join(dir, d, 'package.json');
  if (!existsSync(p)) continue;
  const pj = JSON.parse(readFileSync(p, 'utf8'));
  if (pj.private) continue;
  const view = spawnSync('npm', ['view', `${pj.name}@${pj.version}`, 'version'], { encoding: 'utf8' });
  if (view.status === 0 && view.stdout.trim() === pj.version) { console.log(`skip     ${pj.name}@${pj.version} (already on npm)`); continue; }
  if (!/E404|404/.test(view.stderr ?? '') && view.status !== 0 && view.stderr) console.log(`note     ${pj.name}: npm view said: ${view.stderr.split('\n')[0]}`);
  todo++;
  if (dry) { console.log(`would publish ${pj.name}@${pj.version}`); continue; }
  const r = spawnSync('npm', ['publish', '--access', 'public', '--provenance'], { cwd: join(dir, d), stdio: 'inherit' });
  if (r.status !== 0) { failed++; console.log(`FAILED   ${pj.name}@${pj.version}`); } else console.log(`published ${pj.name}@${pj.version}`);
}
console.log(dry ? `\n${todo} package(s) would be published` : `\n${todo - failed} published, ${failed} failed`);
process.exit(failed ? 1 : 0);
