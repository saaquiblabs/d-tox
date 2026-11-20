// The Web Store upload: a clean build of dist/, zipped as release/d-tox-<version>.zip.
// Fails if the site's /changelog has no entry for this version (add it in the same PR as the bump).
//   npm run zip
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const changelog = readFileSync(join(root, '../site/src/pages/changelog.astro'), 'utf8');
if (!changelog.includes(`version: "${version}"`)) throw new Error(`site/src/pages/changelog.astro has no entry for ${version}`);

execFileSync('node', ['scripts/build.mjs'], { cwd: root, stdio: 'inherit' });

const dir = join(root, 'release'), zip = join(dir, `d-tox-${version}.zip`);
mkdirSync(dir, { recursive: true });
rmSync(zip, { force: true });
// -X: no extra file attributes, so the same build gives the same bytes on any Mac.
execFileSync('zip', ['-r', '-X', '-q', zip, '.', '-x', '.DS_Store', '*/.DS_Store'], { cwd: join(root, 'dist') });

const bytes = readFileSync(zip);
console.log(`${zip}\n${(bytes.length / 1024).toFixed(1)} KB · sha256 ${createHash('sha256').update(bytes).digest('hex')}`);
console.log(execFileSync('unzip', ['-l', zip], { encoding: 'utf8' }));
