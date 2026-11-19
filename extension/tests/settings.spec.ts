import { existsSync } from 'node:fs';
import settings from '../../settings.json' with { type: 'json' };
import { cases, pagesOf, savedPages } from './cases';
import { expect, store, test, turn } from './extension';
import type { Page } from '@playwright/test';

const settingSwitch = (popup: Page, name: string) => popup.getByRole('checkbox', { name, exact: true });
const masterSwitch = (popup: Page) => popup.getByRole('checkbox', { name: 'D-Tox is on' });

const groups = ['Home', 'Watch', 'Shorts', 'Search', 'Everywhere'];

/** Every switch off and every choice on YouTube's default, so one Setting can be tested alone. */
const allOff = Object.fromEntries(settings.map((s) => [s.id, s.type === 'switch' ? false : 'default']));

test('every Setting in settings.json has the agreed shape', () => {
  const ids = new Set<string>();
  for (const s of settings as Record<string, unknown>[]) {
    const keys = ['calmDefault', 'group', 'hides', 'id', 'name', 'type'];
    // A choice lists its values; 'default' is YouTube's own, which the content script treats as off.
    if (s.type === 'choice') keys.push('choices');
    expect(Object.keys(s).sort(), JSON.stringify(s)).toEqual(keys.sort());
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
    else {
      const choices = (s.choices as { id: string; name: string }[]).map((c) => c.id);
      expect(choices).toContain('default');
      // A choice that starts on YouTube's default is out of the Calm Default: calmDefault false.
      expect([false, ...choices.filter((c) => c !== 'default')]).toContain(s.calmDefault);
    }
  }
});

for (const setting of settings) {
  test.describe(`${setting.name} (${setting.id})`, () => {
    const c = cases[setting.id];

    test('has a saved page to test against', () => {
      expect(c, `add "${setting.id}" to tests/cases.ts`).toBeDefined();
      for (const page of pagesOf(c!))
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

    // Checks this Setting's own attribute, not only what is visible: another Setting in the
    // Calm Default can hide the same thing (Shorts hides the search page's Shorts shelf).
    test('the page starts on the Calm Default', async ({ openSaved }) => {
      const page = await openSaved(c.fixture, c.url);
      const html = expect(page.locator('html'));
      if (setting.calmDefault) {
        await html.toHaveAttribute('data-dtox-' + setting.id);
        await distractionsHidden(page, true);
      } else {
        await html.not.toHaveAttribute('data-dtox-' + setting.id);
      }
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
      // Every other Setting off, so none of them hides this one's Distractions too.
      const popup = await openPopup();
      await store(popup, allOff);
      await popup.reload();
      const page = await openSaved(c.fixture, c.url);
      await page.evaluate(() => ((window as any).notReloaded = true));
      const switchEl = settingSwitch(popup, setting.name);

      await turn(switchEl, true);
      await distractionsHidden(page, true);
      for (const kept of c.keeps) await expect(page.locator(kept).first(), `${kept} stays`).toBeVisible();

      await turn(switchEl, false);
      await distractionsHidden(page, false);
      expect(await page.evaluate(() => (window as any).notReloaded)).toBe(true);
    });

    // Hides only what it says, on every saved page: its Distractions wherever they are (and the
    // element a rule hides around them, such as the list that holds them), and nothing else.
    const allDistractions = pagesOf(c).flatMap((p) => ('distractions' in p ? (p.distractions ?? []) : []));
    for (const saved of savedPages) {
      const spot = pagesOf(c).find((p) => p.fixture === saved.fixture);
      const distractions = spot && 'distractions' in spot ? (spot.distractions ?? []) : [];
      const title = distractions.length ? `on ${saved.fixture} it hides its Distractions and nothing else` : `hides nothing on ${saved.fixture}`;
      test(title, async ({ openSaved, openPopup }) => {
        const popup = await openPopup();
        await store(popup, allOff);
        const page = await openSaved(saved.fixture, saved.url);
        await page.waitForFunction(() => ![...document.documentElement.attributes].some((a) => a.name.startsWith('data-dtox-')));
        for (const d of distractions) await expect(page.locator(d).first(), `${d} is in the saved page`).toBeVisible();

        // Mark everything visible now, turn the Setting on, then look for marked things that went.
        await page.evaluate(() => {
          for (const el of document.body.querySelectorAll('*')) if (el.checkVisibility()) el.setAttribute('data-test-shown', '');
        });
        await store(popup, { [setting.id]: true });
        await expect(page.locator('html')).toHaveAttribute('data-dtox-' + setting.id);

        for (const d of distractions) {
          for (const el of await page.locator(d).all()) await expect(el, `${d} is hidden`).toBeHidden();
        }
        for (const kept of spot && 'keeps' in spot ? spot.keeps : []) {
          const all = await page.locator(kept).all();
          expect(all.length, `${kept} is in the saved page`).toBeGreaterThan(0);
          for (const el of all) await expect(el, `${kept} stays`).toBeVisible();
        }
        const wronglyHidden = await page.evaluate((allowed) => {
          // A hidden element is allowed if it, or a hidden element around it, is a Distraction
          // or holds one (a rule may hide the list around its items).
          const isAllowed = (el: Element) => {
            for (let e: Element | null = el; e && !e.checkVisibility(); e = e.parentElement)
              if (allowed.some((sel) => e!.matches(sel) || e!.querySelector(sel))) return true;
            return allowed.some((sel) => el.closest(sel));
          };
          const gone = [...document.querySelectorAll('[data-test-shown]')].filter((el) => !el.checkVisibility() && !isAllowed(el));
          // Report only the outermost ones.
          return gone.filter((el) => !gone.includes(el.parentElement!)).slice(0, 5).map((el) => el.outerHTML.slice(0, 160));
        }, allDistractions);
        expect(wronglyHidden, 'hidden but not one of its Distractions').toEqual([]);
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
