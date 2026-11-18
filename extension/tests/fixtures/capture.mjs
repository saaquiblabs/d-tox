// Saves a trimmed copy of a live YouTube page as a test fixture.
//   node tests/fixtures/capture.mjs watch 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
// Video and image requests are blocked, so nothing plays. The saved page keeps YouTube's
// element tree (names, ids, attributes, the player's controls) and a little text, and drops
// scripts, styles, media, the contents of iframes (so no live chat messages) and all but the first few items of
// long lists. Review the diff before committing a refresh.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const [name, url] = process.argv.slice(2);
if (!name || !url?.startsWith('https://www.youtube.com/')) {
  console.error('usage: node tests/fixtures/capture.mjs <name> <https://www.youtube.com/...>');
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1280, height: 900 } });
await page.route(/googlevideo\.com|\.(jpg|jpeg|png|webp|gif|mp4|webm)(\?|$)|\/ytimg|doubleclick|googlesyndication/, (r) => r.abort());
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('ytd-app', { timeout: 30_000 });
await page.evaluate(() => document.querySelector('video')?.pause());
// Comments and other lazy parts load on scroll.
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => (document.querySelector('ytd-watch-flexy #comments') ?? document.scrollingElement)?.scrollIntoView());
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(1500);
}
await page.waitForSelector('ytd-comment-thread-renderer', { timeout: 30_000 }).catch(() => {});

const html = await page.evaluate(() => {
  const doc = document.documentElement.cloneNode(true);
  doc.querySelectorAll('script, style, link, iframe:not(#chatframe), noscript, video, img, source, svg, template').forEach((n) => n.remove());
  // Live chat is an iframe: keep the frame, empty, so tests can see it without anyone's messages.
  doc.querySelector('iframe#chatframe')?.removeAttribute('src');
  // Keep the first 3 items of long lists.
  for (const list of ['ytd-comment-thread-renderer', 'ytd-compact-video-renderer', 'yt-lockup-view-model', 'ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-playlist-panel-video-renderer', 'ytd-macro-markers-list-item-renderer', '.ytp-modern-videowall-still']) {
    const byParent = new Map();
    for (const el of doc.querySelectorAll(list)) {
      const n = (byParent.get(el.parentNode) ?? 0) + 1;
      byParent.set(el.parentNode, n);
      if (n > 3) el.remove();
    }
  }
  // Don't commit strangers' names and words: replace comment text and links with placeholders.
  for (const thread of doc.querySelectorAll('ytd-comment-thread-renderer')) {
    const walker = document.createTreeWalker(thread, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) if (t.nodeValue.trim()) t.nodeValue = 'Comment';
    thread.querySelectorAll('[href]').forEach((a) => a.setAttribute('href', '#'));
    thread.querySelectorAll('[aria-label], [title]').forEach((a) => { a.removeAttribute('aria-label'); a.removeAttribute('title'); });
  }
  doc.querySelectorAll('iron-iconset-svg, head > meta').forEach((n) => n.remove());
  for (const el of doc.querySelectorAll('*')) {
    // Polymer's scoping classes ("style-scope ytd-watch-flexy") are half the file and never selected on.
    if (el.classList.contains('style-scope')) {
      el.classList.remove('style-scope');
      for (const c of [...el.classList]) if (c.includes('-') && c === c.toLowerCase() && document.createElement(c).constructor !== HTMLElement && customElements.get(c)) el.classList.remove(c);
      if (!el.classList.length) el.removeAttribute('class');
    }
    for (const a of [...el.attributes]) if (a.name === 'style' || a.name.startsWith('on') || a.value.length > 300) el.removeAttribute(a.name);
  }
  // YouTube's scripts nest a <button> in a <button> (and an <a> in an <a>). Saved as HTML, the
  // parser can't rebuild that: it closes elements early, and the player's controls end up
  // outside #movie_player. Make each inner one a <div>, which parses back as it was.
  for (const tag of ['button', 'a']) {
    for (const inner of [...doc.querySelectorAll(`${tag} ${tag}`)].reverse()) {
      const div = document.createElement('div');
      for (const a of inner.attributes) div.setAttribute(a.name, a.value);
      div.append(...inner.childNodes);
      inner.replaceWith(div);
    }
  }
  for (const a of [...doc.attributes]) if (a.name.startsWith('data-dtox-')) doc.removeAttribute(a.name);
  return '<!doctype html>\n' + doc.outerHTML.replace(/\n\s*\n+/g, '\n');
});
await browser.close();

const file = new URL(`./${name}.html`, import.meta.url);
await writeFile(file, html);
console.log(`saved ${file.pathname} (${(html.length / 1024).toFixed(0)} KB)`);
