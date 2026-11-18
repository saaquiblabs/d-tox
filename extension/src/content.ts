// Copies Settings from chrome.storage.sync onto <html> as data-dtox-* attributes, then follows
// storage changes so the popup applies live. hide.css does the hiding (ADR 0001).
// It also does the one thing CSS can't, the Shorts redirect. No timers, no observers.
type Values = Record<string, boolean | string>;

const defaults: Values = { enabled: true, ...__DTOX_CALM_DEFAULT__ };
const root = document.documentElement;
let current = defaults;

function apply() {
  for (const id in defaults) {
    if (id === 'enabled') continue;
    const value = current.enabled ? current[id] : false;
    const name = 'data-dtox-' + id;
    if (value === false) root.removeAttribute(name);
    else root.setAttribute(name, value === true ? '' : String(value));
  }
}

// Shorts redirect: a Short opens in the normal player. Checked once Settings load (a full load
// of a Short's URL) and on every navigation, which includes YouTube's own history.pushState.
// replace(), so Back doesn't return to the Short.
function redirectShort(url: string) {
  const id = /^\/shorts\/([\w-]+)/.exec(new URL(url).pathname)?.[1];
  if (id && current.enabled && current['shorts-redirect']) location.replace('/watch?v=' + id);
}

chrome.storage.sync.get(defaults).then((stored) => {
  current = { ...defaults, ...(stored as Values) };
  apply();
  redirectShort(location.href);
});

navigation.addEventListener('navigate', (event) => redirectShort(event.destination.url));

chrome.storage.sync.onChanged.addListener((changes) => {
  current = { ...current };
  for (const id in changes) {
    if (id in defaults) current[id] = (changes[id]?.newValue as Values[string] | undefined) ?? defaults[id]!;
  }
  apply();
});
