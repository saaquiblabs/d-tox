import { existsSync } from 'node:fs';
import settings from '../../settings.json' with { type: 'json' };
import { cases } from './cases';
import { expect, test } from './extension';

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
    expect(s.hides, 'hides: one line starting "Hides "').toMatch(/^Hides [^\n]+\.$/);
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
      expect(existsSync(new URL(`./fixtures/${c!.fixture}`, import.meta.url)), `missing tests/fixtures/${c!.fixture}`).toBe(true);
    });
    if (!c || setting.type !== 'switch') return;

    test('the page starts on the Calm Default', async ({ openSaved }) => {
      const page = await openSaved(c.fixture, c.url);
      const distraction = page.locator(c.distraction).first();
      if (setting.calmDefault) await expect(distraction).toBeHidden();
      else await expect(distraction).toBeVisible();
    });

    test('switching it on and off in the popup applies to the open tab without a reload', async ({ openSaved, openPopup }) => {
      const page = await openSaved(c.fixture, c.url);
      await page.evaluate(() => ((window as any).notReloaded = true));
      const popup = await openPopup();
      const toggle = popup.getByRole('checkbox', { name: setting.name, exact: true });
      const distraction = page.locator(c.distraction).first();

      await toggle.check();
      await expect(distraction).toBeHidden();
      for (const kept of c.keeps) await expect(page.locator(kept).first(), `${kept} stays`).toBeVisible();

      await toggle.uncheck();
      await expect(distraction).toBeVisible();
      expect(await page.evaluate(() => (window as any).notReloaded)).toBe(true);
    });

    test('is hidden from the first load when on', async ({ openSaved, openPopup }) => {
      const popup = await openPopup();
      await popup.getByRole('checkbox', { name: setting.name, exact: true }).check();
      const page = await openSaved(c.fixture, c.url);
      await expect(page.locator(c.distraction).first()).toBeHidden();
    });

    test('the master switch turns it off everywhere at once', async ({ openSaved, openPopup }) => {
      const page = await openSaved(c.fixture, c.url);
      const popup = await openPopup();
      await popup.getByRole('checkbox', { name: setting.name, exact: true }).check();
      const distraction = page.locator(c.distraction).first();
      await expect(distraction).toBeHidden();

      await popup.getByRole('checkbox', { name: 'D-Tox is on' }).uncheck();
      await expect(distraction).toBeVisible();
      await popup.getByRole('checkbox', { name: 'D-Tox is on' }).check();
      await expect(distraction).toBeHidden();
    });
  });
}
