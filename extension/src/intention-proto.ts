// PROTOTYPE (#22), throwaway. The Intention Page on YouTube's real home page, three variants,
// switched from the yellow bar at the bottom (or ← → when no box has focus). Reads `home` (the
// Home choice, #21; 'intention' unless the popup says otherwise), `enabled`, and the variant from
// chrome.storage.local. Not written to ADR 0001's rules (it looks for YouTube's home element on
// YouTube's navigation events); #21 decides how the real one is built.
const VARIANTS = { A: 'YouTube-native', B: 'Saaquib Labs paper', C: 'Just the question', D: 'No second search box' } as const;
type V = keyof typeof VARIANTS;

const icon = {
  search: 'M20.87 20.17l-5.59-5.59C16.35 13.35 17 11.75 17 10c0-3.87-3.13-7-7-7s-7 3.13-7 7 3.13 7 7 7c1.75 0 3.35-.65 4.58-1.71l5.59 5.59.7-.71zM10 16c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z',
  subs: 'M10 18v-6l5 3-5 3zm7-15H7v1h10V3zm3 3H4v1h16V6zm2 3H2v12h20V9zM3 10h18v10H3V10z',
  later: 'M14.97 16.95 10 13.87V7h2v5.76l4.03 2.49-1.06 1.7zM12 3c-4.96 0-9 4.04-9 9s4.04 9 9 9 9-4.04 9-9-4.04-9-9-9m0-1c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z',
};
const svg = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const SUBS = '/feed/subscriptions';
const LATER = '/playlist?list=WL';

const views: Record<V, () => string> = {
  A: () => `<div class="in">
    <h1>What are you here for?</h1>
    <form role="search"><input name="q" placeholder="Search" aria-label="Search YouTube" autocomplete="off"><button aria-label="Search">${svg(icon.search)}</button></form>
    <nav><a href="${SUBS}">${svg(icon.subs)}Subscriptions</a><a href="${LATER}">${svg(icon.later)}Watch later</a></nav>
    <p class="note">D-Tox put this here in place of the home feed. Change it from the D-Tox button.</p>
  </div>`,
  B: () => `<div class="sheet"><div class="glow"></div>
    <p class="kicker">D-Tox</p>
    <h1>What are you here for?<span>Search for it, then go.</span></h1>
    <form role="search"><input name="q" placeholder="A topic, a video, a channel…" aria-label="Search YouTube" autocomplete="off"><button>Search</button></form>
    <ul>
      <li><a href="${SUBS}">${svg(icon.subs)}Subscriptions <small>new from channels you chose</small></a></li>
      <li><a href="${LATER}">${svg(icon.later)}Watch later <small>what you saved for now</small></a></li>
    </ul>
    <p class="by"><img src="${chrome.runtime.getURL('icon-48.png')}" alt="">D-Tox for YouTube · A Saaquib Labs product</p>
  </div>`,
  C: () => `<form role="search">
    <label for="dtox-q">Type it and press Enter.</label>
    <input id="dtox-q" name="q" placeholder="What are you here for?" autocomplete="off">
  </form>
  <p class="hints"><span><kbd>↵</kbd>Search</span><a href="${SUBS}"><kbd>S</kbd>Subscriptions</a><a href="${LATER}"><kbd>W</kbd>Watch later</a></p>`,
  // D: no search box of its own. The question points up at YouTube's search, which gets the cursor.
  D: () => `<div class="in">
    <span class="up" aria-hidden="true">↑</span>
    <h1>What are you here for?</h1>
    <p>Type it in YouTube's search, up there. Or go straight to:</p>
    <nav><a href="${SUBS}">${svg(icon.subs)}Subscriptions</a><a href="${LATER}">${svg(icon.later)}Watch later</a></nav>
  </div>`,
};
const ytSearch = () => document.querySelector<HTMLInputElement>('ytd-masthead input[name=search_query], ytd-masthead input#search');

const html = document.documentElement;
let variant: V = 'A';
let on = true;

const page = document.createElement('div');
page.id = 'dtox-i';
page.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = String(new FormData(e.target as HTMLFormElement).get('q') ?? '').trim();
  if (q) location.assign('/results?search_query=' + encodeURIComponent(q));
});

const bar = document.createElement('div');
bar.id = 'dtox-proto';
bar.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (b) step(Number(b.dataset.step));
});

function draw() {
  page.className = variant;
  page.innerHTML = views[variant]();
  bar.innerHTML = `<button data-step="-1" aria-label="Previous variant">◀</button><span>Intention Page ${variant} · ${VARIANTS[variant]}</span><button data-step="1" aria-label="Next variant">▶</button>`;
  if (location.pathname === '/') ((variant === 'D' ? ytSearch() : page.querySelector('input')) as HTMLInputElement | null)?.focus({ preventScroll: true });
}

function step(d: number) {
  const keys = Object.keys(VARIANTS) as V[];
  variant = keys[(keys.indexOf(variant) + d + keys.length) % keys.length]!;
  chrome.storage.local.set({ protoIntention: variant });
  draw();
}

function mount() {
  const home = location.pathname === '/';
  html.toggleAttribute('data-dtox-on-home', home);
  if (!bar.isConnected && document.body) document.body.append(bar);
  const browse = document.querySelector('ytd-browse[page-subtype=home]');
  if (browse && page.parentElement !== browse) {
    browse.prepend(page);
    draw();
  }
}

function applyHome(home: string) {
  if (on && home === 'intention') html.setAttribute('data-dtox-home', 'intention');
  else html.removeAttribute('data-dtox-home');
}

document.addEventListener('yt-navigate-finish', mount);
document.addEventListener('yt-page-data-updated', mount);
document.addEventListener('DOMContentLoaded', mount);
document.addEventListener('keydown', (e) => {
  if (location.pathname !== '/' || !html.hasAttribute('data-dtox-home')) return;
  const t = e.target as HTMLElement;
  if (t.matches('input, textarea, [contenteditable], [contenteditable] *')) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') step(e.key === 'ArrowLeft' ? -1 : 1);
  else if (variant === 'C' && (e.key === 's' || e.key === 'w')) location.assign(e.key === 's' ? SUBS : LATER);
});

// Intention Page is the Calm Default, so draw nothing of the feed until storage answers.
html.setAttribute('data-dtox-home', 'intention');
let homeChoice = 'intention';
Promise.all([chrome.storage.sync.get({ enabled: true, home: 'intention' }), chrome.storage.local.get({ protoIntention: 'A' })]).then(([s, l]) => {
  on = s.enabled === true;
  homeChoice = String(s.home);
  variant = (l.protoIntention as V) in VARIANTS ? (l.protoIntention as V) : 'A';
  applyHome(homeChoice);
  if (on && homeChoice === 'subscriptions' && location.pathname === '/') location.replace(SUBS);
  draw();
  mount();
});
chrome.storage.sync.onChanged.addListener((c) => {
  if (c.enabled) on = c.enabled.newValue !== false;
  if (c.home) homeChoice = String(c.home.newValue ?? 'intention');
  applyHome(homeChoice);
});
chrome.storage.local.onChanged.addListener((c) => {
  if (c.protoIntention && c.protoIntention.newValue !== variant) {
    variant = c.protoIntention.newValue as V;
    draw();
  }
});
