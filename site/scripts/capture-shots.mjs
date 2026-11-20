// The product page's pictures (#27), all from scripts/fiction.mjs: no real creator, face, title,
// channel or ad appears on the page.
//   1. public/feed: the Home scene's feed (feed.json + generated SVG thumbnails).
//   2. public/shots/home-*: signed-out YouTube's home is empty, so home before/after is the page's
//      own YouTube home (?yt=before is the feed, ?yt=after is the Intention Page), from the
//      built dist/. Run `npm run build` first.
//   3. public/shots/{search,watch}-*: live YouTube, signed out, without and with D-Tox (every
//      Setting on but the Shorts redirect). Before each shot every video's thumbnail, title,
//      channel, avatar and description is swapped for fiction, and ads are hidden in both (no
//      Setting hides ads). Video is blocked, so nothing plays. Run `npm run build` in extension/ first.
// Writes regions.json (where the hidden parts sit, for the page's marks). Look at every picture
// before committing: YouTube's markup moves, and a missed swap shows a real person.
//   node scripts/capture-shots.mjs [feed|home|live]   (default: all three)
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { avatar, comments, dataUrl, lessons, shorts, thumb, videos, watch } from './fiction.mjs';

const at = (p) => fileURLToPath(new URL(p, import.meta.url));
const feedDir = at('../public/feed/'), shotsDir = at('../public/shots/');
const only = process.argv[2];
const regionsFile = shotsDir + 'regions.json';
const regions = JSON.parse(readFileSync(regionsFile, 'utf8'));

async function save(png, name) {
  await sharp(png).resize(1440).webp({ quality: 74 }).toFile(`${shotsDir}${name}-1440.webp`);
  await sharp(png).webp({ quality: 70 }).toFile(`${shotsDir}${name}-2160.webp`);
}

// 1. The feed.
function feed() {
  for (const f of readdirSync(feedDir)) rmSync(feedDir + f);
  for (const v of videos) writeFileSync(`${feedDir}${v.id}.svg`, thumb(v));
  for (const s of shorts) writeFileSync(`${feedDir}${s.id}.svg`, thumb(s, true));
  const strip = ({ style, word, ...v }) => ({ ...v, ok: true });
  writeFileSync(feedDir + 'feed.json', JSON.stringify({ videos: videos.map(strip), shorts: shorts.map(strip) }, null, 1));
  console.log('feed →', feedDir);
}

// 2. Home, from the page's own YouTube home.
async function home() {
  // dist/ served as is (run `npm run build` first).
  const dist = at('../dist'), types = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', woff2: 'font/woff2', ico: 'image/x-icon' };
  const server = createServer((req, res) => {
    let f = join(dist, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!f.startsWith(dist)) return res.writeHead(403).end();
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': types[f.split('.').pop()] ?? 'application/octet-stream' }).end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
    for (const state of ['before', 'after']) {
      await p.goto(`http://127.0.0.1:${port}/?yt=${state}`);
      await p.waitForSelector('.yt .card img', { state: 'attached' });
      await p.evaluate(async () => { scrollTo(0, 0); await document.fonts.ready; await Promise.all([...document.querySelectorAll('.yt img')].map((i) => (i.loading = 'eager', i.decode().catch(() => {})))); });
      await p.waitForTimeout(300);
      if (state === 'before') regions.home = await p.evaluate(() => {
        const o = document.querySelector('.yt').getBoundingClientRect();
        const pct = (el) => { const r = el.getBoundingClientRect(); return [(r.x - o.x) / 14.4, (r.y - o.y) / 9, r.width / 14.4, Math.min(r.height, o.bottom - r.y) / 9].map((n) => +n.toFixed(2)); };
        return { feed: pct(document.querySelector('.yt .main')), shortsLink: pct(document.querySelector('.ysd a.fade')), explore: pct(document.querySelector('.ysd div.fade')), recommendations: null, shorts: pct(document.querySelector('.yt .shelf')) };
      });
      await save(await p.locator('.yt').screenshot(), `home-${state}`);
    }
    await b.close();
  } finally { server.close(); }
  console.log('home shots →', shotsDir);
}

// 3. Search and watch, live, with fiction swapped in.
const dist = realpathSync(at('../../extension/dist'));
const extId = [...createHash('sha256').update(dist).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const pages = [
  // A Shorts shelf's place in the results changes per load: the capture reloads until one sits
  // near the top, scrolls it into view, and takes the D-Tox shot at the same scroll.
  { key: 'search', url: 'https://www.youtube.com/results?search_query=learn+python', shelf: true },
  { key: 'watch', url: 'https://www.youtube.com/watch?v=rfscVS0vtbw' },
];
const HIDE = [
  'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', '#player-ads', 'ytd-promoted-sparkles-web-renderer', '.ytp-ad-module',
  'ytd-merch-shelf-renderer', 'ytd-expandable-metadata-renderer', 'ytd-video-description-infocards-section-renderer',
  '.ytp-chrome-top', '.ytp-ce-element', '.ytp-paid-content-overlay', '.ytp-cards-teaser', '.ytp-watermark', '.ytp-pause-overlay',
  'ytd-video-preview', '#mouseover-overlay', 'ytd-thumbnail-overlay-loading-preview-renderer', 'ytd-thumbnail-overlay-resume-playback-renderer', 'ytd-video-renderer #badges',
  'tp-yt-paper-tooltip', 'ytd-popup-container', 'tp-yt-iron-dropdown', 'yt-tooltip-renderer', '#dtox-intention',
].join(',') + '{display:none!important}';

const fictionFor = () => {
  const chans = [...new Set([...videos, ...lessons].map((v) => v.channel))];
  return {
    videos: videos.map((v) => ({ ...v, img: dataUrl(thumb(v)) })),
    lessons: lessons.map((v) => ({ ...v, img: dataUrl(thumb(v)) })),
    shorts: shorts.map((s) => ({ ...s, img: dataUrl(thumb(s, true)) })),
    avatars: Object.fromEntries(chans.concat(comments.map(([n]) => n)).map((c) => [c, dataUrl(avatar(c))])),
    watch: { ...watch, img: dataUrl(thumb({ ...watch, style: 'lesson' })) },
    comments,
  };
};

// Runs in the page. Every outermost video card gets the next fictional video.
function swap(F) {
  const CARD = 'ytd-video-renderer, ytd-compact-video-renderer, ytd-rich-item-renderer, yt-lockup-view-model, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, ytd-reel-item-renderer, ytd-playlist-renderer, ytd-radio-renderer, ytd-channel-renderer';
  const AV = 'yt-img-shadow, yt-avatar-shape, #avatar, #channel-thumbnail, [class*="Avatar"], [class*="avatar"]';
  const BADGE = 'badge-shape, [class*="Badge"], [class*="badge"], ytd-thumbnail-overlay-time-status-renderer, ytd-thumbnail-overlay-toggle-button-renderer, .ytp-time-display';
  const DUR = /^(\d+:)?\d+:\d\d$/, VIEWS = /views|watching|^\d[\d.,]*\s?[KMB]?$/i, AGE = /ago$/i, KEEP = /^(•|·|LIVE|New|4K|CC|HD|Verified|Shorts|SHORTS)$/;
  const pool = location.pathname === '/results' ? F.lessons : F.videos;
  let n = 0, s = 0;
  const texts = (el) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), out = []; let t; while ((t = w.nextNode())) if (t.textContent.trim()) out.push(t); return out; };
  const setText = (el, str) => { const ts = texts(el); if (!ts.length) return; ts[0].textContent = str; ts.slice(1).forEach((t) => (t.textContent = '')); };
  const setImg = (img, src) => { img.removeAttribute('srcset'); img.src = src; img.style.objectFit = 'cover'; };
  const cards = [...document.querySelectorAll(CARD)].filter((c) => !c.parentElement.closest(CARD));
  for (const card of cards) {
    const isShort = card.matches('[class*="shorts"], [is-shorts], ytd-reel-item-renderer') || !!card.querySelector('ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, a[href^="/shorts/"]');
    const v = isShort ? F.shorts[s++ % F.shorts.length] : pool[n++ % pool.length];
    for (const img of card.querySelectorAll('img')) setImg(img, img.closest(AV) ? F.avatars[v.channel ?? 'D'] ?? Object.values(F.avatars)[0] : v.img);
    const title = ['#video-title', 'h3', 'a[class*="Title"]'].map((q) => card.querySelector(q)).find(Boolean);
    if (title) setText(title, v.title);
    // A search result names its channel twice (one hidden); set both.
    const names = [...card.querySelectorAll('ytd-channel-name')];
    for (const c of names) setText(c, v.channel);
    let gotChannel = names.length > 0;
    for (const t of texts(card)) {
      if (title?.contains(t) || names.some((c) => c.contains(t))) continue;
      const str = t.textContent.trim(), el = t.parentElement;
      if (el.closest(BADGE) || DUR.test(str) || KEEP.test(str)) continue;
      if (AGE.test(str)) t.textContent = v.age ?? '2d ago';
      else if (VIEWS.test(str)) t.textContent = (v.views ?? '1.2M') + (/views/i.test(str) ? ' views' : '');
      else if (!gotChannel && !isShort) { t.textContent = v.channel; gotChannel = true; }
      else t.textContent = '';
    }
    // A search result's description: one calm line.
    const snip = card.querySelector('.metadata-snippet-container, #description-text');
    if (snip) setText(snip, 'A clear, step-by-step lesson for beginners, with exercises and chapters.');
  }
  for (const chip of document.querySelectorAll('yt-chip-cloud-chip-renderer, chip-shape')) for (const t of texts(chip)) if (/^From /.test(t.textContent.trim())) t.textContent = 'From ' + F.watch.channel;
  // A shelf titled after a real channel.
  for (const h of document.querySelectorAll('ytd-shelf-renderer #title, ytd-rich-shelf-renderer #title')) if (!/^(Shorts|People also watched|For you|Previously watched|Latest from)/.test(h.textContent.trim())) setText(h, 'Latest from ' + F.watch.channel);

  // The watch page itself.
  const meta = document.querySelector('ytd-watch-metadata');
  if (meta) {
    const W = F.watch;
    const h1 = meta.querySelector('#title h1'); if (h1) setText(h1, W.title);
    const ch = meta.querySelector('#owner ytd-channel-name #text, #owner ytd-channel-name a'); if (ch) setText(ch, W.channel);
    const subs = meta.querySelector('#owner-sub-count'); if (subs) setText(subs, W.subs);
    for (const img of meta.querySelectorAll('#owner img')) setImg(img, F.avatars[W.channel]);
    const like = meta.querySelector('like-button-view-model, segmented-like-dislike-button-view-model, #top-level-buttons-computed');
    const likeText = like && texts(like).find((t) => /^\d/.test(t.textContent.trim())); if (likeText) likeText.textContent = W.likes;
    const info = meta.querySelector('#info-container, #info'); if (info) setText(info, `${W.views} views  ${W.age}`);
    const desc = meta.querySelector('#description-inline-expander #attributed-snippet-text, #description-inline-expander #plain-snippet-text, ytd-text-inline-expander');
    if (desc) setText(desc, W.description);
    const player = document.querySelector('#movie_player');
    if (player) {
      const i = Object.assign(document.createElement('img'), { src: W.img });
      i.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:60';
      player.append(i);
    }
  }
  for (const [i, c] of [...document.querySelectorAll('ytd-comment-thread-renderer')].entries()) {
    const [name, text] = F.comments[i % F.comments.length];
    const a = c.querySelector('#author-text'); if (a) setText(a, '@' + name.replace(/\s/g, '').toLowerCase());
    const body = c.querySelector('#content-text'); if (body) setText(body, text);
    for (const img of c.querySelectorAll('img')) setImg(img, F.avatars[name]);
  }
  return Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
}

async function live() {
  const F = fictionFor();
  const SHELF = 'ytd-reel-shelf-renderer, grid-shelf-view-model, ytd-rich-shelf-renderer[is-shorts]';
  const scrollY = {};
  const all = Object.fromEntries(JSON.parse(readFileSync(at('../../settings.json'))).map((s) => [s.id, s.choices ? s.calmDefault : s.id !== 'shorts-redirect']));
  for (const withExtension of [false, true]) {
    const args = withExtension ? [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] : ['--disable-extensions'];
    const ctx = await chromium.launchPersistentContext('', { channel: 'chromium', args, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, locale: 'en-US' });
    // YouTube's dark theme (the product page is dark): PREF f6=400.
    await ctx.addCookies([{ name: 'PREF', value: 'f6=400&hl=en', domain: '.youtube.com', path: '/' }]);
    await ctx.route(/googlevideo\.com|\/videoplayback|doubleclick|googlesyndication/, (r) => r.abort());
    if (withExtension) {
      const pop = await ctx.newPage();
      await pop.goto(`chrome-extension://${extId}/popup.html`);
      await pop.evaluate((all) => chrome.storage.sync.set(all), all);
      await pop.close();
    }
    for (const p of pages) {
      const page = await ctx.newPage();
      for (let tries = 0; ; tries++) {
        await page.goto(p.url);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(4000);
        const reject = page.getByRole('button', { name: /reject all/i });
        if (await reject.count()) { await reject.first().click(); await page.waitForTimeout(2500); }
        if (!p.shelf) break;
        if (withExtension) { await page.evaluate((y) => scrollTo(0, y), scrollY[p.key]); break; }
        const top = await page.evaluate((q) => [...document.querySelectorAll(q)].map((e) => e.getBoundingClientRect().top + scrollY).find((t) => t > 300 && t < 3000), SHELF);
        if (top) { scrollY[p.key] = Math.round(top - 330); await page.evaluate((y) => scrollTo(0, y), scrollY[p.key]); break; }
        if (tries > 6) throw new Error('no Shorts shelf near the top of ' + p.url);
      }
      await page.waitForTimeout(1500);
      await page.evaluate(() => document.querySelector('video')?.pause());
      await page.addStyleTag({ content: HIDE });
      await page.waitForTimeout(800);
      await page.evaluate(swap, F);
      await page.mouse.move(1439, 899);
      await page.evaluate(() => document.activeElement?.blur());
      await page.waitForTimeout(600);
      if (!withExtension) regions[p.key] = await page.evaluate(() => {
        const pct = (el) => { const r = el?.getBoundingClientRect(); return r && r.width && r.height ? [r.x / innerWidth * 100, r.y / innerHeight * 100, r.width / innerWidth * 100, Math.min(r.height, innerHeight - r.y) / innerHeight * 100].map((n) => +n.toFixed(2)) : null; };
        const section = [...document.querySelectorAll('ytd-guide-section-renderer')].find((s) => s.querySelector('#guide-section-title')?.textContent.trim() === 'Explore');
        const shortsShelf = [...document.querySelectorAll('ytd-reel-shelf-renderer, grid-shelf-view-model, ytd-rich-shelf-renderer[is-shorts]')].find((e) => e.getBoundingClientRect().height);
        return { recommendations: pct(document.querySelector('#secondary')), shorts: pct(shortsShelf), explore: pct(section), shortsLink: pct(document.querySelector('ytd-guide-entry-renderer a[title="Shorts"]')?.closest('ytd-guide-entry-renderer')) };
      });
      await save(await page.screenshot(), `${p.key}-${withExtension ? 'after' : 'before'}`);
      await page.close();
    }
    await ctx.close();
  }
  console.log('live shots →', shotsDir);
}

mkdirSync(shotsDir, { recursive: true });
if (!only || only === 'feed') feed();
if (!only || only === 'home') await home();
if (!only || only === 'live') await live();
writeFileSync(regionsFile, JSON.stringify(regions, null, 1));
