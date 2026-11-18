import { existsSync } from 'node:fs';
import settings from '../../settings.json' with { type: 'json' };
import { cases } from './cases';
import { expect, test, turn } from './extension';
import type { Page } from '@playwright/test';

const settingSwitch = (popup: Page, name: string) => popup.getByRole('checkbox', { name, exact: true });
const masterSwitch = (popup: Page) => popup.getByRole('checkbox', { name: 'D-Tox is on' });

const groups = ['Home', 'Watch', 'Shorts', 'Search', 'Everywhere'];

test('every Setting in settings.json has the agreed shape', () => {
  const ids = new Set<string>();
  for (const s of settings as Record<string, unknown>[]) {
    expect(Object.keys(s).sort(), JSON.stringify(s)).toEqual(['calmDefault', 'group', 'hides', 'id', 'name', 'type']);
    expect(s.id, 'id: lowercase words joined by hyphens').toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(s.id).not.toBe('enabled'); // the master switch's storage key
    expect(ids.has(s.id as string), `duplicate id ${s.id}`).toBe(false);
    ids.add(s.id as string);
    expect(typeof s.name === 'string' && s.name.length > 0).toBe(true);
    // A Setting that changes a behaviour (autoplay) says what it turns, not what it hides.
    expect(s.hides, 'hides: one line starting "Hides " or "Turns "').toMatch(/^(Hides|Turns) [^\n]+\.$/);
    expect(groups).toContain(s.group);
    expect(['switch', 'choice']).toContain(s.type);
    if (s.type === 'switch') expect(typeof s.calmDefault).toBe('boolean');
    else expect(typeof s.calmDefault).toBe('string');
  }
});

for (const setting of settings) {
  test.describe(`${setting.name} (${setting.id})`, () => {
    const c = cases[setting.id];

    test('has a saved page to test against', () => {
      expect(c, `add "${setting.id}" to tests/cases.ts`).toBeDefined();
      for (const page of [c!, ...('elsewhere' in c! ? (c.elsewhere ?? []) : [])])
        expect(existsSync(new URL(`./fixtures/${page.fixture}`, import.meta.url)), `missing tests/fixtures/${page.fixture}`).toBe(true);
      if ('spec' in c!) expect(existsSync(new URL(`./${c.spec}`, import.meta.url)), `missing tests/${c.spec}`).toBe(true);
    });
    if (!c || 'spec' in c || setting.type !== 'switch') return;
    /** Checks every Distraction in the case is hidden (true) or visible (false). */
    const distractionsHidden = async (page: Page, hidden: boolean) => {
      for (const d of c.distractions) {
        const el = expect(page.locator(d).first(), d);
        await (hidden ? el.toBeHidden() : el.toBeVisible());
      }
    };

    test('the page starts on the Calm Default', async ({ openSaved }) => {
      const page = await openSaved(c.fixture, c.url);
      await distractionsHidden(page, setting.calmDefault === true);
    });

    if (setting.calmDefault) {
      // toBeHidden() retries, so it can't see a flash. This records whether the Distraction
      // could be seen at the moment YouTube's markup first put it on the page.
      test('never shows, not even while the page loads', async ({ openSaved }) => {
        const page = await openSaved(c.fixture, c.url, (selectors) => {
          const w = window as any;
          w.firstSeen = {};
          const observer = new MutationObserver(() => {
            for (const s of selectors) {
              const el = document.querySelector(s);
              if (el && !(s in w.firstSeen)) w.firstSeen[s] = el.checkVisibility();
            }
          });
          observer.observe(document, { childList: true, subtree: true });
        }, c.distractions);
        expect(await page.evaluate(() => (window as any).firstSeen)).toEqual(Object.fromEntries(c.distractions.map((d) => [d, false])));
      });
    }

    test('switching it on and off in the popup applies to the open tab without a reload', async ({ openSaved, openPopup }) => {
      const page = await openSaved(c.fixture, c.url);
      await page.evaluate(() => ((window as any).notReloaded = true));
      const popup = await openPopup();
      const switchEl = settingSwitch(popup, setting.name);

      await turn(switchEl, true);
      await distractionsHidden(page, true);
      for (const kept of c.keeps) await expect(page.locator(kept).first(), `${kept} stays`).toBeVisible();

      await turn(switchEl, false);
      await distractionsHidden(page, false);
      expect(await page.evaluate(() => (window as any).notReloaded)).toBe(true);
    });

    for (const other of c.elsewhere ?? []) {
      test(`leaves the rest of ${other.fixture} alone`, async ({ openSaved, openPopup }) => {
        const popup = await openPopup();
        await turn(settingSwitch(popup, setting.name), true);
        const page = await openSaved(other.fixture, other.url);
        for (const kept of other.keeps) await expect(page.locator(kept).first(), `${kept} stays`).toBeVisible();
      });
    }

    test('is hidden from the first load when on', async ({ openSaved, openPopup }) => {
      const popup = await openPopup();
      await turn(settingSwitch(popup, setting.name), true);
      const page = await openSaved(c.fixture, c.url);
      await distractionsHidden(page, true);
    });

    test('the master switch turns it off everywhere at once', async ({ openSaved, openPopup }) => {
      const page = await openSaved(c.fixture, c.url);
      const popup = await openPopup();
      await turn(settingSwitch(popup, setting.name), true);
      await distractionsHidden(page, true);

      await turn(masterSwitch(popup), false);
      await distractionsHidden(page, false);
      await turn(masterSwitch(popup), true);
      await distractionsHidden(page, true);
    });
  });
}
