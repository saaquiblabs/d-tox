// Checks Settings against live YouTube. Chromium loads a stripped-down D-Tox: only
// extension/src/hide.css, injected by Chrome at document_start exactly as the real extension
// does. For each Setting the check finds the Distraction with D-Tox off, then puts the Setting's
// attribute on <html> (what content.ts does) and expects the Distraction to disappear.
// Video and images are never fetched, so nothing plays.
import { chromium, type BrowserContext, type Page } from 'playwright';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Case } from '../../extension/tests/cases.ts';
import type { Result } from './issues.ts';

export type Language = { name: string; hl: string; locale: string };
export type Setting = { id: string; name: string; type: string };
export type Options = { revealTries?: number; settleMs?: number; hideTimeoutMs?: number; tries?: number };

export const languages: Language[] = [
  { name: 'English', hl: 'en', locale: 'en-US' },
  { name: 'Hindi', hl: 'hi', locale: 'hi-IN' },
];

/** Media, images and ads: aborted so no video plays and the check stays light. */
const blocked = /googlevideo\.com|\/ytimg|ggpht\.com|doubleclick|googlesyndication|\.(jpg|jpeg|png|webp|gif|mp4|webm)(\?|$)/;

/** Proves the stylesheet loaded: without it every Setting would look broken. */
const probe = 'html[data-dtox-nightly-probe] { --dtox-nightly-probe: 1; }';

export async function launch(language: Language, hideCss: string): Promise<BrowserContext> {
  const ext = await mkdtemp(join(tmpdir(), 'dtox-nightly-'));
  await writeFile(join(ext, 'hide.css'), `${hideCss}\n${probe}\n`);
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
  const playability = await page.evaluate(() => (window as any).ytInitialPlayerResponse?.playabilityStatus);
  if (playability?.status === 'LOGIN_REQUIRED') return `bot check on the watch page: “${playability.reason ?? 'sign in'}”`;
  const lang = await page.evaluate(() => document.documentElement.lang);
  if (!lang.toLowerCase().startsWith(language.hl)) return `YouTube answered in “${lang}”, not ${language.name}`;
  return null;
}

/** Scrolls until the Distraction shows (comments and others load lazily). */
async function reveal(page: Page, selector: string, tries: number, settleMs: number) {
  const distraction = page.locator(selector).first();
  for (let i = 0; i < tries; i++) {
    await page.evaluate(() => document.querySelector('video')?.pause());
    if (await distraction.isVisible()) return true;
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(settleMs);
  }
  return distraction.isVisible();
}

async function setAttribute(page: Page, name: string, on: boolean) {
  await page.evaluate(([n, o]) => (o ? document.documentElement.setAttribute(n!, '') : document.documentElement.removeAttribute(n!)), [
    name,
    on ? '1' : '',
  ] as const);
}

type Outcome = { blocked: string } | { problem: string } | { ok: true };

async function checkOnce(context: BrowserContext, language: Language, setting: Setting, c: Case, o: Required<Options>): Promise<Outcome> {
  const page = await context.newPage();
  try {
    try {
      await page.goto(withHl(c.url, language.hl), { waitUntil: 'domcontentloaded', timeout: 45_000 });
    } catch (e) {
      return { blocked: `YouTube did not load ${c.url}: ${(e as Error).message.split('\n')[0]}` };
    }
    const why = await blockedReason(page, language);
    if (why) return { blocked: why };

    await setAttribute(page, 'data-dtox-nightly-probe', true);
    const loaded = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dtox-nightly-probe').trim());
    if (loaded !== '1') throw new Error('the check is broken: Chrome did not apply hide.css to the page');

    if (!(await reveal(page, c.distraction, o.revealTries, o.settleMs)))
      return { problem: `not found: nothing visible matches \`${c.distraction}\` on ${c.url} with D-Tox off` };

    await setAttribute(page, `data-dtox-${setting.id}`, true);
    const hidden = await page
      .locator(c.distraction)
      .first()
      .waitFor({ state: 'hidden', timeout: o.hideTimeoutMs })
      .then(() => true, () => false);
    if (!hidden) return { problem: `still visible: \`${c.distraction}\` shows on ${c.url} with the Setting on` };
    return { ok: true };
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
    if (setting.type !== 'switch') {
      lines.push(`  -  ${label}: skipped, choice Settings have no live check yet`);
      continue;
    }
    let outcome = await checkOnce(context, language, setting, c, o);
    for (let i = 1; i < o.tries && !('ok' in outcome); i++) outcome = await checkOnce(context, language, setting, c, o);

    if ('blocked' in outcome) {
      results.push({ kind: 'blocked', language: language.name, problem: outcome.blocked });
      lines.push(`  ✗  BLOCKED in ${language.name}: ${outcome.blocked}. No Setting was checked in ${language.name}.`);
      return { results, lines };
    }
    if ('problem' in outcome) {
      results.push({ kind: 'setting', setting, language: language.name, problem: outcome.problem });
      lines.push(`  ✗  ${label}: ${outcome.problem}`);
    } else lines.push(`  ✓  ${label}`);
  }
  return { results, lines };
}
