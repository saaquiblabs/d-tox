// The popup (#23): a tab per group, a row per Setting with its hint and its full "hides" line
// behind "?", the count, the footer, both system themes, and an accessibility audit.
import AxeBuilder from '@axe-core/playwright';
import settings from '../../settings.json' with { type: 'json' };
import { expect, masterSwitch, settingSwitch, test, turn } from './extension';
import type { Page } from '@playwright/test';

const groups = [...new Set(settings.map((s) => s.group))];
const calmCount = settings.filter((s) => s.calmDefault === true || typeof s.calmDefault === 'string').length;

/** Ready once storage has answered and the rows are built. */
const ready = async (popup: Page) => {
  await expect(masterSwitch(popup)).toBeEnabled();
  await expect(popup.getByRole('tab')).toHaveCount(groups.length);
};

test('a tab per group, each holding its Settings with name and hint', async ({ openPopup }) => {
  const popup = await openPopup();
  await ready(popup);
  await expect(popup.getByRole('tab')).toHaveText(groups);
  for (const g of groups) {
    await popup.getByRole('tab', { name: g, exact: true }).click();
    const panel = popup.getByRole('tabpanel');
    await expect(panel).toHaveCount(1);
    await expect(panel).toHaveAccessibleName(g);
    for (const s of settings.filter((x) => x.group === g)) {
      // A choice (Home) shows its hint as the question, then each choice with its own line.
      for (const text of [s.hint, ...(s.choices ? s.choices.flatMap((c) => [c.name, c.hint]) : [s.name])])
        await expect(panel.getByText(text, { exact: true })).toBeVisible();
    }
  }
});

test('"i" shows the full line, and every switch is described by it', async ({ openPopup }) => {
  const popup = await openPopup();
  await ready(popup);
  for (const s of settings.filter((x) => x.type === 'switch')) {
    await popup.getByRole('tab', { name: s.group, exact: true }).click();
    const more = popup.getByRole('button', { name: 'More about ' + s.name });
    const line = popup.getByText(s.hides, { exact: true });
    await expect(line).toBeHidden();
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(line).toBeVisible();
    await expect(popup.getByRole('switch', { name: s.name, exact: true })).toHaveAccessibleDescription(s.hides);
  }
});

test('the count follows the switches and the master switch', async ({ openPopup }) => {
  const popup = await openPopup();
  await ready(popup);
  const status = popup.locator('#status');
  const ticksOn = popup.locator('.ticks i.on');
  await expect(status).toHaveText(`${calmCount}of ${settings.length} switches onThe Calm Default`);
  await expect(ticksOn).toHaveCount(calmCount);
  await expect(popup.getByRole('tab', { name: 'Search' })).not.toHaveClass(/dot/);

  await turn(await settingSwitch(popup, 'Clean up search'), true);
  await expect(status).toHaveText(`${calmCount + 1}of ${settings.length} switches onYour own mix`);
  await expect(ticksOn).toHaveCount(calmCount + 1);
  await expect(popup.getByRole('tab', { name: 'Search' })).toHaveClass(/dot/);

  await turn(masterSwitch(popup), false);
  await expect(status).toHaveText('PausedYouTube shows everythingYour choices are kept');
  await popup.reload();
  await ready(popup);
  await expect(masterSwitch(popup)).not.toBeChecked();
  await expect(await settingSwitch(popup, 'Clean up search')).toBeChecked();
});

test('arrow keys move between tabs', async ({ openPopup }) => {
  const popup = await openPopup();
  await ready(popup);
  await popup.getByRole('tab', { name: 'Home' }).focus();
  await popup.keyboard.press('ArrowRight');
  await expect(popup.getByRole('tab', { name: 'Videos' })).toBeFocused();
  await expect(popup.getByRole('tab', { name: 'Videos' })).toHaveAttribute('aria-selected', 'true');
  await popup.keyboard.press('ArrowLeft');
  await popup.keyboard.press('ArrowLeft');
  await expect(popup.getByRole('tab', { name: 'Everywhere' })).toBeFocused();
  // Tab goes from the tabs into the open panel.
  await popup.keyboard.press('Tab');
  await expect(popup.getByRole('button', { name: 'More about Hide Explore and Trending' })).toBeFocused();
});

test("the footer links to Privacy, What's new (our changelog) and Sponsor, with the version", async ({ openPopup }) => {
  const popup = await openPopup();
  await ready(popup);
  const footer = popup.locator('footer');
  await expect(footer.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', 'https://d-tox.saaquiblabs.com/privacy');
  await expect(footer.getByRole('link', { name: 'What’s new' })).toHaveAttribute('href', 'https://d-tox.saaquiblabs.com/changelog');
  await expect(footer.getByRole('link', { name: 'Sponsor' })).toHaveAttribute('href', 'https://github.com/sponsors/saaquiblabs');
  await expect(footer).toContainText(/v\d+\.\d+\.\d+/);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`follows the system's ${scheme} theme and passes an accessibility audit`, async ({ openPopup }) => {
    const popup = await openPopup();
    await popup.emulateMedia({ colorScheme: scheme });
    await ready(popup);
    await expect(popup.locator('body')).toHaveCSS('background-color', scheme === 'light' ? 'rgb(238, 242, 240)' : 'rgb(7, 12, 10)');
    for (const g of groups) {
      await popup.getByRole('tab', { name: g, exact: true }).click();
      for (const more of await popup.getByRole('tabpanel').getByRole('button', { name: /^More about/ }).all()) await more.click();
      await expect(popup.locator('body')).toHaveClass(/ready/); // transitions on, as a person sees it
      const { violations } = await new AxeBuilder({ page: popup }).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`), `${g} tab`).toEqual([]);
    }
    // And with D-Tox off (the Settings fade).
    await turn(masterSwitch(popup), false);
    const { violations } = await new AxeBuilder({ page: popup }).analyze();
    expect(violations.map((v) => v.id), 'D-Tox off').toEqual([]);
  });
}
