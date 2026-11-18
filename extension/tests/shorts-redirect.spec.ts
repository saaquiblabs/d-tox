// The Shorts redirect: a Short opens in the normal player instead of the swipe feed, both when
// a Short's URL is loaded and when YouTube moves to one itself (it uses history.pushState).
import { search, short } from './cases';
import { expect, test } from './extension';
import type { Page } from '@playwright/test';

const id = new URL(short.url).pathname.split('/')[2]!;
const watchUrl = `https://www.youtube.com/watch?v=${id}`;

const store = (popup: Page, values: Record<string, unknown>) =>
  popup.evaluate((v) => chrome.storage.sync.set(v), values);

/** YouTube's own navigation to the Short, as its app does it: no page load, just pushState. */
const youtubeNavigatesToShort = (page: Page) =>
  page.evaluate((url) => history.pushState({}, '', url), short.url);

/** Settings have reached the page (the Calm Default hides Shorts, so this attribute appears). */
const settled = (page: Page) => page.waitForFunction(() => document.documentElement.hasAttribute('data-dtox-shorts'));

test('a Short opens in the normal player when the redirect is on', async ({ context, openPopup }) => {
  const popup = await openPopup();
  await store(popup, { 'shorts-redirect': true });
  const page = await context.newPage();
  await page.goto(short.url, { waitUntil: 'commit' }).catch(() => {}); // replaced while loading
  await expect(page).toHaveURL(watchUrl);
  await expect(page.locator('ytd-watch-flexy').first()).toBeAttached();
});

test('YouTube moving to a Short itself is redirected too', async ({ openSaved, openPopup }) => {
  const popup = await openPopup();
  await store(popup, { 'shorts-redirect': true });
  const page = await openSaved(search.fixture, search.url);
  await youtubeNavigatesToShort(page);
  await expect(page).toHaveURL(watchUrl);
});

test('the back button does not return to the Short', async ({ openSaved, openPopup }) => {
  const popup = await openPopup();
  await store(popup, { 'shorts-redirect': true });
  const page = await openSaved(search.fixture, search.url);
  await youtubeNavigatesToShort(page);
  await expect(page).toHaveURL(watchUrl);
  await page.goBack();
  await expect(page).toHaveURL(search.url);
});

test('off in the Calm Default: a Short stays a Short', async ({ openSaved }) => {
  const page = await openSaved(short.fixture, short.url);
  await settled(page);
  const results = await openSaved(search.fixture, search.url);
  await settled(results);
  await youtubeNavigatesToShort(results);
  // Give a wrong redirect the chance to happen.
  await results.waitForTimeout(500);
  await expect(page).toHaveURL(short.url);
  await expect(results).toHaveURL(short.url);
});

test('the master switch turns the redirect off', async ({ openSaved, openPopup }) => {
  const popup = await openPopup();
  await store(popup, { 'shorts-redirect': true, enabled: false });
  const page = await openSaved(short.fixture, short.url);
  await page.waitForFunction(() => document.readyState === 'complete');
  // Settings load within milliseconds; give a wrong redirect the chance to happen.
  await page.waitForTimeout(500);
  await expect(page).toHaveURL(short.url);
});
