// Home (#21): a choice of the Intention Page, Subscriptions or YouTube's default. The Intention
// Page replaces the feed on full loads and on YouTube's own moves to home (pushState), and the
// feed never shows on the way. Also here: what install and update do.
import settings from '../../settings.json' with { type: 'json' };
import { cases, home } from './cases';
import { expect, store, test, welcomeUrl } from './extension';
import type { Page } from '@playwright/test';

const setting = settings.find((s) => s.id === 'home')!;
const watch = cases.comments!; // any saved page that isn't home
const subscriptionsUrl = 'https://www.youtube.com/feed/subscriptions';

const card = (page: Page) => page.locator('#dtox-intention');
/** The feed, as a person sees it. Signed out, YouTube's home holds only a "Try searching" nudge. */
const feed = (page: Page) => page.locator('ytd-browse[page-subtype="home"] ytd-feed-nudge-renderer');
/** YouTube's own navigation: no page load, just pushState. */
const youtubeGoesTo = (page: Page, url: string) => page.evaluate((u) => history.pushState({}, '', u), url);

test('the Calm Default shows the Intention Page in place of the feed', async ({ openSaved }) => {
  expect(setting.calmDefault).toBe('intention');
  const page = await openSaved(home.fixture, home.url);
  await expect(card(page)).toBeVisible();
  await expect(card(page).getByRole('heading', { name: 'What are you here for?' })).toBeVisible();
  const links = card(page).getByRole('link');
  await expect(links).toHaveCount(3);
  await expect(card(page).getByRole('link', { name: /^Subscriptions/ })).toHaveAttribute('href', '/feed/subscriptions');
  await expect(card(page).getByRole('link', { name: /^Watch later/ })).toHaveAttribute('href', '/playlist?list=WL');
  await expect(card(page).getByRole('link', { name: /^History/ })).toHaveAttribute('href', '/feed/history');
  await expect(feed(page)).toBeHidden();
});

// Najmush, 2026-11-19 (#22): "we already have a search button on youtube". It points up at
// YouTube's search instead, whose own shortcut is "/".
test('has no search box of its own', async ({ openSaved }) => {
  const page = await openSaved(home.fixture, home.url);
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator('input, form, button')).toHaveCount(0);
  await expect(card(page).locator('kbd')).toHaveText('/');
});

// toBeHidden() retries, so it can't see a flash. This records whether the feed could be seen at
// the moment YouTube's markup first put it on the page.
test('the feed never shows, not even while the page loads', async ({ openSaved }) => {
  const page = await openSaved(home.fixture, home.url, () => {
    const w = window as any;
    new MutationObserver((_, observer) => {
      const el = document.querySelector('ytd-browse[page-subtype="home"] ytd-feed-nudge-renderer');
      if (!el) return;
      w.feedSeen = el.checkVisibility();
      observer.disconnect();
    }).observe(document, { childList: true, subtree: true });
  });
  await expect(card(page)).toBeVisible();
  expect(await page.evaluate(() => (window as any).feedSeen)).toBe(false);
});

// YouTube's first HTML draws a grey, feed-shaped placeholder until its app takes over; the saved
// page was captured after that, so the placeholder is put back here as YouTube serves it.
test("the feed's loading placeholder doesn't show either", async ({ openSaved }) => {
  const page = await openSaved(home.fixture, home.url, () => {
    document.addEventListener('DOMContentLoaded', () => {
      const skeleton = Object.assign(document.createElement('div'), { id: 'home-page-skeleton' });
      skeleton.append(Object.assign(document.createElement('div'), { id: 'guide-skeleton', textContent: 'menu' }));
      skeleton.append(Object.assign(document.createElement('div'), { id: 'home-container-skeleton', textContent: 'feed' }));
      document.body.prepend(skeleton);
    });
  });
  await expect(page.locator('#home-container-skeleton')).toBeHidden();
  await expect(page.locator('#guide-skeleton')).toBeVisible();
});

test("follows YouTube's light and dark theme", async ({ openSaved }) => {
  const page = await openSaved(home.fixture, home.url);
  const heading = card(page).locator('h1');
  const cardBg = card(page).locator('nav a').first();
  await expect(heading).toHaveCSS('color', 'rgb(15, 15, 15)');
  await expect(cardBg).toHaveCSS('background-color', 'rgb(242, 242, 242)');
  await page.evaluate(() => document.documentElement.setAttribute('dark', ''));
  await expect(heading).toHaveCSS('color', 'rgb(241, 241, 241)');
  await expect(cardBg).toHaveCSS('background-color', 'rgb(27, 27, 27)');
});

test("shows on YouTube's own moves to home and back, and nowhere else", async ({ openSaved }) => {
  const page = await openSaved(watch.fixture, watch.url);
  await expect(page.locator('html')).toHaveAttribute('data-dtox-home', 'intention');
  await expect(card(page)).toBeHidden();
  await youtubeGoesTo(page, '/');
  await expect(card(page)).toBeVisible();
  await youtubeGoesTo(page, watch.url);
  await expect(card(page)).toBeHidden();
  await page.goBack();
  await expect(page).toHaveURL(home.url);
  await expect(card(page)).toBeVisible();
});

test('on Subscriptions, home opens Subscriptions', async ({ context, served, openPopup }) => {
  served.set(subscriptionsUrl, 'gaming.html');
  await store(await openPopup(), { home: 'subscriptions' });
  const page = await context.newPage();
  await page.goto(home.url, { waitUntil: 'commit' }).catch(() => {}); // replaced while loading
  await expect(page).toHaveURL(subscriptionsUrl);
});

test("on Subscriptions, YouTube's own move to home opens Subscriptions, and Back skips home", async ({ served, openSaved, openPopup }) => {
  served.set(subscriptionsUrl, 'gaming.html');
  await store(await openPopup(), { home: 'subscriptions' });
  const page = await openSaved(watch.fixture, watch.url);
  await expect(page.locator('html')).toHaveAttribute('data-dtox-home', 'subscriptions');
  await expect(card(page)).toBeHidden();
  await youtubeGoesTo(page, '/');
  await expect(page).toHaveURL(subscriptionsUrl);
  await page.goBack();
  await expect(page).toHaveURL(watch.url);
});

test("on YouTube's default, home is left as it is", async ({ openSaved, openPopup }) => {
  await store(await openPopup(), { home: 'default' });
  const page = await openSaved(home.fixture, home.url);
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-dtox-shorts')); // Settings loaded
  await expect(page.locator('html')).not.toHaveAttribute('data-dtox-home');
  await expect(feed(page)).toBeVisible();
  await expect(card(page)).toBeHidden();
  await page.waitForTimeout(500); // give a wrong redirect the chance to happen
  await expect(page).toHaveURL(home.url);
});

test("the popup's Home choice switches the open tab without a reload", async ({ openSaved, openPopup }) => {
  const page = await openSaved(home.fixture, home.url);
  await page.evaluate(() => ((window as any).notReloaded = true));
  const popup = await openPopup();
  const choice = popup.getByRole('radiogroup', { name: /^Home/ });
  await expect(choice.getByRole('radio')).toHaveCount(3);
  await expect(choice.locator('label')).toHaveText(['Intention Page', 'Subscriptions', 'YouTube default']);
  await expect(choice.getByRole('radio', { name: 'Intention Page' })).toBeChecked();

  await choice.getByRole('radio', { name: 'YouTube default' }).check();
  await expect(feed(page)).toBeVisible();
  await expect(card(page)).toBeHidden();
  await choice.getByRole('radio', { name: 'Intention Page' }).check();
  await expect(card(page)).toBeVisible();
  await expect(feed(page)).toBeHidden();
  expect(await page.evaluate(() => (window as any).notReloaded)).toBe(true);
});

test("the master switch gives back YouTube's home", async ({ openSaved, openPopup }) => {
  const page = await openSaved(home.fixture, home.url);
  await expect(card(page)).toBeVisible();
  await store(await openPopup(), { enabled: false });
  await expect(feed(page)).toBeVisible();
  await expect(card(page)).toBeHidden();
});

// An update can't be made here: chrome.runtime.reload() leaves a --load-extension extension
// switched off in Playwright's Chromium. background.ts opens the page only on reason "install".
test('install opens the welcome page, once', async ({ context, openSaved }) => {
  const welcomeTabs = () => context.pages().filter((p) => p.url() === welcomeUrl).length;
  await expect.poll(welcomeTabs).toBe(1);
  await openSaved(home.fixture, home.url);
  await new Promise((r) => setTimeout(r, 500)); // give a second one the chance to open
  expect(welcomeTabs()).toBe(1);
});
