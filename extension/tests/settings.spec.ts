import { existsSync } from 'node:fs';
import settings from '../../settings.json' with { type: 'json' };
import { cases, pages, type PageName } from './cases';
import { expect, test } from './extension';
import type { Page } from '@playwright/test';

const settingSwitch = (popup: Page, name: string) => popup.getByRole('checkbox', { name, exact: true });
const masterSwitch = (popup: Page) => popup.getByRole('checkbox', { name: 'D-Tox is on' });

const groups = ['Home', 'Watch', 'Shorts', 'Search', 'Everywhere'];
const pageNames = Object.keys(pages) as PageName[];

/** Every switch off, so one Setting can be tested alone. */
const allOff = Object.fromEntries(settings.filter((s) => s.type === 'switch').map((s) => [s.id, false]));
const store = (popup: Page, values: Record<string, unknown>) =>
  popup.evaluate((v) => chrome.storage.sync.set(v), values);

test('every Setting in settings.json has the agreed shape', () => {
  const ids = new Set<string>();
  for (const s of settings as Record<string, unknown>[]) {
    expect(Object.keys(s).sort(), JSON.stringify(s)).toEqual(['calmDefault', 'group', 'hides', 'id', 'name', 'type']);
    expect(s.id, 'id: lowercase words joined by hyphens').toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(s.id).not.toBe('enabled'); // the master switch's storage key
    expect(ids.has(s.id as string), `duplicate id ${s.id}`).toBe(false);
    ids.add(s.id as string);
    expect(typeof s.name === 'string' && s.name.length > 0).toBe(true);
    expect(s.hides, 'hides: one line starting "Hides "').toMatch(/^Hides [^\n]+\.$/);
    expect(groups).toContain(s.group);
    expect(['switch', 'choice']).toContain(s.type);
    if (s.type === 'switch') expect(typeof s.calmDefault).toBe('boolean');
    else expect(typeof s.calmDefault).toBe('string');
  }
});

test('every saved page exists', () => {
  for (const name of pageNames) expect(existsSync(new URL(`./fixtures/${name}.html`, import.meta.url)), `missing tests/fixtures/${name}.html`).toBe(true);
});

for (const setting of settings) {
  test.describe(`${setting.name} (${setting.id})`, () => {
    const spots = cases[setting.id];

    test('has its cases', () => {
      expect(spots, `add "${setting.id}" to tests/cases.ts`).toBeDefined();
    });
    if (!spots || setting.type !== 'switch') return;

    // Hides only what it says, on every saved page: its Distractions on its own pages, and
    // nothing at all on any other page.
    for (const name of pageNames) {
      const spot = spots.find((s) => s.page === name);
      const title = spot ? `on the ${name} page it hides its Distractions and nothing else` : `hides nothing on the ${name} page`;
      test(title, async ({ openSaved, openPopup }) => {
        const popup = await openPopup();
        await store(popup, allOff);
        const page = await openSaved(name);
        for (const hidden of spot?.hides ?? []) await expect(page.locator(hidden).first(), `${hidden} is in the saved page`).toBeVisible();

        // Mark everything visible now, turn the Setting on, then look for marked things that went.
        await page.evaluate(() => {
          for (const el of document.body.querySelectorAll('*')) if (el.checkVisibility()) el.setAttribute('data-test-shown', '');
        });
        await store(popup, { [setting.id]: true });
        await page.waitForFunction((id) => document.documentElement.hasAttribute('data-dtox-' + id), setting.id);

        for (const hidden of spot?.hides ?? []) {
          for (const el of await page.locator(hidden).all()) await expect(el, `${hidden} is hidden`).toBeHidden();
        }
        for (const kept of spot?.keeps ?? []) {
          const all = await page.locator(kept).all();
          expect(all.length, `${kept} is in the saved page`).toBeGreaterThan(0);
          for (const el of all) await expect(el, `${kept} stays`).toBeVisible();
        }
        const wronglyHidden = await page.evaluate((allowed) => {
          const gone = [...document.querySelectorAll('[data-test-shown]')].filter(
            (el) => !el.checkVisibility() && !allowed.some((sel) => el.closest(sel)),
          );
          // Report only the outermost ones.
          return gone.filter((el) => !gone.includes(el.parentElement!)).slice(0, 5).map((el) => el.outerHTML.slice(0, 160));
        }, spot?.hides ?? []);
        expect(wronglyHidden, 'hidden but not one of its Distractions').toEqual([]);
      });
    }

    const main = spots[0];
    if (!main) return;
    const distractionOn = (page: Page) => page.locator(main.hides[0]!).first();

    test('the page starts on the Calm Default', async ({ openSaved }) => {
      const page = await openSaved(main.page);
      if (setting.calmDefault) await expect(distractionOn(page)).toBeHidden();
      else await expect(distractionOn(page)).toBeVisible();
    });

    test('switching it on and off in the popup applies to the open tab without a reload', async ({ openSaved, openPopup }) => {
      const page = await openSaved(main.page);
      await page.evaluate(() => ((window as any).notReloaded = true));
      const popup = await openPopup();
      const switchEl = settingSwitch(popup, setting.name);
      const distraction = distractionOn(page);

      await switchEl.check();
      await expect(distraction).toBeHidden();
      await switchEl.uncheck();
      await expect(distraction).toBeVisible();
      expect(await page.evaluate(() => (window as any).notReloaded)).toBe(true);
    });

    test('is hidden from the first load when on', async ({ openSaved, openPopup }) => {
      const popup = await openPopup();
      await settingSwitch(popup, setting.name).check();
      const page = await openSaved(main.page);
      await expect(distractionOn(page)).toBeHidden();
    });

    test('the master switch turns it off everywhere at once', async ({ openSaved, openPopup }) => {
      const page = await openSaved(main.page);
      const popup = await openPopup();
      await settingSwitch(popup, setting.name).check();
      const distraction = distractionOn(page);
      await expect(distraction).toBeHidden();

      await masterSwitch(popup).uncheck();
      await expect(distraction).toBeVisible();
      await masterSwitch(popup).check();
      await expect(distraction).toBeHidden();
    });
  });
}
