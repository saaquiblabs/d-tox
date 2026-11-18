// Copies Settings from chrome.storage.sync onto <html> as data-dtox-* attributes, then follows
// storage changes so the popup applies live. hide.css does the hiding (ADR 0001). The two things
// CSS can't do, Autoplay off and the Shorts redirect, are below: they listen to YouTube's own
// events. No timers, no observers.
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
    if (value === false) root.removeAttribute(name);
    else root.setAttribute(name, value === true ? '' : String(value));
  }
}

// Reading storage is async, and YouTube could draw first. Until it answers, use the Calm
// Default, so a Distraction hidden by default never flashes. (Someone who turned one back on
// sees it a moment later instead.)
apply();

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

navigation.addEventListener('currententrychange', redirectShort);

chrome.storage.sync.get(defaults).then((stored) => {
  current = { ...defaults, ...(stored as Values) };
  loaded = true;
  apply();
  autoplayOff();
  redirectShort();
});

chrome.storage.sync.onChanged.addListener((changes) => {
  current = { ...current };
  for (const id in changes) {
    if (id in defaults) current[id] = (changes[id]?.newValue as Values[string] | undefined) ?? defaults[id]!;
  }
  apply();
  // Switched on while a Short is open: open it in the normal player now, not at the next move.
  if (changes['shorts-redirect'] || changes.enabled) redirectShort();
  if (changes['autoplay-off'] || changes.enabled) {
    autoplayPending = true;
    autoplayOff();
  }
});
