// PROTOTYPE (#22), throwaway. Signed-out YouTube's home is empty, so the product page's Home
// before/after shots are taken from the page's own YouTube home (built from feed/, live titles and
// thumbnails): ?yt=before is the feed as it comes, ?yt=after is Intention Page B. Writes
// shots/home-{before,after}-{1440,2160}.webp and the hidden parts' positions into regions.json.
// Needs the page served at :4322 (repo root). Run from extension/: node scripts/prototype-home-shots.mjs
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const shots = fileURLToPath(new URL('../../site/prototype-home/shots/', import.meta.url));
const b = await chromium.launch({ channel: 'chromium' });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const regions = JSON.parse(readFileSync(shots + 'regions.json', 'utf8'));
for (const state of ['before', 'after']) {
  await p.goto(`http://127.0.0.1:4322/site/prototype-home/?yt=${state}`);
  await p.waitForSelector('.yt .card img', { state: 'attached' });
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('.yt img')].map((i) => (i.loading = 'eager', i.decode().catch(() => {})))); });
  await p.waitForTimeout(300);
  if (state === 'before') regions.home = await p.evaluate(() => {
    const o = document.querySelector('.yt').getBoundingClientRect();
    const pct = (el) => { const r = el.getBoundingClientRect(); return [(r.x - o.x) / 14.4, (r.y - o.y) / 9, r.width / 14.4, Math.min(r.height, o.bottom - r.y) / 9].map((n) => +n.toFixed(2)); };
    const main = document.querySelector('.yt .main');
    return { feed: pct(main), shortsLink: pct(document.querySelector('.ysd a.fade')), explore: pct(document.querySelector('.ysd div.fade')), recommendations: null, shorts: pct(document.querySelector('.yt .shelf')) };
  });
  const png = shots + `home-${state}.png`;
  await p.locator('.yt').screenshot({ path: png });
  execFileSync('cwebp', ['-quiet', '-q', '74', '-resize', '1440', '0', png, '-o', shots + `home-${state}-1440.webp`]);
  execFileSync('cwebp', ['-quiet', '-q', '70', png, '-o', shots + `home-${state}-2160.webp`]);
  rmSync(png);
}
writeFileSync(shots + 'regions.json', JSON.stringify(regions, null, 1));
await b.close();
console.log('home shots + regions →', shots);
