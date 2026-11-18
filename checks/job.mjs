// What the Openship job `d-tox nightly` runs, inside mcr.microsoft.com/playwright:v1.63.0-noble.
// Openship fetches this one file from main (like mihrab smoke) and pipes it in; it then fetches
// the rest of the repo at the same branch, installs checks/ and runs `npm run nightly`. Its exit code is the job's.
// Plain JavaScript with no dependencies, because it runs before anything is installed.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// DTOX_REF tries a branch before it is merged; the scheduled job leaves it unset.
const ref = process.env.DTOX_REF || 'main';
const tarball = `https://codeload.github.com/saaquiblabs/d-tox/tar.gz/refs/heads/${ref}`;
const dir = mkdtempSync(join(tmpdir(), 'd-tox-'));

const run = (cmd, args, cwd = dir) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    console.error(`job: ${cmd} ${args.join(' ')} failed (${r.status ?? r.signal})`);
    process.exit(1);
  }
};

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(`job: Node ${process.versions.node} can't run TypeScript; checks/ needs 22.18 or later`);
  process.exit(1);
}

const res = await fetch(tarball, { signal: AbortSignal.timeout(60_000) });
if (!res.ok) {
  console.error(`job: could not fetch ${tarball}: ${res.status}`);
  process.exit(1);
}
writeFileSync(join(dir, 'main.tar.gz'), Buffer.from(await res.arrayBuffer()));
run('tar', ['-xzf', 'main.tar.gz', '--strip-components=1']);

const checks = join(dir, 'checks');
run('npm', ['ci', '--no-audit', '--no-fund', '--loglevel=error'], checks);
const r = spawnSync('node', ['nightly.ts'], { cwd: checks, stdio: 'inherit', env: process.env });
process.exit(r.status ?? 1);
