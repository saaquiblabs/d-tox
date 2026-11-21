// The Chrome Web Store listing's pictures (#28): five 1280×800 screenshots and the 440×280 small
// promo tile. The screenshots are live YouTube as it is, signed out, dark theme, real videos and
// creators (Najmush, 2026-11-21: "live actual views"). Each pair is the same page without D-Tox
// and with it, side by side. Nothing on the page is swapped. Two things are held still in both:
// ads are hidden (no Setting hides ads, and they differ per load) and video is blocked, so
// nothing plays; the player shows the video's own thumbnail, as YouTube does before playback,
// without its clock (a blocked ad's length lands there).
// Writes extension/release/store/ (raw captures in raw/). Needs extension/dist (npm run build).
// Look at every picture: YouTube's markup and results change per load.
//   node scripts/store-assets.mjs [capture|compose]   (default: both)
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const at = (p) => fileURLToPath(new URL(p, import.meta.url));
const pub = pathToFileURL(at('../public/')).href;
const out = at('../../extension/release/store/');
const raw = out + 'raw/';
const dist = realpathSync(at('../../extension/dist'));
const only = process.argv[2];
mkdirSync(raw, { recursive: true });
const extId = [...createHash('sha256').update(dist).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

// Captures are 1280 CSS px wide at 2x. A pair's pane is 600×637 in the listing, so a pair
// captures 1280×1360; a single shot 1280×800.
const PAIR = { width: 1280, height: 1360 }, ONE = { width: 1280, height: 800 };
const WATCH = 'https://www.youtube.com/watch?v=rfscVS0vtbw';
const SEARCH = 'https://www.youtube.com/results?search_query=learn+python';
const SHELF = 'ytd-reel-shelf-renderer, grid-shelf-view-model, ytd-rich-shelf-renderer[is-shorts]';
const HIDE = [
  'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', '#player-ads', 'ytd-promoted-sparkles-web-renderer', '.ytp-ad-module',
  'ytd-merch-shelf-renderer', '.ytp-chrome-top', '.ytp-ce-element', '.ytp-paid-content-overlay', '.ytp-cards-teaser',
  '.ytp-pause-overlay', '.ytp-spinner', '.ytp-time-display', 'ytd-video-preview', '#mouseover-overlay', 'tp-yt-paper-tooltip', 'ytd-popup-container',
  'tp-yt-iron-dropdown', 'yt-tooltip-renderer', 'ytd-banner-promo-renderer', 'ytd-statement-banner-renderer',
].join(',') + '{display:none!important}';

// Each picture changes one thing: the Calm Default, plus the one Setting that picture is about.
const calm = Object.fromEntries(JSON.parse(readFileSync(at('../../settings.json'))).map((s) => [s.id, s.calmDefault]));
async function use(ctx, extra = {}) {
  const pop = await ctx.newPage();
  await pop.goto(`chrome-extension://${extId}/popup.html`);
  await pop.evaluate((s) => chrome.storage.sync.set(s), { ...calm, ...extra });
  await pop.close();
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(4000);
  const reject = page.getByRole('button', { name: /reject all/i });
  if (await reject.count()) { await reject.first().click(); await page.waitForTimeout(2500); }
}

// The player: video is blocked, so put up the video's own thumbnail, as YouTube does when cued.
async function still(page) {
  await page.evaluate(() => {
    document.querySelector('video')?.pause();
    const id = new URL(location.href).searchParams.get('v'), p = document.querySelector('#movie_player');
    if (!id || !p) return;
    const i = Object.assign(document.createElement('img'), { src: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` });
    i.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:30';
    p.append(i);
    return i.decode().catch(() => {});
  });
}

async function shoot(page, name) {
  await page.addStyleTag({ content: HIDE });
  await page.mouse.move(2, page.viewportSize().height - 2);
  await page.evaluate(async () => { document.activeElement?.blur(); await Promise.all([...document.images].filter((i) => i.getBoundingClientRect().top < innerHeight).map((i) => (i.loading = 'eager', i.decode().catch(() => {})))); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${raw}${name}.png` });
}

async function capture() {
  const y = {};
  for (const withExtension of [false, true]) {
    const args = withExtension ? [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] : ['--disable-extensions'];
    const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', args, viewport: PAIR, deviceScaleFactor: 2, locale: 'en-US', colorScheme: 'dark' });
    await ctx.addCookies([{ name: 'PREF', value: 'f6=400&hl=en', domain: '.youtube.com', path: '/' }]);
    await ctx.route(/googlevideo\.com|\/videoplayback|doubleclick|googlesyndication/, (r) => r.abort());
    const tag = withExtension ? 'after' : 'before';
    const set = (extra) => withExtension && use(ctx, extra);
    await set();
    const page = await ctx.newPage();

    // 1. Watch, top of the page.
    await page.goto(WATCH); await settle(page); await still(page);
    await shoot(page, `watch-${tag}`);

    // 2. Watch with comments hidden, scrolled down to where the comments start (before), same
    // scroll after.
    await set({ comments: true, recommendations: false });
    if (withExtension) { await page.goto(WATCH); await settle(page); await still(page); }
    if (!withExtension) {
      await page.evaluate(() => document.querySelector('ytd-comments')?.scrollIntoView());
      await page.waitForTimeout(3500);
      y.comments = await page.evaluate(() => Math.round(document.querySelector('ytd-watch-metadata').getBoundingClientRect().top + scrollY - 80));
    }
    await page.evaluate((v) => scrollTo(0, v), y.comments); await page.waitForTimeout(3000);
    await page.evaluate((v) => scrollTo(0, v), y.comments); await page.waitForTimeout(500);
    await shoot(page, `comments-${tag}`);

    // 3. Search with clean-up on: reload until a Shorts shelf sits in view without scrolling (before).
    await set({ 'search-clean-up': true });
    for (let tries = 0; ; tries++) {
      await page.goto(SEARCH); await settle(page);
      if (withExtension) break;
      await page.waitForTimeout(2000);
      const tops = await page.evaluate((q) => [...document.querySelectorAll(q)].map((e) => Math.round(e.getBoundingClientRect().top)), SHELF);
      console.log('search shelf tops', tops);
      if (tops.some((t) => t > 150 && t < 1150)) break;
      if (tries > 6) throw new Error('no Shorts shelf in view on ' + SEARCH);
    }
    await shoot(page, `search-${tag}`);

    // 4. Home and 5. the popup's backdrop, at the listing's own size.
    if (withExtension) {
      await set();
      await page.setViewportSize(ONE);
      await page.goto('https://www.youtube.com/'); await settle(page);
      await shoot(page, 'home-after');
      await page.goto(WATCH); await settle(page); await still(page);
      await shoot(page, 'popup-backdrop');
      // The popup itself, at its Calm Default (what a fresh install shows).
      const pop = await ctx.newPage();
      await pop.setViewportSize({ width: 400, height: 900 });
      await pop.goto(`chrome-extension://${extId}/popup.html`);
      await pop.evaluate(() => chrome.storage.sync.clear());
      await pop.reload(); await pop.waitForTimeout(800);
      await pop.locator('body').screenshot({ path: `${raw}popup.png`, animations: 'disabled' });
    }
    await ctx.close();
  }
  console.log('raw captures →', raw);
}

async function compose() {
  const img = (n) => pathToFileURL(raw + n + '.png').href;
  for (const n of ['watch-before', 'watch-after', 'comments-before', 'comments-after', 'search-before', 'search-after', 'home-after', 'popup-backdrop', 'popup'])
    if (!existsSync(raw + n + '.png')) throw new Error(`missing ${n}.png: run capture first`);
  const head = `<meta charset="utf-8"><style>
@font-face{font-family:'Instrument Serif';font-style:normal;src:url(${pub}fonts/InstrumentSerif-normal-400.woff2)}
@font-face{font-family:'Instrument Serif';font-style:italic;src:url(${pub}fonts/InstrumentSerif-italic-400.woff2)}
@font-face{font-family:'Inter';font-weight:400 700;src:url(${pub}fonts/Inter-normal-400-700.woff2)}
*{box-sizing:border-box;margin:0}
body{width:var(--w);height:var(--h);overflow:hidden;position:relative;background:radial-gradient(60% 70% at 50% 0%,#12352A,#090F0D 70%);color:#EEF3F0;font-family:Inter,sans-serif}
h1{font:400 44px/1 'Instrument Serif',serif;letter-spacing:-.01em;text-align:center;padding-top:30px}h1 em{color:#7CF0C4}
.pane{position:absolute;border-radius:10px;overflow:hidden;border:1px solid rgb(255 255 255 / .14);box-shadow:0 24px 60px rgb(0 0 0 / .5)}
.pane img{display:block;width:100%}
.tag{position:absolute;font:600 13px/1 Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase}
.tag.off{color:#A2B1AB}.tag.on{color:#7CF0C4}
</style>`;
  const pair = (line, key) => `<h1>${line}</h1>
<p class="tag off" style="left:28px;top:94px">Without D-Tox</p><p class="tag on" style="left:652px;top:94px">With D-Tox</p>
<div class="pane" style="left:28px;top:116px;width:600px"><img src="${img(key + '-before')}"></div>
<div class="pane" style="left:652px;top:116px;width:600px;border-color:rgb(124 240 196 / .45)"><img src="${img(key + '-after')}"></div>`;
  const one = (line, key, extra = '') => `<h1>${line}</h1>
<div class="pane" style="left:50%;transform:translateX(-50%);top:104px;width:1048px;border-color:rgb(124 240 196 / .45)"><img src="${img(key)}">${extra}</div>`;
  const popup = `<img src="${img('popup')}" style="position:absolute;right:18px;top:10px;width:330px;width:330px;border-radius:12px;box-shadow:0 20px 50px rgb(0 0 0 / .6)">`;
  const screens = [
    ['1-watch', pair('Just the video. <em>No next one.</em>', 'watch')],
    ['2-search', pair('Search, <em>without the Shorts.</em>', 'search')],
    ['3-home', one('Home asks what <em>you came for.</em>', 'home-after')],
    ['4-comments', pair('Comments, <em>only if you want them.</em>', 'comments')],
    ['5-popup', one('Ten switches. <em>Four on from the start.</em>', 'popup-backdrop', popup)],
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
  for (const f of ['1-home', '2-watch', '3-search', '4-popup', '5-before']) rmSync(`${out}${f}.png`, { force: true });
  for (const [name, body] of screens) await render(name, 1280, 800, body);
  // Small promo tile: the mark, the name, the promise.
  await render('promo-440x280', 440, 280, `<div style="height:100%;display:grid;place-items:center;text-align:center;gap:0;padding:28px">
  <div><img src="${pub}logo/d-ivory.svg" style="width:64px;height:64px"><h1 style="font-size:52px;padding:0;margin-top:10px">D-Tox</h1>
  <p style="margin-top:10px;font-size:16px;color:#A2B1AB">YouTube for what you <em style="font:italic 20px 'Instrument Serif',serif;color:#7CF0C4">came for.</em></p></div></div>`);
  // Marquee promo tile (1400×560): the promise on the left, the live watch page without/with D-Tox.
  await render('marquee-1400x560', 1400, 560, `<div style="position:absolute;left:72px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center">
  <div style="display:flex;align-items:center;gap:14px"><img src="${pub}logo/d-ivory.svg" style="width:52px;height:52px"><span style="font:600 30px Inter,sans-serif">D-Tox</span></div>
  <h1 style="text-align:left;padding:0;margin-top:26px;font-size:64px;line-height:1.02">YouTube for what<br>you <em>came for.</em></h1>
  <p style="margin-top:22px;font-size:19px;line-height:1.45;color:#A2B1AB">No feed, no Shorts, no next video.<br>Free, open source, sends nothing anywhere.</p></div>
<p class="tag off" style="left:600px;top:58px">Without D-Tox</p><p class="tag on" style="left:1004px;top:58px">With D-Tox</p>
<div class="pane" style="left:600px;top:80px;width:380px"><img src="${img('watch-before')}" style="margin-top:0"></div>
<div class="pane" style="left:1004px;top:80px;width:380px;border-color:rgb(124 240 196 / .45)"><img src="${img('watch-after')}"></div>
<div style="position:absolute;left:0;right:0;bottom:0;height:70px;background:linear-gradient(transparent,#090F0D)"></div>`);
  await b.close();
  console.log('store pictures →', out);
}

if (!only || only === 'capture') await capture();
if (!only || only === 'compose') await compose();
