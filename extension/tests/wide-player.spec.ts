import { expect, store, test } from './extension';
import type { Page } from '@playwright/test';

// #46: with recommendations hidden, an empty right column goes and the video takes the room,
// centred. A column that still holds a playlist, live chat or an open panel stays.
const watch = { fixture: 'watch.html', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' };
const playlist = {
  fixture: 'watch-playlist.html',
  url: 'https://www.youtube.com/watch?v=aircAruvnKk&list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi',
};
const live = { fixture: 'watch-live.html', url: 'https://www.youtube.com/watch?v=7yKPg0OKT-A' };

const secondary = (page: Page) => page.locator('ytd-watch-flexy #secondary');

async function open(openSaved: any, openPopup: any, saved: { fixture: string; url: string }, on: boolean) {
  const popup = await openPopup();
  await store(popup, { recommendations: on });
  const page: Page = await openSaved(saved.fixture, saved.url);
  const html = expect(page.locator('html'));
  await (on ? html.toHaveAttribute('data-dtox-recommendations') : html.not.toHaveAttribute('data-dtox-recommendations'));
  return page;
}

test('with recommendations hidden, the empty column goes and the video sits in the middle', async ({ openSaved, openPopup }) => {
  const page = await open(openSaved, openPopup, watch, true);
  await expect(secondary(page)).toBeHidden();
  const primary = (await page.locator('ytd-watch-flexy #primary').boundingBox())!;
  const width = page.viewportSize()!.width;
  const left = primary.x;
  const right = width - (primary.x + primary.width);
  expect(Math.abs(left - right), `centred: ${left}px left, ${right}px right`).toBeLessThan(24);
});

test('the video stays short enough for the title to show', async ({ openSaved, openPopup }) => {
  const page = await open(openSaved, openPopup, watch, true);
  const { height } = page.viewportSize()!;
  const max = await page
    .locator('ytd-watch-flexy')
    .evaluate((el) => {
      const probe = Object.assign(document.createElement('div'), {});
      probe.style.width = 'var(--ytd-watch-flexy-max-player-width)';
      el.append(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    });
  expect(max).toBeCloseTo((height - 56 - 12 - 150) * (16 / 9), 0);
});

test('with recommendations shown, YouTube keeps its two columns', async ({ openSaved, openPopup }) => {
  const page = await open(openSaved, openPopup, watch, false);
  await expect(secondary(page)).toBeVisible();
});

for (const [name, saved] of [
  ['a playlist', playlist],
  ['live chat', live],
] as const) {
  test(`a column holding ${name} stays`, async ({ openSaved, openPopup }) => {
    const page = await open(openSaved, openPopup, saved, true);
    await expect(secondary(page)).toBeVisible();
  });
}

test('opening chapters or the transcript brings the column back', async ({ openSaved, openPopup }) => {
  const page = await open(openSaved, openPopup, watch, true);
  await expect(secondary(page)).toBeHidden();
  // YouTube marks the page panel-expanded when an engagement panel opens beside the video.
  await page.locator('ytd-watch-flexy').evaluate((el) => el.setAttribute('panel-expanded', ''));
  await expect(secondary(page)).toBeVisible();
});
