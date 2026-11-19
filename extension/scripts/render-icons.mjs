// Renders the extension's icons (extension/public/icon-{16,48,128}.png) from the folded-D mark
// (site/public/logo, #22), and the site's social card (site/public/og.jpg, 1200×630; also the repo's social preview). The mark sits
// on the product page's dark tile, so it reads on Chrome's light and dark toolbars alike.
// Each icon also gets a paused twin (icon-off-*.png), a flat grey mark, which background.ts shows
// in the toolbar while D-Tox is off.
// extension/public is the single source: the site copies its favicon from there (site/scripts/copy-icons.mjs).
//   node scripts/render-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const at = (p) => fileURLToPath(new URL(p, import.meta.url));
const svg = (f) => 'data:image/svg+xml;base64,' + readFileSync(at('../../site/public/logo/' + f)).toString('base64');
const font = (f) => 'data:font/woff2;base64,' + readFileSync(at('../../site/public/fonts/' + f)).toString('base64');
const browser = await chromium.launch({ channel: 'chromium' });

// size, tile inset, corner radius, mark size (fractions of the icon), artwork
const ICONS = [[16, 0, .22, .86, 'd-small.svg'], [48, 0, .22, .8, 'd-small.svg'], [128, .0625, .2, .7, 'd-ivory.svg']];
for (const [n, inset, r, mark, file] of ICONS) for (const off of [false, true]) {
  const page = await browser.newPage({ viewport: { width: n, height: n }, deviceScaleFactor: 1 });
  const t = n * (1 - 2 * inset);
  // Paused: no tile, only the mark as a flat mid grey (like other extensions' "off" icons), which
  // reads on light and dark toolbars alike and can't be mistaken for the dark "on" tile.
  if (off) await page.setContent(`<body style="margin:0;background:transparent;display:grid;place-items:center;height:${n}px;overflow:hidden"><img src="${svg('d-small.svg')}" style="width:${n * 1.2}px;height:${n * 1.2}px;flex:none;filter:brightness(0) invert(.56)"></body>`);
  else await page.setContent(`<body style="margin:0;background:transparent"><div style="position:absolute;left:${n * inset}px;top:${n * inset}px;width:${t}px;height:${t}px;border-radius:${t * r}px;background:radial-gradient(70% 70% at 30% 20%,#174536,#090F0D 75%);box-shadow:inset 0 0 0 ${n > 16 ? 1 : 0}px rgb(255 255 255 / .1);display:grid;place-items:center"><img src="${svg(file)}" style="width:${t * mark}px;height:${t * mark}px"></div></body>`);
  await page.screenshot({ path: at(`../public/icon-${off ? 'off-' : ''}${n}.png`), omitBackground: true });
  await page.close();
}

const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await og.setContent(`<style>
@font-face{font-family:S;src:url(${font('InstrumentSerif-normal-400.woff2')})}@font-face{font-family:S;font-style:italic;src:url(${font('InstrumentSerif-italic-400.woff2')})}
@font-face{font-family:I;font-weight:400 700;src:url(${font('Inter-normal-400-700.woff2')})}
body{margin:0;width:1200px;height:630px;overflow:hidden;color:#EEF3F0;font-family:I;background:radial-gradient(60% 70% at 15% 0%,#174536,transparent 70%),radial-gradient(40% 60% at 100% 100%,#13302A,transparent 70%),#090F0D;position:relative}
body::before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgb(255 255 255 / .09) 1px,transparent 1.2px);background-size:22px 22px;-webkit-mask:radial-gradient(60% 80% at 20% 30%,#000,transparent 75%)}
.b{position:absolute;left:80px;top:72px;display:flex;align-items:center;gap:14px;font:600 30px/1 I}
h1{position:absolute;left:80px;top:170px;width:700px;margin:0;font:400 92px/1 S;letter-spacing:-.02em}
em{color:#A8E6CE}p{position:absolute;left:80px;bottom:72px;margin:0;font:500 24px/1 I;color:#A2B1AB}
.m{position:absolute;right:90px;top:50%;width:300px;transform:translateY(-50%);filter:drop-shadow(0 40px 60px rgb(0 0 0 / .55)) drop-shadow(0 0 60px rgb(124 240 196 / .22))}
</style><div class="b"><img src="${svg('d-small.svg')}" width="40">D-Tox for YouTube</div><h1>YouTube for what you came for. <em>Nothing else.</em></h1><p>Free · Open source · Sends nothing · d-tox.saaquiblabs.com</p><img class="m" src="${svg('d-ivory.svg')}">`);
await og.evaluate(() => document.fonts.ready);
await og.screenshot({ path: at('../../site/public/og.jpg'), type: 'jpeg', quality: 82 });
await browser.close();
console.log('icons 16, 48, 128 (and paused twins) → extension/public; og.jpg → site/public');
