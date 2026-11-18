// PROTOTYPE (#22), throwaway. Signed-out YouTube's home is empty ("Try searching to get started"),
// so the product page's closing scene builds a home feed itself: real titles, channels and
// thumbnails taken from live search results (videos and Shorts), saved to
// site/prototype-home/feed/ (feed.json + small WebP thumbnails, via cwebp). Plays nothing.
//   node scripts/prototype-feed.mjs
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../../site/prototype-home/feed/', import.meta.url));
mkdirSync(out, { recursive: true });
const QUERIES = ['mrbeast', 'cricket highlights', 'try not to laugh', 'minecraft', 'podcast clips', 'street food india', 'unboxing iphone', 'satisfying'];

const browser = await chromium.launch({ channel: 'chromium' });
const ctx = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 } });
await ctx.addCookies([{ name: 'PREF', value: 'f6=400&hl=en', domain: '.youtube.com', path: '/' }]);
await ctx.route(/googlevideo\.com|\/videoplayback/, (r) => r.abort());
const page = await ctx.newPage();
const videos = [], shorts = [], seen = new Set();
for (const q of QUERIES) {
  await page.goto('https://www.youtube.com/results?search_query=' + encodeURIComponent(q));
  await page.waitForTimeout(3000);
  const got = await page.evaluate(() => {
    const t = (el, s) => el.querySelector(s)?.textContent.trim() ?? '';
    const v = [...document.querySelectorAll('ytd-video-renderer')].slice(0, 4).map((el) => {
      const id = new URL(el.querySelector('a#thumbnail')?.href ?? location.href).searchParams.get('v');
      const meta = [...el.querySelectorAll('#metadata-line span.inline-metadata-item')].map((s) => s.textContent.trim());
      return { id, title: t(el, '#video-title'), channel: t(el, 'ytd-channel-name a'), views: meta[0] ?? '', age: meta[1] ?? '', dur: t(el, 'badge-shape .yt-badge-shape__text, ytd-thumbnail-overlay-time-status-renderer #text') };
    });
    const s = [...document.querySelectorAll('a[href^="/shorts/"]')].map((a) => ({ id: a.getAttribute('href').split('/')[2]?.split('?')[0], title: a.getAttribute('title') || a.closest('ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2')?.querySelector('h3')?.textContent.trim() || '' }));
    return { v, s };
  });
  for (const x of got.v) if (x.id && x.dur && !seen.has(x.id) && videos.length < 16) { seen.add(x.id); videos.push(x); }
  for (const x of got.s) if (x.id && x.title && !seen.has(x.id) && shorts.length < 8) { seen.add(x.id); shorts.push(x); }
}
await browser.close();

async function grab(url, file, w) {
  const r = await fetch(url);
  if (!r.ok) return false;
  const tmp = out + file + '.jpg';
  writeFileSync(tmp, Buffer.from(await r.arrayBuffer()));
  execFileSync('cwebp', ['-quiet', '-q', '72', '-resize', String(w), '0', tmp, '-o', out + file + '.webp']);
  execFileSync('rm', [tmp]);
  return true;
}
for (const v of videos) v.ok = await grab(`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`, v.id, 480);
for (const s of shorts) s.ok = (await grab(`https://i.ytimg.com/vi/${s.id}/oar2.jpg`, 's-' + s.id, 270)) || (await grab(`https://i.ytimg.com/vi/${s.id}/hqdefault.jpg`, 's-' + s.id, 270));
writeFileSync(out + 'feed.json', JSON.stringify({ videos: videos.filter((v) => v.ok), shorts: shorts.filter((s) => s.ok) }, null, 1));
console.log(videos.length, 'videos,', shorts.length, 'shorts →', out);
