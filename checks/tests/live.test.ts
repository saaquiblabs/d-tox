// The live checker, pointed at the saved watch page from the extension's tests instead of
// live YouTube: every request is answered here, so these run offline and the same every time.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import type { BrowserContext } from 'playwright';
import { cases, type Case, type Hides } from '../../extension/tests/cases.ts';
import { checkLanguage, languages, launch, type Setting } from '../lib/live.ts';

const watchHtml = readFileSync(new URL('../../extension/tests/fixtures/watch.html', import.meta.url), 'utf8');
const hideCss = readFileSync(new URL('../../extension/src/hide.css', import.meta.url), 'utf8');
const [english, hindi] = languages;
const fast = { revealTries: 2, settleMs: 100, hideTimeoutMs: 1500, tries: 1 };

const comments: Setting = { id: 'comments', name: 'Comments', type: 'switch' };

/** Answers every request: `pages` maps a pathname to its HTML, all else 404s. */
async function serve(context: BrowserContext, pages: Record<string, string>) {
  await context.route('**/*', (route) => {
    // Video goes on to the checker's own blocking (registered first, so it runs after this).
    if (new URL(route.request().url()).hostname.endsWith('googlevideo.com')) return route.fallback();
    const page = pages[new URL(route.request().url()).pathname];
    if (page !== undefined) return route.fulfill({ contentType: 'text/html; charset=utf-8', body: page });
    return route.fulfill({ status: 404, body: '' });
  });
}

/** A Chromium with the check's stripped-down D-Tox, closed when the test ends. */
const open = async (t: TestContext, css = hideCss, language = english!) => {
  const context = await launch(language, css);
  t.after(() => context.close());
  return context;
};

test('a Setting whose rule still hides its Distraction passes', async (t) => {
  const context = await open(t);
  await serve(context, { '/watch': watchHtml });
  const { results, lines } = await checkLanguage(context, english!, [comments], cases, fast);
  assert.deepEqual(results, []);
  assert.match(lines.join('\n'), /✓.*Comments/);
});

test('a rule that no longer matches is reported as still visible', async (t) => {
  const context = await open(t, hideCss.replace('ytd-comments#comments', 'ytd-comments#renamed'));
  await serve(context, { '/watch': watchHtml });
  const { results } = await checkLanguage(context, english!, [comments], cases, fast);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.kind, 'setting');
  assert.match(results[0]!.problem, /still visible/);
});

test('a Distraction YouTube no longer shows is reported as not found', async (t) => {
  const context = await open(t);
  await serve(context, { '/watch': watchHtml.replaceAll('ytd-comment-thread-renderer', 'ytd-comment-thread-renamed') });
  const { results } = await checkLanguage(context, english!, [comments], cases, fast);
  assert.equal(results.length, 1);
  assert.match(results[0]!.problem, /not found/);
});

test('a consent page fails loudly as blocked, and no Setting is blamed', async (t) => {
  const context = await open(t);
  await serve(context, {
    // A script, not a 302: Playwright doesn't follow a redirect answered by a route.
    '/watch': `<!doctype html><script>location.replace('https://consent.youtube.com/m?continue=x')</script>`,
    '/m': '<!doctype html><html lang="en"><body><form action="/save">Before you continue to YouTube</form></body></html>',
  });
  const { results, lines } = await checkLanguage(context, english!, [comments], cases, fast);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.kind, 'blocked');
  assert.match(results[0]!.problem, /consent/);
  assert.doesNotMatch(lines.join('\n'), /✓/);
});

test('a bot check on the watch page fails loudly as blocked', async (t) => {
  const context = await open(t);
  const botCheck = watchHtml.replace(
    '</body>',
    `<script>var ytInitialPlayerResponse = { playabilityStatus: { status: "LOGIN_REQUIRED", reason: "Sign in to confirm you’re not a bot" } };</script></body>`,
  );
  await serve(context, { '/watch': botCheck });
  const { results } = await checkLanguage(context, english!, [comments], cases, fast);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.kind, 'blocked');
  assert.match(results[0]!.problem, /not a bot/);
});

test('a page in the wrong language is blocked, never a pass for that language', async (t) => {
  const context = await open(t, hideCss, hindi);
  await serve(context, { '/watch': watchHtml });
  const { results } = await checkLanguage(context, hindi!, [comments], cases, fast);
  assert.equal(results.length, 1);
  assert.equal(results[0]!.kind, 'blocked');
  assert.match(results[0]!.problem, /Hindi/);
});

test('asks YouTube for the language by URL and plays no video', async (t) => {
  const context = await open(t, hideCss, hindi);
  const asked: string[] = [];
  await serve(context, { '/watch': watchHtml.replace('lang="en"', 'lang="hi-IN"') });
  context.on('request', (r) => asked.push(r.url()));
  const { results } = await checkLanguage(context, hindi!, [comments], cases, fast);
  assert.deepEqual(results, []);
  assert.ok(asked.some((u) => new URL(u).searchParams.get('hl') === 'hi'), asked.join('\n'));
  const page = await context.newPage();
  await assert.rejects(page.goto('https://rr1---sn-x.googlevideo.com/videoplayback?x=1'), /ERR_/);
});

test('a Setting with no case is a failure, not a silent skip', async (t) => {
  const context = await open(t);
  await serve(context, {});
  const { results } = await checkLanguage(context, english!, [{ id: 'mystery', name: 'Mystery', type: 'switch' }], cases, fast);
  assert.equal(results.length, 1);
  assert.match(results[0]!.problem, /cases\.ts/);
});

test('a Setting gets a second try before it counts as broken', async (t) => {
  const context = await open(t);
  let loads = 0;
  await context.route('**/*', (route) => {
    if (new URL(route.request().url()).pathname !== '/watch') return route.fulfill({ status: 404, body: '' });
    loads++;
    // The first load is missing its comments, as a slow or partial load would be.
    const body = loads === 1 ? watchHtml.replaceAll('ytd-comment-thread-renderer', 'x-gone') : watchHtml;
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body });
  });
  const { results } = await checkLanguage(context, english!, [comments], cases, { ...fast, tries: 2 });
  assert.deepEqual(results, []);
  assert.equal(loads, 2);
});

test('a Setting with several Distractions passes when its rule matches each, shown or not', async (t) => {
  // End screens only show when a video ends, and no video plays: the rule must match them anyway.
  const playlistHtml = readFileSync(new URL('../../extension/tests/fixtures/watch-playlist.html', import.meta.url), 'utf8');
  const context = await open(t);
  await serve(context, { '/watch': playlistHtml });
  const endScreens: Setting = { id: 'end-screens', name: 'End screens', type: 'switch' };
  const { results, lines } = await checkLanguage(context, english!, [endScreens], cases, fast);
  assert.deepEqual(results, []);
  assert.match(lines.join('\n'), /✓.*End screens.*2 of 5 Distractions need a playing video/);
});

test('a Distraction that needs a playing video is not looked for', async (t) => {
  const context = await open(t);
  // Comment threads are missing, as end screens are when no video has played.
  await serve(context, { '/watch': watchHtml.replaceAll('ytd-comment-thread-renderer', 'x-gone') });
  const thread = 'ytd-watch-flexy #comments ytd-comment-thread-renderer';
  const c: Case = { ...(cases.comments as Hides), distractions: [thread, 'ytd-watch-flexy ytd-comments#comments'], needPlayback: [thread] };
  const { results } = await checkLanguage(context, english!, [comments], { comments: c }, fast);
  assert.deepEqual(results, []);
});

test('a Setting that changes a behaviour is skipped by name, not failed', async (t) => {
  const context = await open(t);
  await serve(context, {});
  const autoplay: Setting = { id: 'autoplay-off', name: 'Autoplay off', type: 'switch' };
  const { results, lines } = await checkLanguage(context, english!, [autoplay], cases, fast);
  assert.deepEqual(results, []);
  assert.match(lines.join('\n'), /Autoplay off.*skipped.*autoplay\.spec\.ts/);
});
