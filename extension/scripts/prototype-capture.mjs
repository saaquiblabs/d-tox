// PROTOTYPE (#22), throwaway. Screenshots of live YouTube, signed out, with and without the
// extension: before/after images for the product-page prototypes (site/prototype-home/shots/), and
// review shots of every popup and Intention Page variant (argv[2], default ./proto-review).
// Video is blocked (googlevideo.com), so nothing plays. Run from extension/ after npm run build:
//   node scripts/prototype-capture.mjs [reviewDir]
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dist = realpathSync(fileURLToPath(new URL('../dist', import.meta.url)));
const shots = fileURLToPath(new URL('../../site/prototype-home/shots/', import.meta.url));
const review = (process.argv[2] ?? 'proto-review') + '/';
mkdirSync(shots, { recursive: true });
mkdirSync(review, { recursive: true });
const id = [...createHash('sha256').update(dist).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

const pages = [
  { key: 'home', url: 'https://www.youtube.com/' },
  { key: 'search', url: 'https://www.youtube.com/results?search_query=' + (process.env.Q ?? 'python+tutorial') },
  { key: 'watch', url: 'https://www.youtube.com/watch?v=rfscVS0vtbw' },
];

async function open(withExtension) {
  const args = withExtension ? [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] : ['--disable-extensions'];
  const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', args, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: 'en-US' });
  // YouTube's dark theme (the product page is dark): PREF f6=400.
  await ctx.addCookies([{ name: 'PREF', value: 'f6=400&hl=en', domain: '.youtube.com', path: '/' }]);
  await ctx.route(/googlevideo\.com|\/videoplayback/, (r) => r.abort());
  return ctx;
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3500);
  // The consent wall some regions show.
  const reject = page.getByRole('button', { name: /reject all/i });
  if (await reject.count()) { await reject.first().click(); await page.waitForTimeout(2500); }
  await page.evaluate(() => document.querySelector('video')?.pause());
}

async function product(withExtension) {
  const ctx = await open(withExtension);
  if (withExtension) {
    const pop = await ctx.newPage();
    await pop.goto(`chrome-extension://${id}/popup.html`);
    await pop.evaluate(() => Promise.all([chrome.storage.sync.set({ 'search-clean-up': true }), chrome.storage.local.set({ protoIntention: 'D' })]));
    await pop.close();
  }
  for (const p of pages) {
    const page = await ctx.newPage();
    await page.goto(p.url);
    await settle(page);
    await page.addStyleTag({ content: '#dtox-proto{display:none!important}' });
    // Video is blocked, so the player shows a pre-roll ad's poster; show the video's own thumbnail.
    await page.evaluate(async () => {
      const v = new URLSearchParams(location.search).get('v'), p = document.querySelector('#movie_player');
      if (!v || !p) return;
      const i = Object.assign(document.createElement('img'), { src: `https://i.ytimg.com/vi/${v}/maxresdefault.jpg` });
      i.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:60';
      p.append(i); await i.decode().catch(() => {});
    });
    await page.screenshot({ path: `${shots}${p.key}-${withExtension ? 'after' : 'before'}.jpg`, type: 'jpeg', quality: 80 });
    await page.close();
  }
  await ctx.close();
}

async function variants() {
  const ctx = await open(true);
  const pop = await ctx.newPage();
  await pop.setViewportSize({ width: 360, height: 760 });
  for (const v of ['A', 'B', 'C']) {
    for (const theme of ['light', 'dark']) {
      await pop.goto(`chrome-extension://${id}/popup.html?variant=${v}&theme=${theme}`);
      await pop.waitForTimeout(300);
      await pop.screenshot({ path: `${review}popup-${v}-${theme}.png`, fullPage: true });
    }
  }
  const yt = await ctx.newPage();
  for (const v of ['A', 'B', 'C']) {
    await pop.evaluate((v) => chrome.storage.local.set({ protoIntention: v }), v);
    await yt.goto('https://www.youtube.com/');
    await settle(yt);
    await yt.screenshot({ path: `${review}intention-${v}.png` });
  }
  await ctx.close();
}

const only = process.argv[3];
if (!only || only === 'product') { await product(false); await product(true); }
if (!only || only === 'variants') await variants();
console.log('product shots:', shots, '\nreview shots:', review);
