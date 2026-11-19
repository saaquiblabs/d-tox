// The service worker does one thing: on install (not on update), open the welcome page once.
// It keeps nothing in globals: Chrome stops it whenever it likes.
// No migration on update (ADR 0002): v1.4.1 kept its settings in chrome.storage.local, which v2
// never reads, so every update starts on the Calm Default as a new install does.
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') chrome.tabs.create({ url: 'https://d-tox.saaquiblabs.com/welcome' });
});
