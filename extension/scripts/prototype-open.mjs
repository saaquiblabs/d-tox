// PROTOTYPE (#22), throwaway. Opens a visible Chromium with the prototype build loaded and three
// tabs: YouTube's home (the Intention Page), the popup in a tab, and the product page (served by
// `python3 -m http.server 4322` from the repo root). The D-Tox toolbar button opens the real popup.
// Branded Chrome no longer accepts --load-extension, hence Playwright's Chromium. The profile is
// kept in argv[2] (default ./proto-profile), so a sign-in survives a restart.
//   npm run build && node scripts/prototype-open.mjs [profileDir]
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dist = realpathSync(fileURLToPath(new URL('../dist', import.meta.url)));
const id = [...createHash('sha256').update(dist).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const ctx = await chromium.launchPersistentContext(process.argv[2] ?? 'proto-profile', {
  channel: 'chromium',
  headless: false,
  viewport: null,
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`, '--start-maximized'],
});
const [first] = ctx.pages();
const sw = await ctx.newPage();
await sw.goto(`chrome-extension://${id}/popup.html?tab=1`);
await sw.evaluate(() => chrome.storage.local.set({ protoIntention: 'D', protoPopup: 'D' }));
await sw.close();
await (first ?? (await ctx.newPage())).goto('https://www.youtube.com/');
await (await ctx.newPage()).goto(`chrome-extension://${id}/popup.html?tab=1`);
await (await ctx.newPage()).goto('http://127.0.0.1:4322/site/prototype-home/');
console.log('open; close the window to end');
await new Promise((r) => ctx.on('close', r));
