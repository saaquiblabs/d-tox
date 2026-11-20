import { watchPlaylist, type SavedPage } from './cases';
import { expect, store, test, type Fixtures } from './extension';
import type { Page } from '@playwright/test';

// #46: with recommendations hidden, an empty right column goes and the player may grow (the
// rule in hide.css). A column that still holds a playlist, live chat or an open panel stays.
// Saved pages run none of YouTube's scripts, so they lay out in one column and can't show where
// the player ends up or how big it is: these tests prove *when* the rule applies. Its size and
// centring are measured on live YouTube by the Release Gate (#25).
const watch: SavedPage = { fixture: 'watch.html', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' };
const live: SavedPage = { fixture: 'watch-live.html', url: 'https://www.youtube.com/watch?v=7yKPg0OKT-A' };

/** The attributes YouTube puts on ytd-watch-flexy that keep the right column. */
const keepers = ['playlist', 'live-chat-present-and-expanded', 'panel-expanded'];

const secondary = (page: Page) => page.locator('ytd-watch-flexy #secondary');
/** Sets or removes attributes on ytd-watch-flexy, as YouTube does when the layout changes. */
const flexy = (page: Page, set: string[], remove: string[] = []) =>
  page.locator('ytd-watch-flexy').evaluate((el, [set, remove]) => {
    for (const a of remove) el.removeAttribute(a);
    for (const a of set) el.setAttribute(a, '');
  }, [set, remove] as const);

async function open({ openSaved, openPopup }: Pick<Fixtures, 'openSaved' | 'openPopup'>, saved: SavedPage, on: boolean) {
  const popup = await openPopup();
  await store(popup, { recommendations: on });
  const page = await openSaved(saved.fixture, saved.url);
  const html = expect(page.locator('html'));
  await (on ? html.toHaveAttribute('data-dtox-recommendations') : html.not.toHaveAttribute('data-dtox-recommendations'));
  return page;
}

test('with recommendations hidden, the empty right column goes', async ({ openSaved, openPopup }) => {
  const page = await open({ openSaved, openPopup }, watch, true);
  await expect(secondary(page)).toBeHidden();
});

test("the player's height is capped so the title and channel row fit under it", async ({ openSaved, openPopup }) => {
  const page = await open({ openSaved, openPopup }, watch, true);
  const { height } = page.viewportSize()!;
  // Reads YouTube's own variable back through a probe: the value the player is sized by.
  const max = await page.locator('ytd-watch-flexy').evaluate((el) => {
    const probe = document.createElement('div');
    probe.style.width = 'var(--ytd-watch-flexy-max-player-width)';
    el.append(probe);
    const w = probe.getBoundingClientRect().width;
    probe.remove();
    return w;
  });
  // hide.css: the window's height less the masthead (56), YouTube's top padding (12) and 150px.
  expect(max).toBeCloseTo((height - 56 - 12 - 150) * (16 / 9), 0);
});

test('with recommendations shown, YouTube keeps its two columns', async ({ openSaved, openPopup }) => {
  const page = await open({ openSaved, openPopup }, watch, false);
  await expect(secondary(page)).toBeVisible();
});

// Each attribute on its own: the saved playlist and live pages also carry panel-expanded, so the
// other two are removed first.
for (const keeper of keepers) {
  test(`a column YouTube marks ${keeper} stays`, async ({ openSaved, openPopup }) => {
    const page = await open({ openSaved, openPopup }, watch, true);
    await expect(secondary(page)).toBeHidden();
    await flexy(page, [keeper], keepers.filter((k) => k !== keeper));
    await expect(secondary(page)).toBeVisible();
  });
}

for (const [name, saved] of [
  ['a playlist', watchPlaylist],
  ['live chat', live],
] as const) {
  test(`on the saved page with ${name}, the column stays`, async ({ openSaved, openPopup }) => {
    const page = await open({ openSaved, openPopup }, saved, true);
    await expect(secondary(page)).toBeVisible();
  });
}

for (const [name, set, remove] of [
  ['theatre', ['theater'], ['default-layout']],
  ['fullscreen', ['fullscreen'], ['default-layout']],
  ['a narrow window', [], ['is-two-columns_']],
] as const) {
  test(`${name} stays YouTube's own layout`, async ({ openSaved, openPopup }) => {
    const page = await open({ openSaved, openPopup }, watch, true);
    await flexy(page, [...set], [...remove]);
    await expect(secondary(page)).toBeVisible();
  });
}
