// Copies Settings from chrome.storage.sync onto <html> as data-dtox-* attributes, then follows
// storage changes so the popup applies live. hide.css does the hiding (ADR 0001).
// No timers, no observers.
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

// Autoplay off: JavaScript, because CSS can't set YouTube's autoplay. Click YouTube's own button
// to off once per page load and once per YouTube navigation, then leave it, so the Learner can
// switch autoplay back on. Until the player is ready a click does nothing, so keep trying on
// the player's own events until the button reads off.
let autoplayPending = true;

function autoplayOff() {
  if (!loaded || !autoplayPending || !current.enabled || current['autoplay-off'] !== true) return;
  const state = document.querySelector('ytd-watch-flexy #movie_player .ytp-autonav-toggle-button');
  if (!state) return;
  if (state.getAttribute('aria-checked') === 'true') (state as HTMLElement).click();
  autoplayPending = state.getAttribute('aria-checked') === 'true';
}

document.addEventListener('yt-navigate-finish', () => {
  autoplayPending = true;
  autoplayOff();
});
document.addEventListener('yt-player-updated', autoplayOff);
// Media events don't bubble; listening in the capture phase sees the video start.
document.addEventListener('playing', autoplayOff, true);

chrome.storage.sync.get(defaults).then((stored) => {
  current = { ...defaults, ...(stored as Values) };
  loaded = true;
  apply();
  autoplayOff();
});

chrome.storage.sync.onChanged.addListener((changes) => {
  current = { ...current };
  for (const id in changes) {
    if (id in defaults) current[id] = (changes[id]?.newValue as Values[string] | undefined) ?? defaults[id]!;
  }
  apply();
  if (changes['autoplay-off'] || changes.enabled) {
    autoplayPending = true;
    autoplayOff();
  }
});
