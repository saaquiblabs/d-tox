// The popup (#23): a tab per group, a row per Setting with its hint and its full "hides" line
// behind "i", the count, finding a switch, the paused toolbar icon, reduced motion, the footer,
// both system themes, and an accessibility audit.
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
      // A choice (Home) is a radio group named for the Setting, each choice with its own line.
      if (s.choices) await expect(panel.getByRole('radiogroup', { name: s.name })).toBeVisible();
      for (const text of s.choices ? s.choices.flatMap((c) => [c.name, c.hint]) : [s.name, s.hint])
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
  await expect(status).toHaveText(`${calmCount}of ${settings.length} switches on`);
  await expect(ticksOn).toHaveCount(calmCount);
  await expect(popup.getByRole('tab', { name: 'Search' })).not.toHaveClass(/dot/);

  await turn(await settingSwitch(popup, 'Clean up search'), true);
  await expect(status).toHaveText(`${calmCount + 1}of ${settings.length} switches on`);
  await expect(ticksOn).toHaveCount(calmCount + 1);
  await expect(popup.getByRole('tab', { name: 'Search' })).toHaveClass(/dot/);

  await turn(masterSwitch(popup), false);
  await expect(status).toHaveText('Paused');
  await expect(popup.locator('body')).toHaveClass(/off/);
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
  // Tab goes from the tabs to the magnifier, then into the open panel.
  await popup.keyboard.press('Tab');
  await expect(popup.getByRole('button', { name: 'Find a switch' })).toBeFocused();
  await popup.keyboard.press('Tab');
  await expect(popup.getByRole('button', { name: 'More about Hide Explore and Trending' })).toBeFocused();
});

test('find: "/" turns the tabs into a field, matching switches from every group can be switched there', async ({ openPopup }) => {
  const popup = await openPopup();
  await ready(popup);
  const field = popup.getByRole('searchbox', { name: 'Find a switch' });
  await expect(field).toBeHidden();
  await popup.keyboard.press('/');
  await expect(field).toBeFocused();
  await expect(popup.getByRole('tablist')).toBeHidden();

  // Matched on name, hint and the full line, across groups.
  await field.fill('hide');
  for (const s of settings.filter((x) => x.type === 'switch')) {
    const visible = popup.getByRole('switch', { name: s.name, exact: true });
    if (`${s.name} ${s.hint} ${s.hides}`.toLowerCase().includes('hide')) await expect(visible).toBeVisible();
    else await expect(visible).toBeHidden();
  }
  await field.fill('red count'); // the bell's hint
  await expect(popup.getByRole('switch')).toHaveCount(2); // the master switch and the bell
  await expect(popup.getByRole('switch', { name: 'Hide the notifications bell' })).toBeVisible();
  await field.fill('chapters'); // only in recommendations' full line
  await turn(popup.getByRole('switch', { name: 'Hide recommendations' }), false);

  await field.fill('zzz');
  await expect(popup.getByText('Nothing matches')).toBeVisible();
  await field.press('Escape');
  await expect(field).toBeHidden();
  await expect(popup.getByRole('tab', { name: 'Home' })).toBeFocused();
  await expect(popup.getByRole('tabpanel')).toHaveCount(1);
  await expect(popup.getByRole('tabpanel')).toHaveAccessibleName('Home');
});

test('find: start typing, or click the magnifier; an empty field brings the tabs back', async ({ openPopup }) => {
  const popup = await openPopup();
  await ready(popup);
  const field = popup.getByRole('searchbox', { name: 'Find a switch' });
  await popup.getByRole('tab', { name: 'Videos' }).focus();
  await popup.keyboard.type('shorts');
  await expect(field).toHaveValue('shorts');
  await expect(popup.getByRole('switch', { name: 'Hide Shorts', exact: true })).toBeVisible();
  await expect(popup.getByRole('switch', { name: 'Hide comments' })).toBeHidden();
  await field.fill('');
  await expect(field).toBeHidden();
  await expect(popup.getByRole('tab', { name: 'Home' })).toBeFocused(); // back to the open tab

  await popup.getByRole('button', { name: 'Find a switch' }).click();
  await expect(field).toBeFocused();
  await popup.getByRole('button', { name: 'Close find' }).click();
  await expect(field).toBeHidden();
  await expect(popup.getByRole('tab', { name: 'Home' })).toHaveAttribute('aria-selected', 'true');
});

test('the toolbar icon goes grey while D-Tox is paused', async ({ context, openPopup }) => {
  const popup = await openPopup();
  await ready(popup);
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  // Records each icon the worker sets, still setting it, so a missing file would fail here too.
  await worker.evaluate(() => {
    const g = globalThis as unknown as { icons: string[] };
    g.icons = [];
    const set = chrome.action.setIcon.bind(chrome.action);
    chrome.action.setIcon = ((d: { path: Record<string, string> }) =>
      set(d as chrome.action.TabIconDetails).then(() => g.icons.push(d.path[16]!))) as typeof chrome.action.setIcon;
  });
  const last = () => worker.evaluate(() => (globalThis as unknown as { icons: string[] }).icons.at(-1));
  await turn(masterSwitch(popup), false);
  await expect.poll(last).toBe('icon-off-16.png');
  await turn(masterSwitch(popup), true);
  await expect.poll(last).toBe('icon-16.png');
});

test('nothing moves when the system asks for reduced motion', async ({ openPopup }) => {
  const popup = await openPopup();
  await popup.emulateMedia({ reducedMotion: 'reduce' });
  await ready(popup);
  await expect(popup.locator('body')).toHaveClass(/ready/);
  await popup.getByRole('tab', { name: 'Shorts' }).click();
  await turn(popup.getByRole('switch', { name: 'Hide Shorts', exact: true }), false);
  await popup.keyboard.press('/');
  await turn(masterSwitch(popup), false);
  expect(await popup.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(popup.locator('#panels')).not.toHaveClass(/sizing/);
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
    // And with D-Tox off (the Settings go grey), and while finding.
    await turn(masterSwitch(popup), false);
    await popup.waitForTimeout(400); // the grey fades in
    let { violations } = await new AxeBuilder({ page: popup }).analyze();
    expect(violations.map((v) => v.id), 'D-Tox off').toEqual([]);
    await popup.keyboard.press('/');
    await popup.keyboard.type('hide');
    ({ violations } = await new AxeBuilder({ page: popup }).analyze());
    expect(violations.map((v) => v.id), 'finding').toEqual([]);
  });
}
