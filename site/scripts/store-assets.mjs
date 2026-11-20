// The Chrome Web Store listing's pictures (#28), in the product page's look: five 1280×800
// screenshots (a line over one of public/shots, or the popup) and the 440×280 small promo tile.
// Pictures are the page's own (fiction, no real creator; see capture-shots.mjs).
// Writes extension/release/store/. Needs extension/dist (npm run build there) for the popup.
//   node scripts/store-assets.mjs
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const at = (p) => fileURLToPath(new URL(p, import.meta.url));
const pub = pathToFileURL(at('../public/')).href;
const out = at('../../extension/release/store/');
const dist = realpathSync(at('../../extension/dist'));
mkdirSync(out, { recursive: true });

// The popup, dark, every Setting at its Calm Default (a fresh install).
const extId = [...createHash('sha256').update(dist).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`], viewport: { width: 400, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
const pop = await ctx.newPage();
await pop.goto(`chrome-extension://${extId}/popup.html`);
await pop.waitForTimeout(800);
const popupPng = await pop.locator('body').screenshot({ animations: 'disabled' });
await ctx.close();
const popupUrl = 'data:image/png;base64,' + popupPng.toString('base64');

const head = `<meta charset="utf-8"><style>
@font-face{font-family:'Instrument Serif';font-style:normal;src:url(${pub}fonts/InstrumentSerif-normal-400.woff2)}
@font-face{font-family:'Instrument Serif';font-style:italic;src:url(${pub}fonts/InstrumentSerif-italic-400.woff2)}
@font-face{font-family:'Inter';font-weight:400 700;src:url(${pub}fonts/Inter-normal-400-700.woff2)}
*{box-sizing:border-box;margin:0}
body{width:var(--w);height:var(--h);overflow:hidden;background:radial-gradient(60% 70% at 50% 0%,#12352A,#090F0D 70%);color:#EEF3F0;font-family:Inter,sans-serif}
h1{font:400 56px/1 'Instrument Serif',serif;letter-spacing:-.01em;text-align:center}h1 em{color:#7CF0C4}
.shot{position:absolute;left:50%;transform:translateX(-50%);border-radius:14px;overflow:hidden;border:1px solid rgb(255 255 255 / .12);box-shadow:0 30px 80px rgb(0 0 0 / .55),0 0 0 6px rgb(124 240 196 / .05)}
.shot img{display:block;width:100%}
</style>`;

const screens = [
  ['1-home', 'Home asks what <em>you came for.</em>', 'home-after'],
  ['2-watch', 'Just the video. <em>No next one.</em>', 'watch-after'],
  ['3-search', 'Search, <em>without the Shorts.</em>', 'search-after'],
  ['4-popup', 'Ten switches. <em>Four on from the start.</em>', null],
  ['5-before', 'Without D-Tox, <em>all of this.</em>', 'home-before'],
];
const b = await chromium.launch();
const page = await b.newPage({ deviceScaleFactor: 1 });
const render = async (name, w, h, body) => {
  const tmp = `${out}.${name}.html`;
  writeFileSync(tmp, `<!doctype html><html><head>${head}</head><body style="--w:${w}px;--h:${h}px">${body}</body></html>`);
  await page.setViewportSize({ width: w, height: h });
  await page.goto(pathToFileURL(tmp).href);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  await page.screenshot({ path: `${out}${name}.png` });
  rmSync(tmp);
};
for (const [name, line, shot] of screens) {
  const pic = shot
    ? `<div class="shot" style="top:150px;width:1040px"><img src="${pub}shots/${shot}-2160.webp"></div>`
    : `<div class="shot" style="top:140px;width:500px"><img src="${popupUrl}"></div>`;
  await render(name, 1280, 800, `<h1 style="padding-top:56px">${line}</h1>${pic}`);
}
// Small promo tile: the mark, the name, the promise.
await render('promo-440x280', 440, 280, `<div style="height:100%;display:grid;place-items:center;text-align:center;gap:0;padding:28px">
  <div><img src="${pub}logo/d-ivory.svg" style="width:64px;height:64px"><h1 style="font-size:52px;margin-top:10px">D-Tox</h1>
  <p style="margin-top:10px;font-size:16px;color:#A2B1AB">YouTube for what you <em style="font:italic 20px 'Instrument Serif',serif;color:#7CF0C4">came for.</em></p></div></div>`);
await b.close();
console.log('store pictures →', out);
