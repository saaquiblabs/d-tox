// Builds the extension into dist/ with esbuild, then fails if it is over budget.
// WXT was measured first and added ~4.4 KB (ADR 0001), so this is the whole build.
//   node scripts/build.mjs           one build
//   node scripts/build.mjs --watch   rebuild on change (reload the extension in chrome://extensions)
import * as esbuild from 'esbuild';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist');
const BUDGET = 40 * 1024; // bytes, excluding icons (ADR 0001)

const settings = JSON.parse(await readFile(join(root, '../settings.json'), 'utf8'));
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

// The content script carries only each Setting's id and Calm Default value, not the whole list.
const calmDefault = Object.fromEntries(settings.map((s) => [s.id, s.calmDefault]));

const manifest = {
  manifest_version: 3,
  name: 'D-Tox for YouTube',
  version: pkg.version,
  description: 'YouTube for what you came for. Hides the parts of YouTube that pull you elsewhere.',
  icons: { 16: 'icon-16.png', 48: 'icon-48.png', 128: 'icon-128.png' },
  permissions: ['storage'],
  // PROTOTYPE (#22): the Intention Page shows the icon.
  web_accessible_resources: [{ resources: ['icon-48.png'], matches: ['https://www.youtube.com/*'] }],
  host_permissions: ['https://www.youtube.com/*'],
  action: { default_title: 'D-Tox', default_popup: 'popup.html' },
  content_scripts: [
    {
      matches: ['https://www.youtube.com/*'],
      run_at: 'document_start',
      css: ['hide.css', 'hide-rys.css'],
      js: ['content.js'],
    },
    // PROTOTYPE (#22): the Intention Page variants.
    { matches: ['https://www.youtube.com/*'], run_at: 'document_start', css: ['intention-proto-style.css'], js: ['intention-proto.js'] },
  ],
};

const options = {
  entryPoints: {
    content: join(root, 'src/content.ts'),
    popup: join(root, 'src/popup/popup.ts'),
    hide: join(root, 'src/hide.css'),
    'hide-rys': join(root, 'src/hide-rys.css'), // MPL-2.0, kept as its own file
    'popup-style': join(root, 'src/popup/popup.css'),
    // PROTOTYPE (#22)
    'popup-proto': join(root, 'src/popup/popup-proto.ts'),
    'popup-proto-style': join(root, 'src/popup/popup-proto.css'),
    'intention-proto': join(root, 'src/intention-proto.ts'),
    'intention-proto-style': join(root, 'src/intention-proto.css'),
  },
  outdir: out,
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'chrome120',
  legalComments: 'inline', // keeps hide-rys.css's MPL-2.0 notice (/*! */) in dist
  define: { __DTOX_CALM_DEFAULT__: JSON.stringify(calmDefault) },
  logLevel: 'warning',
};

async function copyStatic() {
  await mkdir(out, { recursive: true });
  await writeFile(join(out, 'manifest.json'), JSON.stringify(manifest));
  await cp(join(root, 'src/popup/popup.html'), join(out, 'popup.html'));
  await cp(join(root, 'public'), out, { recursive: true });
}

async function checkSize() {
  let total = 0;
  for (const name of await readdir(out, { recursive: true })) {
    const file = await stat(join(out, name));
    if (file.isFile() && !name.endsWith('.png')) total += file.size;
  }
  const line = `extension size: ${(total / 1024).toFixed(2)} KB of ${BUDGET / 1024} KB (icons excluded)`;
  if (total > BUDGET) throw new Error(line + ' — over budget');
  console.log(line);
}

await rm(out, { recursive: true, force: true });
if (process.argv.includes('--watch')) {
  await copyStatic();
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching src/ (popup.html, manifest and icons are copied once)');
} else {
  await esbuild.build(options);
  await copyStatic();
  await checkSize();
}
