// Copies Settings from chrome.storage.sync onto <html> as data-dtox-* attributes, then follows
// storage changes so the popup applies live. hide.css does the hiding (ADR 0001). What CSS can't
// do is below: the Intention Page's element, Autoplay off and the two redirects (Shorts, Home on
// Subscriptions). They listen to YouTube's own events. No timers, no observers.
type Values = Record<string, boolean | string>;

const defaults: Values = { enabled: true, ...__DTOX_CALM_DEFAULT__ };
const root = document.documentElement;
let current = defaults;
let loaded = false;

function apply() {
  for (const id in defaults) {
    if (id === 'enabled') continue;
    const value = current.enabled ? current[id] : false;
    const name = 'data-dtox-' + id;
    // A choice left on 'default' (YouTube's own) is off, like a switch.
    if (value === false || value === 'default') root.removeAttribute(name);
    else root.setAttribute(name, value === true ? '' : String(value));
  }
}

// Reading storage is async, and YouTube could draw first. Until it answers, use the Calm
// Default, so a Distraction hidden by default never flashes. (Someone who turned one back on
// sees it a moment later instead.)
apply();

// The Intention Page (design B, #22): one element on <html>, outside YouTube's app, so it exists
// before YouTube draws anything. hide.css hides the home feed; intention.css draws this (icons
// included) only while Home is on the Intention Page and the page is home (it is `hidden`
// everywhere else). No search box of its own: it points at YouTube's, and "/" is YouTube's own
// shortcut to it. The links are plain YouTube URLs: nothing is read from the page.
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: object, ...kids: (Node | string)[]) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};
const card = (href: string, name: string, line: string) =>
  el('a', { href, className: name.split(' ')[0]!.toLowerCase() }, el('i', {}), el('b', {}, name), el('small', {}, line));
const intention = el(
  'div',
  { id: 'dtox-intention', hidden: true },
  el('span', { className: 'up', ariaHidden: 'true' }, '↑'),
  el('h1', {}, 'What are you here for?'),
  el('p', {}, 'Search for it up there, or pick up where you meant to.'),
  el(
    'nav',
    {},
    card('/feed/subscriptions', 'Subscriptions', 'New from the channels you chose.'),
    card('/playlist?list=WL', 'Watch later', 'What you saved for this moment.'),
    card('/feed/history', 'History', 'Pick up where you left off.'),
  ),
  el('p', { className: 'foot' }, el('kbd', {}, '/'), ' to search · Home stays this quiet until you ask'),
);
root.append(intention);

// Shown once Settings load (so someone on Subscriptions never sees it on the way). On YouTube's
// own moves (pushState, Back) it hides the moment the address leaves home, but shows only once
// YouTube has drawn home (yt-navigate-finish): shown at the address change, it sat over the page
// YouTube was still showing (Najmush, 2026-11-19: the question over search results). On
// Subscriptions, home is replaced by it, so Back doesn't return to home.
function home(show = true) {
  const atHome = loaded && location.pathname === '/';
  if (!atHome) intention.hidden = true;
  else if (show) intention.hidden = false;
  if (atHome && current.enabled && current.home === 'subscriptions') location.replace('/feed/subscriptions');
}
document.addEventListener('yt-navigate-finish', () => home());

// Autoplay off. Click YouTube's own autoplay button to off on the first watch page in this tab,
// then leave it alone: YouTube keeps the button's state from video to video, so if the Learner
// switches autoplay back on (say, for a playlist), it stays on in this tab. Switching the Setting
// in the popup arms it again. Until the player is ready a click does nothing, so keep trying on
// the player's own events until the button reads off.
let autoplayPending = true;

function autoplayOff() {
  if (!loaded || !autoplayPending || !current.enabled || current['autoplay-off'] !== true) return;
  if (location.pathname !== '/watch') return; // not the miniplayer on Home or Search
  const state = document.querySelector('ytd-watch-flexy #movie_player .ytp-autonav-toggle-button');
  // In a playlist YouTube hides the button (a playlist always plays on); leave it alone there.
  if (!state?.checkVisibility()) return;
  if (state.getAttribute('aria-checked') === 'true') (state as HTMLElement).click();
  autoplayPending = state.getAttribute('aria-checked') === 'true';
}

document.addEventListener('yt-navigate-finish', autoplayOff);
document.addEventListener('yt-player-updated', autoplayOff);
// Media events don't bubble; listening in the capture phase sees the video start.
document.addEventListener('playing', autoplayOff, true);

// Shorts redirect: a Short opens in the normal player. Checked once Settings load (a full load
// of a Short's URL) and whenever the current entry changes, which includes YouTube's own
// history.pushState. Not on 'navigate': that fires before pushState commits, so replace() would
// replace the page before the Short. replace(), so Back doesn't return to the Short.
function redirectShort() {
  const id = /^\/shorts\/([\w-]+)/.exec(location.pathname)?.[1];
  if (id && loaded && current.enabled && current['shorts-redirect'] === true) location.replace('/watch?v=' + id);
}

navigation.addEventListener('currententrychange', () => {
  redirectShort();
  home(false);
});

chrome.storage.sync.get(defaults).then((stored) => {
  current = { ...defaults, ...(stored as Values) };
  loaded = true;
  apply();
  autoplayOff();
  redirectShort();
  home();
});

chrome.storage.sync.onChanged.addListener((changes) => {
  const wasSubscriptions = current.home === 'subscriptions';
  current = { ...current };
  for (const id in changes) {
    if (id in defaults) current[id] = (changes[id]?.newValue as Values[string] | undefined) ?? defaults[id]!;
  }
  apply();
  // Switched on while a Short is open: open it in the normal player now, not at the next move.
  if (changes['shorts-redirect'] || changes.enabled) redirectShort();
  if (changes.home || changes.enabled) home();
  // Home moved off Subscriptions while this tab shows Subscriptions (where Home sent it): show the
  // new Home now, in the tab in front, rather than leave the Learner there until they reload.
  if (changes.home && wasSubscriptions && current.home !== 'subscriptions' && location.pathname === '/feed/subscriptions' && document.visibilityState === 'visible')
    location.assign('/');
  if (changes['autoplay-off'] || changes.enabled) {
    autoplayPending = true;
    autoplayOff();
  }
});
