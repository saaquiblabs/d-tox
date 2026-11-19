// The service worker opens the welcome page once on install (not on update), and keeps the
// toolbar icon showing whether D-Tox is on: grey while it is paused.
// It keeps nothing in globals: Chrome stops it whenever it likes.
// No migration on update (ADR 0002): v1.4.1 kept its settings in chrome.storage.local, which v2
// never reads, so every update starts on the Calm Default as a new install does.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: 'https://d-tox.saaquiblabs.com/welcome' });
  showOnOff();
});

// Chrome forgets an icon set with setIcon when it restarts, so it is set again at startup.
chrome.runtime.onStartup.addListener(showOnOff);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.enabled) paint(changes.enabled.newValue !== false);
});

function showOnOff() {
  chrome.storage.sync.get({ enabled: true }).then((v) => paint(v.enabled !== false));
}

function paint(on: boolean) {
  const icon = (n: number) => `icon-${on ? '' : 'off-'}${n}.png`;
  chrome.action.setIcon({ path: { 16: icon(16), 48: icon(48), 128: icon(128) } });
  chrome.action.setTitle({ title: on ? 'D-Tox' : 'D-Tox (paused)' });
}
