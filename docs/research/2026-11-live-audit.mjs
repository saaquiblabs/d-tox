// Live audit of d-tox v1.4.1 on YouTube. Muted, nothing recorded.
// Run from anywhere: needs Playwright installed (path below) and a built extension at EXT.
// node docs/research/2026-11-live-audit.mjs  (writes results2.json next to this file)
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const require = createRequire('/Users/saaquib/projects/mihrab-ummah/package.json');
const { chromium } = require('playwright');

const EXT = '/Users/saaquib/projects/d-tox/dist/chrome-mv3';
const OUT = path.dirname(new URL(import.meta.url).pathname);

const ALL_OFF = {
  extensionEnabled: true, hideHomeFeed: false, hideSidebar: false, hideShorts: false,
  hidePlaylists: false, hideMixes: false, hideMoreFromYoutube: false, hideComments: false,
  hideProfilePhotos: false, hideHeader: false, hideNotifications: false, hideLiveChat: false,
  hideFundraiser: false, hideScreenFeed: false, hideScreenCards: false,
  hideMerchTicketOffers: false, hideVideoInfo: false, hideExplore: false,
  hideSearchResults: false, disableAutoplay: false, disableAnnotations: false,
};
const MODES = {
  off: null,
  shorts: { ...ALL_OFF, hideShorts: true, disableAutoplay: true },
  minimal: { ...ALL_OFF, hideHomeFeed: true, hideSidebar: true, hideShorts: true,
    hidePlaylists: true, hideMixes: true, hideMoreFromYoutube: true, hideComments: true,
    hideProfilePhotos: true, hideNotifications: true, hideLiveChat: true, hideFundraiser: true,
    hideScreenFeed: true, hideScreenCards: true, hideMerchTicketOffers: true, hideExplore: true,
    disableAutoplay: true, disableAnnotations: true },
};

const PAGES = [
  { id: 'search', url: 'https://www.youtube.com/results?search_query=how+to+learn+guitar', scroll: 8 },
  { id: 'search2', url: 'https://www.youtube.com/results?search_query=cooking+pasta', scroll: 8 },
  { id: 'home', url: 'https://www.youtube.com/', scroll: 8 },
  { id: 'watch', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', scroll: 4, video: true },
  { id: 'playlist', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI', scroll: 0, video: true },
  { id: 'shorts', url: 'https://www.youtube.com/shorts', scroll: 0, video: true, shorts: true },
  { id: 'channel', url: 'https://www.youtube.com/@veritasium/videos', scroll: 6 },
];

// Things a user wants to keep that d-tox should never hide by accident.
const WANTED = {
  'player': '#movie_player',
  'title': 'ytd-watch-metadata h1, #title h1',
  'playlist queue': 'ytd-playlist-panel-renderer#playlist',
  'live chat frame': 'ytd-live-chat-frame#chat, #chat-container',
  'chapters/engagement panel': 'ytd-engagement-panel-section-list-renderer',
  'channel video grid': 'ytd-browse[page-subtype="channels"] ytd-rich-grid-renderer',
  'search results': 'ytd-search ytd-video-renderer',
  'shorts player': 'ytd-reel-video-renderer',
  'masthead search': 'ytd-searchbox, input#search',
  'music content': 'ytmusic-app #contents, ytmusic-browse-response',
};

const LONGTASK_INIT = () => {
  window.__lt = [];
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push(e.duration); })
      .observe({ type: 'longtask', buffered: true });
  } catch {}
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function metrics(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map(x => [x.name, x.value]));
  return { style: m.RecalcStyleDuration * 1000, layout: m.LayoutDuration * 1000,
    script: m.ScriptDuration * 1000, recalcCount: m.RecalcStyleCount, nodes: m.Nodes };
}

async function runMode(mode) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dtox-audit-'));
  const args = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--lang=en-US'];
  if (MODES[mode]) args.push(`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`);
  const ctx = await chromium.launchPersistentContext(dir, {
    channel: 'chromium', headless: true, args, viewport: { width: 1440, height: 900 }, locale: 'en-US',
  });
  if (MODES[mode]) {
    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker');
    await sw.evaluate(s => chrome.storage.local.set({ yt_detox_settings: s }), MODES[mode]);
    // the extension opens a welcome tab on install; close it
    await sleep(1500);
    for (const p of ctx.pages()) if (!p.url().startsWith('about:')) await p.close().catch(() => {});
  }
  await ctx.addInitScript(LONGTASK_INIT);
  const results = {};
  for (const pg of PAGES) {
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    const r = { mode, page: pg.id };
    page.on('crash', () => { r.crashed = true; });
    const limit = new Promise((_, rej) => setTimeout(() => rej(new Error('page time limit 75s')), 75000));
    try { await Promise.race([limit, (async () => {
      const t0 = Date.now();
      await page.goto(pg.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(6000);
      r.loadMs = Date.now() - t0;
      const before = await metrics(cdp);
      for (let i = 0; i < pg.scroll; i++) { await page.mouse.wheel(0, 2500); await sleep(1200); }
      if (pg.video) {
        const t1 = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
        await sleep(5000);
        const t2 = await page.evaluate(() => document.querySelector('video')?.currentTime ?? -1);
        r.videoAdvancedSec = +(t2 - t1).toFixed(2);
        r.videoPaused = await page.evaluate(() => document.querySelector('video')?.paused ?? null);
      }
      if (pg.shorts) {
        const u1 = page.url();
        await page.keyboard.press('ArrowDown'); await sleep(4000);
        const u2 = page.url();
        r.shortsNextUrlChanged = u1 !== u2;
        r.shortsNextPlaying = await page.evaluate(() => {
          const v = [...document.querySelectorAll('video')].find(v => !v.paused);
          return !!v;
        });
      }
      const after = await metrics(cdp);
      r.during = Object.fromEntries(Object.keys(after).map(k => [k, +(after[k] - before[k]).toFixed(1)]));
      r.during.nodes = after.nodes;
      r.total = Object.fromEntries(Object.entries(after).map(([k, v]) => [k, +v.toFixed(1)]));
      const lt = await page.evaluate(() => window.__lt || []);
      r.longTasks = { count: lt.length, totalMs: Math.round(lt.reduce((a, b) => a + b, 0)) };
      r.wanted = await page.evaluate(W => {
        const o = {};
        for (const [k, sel] of Object.entries(W)) {
          const els = [...document.querySelectorAll(sel)];
          if (!els.length) continue;
          o[k] = els.some(e => e.checkVisibility ? e.checkVisibility() : e.offsetParent !== null) ? 'visible' : 'HIDDEN';
        }
        return o;
      }, WANTED);
      r.title = await page.title();
      r.botWall = await page.evaluate(() => /not a bot|unusual traffic/i.test(document.body.innerText));
    })()]); } catch (e) { r.error = String(e).slice(0, 200); }
    results[pg.id] = r;
    console.log(JSON.stringify(r));
    await Promise.race([page.close().catch(() => {}), sleep(5000)]);
  }
  await Promise.race([ctx.close().catch(() => {}), sleep(10000)]);
  return results;
}

setTimeout(() => { console.log('GLOBAL TIMEOUT'); process.exit(2); }, 14 * 60000).unref();
const all = {};
for (const mode of Object.keys(MODES)) all[mode] = await runMode(mode);
fs.writeFileSync(path.join(OUT, 'results2.json'), JSON.stringify(all, null, 2));
console.log('DONE');
