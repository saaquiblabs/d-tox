// One run of the Release Gate's audit (#25): a fresh Chromium visits each page, either with no
// extension (the Baseline Run) or with the built extension and every Setting on. The method is
// docs/research/2026-11-live-audit.mjs: Performance.getMetrics and long tasks while the page
// loads, is scrolled and then sits idle; then what must still work. Muted, nothing recorded.
import { chromium, type BrowserContext, type CDPSession, type Page, type Worker } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import settings from '../../settings.json' with { type: 'json' };
import { watchPlaylist } from '../../extension/tests/cases.ts';
import { blockedReason, languages, playerBotCheck } from './live.ts';
import type { Check, PageId, PageRun } from './verdict.ts';

export type Mode = 'baseline' | 'dtox';
export const viewport = { width: 1440, height: 900 };

type Kind = 'browse' | 'video' | 'shorts' | 'redirect';
type Spec = { id: PageId; url: string; scroll: number; kind: Kind; only?: Mode };

export const pages: Spec[] = [
  { id: 'home', url: 'https://www.youtube.com/', scroll: 6, kind: 'browse' },
  { id: 'search', url: 'https://www.youtube.com/results?search_query=python+tutorial', scroll: 8, kind: 'browse' },
  // The worst case, not in the speed total (verdict.ts `uncounted`): ~85% of "cooking" results in
  // India are Shorts, so with them hidden YouTube loads ~3× the result pages for the same scroll.
  { id: 'search-shorts', url: 'https://www.youtube.com/results?search_query=cooking', scroll: 8, kind: 'browse' },
  { id: 'watch', url: 'https://www.youtube.com/watch?v=aircAruvnKk', scroll: 4, kind: 'video' },
  { id: 'playlist', url: watchPlaylist.url, scroll: 0, kind: 'video' },
  { id: 'channel', url: 'https://www.youtube.com/@3blue1brown/videos', scroll: 6, kind: 'browse' },
  // With the Shorts redirect off, so there is a Short to swipe (a Shorts Quitter may keep them).
  { id: 'shorts', url: 'https://www.youtube.com/shorts/k5Z7sFwFF7Q', scroll: 0, kind: 'shorts' },
  { id: 'shorts-redirect', url: 'https://www.youtube.com/shorts/k5Z7sFwFF7Q', scroll: 0, kind: 'redirect', only: 'dtox' },
];

/** Every switch on, and each choice on its Calm Default (Home: the Intention Page). */
export const everySettingOn = Object.fromEntries(
  settings.map((s) => [s.id, s.type === 'switch' ? true : s.calmDefault || s.choices!.find((c) => c.id !== 'default')!.id]),
);

const pageLimitMs = 180_000;
/** Up to this long for a page to stop changing after the scroll, then this long sitting idle. */
const settleMs = 30_000;
const idleMs = 8_000;
const english = languages[0]!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Long tasks from the very start of each page, buffered so none before the observer is lost. */
function watchLongTasks() {
  const w = window as any;
  w.__dtoxLongTasks = [];
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__dtoxLongTasks.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  } catch {}
}

async function metrics(cdp: CDPSession) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { styleMs: (m.RecalcStyleDuration ?? 0) * 1000 };
}

export type Run = { context: BrowserContext; close: () => Promise<void>; set: (values: Record<string, unknown>) => Promise<void> };

export async function launch(mode: Mode, extension: string): Promise<Run> {
  const profile = await mkdtemp(join(tmpdir(), `dtox-gate-${mode}-`));
  const args = ['--mute-audio', '--autoplay-policy=no-user-gesture-required', '--lang=en-US'];
  if (mode === 'dtox') args.push(`--disable-extensions-except=${extension}`, `--load-extension=${extension}`);
  const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', viewport, locale: 'en-US', args });
  await context.addInitScript(watchLongTasks);
  let worker: Worker | undefined;
  if (mode === 'dtox') {
    worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await worker.evaluate((v) => (globalThis as any).chrome.storage.sync.set(v), everySettingOn);
    await sleep(1500); // D-Tox opens /welcome on install: close it.
    for (const p of context.pages()) if (!p.url().startsWith('about:')) await p.close().catch(() => {});
  }
  return {
    context,
    set: async (values) => {
      await worker?.evaluate((v) => (globalThis as any).chrome.storage.sync.set(v), values);
    },
    close: async () => {
      await Promise.race([context.close().catch(() => {}), sleep(15_000)]);
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/** Waits out a pre-roll ad, skipping it when YouTube offers to. */
async function pastAds(page: Page, ms = 60_000) {
  for (const end = Date.now() + ms; Date.now() < end; await sleep(1000)) {
    const ad = await page.evaluate(() => !!document.querySelector('#movie_player.ad-showing, #movie_player.ad-interrupting'));
    if (!ad) return true;
    await page.locator('#movie_player :is(.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern)').first().click({ timeout: 500 }).catch(() => {});
  }
  return false;
}

const videoTime = (page: Page) => page.evaluate(() => document.querySelector<HTMLVideoElement>('#movie_player video')?.currentTime ?? -1);

/** A video plays: started (as a person pressing play would) and its time moves on. */
async function plays(page: Page) {
  await page.evaluate(() => document.querySelector<HTMLVideoElement>('#movie_player video')?.play().catch(() => {}));
  const t1 = await videoTime(page);
  await sleep(4000);
  const t2 = await videoTime(page);
  return t1 >= 0 && t2 - t1 > 1.5;
}

/**
 * Jumps and keeps playing from there. Back within what has loaded: past it, YouTube's player
 * stalls for an automated browser (navigator.webdriver), with or without D-Tox (checked live
 * 2026-11-20: the jump's requests answer 200, the player stays buffering).
 */
async function seeks(page: Page) {
  for (const end = Date.now() + 20_000; Date.now() < end && (await videoTime(page)) < 12; ) await sleep(1000);
  if ((await videoTime(page)) < 12) return null;
  await page.evaluate(() => {
    document.querySelector<HTMLVideoElement>('#movie_player video')!.currentTime = 2;
  });
  await sleep(1500);
  const t1 = await videoTime(page);
  await sleep(2000);
  const t2 = await videoTime(page);
  return t1 >= 2 && t1 < 8 && t2 > t1;
}

/** Seeks to the last seconds and counts the end-screen elements that can be seen; null if the end wasn't reached. */
async function endScreens(page: Page) {
  const ok = await page.evaluate(() => {
    const v = document.querySelector<HTMLVideoElement>('#movie_player video');
    if (!v || !Number.isFinite(v.duration) || v.duration < 30) return false;
    v.currentTime = v.duration - 12;
    return true;
  });
  if (!ok) return null;
  let most = 0;
  let reached = false;
  for (let i = 0; i < 22; i++) {
    await sleep(1000);
    const s = await page.evaluate(() => {
      const v = document.querySelector<HTMLVideoElement>('#movie_player video');
      const seen = [...document.querySelectorAll('#movie_player :is(.ytp-ce-element, .html5-endscreen .ytp-videowall-still, .ytp-fullscreen-grid .ytp-modern-videowall-still)')].filter((e) => e.checkVisibility()).length;
      return { seen, near: !!v && v.duration - v.currentTime < 13 };
    });
    reached ||= s.near;
    most = Math.max(most, s.seen);
  }
  return reached ? most : null;
}

const anyVideoPlaying = (page: Page) => page.evaluate(() => [...document.querySelectorAll('video')].some((v) => !v.paused && v.currentTime > 0));

/** Measures one page. Never throws: a timeout or crash is the result's `error`. */
export async function measure(run: Run, spec: Spec, mode: Mode): Promise<PageRun> {
  const page = await run.context.newPage();
  const r: PageRun = { page: spec.id };
  let timer: NodeJS.Timeout | undefined;
  try {
    const cdp = await run.context.newCDPSession(page);
    await cdp.send('Performance.enable');
    const limit = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error(`page time limit ${pageLimitMs / 1000}s`)), pageLimitMs)));
    await Promise.race([limit, (async () => {
      const url = new URL(spec.url);
      url.searchParams.set('hl', 'en');
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 45_000 });
      const blocked = (await blockedReason(page, english)) ?? (spec.kind === 'browse' ? null : await playerBotCheck(page));
      if (blocked) return void (r.blocked = blocked);

      // Speed: load, scroll, then sit idle and see whether the page keeps growing.
      await sleep(6000);
      // A D-Tox run where the extension did nothing would pass every speed check.
      if (mode === 'dtox' && !(await page.evaluate(() => [...document.documentElement.attributes].some((a) => a.name.startsWith('data-dtox-')))))
        throw new Error('D-Tox applied no Settings (no data-dtox-* attribute on <html>)');
      for (let i = 0; i < spec.scroll; i++) {
        await page.mouse.wheel(0, 2500);
        await sleep(1200);
      }
      // Elements in the page, not Chrome's node count: that counts discarded nodes until they are
      // collected. Let the page settle first (YouTube may still be loading what the scroll asked
      // for, more of it when D-Tox hides much of each page); only growth after that is runaway.
      const elements = () => page.evaluate(() => document.getElementsByTagName('*').length);
      let last = await elements();
      for (let still = 0, end = Date.now() + settleMs; still < 3 && Date.now() < end; ) {
        await sleep(2000);
        const now = await elements();
        still = now === last ? still + 1 : 0;
        last = now;
      }
      await sleep(idleMs);
      const after = await elements();
      r.styleMs = Math.round((await metrics(cdp)).styleMs);
      r.nodes = after;
      r.idleGrowth = after - last;
      r.longTaskMs = Math.round(await page.evaluate(() => ((window as any).__dtoxLongTasks as number[]).reduce((a, b) => a + b, 0)));

      // What must work.
      await page.evaluate(() => window.scrollTo(0, 0));
      const checks: Partial<Record<Check, boolean | null>> = {};
      if (spec.kind === 'video') {
        if (!(await pastAds(page))) checks.plays = null;
        else checks.plays = await plays(page);
        if (spec.id === 'watch') {
          r.playerWidth = Math.round((await page.locator('#movie_player').boundingBox())?.width ?? 0);
          const owner = await page.locator('ytd-watch-metadata #owner').boundingBox();
          checks['title in view'] = owner ? owner.y + owner.height <= viewport.height : null;
          checks.seeks = checks.plays ? await seeks(page) : null;
          r.endScreens = checks.plays ? await endScreens(page) : null;
        } else {
          checks['playlist column kept'] = await page
            .locator('ytd-watch-flexy #secondary ytd-playlist-panel-renderer#playlist')
            .first()
            .isVisible();
        }
      } else if (spec.kind === 'shorts') {
        checks.plays = await anyVideoPlaying(page);
        const from = page.url();
        await page.keyboard.press('ArrowDown');
        await sleep(4000);
        checks.swipes = page.url() !== from && (await anyVideoPlaying(page));
      } else if (spec.kind === 'redirect') {
        checks.redirects = new URL(page.url()).pathname === '/watch';
        checks.plays = (await pastAds(page)) ? await plays(page) : null;
      }
      if (Object.keys(checks).length) r.checks = checks;
    })()]);
  } catch (e) {
    r.error = (e as Error).message.split('\n')[0]!.slice(0, 200);
  } finally {
    clearTimeout(timer);
    await Promise.race([page.close().catch(() => {}), sleep(5000)]);
  }
  return r;
}

/** One whole run: every page in order. Stops early at a block, so a bot check isn't hammered. */
export async function audit(mode: Mode, extension: string, log: (line: string) => void): Promise<PageRun[]> {
  const run = await launch(mode, extension);
  const out: PageRun[] = [];
  try {
    for (const spec of pages) {
      if (spec.only && spec.only !== mode) continue;
      // The Shorts page needs a Short to swipe: the redirect is off for it alone.
      if (spec.kind === 'shorts') await run.set({ 'shorts-redirect': false });
      const r = await measure(run, spec, mode);
      if (spec.kind === 'shorts') await run.set({ 'shorts-redirect': true });
      out.push(r);
      log(describe(mode, r));
      if (r.blocked) break;
    }
  } finally {
    await run.close();
  }
  return out;
}

export function describe(mode: Mode, r: PageRun) {
  const who = mode === 'dtox' ? 'D-Tox   ' : 'Baseline';
  if (r.blocked) return `  ${who} ${r.page.padEnd(16)} BLOCKED: ${r.blocked}`;
  if (r.error) return `  ${who} ${r.page.padEnd(16)} ERROR: ${r.error}`;
  const checks = Object.entries(r.checks ?? {}).map(([k, v]) => `${k} ${v === null ? '–' : v ? '✓' : '✗'}`);
  if (r.playerWidth) checks.push(`player ${r.playerWidth}px`);
  if (r.endScreens !== undefined) checks.push(`end screens ${r.endScreens ?? '–'}`);
  return `  ${who} ${r.page.padEnd(16)} long tasks ${String(r.longTaskMs).padStart(5)} ms · style ${String(r.styleMs).padStart(4)} ms · idle +${r.idleGrowth} nodes${checks.length ? ' · ' + checks.join(' · ') : ''}`;
}
