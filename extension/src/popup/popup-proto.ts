// PROTOTYPE (#22), throwaway. Three popup variants on one page, switched from the yellow bar at the
// bottom or with ← →. The switches are real: they write chrome.storage.sync like popup.ts, so the
// open YouTube tabs change at once. The Home choice (#21) is stored as `home` and only the
// Intention Page prototype reads it. Variant and theme (review only) live in chrome.storage.local.
import list from '../../../settings.json' with { type: 'json' };

type S = { id: string; name: string; hides: string; group: string; type: string; calmDefault: boolean | string };
const home: S = {
  id: 'home', name: 'Home', group: 'Home', type: 'choice', calmDefault: 'intention',
  hides: '',
};
const homeChoices = [
  { value: 'intention', label: 'Intention Page', line: 'Home shows “What are you here for?” and a search box, not the feed.' },
  { value: 'subscriptions', label: 'Subscriptions', line: 'Home opens your Subscriptions instead of the feed.' },
  { value: 'default', label: 'YouTube', line: 'Home is YouTube’s own recommended feed.' },
];
const settings: S[] = [home, ...(list as S[])];
const groups = ['Home', 'Watch', 'Shorts', 'Search', 'Everywhere'];
const VARIANTS = { A: 'Settings list', B: 'Graphite card + tabs', C: 'Checklist' } as const;
type V = keyof typeof VARIANTS;
const THEMES = ['system', 'light', 'dark'] as const;
const links = [
  { label: 'Privacy', href: 'https://d-tox.saaquiblabs.com/privacy' },
  { label: 'Changelog', href: 'https://github.com/saaquiblabs/d-tox/releases' },
  { label: 'Sponsor', href: 'https://github.com/sponsors/saaquiblabs' },
];

const defaults: Record<string, boolean | string> = { enabled: true };
for (const s of settings) defaults[s.id] = s.calmDefault;

let values: Record<string, boolean | string> = {};
let variant: V = 'A';
let theme: (typeof THEMES)[number] = 'system';
let tab = 'Home'; // B's open group

if (new URLSearchParams(location.search).has('tab')) document.body.classList.add('tab');

const h = (html: string) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`);
const inGroup = (g: string) => settings.filter((s) => s.group === g);
const isOn = (s: S) => (s.type === 'choice' ? values[s.id] !== 'default' : values[s.id] === true);
const onCount = () => settings.filter(isOn).length;
const groupOn = (g: string) => inGroup(g).filter(isOn).length;
const homeLine = () => homeChoices.find((c) => c.value === values.home)?.line ?? '';

const foot = (extra = '') => `<footer class="foot">${extra}${links.map((l) => `<a href="${l.href}" target="_blank">${l.label}</a>`).join('')}<span class="ver">v2.0.0</span></footer>`;
const mark = `<span class="mark"><img src="proto-mark-48.png" alt="">D-Tox</span>`;
const sw = (id: string, label: string, big = false) =>
  `<input type="checkbox" role="switch" class="sw${big ? ' big' : ''}" data-id="${id}" aria-label="${esc(label)}" ${values[id] === true ? 'checked' : ''}>`;
const seg = () =>
  `<div class="seg" role="radiogroup" aria-label="Home">${homeChoices
    .map((c) => `<label><input type="radio" name="home" value="${c.value}" ${values.home === c.value ? 'checked' : ''}>${c.label}</label>`)
    .join('')}</div>`;

function A() {
  return `<div class="A${values.enabled ? '' : ' off'}">
    <header>${mark}${sw('enabled', 'D-Tox', true)}</header>
    <p class="status">${values.enabled ? `On · ${onCount()} of ${settings.length} Settings` : 'Off · YouTube is showing everything'}</p>
    <div class="groups">${groups
      .map((g) => `<section><h2>${g}</h2>${inGroup(g)
        .map((s) => s.type === 'choice'
          ? `<div class="home">${seg()}<p class="hides">${homeLine()}</p></div>`
          : `<div class="row"><div><p class="name">${esc(s.name)}</p><p class="hides">${esc(s.hides)}</p></div>${sw(s.id, s.name)}</div>`)
        .join('')}</section>`)
      .join('')}</div>
    ${foot()}
  </div>`;
}

function B() {
  return `<div class="B${values.enabled ? '' : ' off'}">
    <div class="card">
      <div class="top"><span class="mark"><img src="proto-mark-48.png" alt="">D-Tox</span>${sw('enabled', 'D-Tox', true)}</div>
      <h1>${values.enabled ? 'YouTube for what you came for.' : 'D-Tox is off.'}</h1>
      <p>${values.enabled ? `${onCount()} of ${settings.length} Settings on` : 'YouTube is showing everything.'}</p>
    </div>
    <div class="tabs" role="tablist">${groups
      .map((g) => `<button role="tab" data-tab="${g}" aria-selected="${g === tab}">${g}<span class="n">${groupOn(g)}/${inGroup(g).length}</span></button>`)
      .join('')}</div>
    <div class="panel" role="tabpanel">${inGroup(tab)
      .map((s) => s.type === 'choice'
        ? `<div class="item"><div class="head">Home page</div>${seg()}<p>${homeLine()}</p></div>`
        : `<div class="item"><div class="head">${esc(s.name)}${sw(s.id, s.name)}</div><p>${esc(s.hides)}</p></div>`)
      .join('')}</div>
    ${foot()}
  </div>`;
}

function C() {
  return `<div class="C${values.enabled ? '' : ' off'}">
    <header>${mark}
      <div class="master"><div class="t"><b>${values.enabled ? 'D-Tox is on' : 'D-Tox is off'}</b><span class="muted small">${values.enabled ? 'YouTube for what you came for.' : 'YouTube is showing everything.'}</span></div>${sw('enabled', 'D-Tox', true)}</div>
    </header>
    <p class="banner">Your Settings are kept. Turn D-Tox on to use them again.</p>
    <div class="groups">${groups
      .map((g) => `<details ${openC.has(g) ? 'open' : ''} data-g="${g}"><summary><span class="dot${groupOn(g) ? ' on' : ''}"></span>${g}<span class="count">${g === 'Home' ? homeChoices.find((c) => c.value === values.home)?.label : `${groupOn(g)} of ${inGroup(g).length} on`}</span></summary><div class="opts">${inGroup(g)
        .map((s) => s.type === 'choice'
          ? homeChoices.map((c) => `<label class="opt"><input type="radio" name="home" value="${c.value}" ${values.home === c.value ? 'checked' : ''}><span>${c.label}</span><span></span><span class="hides">${c.line}</span></label>`).join('')
          : `<label class="opt"><input type="checkbox" data-id="${s.id}" ${values[s.id] === true ? 'checked' : ''}><span>${esc(s.name)}</span><button class="i" data-more="${s.id}" aria-label="What it hides" aria-expanded="${openMore.has(s.id)}">i</button><span class="hides" ${openMore.has(s.id) ? '' : 'hidden'}>${esc(s.hides)}</span></label>`)
        .join('')}</div></details>`)
      .join('')}</div>
    ${foot()}
  </div>`;
}
const openC = new Set<string>(['Home', 'Watch']);
const openMore = new Set<string>();

const root = document.getElementById('app')!;
function render() {
  const keepFocus = (document.activeElement as HTMLElement | null)?.dataset?.id;
  document.documentElement.dataset.theme = theme === 'system' ? '' : theme;
  if (theme === 'system') delete document.documentElement.dataset.theme;
  root.replaceChildren(h({ A, B, C }[variant]()));
  root.append(h(`<div class="proto"><button data-step="-1" aria-label="Previous variant">◀</button><span class="label">${variant} · ${VARIANTS[variant]}</span><button data-step="1" aria-label="Next variant">▶</button><button data-theme-next>theme: ${theme}</button></div>`));
  if (keepFocus) (root.querySelector(`[data-id="${keepFocus}"]`) as HTMLElement | null)?.focus();
}

function step(d: number) {
  const keys = Object.keys(VARIANTS) as V[];
  variant = keys[(keys.indexOf(variant) + d + keys.length) % keys.length]!;
  chrome.storage.local.set({ protoPopup: variant });
  render();
}

root.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.name === 'home') values.home = t.value;
  else if (t.dataset.id) values[t.dataset.id] = t.checked;
  else return;
  chrome.storage.sync.set({ [t.name === 'home' ? 'home' : t.dataset.id!]: t.name === 'home' ? t.value : t.checked });
  render();
});
root.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('button, summary') as HTMLElement | null;
  if (!t) return;
  if (t.dataset.step) step(Number(t.dataset.step));
  else if ('themeNext' in t.dataset) {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]!;
    chrome.storage.local.set({ protoTheme: theme });
    render();
  } else if (t.dataset.tab) { tab = t.dataset.tab; render(); }
  else if (t.dataset.more) {
    e.preventDefault();
    openMore.has(t.dataset.more) ? openMore.delete(t.dataset.more) : openMore.add(t.dataset.more);
    render();
  } else if (t.tagName === 'SUMMARY') {
    const g = (t.parentElement as HTMLElement).dataset.g!;
    e.preventDefault();
    openC.has(g) ? openC.delete(g) : openC.add(g);
    render();
  }
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !(e.target as HTMLElement).matches('input[type=radio], [role=tab]')) step(e.key === 'ArrowLeft' ? -1 : 1);
});

Promise.all([chrome.storage.sync.get(defaults), chrome.storage.local.get({ protoPopup: 'A', protoTheme: 'system' })]).then(([sync, local]) => {
  values = sync as Record<string, boolean | string>;
  const q = new URLSearchParams(location.search);
  variant = ((q.get('variant') ?? local.protoPopup) as V) in VARIANTS ? ((q.get('variant') ?? local.protoPopup) as V) : 'A';
  theme = (q.get('theme') as typeof theme) ?? local.protoTheme;
  render();
});
chrome.storage.sync.onChanged.addListener((c) => {
  for (const k in c) values[k] = (c[k]!.newValue as boolean | string | undefined) ?? defaults[k]!;
  render();
});
