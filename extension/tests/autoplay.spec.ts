import settings from '../../settings.json' with { type: 'json' };
import { cases } from './cases';
import { expect, test } from './extension';
import type { Page } from '@playwright/test';

// "Autoplay off" sets YouTube's own autoplay button to off on the first watch page in a tab,
// and then leaves it alone, so a Learner who switches autoplay back on keeps it on in that tab. The saved page has no YouTube scripts, so this stands in for the player: a click on
// the button flips it, but only once the player is ready, as on live YouTube.
const setting = settings.find((s) => s.id === 'autoplay-off')!;
const c = cases['autoplay-off']!;
const button = '#movie_player .ytp-autonav-toggle';

function fakePlayer(readyAtStart: boolean) {
  const w = window as any;
  w.playerReady = readyAtStart;
  document.addEventListener('click', (e) => {
    const toggle = (e.target as Element).closest?.('.ytp-autonav-toggle');
    const state = toggle?.querySelector('.ytp-autonav-toggle-button');
    if (!state || !w.playerReady) return;
    state.setAttribute('aria-checked', state.getAttribute('aria-checked') === 'true' ? 'false' : 'true');
  });
}

const autoplay = (page: Page) => page.locator(`${button} .ytp-autonav-toggle-button`);
/** Fires one of YouTube's own events, as the real page does. */
const youtube = (page: Page, event: string) => page.evaluate((e) => document.dispatchEvent(new CustomEvent(e, { bubbles: true })), event);
/** Waits until D-Tox has read the Settings (it copies them onto <html>). */
const settled = (page: Page, on: boolean) => {
  const html = expect(page.locator('html'));
  return on ? html.toHaveAttribute('data-dtox-autoplay-off') : html.not.toHaveAttribute('data-dtox-autoplay-off');
};

test('the saved page starts with YouTube autoplay on', async ({ openSaved, openPopup }) => {
  const popup = await openPopup();
  await popup.getByRole('checkbox', { name: 'D-Tox is on' }).uncheck();
  const page = await openSaved(c.fixture, c.url, fakePlayer, true);
  await expect(autoplay(page)).toHaveAttribute('aria-checked', 'true');
});

test('is on in the Calm Default and turns autoplay off when the video opens', async ({ openSaved }) => {
  expect(setting.calmDefault).toBe(true);
  const page = await openSaved(c.fixture, c.url, fakePlayer, true);
  await expect(autoplay(page)).toHaveAttribute('aria-checked', 'false');
});

test('waits for the player to be ready', async ({ openSaved }) => {
  const page = await openSaved(c.fixture, c.url, fakePlayer, false);
  await settled(page, true);
  await youtube(page, 'yt-navigate-finish');
  await expect(autoplay(page)).toHaveAttribute('aria-checked', 'true');

  await page.evaluate(() => ((window as any).playerReady = true));
  await youtube(page, 'yt-player-updated');
  await expect(autoplay(page)).toHaveAttribute('aria-checked', 'false');
});

test('the Learner can switch autoplay back on, and it stays on in this tab', async ({ openSaved }) => {
  const page = await openSaved(c.fixture, c.url, fakePlayer, true);
  await expect(autoplay(page)).toHaveAttribute('aria-checked', 'false');

  await page.locator(button).click();
  await expect(autoplay(page)).toHaveAttribute('aria-checked', 'true');
  // The video goes on updating its player and playing, and autoplay (or the Learner) opens the
  // next video with YouTube's own navigation: the Learner's choice stands.
  await youtube(page, 'yt-player-updated');
  await youtube(page, 'yt-navigate-finish');
  await page.evaluate(() => document.querySelector('#movie_player')!.dispatchEvent(new Event('playing')));
  expect(await autoplay(page).getAttribute('aria-checked')).toBe('true');
});

test('leaves the miniplayer alone away from the watch page', async ({ openSaved }) => {
  // The watch page's markup served at the home page URL stands in for the miniplayer.
  const page = await openSaved(c.fixture, 'https://www.youtube.com/', fakePlayer, true);
  await settled(page, true);
  await youtube(page, 'yt-navigate-finish');
  await youtube(page, 'yt-player-updated');
  expect(await autoplay(page).getAttribute('aria-checked')).toBe('true');
});

test('leaves autoplay alone when the Setting is off', async ({ openSaved, openPopup }) => {
  const popup = await openPopup();
  await popup.getByRole('checkbox', { name: setting.name, exact: true }).uncheck();
  const page = await openSaved(c.fixture, c.url, fakePlayer, true);
  await settled(page, false);
  await youtube(page, 'yt-navigate-finish');
  await youtube(page, 'yt-player-updated');
  expect(await autoplay(page).getAttribute('aria-checked')).toBe('true');
});

test('leaves autoplay alone when the master switch is off', async ({ openSaved, openPopup }) => {
  const popup = await openPopup();
  await popup.getByRole('checkbox', { name: 'D-Tox is on' }).uncheck();
  const page = await openSaved(c.fixture, c.url, fakePlayer, true);
  await settled(page, false);
  await youtube(page, 'yt-navigate-finish');
  expect(await autoplay(page).getAttribute('aria-checked')).toBe('true');
});

test('switching it on in the popup turns autoplay off in the open tab', async ({ openSaved, openPopup }) => {
  const popup = await openPopup();
  const switchEl = popup.getByRole('checkbox', { name: setting.name, exact: true });
  await switchEl.uncheck();
  const page = await openSaved(c.fixture, c.url, fakePlayer, true);
  await settled(page, false);
  expect(await autoplay(page).getAttribute('aria-checked')).toBe('true');

  await switchEl.check();
  await expect(autoplay(page)).toHaveAttribute('aria-checked', 'false');
});
