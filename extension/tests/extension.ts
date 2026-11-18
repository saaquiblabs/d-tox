import { test as base, chromium, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import settings from '../../settings.json' with { type: 'json' };
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { savedPages } from './cases';

const dist = realpathSync(fileURLToPath(new URL('../dist', import.meta.url)));
const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url));

// Chrome derives an unpacked extension's id from its absolute path: the first 32 hex digits of
// its SHA-256, written with the letters a–p.
const extensionId = [...createHash('sha256').update(dist).digest('hex').slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16)))
  .join('');

/** Saved page served at each youtube.com URL: every page the cases name, plus any a test opens. */
type Served = Map<string, string>;

/** Which saved page answers a URL. Any other video's watch URL gets the saved watch page (that
 *  is where the Shorts redirect lands). Everything else is refused, so nothing is fetched. */
function fixtureFor(served: Served, href: string) {
  const url = new URL(href);
  return served.get(url.href) ?? (url.origin === 'https://www.youtube.com' && url.pathname === '/watch' ? 'watch.html' : undefined);
}

type Fixtures = {
  served: Served;
  context: BrowserContext;
  /**
   * Opens a saved page at its youtube.com URL. Nothing else is fetched. `init` runs in the page
   * before its markup does, to stand in for YouTube's own scripts or to watch the page load.
   */
  openSaved: <A>(fixture: string, url: string, init?: (arg: A) => void, arg?: A) => Promise<Page>;
  /** Opens the extension's popup in its own tab. */
  openPopup: () => Promise<Page>;
};

export const test = base.extend<Fixtures>({
  served: async ({}, use) => {
    await use(new Map(savedPages.map((p) => [p.url, p.fixture])));
  },
  context: async ({ served }, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    });
    await context.route((u) => u.protocol === 'https:' || u.protocol === 'http:', (route) => {
      const fixture = fixtureFor(served, route.request().url());
      if (!fixture) return route.abort();
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: readFileSync(fixtures + fixture, 'utf8') });
    });
    await use(context);
    await context.close();
  },
  openSaved: async ({ context, served }, use) => {
    await use(async (fixture, url, init, arg) => {
      served.set(url, fixture);
      const page = await context.newPage();
      if (init) await page.addInitScript(init as (arg: unknown) => void, arg);
      await page.goto(url);
      return page;
    });
  },
  openPopup: async ({ context }, use) => {
    await use(async () => {
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      return popup;
    });
  },
});

export { expect };

/** Writes Settings straight to storage from an extension page, without the popup's switches. */
export const store = (extensionPage: Page, values: Record<string, unknown>) =>
  extensionPage.evaluate((v) => chrome.storage.sync.set(v), values);

/**
 * Turns a popup switch on or off and waits until chrome.storage.sync holds it. The popup writes
 * storage asynchronously, so a page opened straight after a click could otherwise read the old
 * value.
 */
export async function turn(sw: Locator, on: boolean) {
  await sw.setChecked(on);
  const id = (await sw.getAttribute('id'))!;
  // Nothing is stored until a switch changes, so read with its default, as the extension does.
  const fallback = id === 'enabled' ? true : settings.find((s) => s.id === id)!.calmDefault;
  const read = (a: { k: string; d: unknown }) => chrome.storage.sync.get({ [a.k]: a.d }).then((v) => v[a.k]);
  await expect.poll(() => sw.page().evaluate(read, { k: id, d: fallback })).toBe(on);
}
