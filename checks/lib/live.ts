// Checks Settings against live YouTube. Chromium loads a stripped-down D-Tox: only
// its stylesheets (extension/src/*.css), injected by Chrome at document_start exactly as the real extension
// does. For each Setting the check finds each of its Distractions in the page with D-Tox off,
// then puts the Setting's attribute on <html> (what content.ts does) and expects a hide rule to
// match it. Matching, not visibility: end screens only show when a video ends, and no video plays.
// Video and images are never fetched, so nothing plays.
import { chromium, type BrowserContext, type Page } from 'playwright';
import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Case, Hides } from '../../extension/tests/cases.ts';
import type { Result } from './issues.ts';

export type Language = { name: string; hl: string; locale: string };
export type Setting = { id: string; name: string; type: string; calmDefault: boolean | string };
export type Options = { revealTries?: number; settleMs?: number; hideTimeoutMs?: number; tries?: number };

export const languages: Language[] = [
  { name: 'English', hl: 'en', locale: 'en-US' },
  { name: 'Hindi', hl: 'hi', locale: 'hi-IN' },
];

/** Media, images and ads: aborted so no video plays and the check stays light. */
const blocked = /googlevideo\.com|\/ytimg|ggpht\.com|doubleclick|googlesyndication|\.(jpg|jpeg|png|webp|gif|mp4|webm)(\?|$)/;

/** Every stylesheet the extension injects, joined: the .css files at the top of extension/src (the popup's is in src/popup/). */
export async function readStylesheets() {
  const src = new URL('../../extension/src/', import.meta.url);
  const sheets = (await readdir(src)).filter((f) => f.endsWith('.css')).sort();
  return (await Promise.all(sheets.map((f) => readFile(new URL(f, src), 'utf8')))).join('\n');
}

/** Proves the stylesheet loaded: without it every Setting would look broken. */
const probe = 'html[data-dtox-nightly-probe] { --dtox-nightly-probe: 1; }';

/**
 * Marks every hide rule. A custom property is inherited, so an element hidden by a rule on it or
 * on an ancestor carries the mark, whether or not YouTube was showing it.
 */
const hiddenMark = '--dtox-nightly-hidden';
export function markHideRules(css: string) {
  const marked = css.replace(/display\s*:\s*none\s*!important\s*;?/g, `display: none !important; ${hiddenMark}: 1;`);
  if (marked === css) throw new Error('the check is broken: the stylesheets have no `display: none !important` rule to mark');
  return marked;
}

export async function launch(language: Language, hideCss: string): Promise<BrowserContext> {
  const ext = await mkdtemp(join(tmpdir(), 'dtox-nightly-'));
  await writeFile(join(ext, 'hide.css'), `${markHideRules(hideCss)}\n${probe}\n`);
  await writeFile(
    join(ext, 'manifest.json'),
    JSON.stringify({
      manifest_version: 3,
      name: 'D-Tox nightly check',
      version: '0',
      content_scripts: [{ matches: ['https://www.youtube.com/*'], run_at: 'document_start', css: ['hide.css'] }],
    }),
  );
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    locale: language.locale,
    viewport: { width: 1280, height: 900 },
    args: [
      `--disable-extensions-except=${ext}`,
      `--load-extension=${ext}`,
      '--disable-dev-shm-usage', // Docker's 64 MB /dev/shm crashes Chrome (saaquiblabs ADR 0014)
      '--mute-audio',
      '--autoplay-policy=user-gesture-required',
    ],
  });
  await context.route(blocked, (route) => route.abort());
  return context;
}

const withHl = (url: string, hl: string) => {
  const u = new URL(url);
  u.searchParams.set('hl', hl);
  return u.toString();
};

/** Why this page can't be checked (bot check, consent, wrong language), or null if it can. */
async function blockedReason(page: Page, language: Language): Promise<string | null> {
  // Wait for YouTube's app, or for the page to leave YouTube (a consent or bot-check redirect).
  let app = false;
  for (const end = Date.now() + 30_000; Date.now() < end; await page.waitForTimeout(250)) {
    if (new URL(page.url()).hostname !== 'www.youtube.com') break;
    app = await page.locator('ytd-app').count().then((n) => n > 0, () => false);
    if (app) break;
  }
  const url = new URL(page.url());
  if (url.hostname.startsWith('consent.')) return `consent page at ${page.url()}`;
  if (url.pathname.startsWith('/sorry')) return `bot check at ${page.url()}`;
  if (url.hostname !== 'www.youtube.com') return `sent away from YouTube to ${page.url()}`;
  if (!app) return `no YouTube app on ${page.url()} (a bot check or an error page)`;
  const lang = await page.evaluate(() => document.documentElement.lang);
  if (!lang.toLowerCase().startsWith(language.hl)) return `YouTube answered in “${lang}”, not ${language.name}`;
  return null;
}

/** Scrolls until every Distraction is in the page (comments and others load lazily); returns the missing ones. */
async function reveal(page: Page, selectors: string[], tries: number, settleMs: number) {
  const missing = async () => {
    const out: string[] = [];
    for (const s of selectors) if ((await page.locator(s).count()) === 0) out.push(s);
    return out;
  };
  for (let i = 0; i < tries; i++) {
    await page.evaluate(() => document.querySelector('video')?.pause());
    if ((await missing()).length === 0) return [];
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(settleMs);
  }
  return missing();
}

/** The Distractions no hide rule matches (one YouTube has since removed counts as unmatched). */
async function unmatched(page: Page, selectors: string[]) {
  return page.evaluate(
    ([sels, mark]) =>
      sels.filter((s) => {
        const el = document.querySelector(s);
        return !el || getComputedStyle(el).getPropertyValue(mark).trim() !== '1';
      }),
    [selectors, hiddenMark] as const,
  );
}

async function setAttribute(page: Page, name: string, value = '') {
  await page.evaluate(([n, v]) => document.documentElement.setAttribute(n, v), [name, value] as const);
}

type Outcome = { blocked: string } | { problem: string } | { ok: true; note?: string };

/**
 * The player's own bot check ("Sign in to confirm you're not a bot"). YouTube shows it to
 * datacenter addresses such as the VPS, but only the video is refused: the page still renders,
 * and the check plays no video. So it blocks the check only if a Distraction is then missing.
 */
async function playerBotCheck(page: Page) {
  const p = await page.evaluate(() => (window as any).ytInitialPlayerResponse?.playabilityStatus);
  return p?.status === 'LOGIN_REQUIRED' ? `the player's bot check (“${p.reason ?? 'sign in'}”)` : null;
}

/** The Distractions the check can find without playing a video. */
const checkable = (c: Hides) => c.distractions.filter((s) => !c.needs?.[s]);
/** What the unchecked Distractions need, e.g. "a playing video". */
const needed = (c: Hides) => [...new Set(Object.values(c.needs ?? {}))].join(' or ');

async function checkOnce(context: BrowserContext, language: Language, setting: Setting, c: Hides, o: Required<Options>): Promise<Outcome> {
  const url = c.liveUrl ?? c.url;
  const page = await context.newPage();
  if (c.width) await page.setViewportSize({ width: c.width, height: 900 });
  try {
    try {
      await page.goto(withHl(url, language.hl), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    } catch (e) {
      return { blocked: `YouTube did not load ${url}: ${(e as Error).message.split('\n')[0]}` };
    }
    const why = await blockedReason(page, language);
    if (why) return { blocked: why };

    await setAttribute(page, 'data-dtox-nightly-probe');
    const loaded = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dtox-nightly-probe').trim());
    if (loaded !== '1') throw new Error('the check is broken: Chrome did not apply the stylesheets to the page');

    const list = (sels: string[]) => sels.map((s) => `\`${s}\``).join(', ');
    const distractions = checkable(c);
    const missing = await reveal(page, distractions, o.revealTries, o.settleMs);
    const botCheck = await playerBotCheck(page);
    if (missing.length && botCheck) return { blocked: `${botCheck} on ${url}, and ${list(missing)} did not render` };
    if (missing.length) return { problem: `not found: nothing matches ${list(missing)} on ${url}` };

    if ((await unmatched(page, distractions)).length < distractions.length)
      throw new Error('the check is broken: a Distraction is marked hidden with every Setting off');
    // A choice (Home) is checked on its Calm Default value, as content.ts would set it.
    await setAttribute(page, `data-dtox-${setting.id}`, typeof setting.calmDefault === 'string' ? setting.calmDefault : '');
    let left = await unmatched(page, distractions);
    for (const end = Date.now() + o.hideTimeoutMs; left.length && Date.now() < end; left = await unmatched(page, distractions))
      await page.waitForTimeout(100);
    if (left.length) return { problem: `still visible: no hide rule matches ${list(left)} on ${url} with the Setting on` };
    return botCheck ? { ok: true, note: `${botCheck} refused the video; the page rendered and nothing here needs it` } : { ok: true };
  } finally {
    await page.close();
  }
}

/**
 * Checks every Setting in one language. A Setting gets a second try before it counts as broken.
 * If YouTube blocks the check, it stops: the rest can't be checked, and none of them passed.
 */
export async function checkLanguage(
  context: BrowserContext,
  language: Language,
  settings: Setting[],
  cases: Record<string, Case>,
  options: Options = {},
) {
  const o = { revealTries: 10, settleMs: 1500, hideTimeoutMs: 5000, tries: 2, ...options };
  const results: Result[] = [];
  const lines: string[] = [];
  for (const setting of settings) {
    const label = `${setting.name} (${setting.id}), ${language.name}`;
    const c = cases[setting.id];
    if (!c) {
      const problem = `no case: add "${setting.id}" to extension/tests/cases.ts`;
      results.push({ kind: 'setting', setting, language: language.name, problem });
      lines.push(`  ✗  ${label}: ${problem}`);
      continue;
    }
    if (!('distractions' in c)) {
      lines.push(`  -  ${label}: skipped, it changes a behaviour (tested in extension/tests/${c.spec})`);
      continue;
    }
    if (checkable(c).length === 0) {
      lines.push(`  -  ${label}: skipped, its Distractions need ${needed(c)} (tested on saved pages)`);
      continue;
    }
    // A block on any try wins over a later problem: a half-loaded retry must not blame the Setting.
    let outcome = await checkOnce(context, language, setting, c, o);
    for (let i = 1; i < o.tries && !('ok' in outcome); i++) {
      const next = await checkOnce(context, language, setting, c, o);
      if (!('blocked' in outcome) || 'ok' in next) outcome = next;
    }

    if ('blocked' in outcome) {
      results.push({ kind: 'blocked', language: language.name, problem: outcome.blocked });
      lines.push(`  ✗  BLOCKED in ${language.name}: ${outcome.blocked}. No Setting was checked in ${language.name}.`);
      return { results, lines };
    }
    if ('problem' in outcome) {
      results.push({ kind: 'setting', setting, language: language.name, problem: outcome.problem });
      lines.push(`  ✗  ${label}: ${outcome.problem}`);
    } else {
      const unchecked = c.distractions.length - checkable(c).length;
      lines.push(`  ✓  ${label}${unchecked ? ` (${unchecked} of ${c.distractions.length} Distractions need ${needed(c)}: not checked)` : ''}`);
      if (outcome.note) lines.push(`       note: ${outcome.note}`);
    }
  }
  return { results, lines };
}
