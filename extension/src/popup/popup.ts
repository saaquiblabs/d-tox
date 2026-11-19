import settings from '../../../settings.json' with { type: 'json' };

// The popup: the master switch, how many Settings are on, a tab per group, and a row per Setting
// (icon, name, short hint, "?" for the full line, switch). Home is three radio buttons. Each
// change is written to chrome.storage.sync; the content script in every open YouTube tab picks it
// up at once. The controls are native inputs, so keyboard and screen readers get them for free.
type Setting = (typeof settings)[number];

const defaults: Record<string, boolean | string> = { enabled: true };
for (const s of settings) defaults[s.id] = s.calmDefault;

const groups = [...new Set(settings.map((s) => s.group))];

/** Line icons, drawn on a 24px grid (the same ones as the product page). */
const icons: Record<string, string> = {
  home: '<path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>',
  recommendations: '<rect x="3.5" y="5" width="7" height="5" rx="1.5"/><rect x="3.5" y="14" width="7" height="5" rx="1.5"/><path d="M14 6.5h6.5M14 9h4M14 15.5h6.5M14 18h4"/>',
  'end-screens': '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><rect x="6.5" y="12" width="4.5" height="4" rx="1"/><rect x="13" y="12" width="4.5" height="4" rx="1"/>',
  'autoplay-off': '<path d="M5 6v12l8-6zM16 6v12M19.5 6v12"/>',
  comments: '<path d="M4 5.5h16v11H9.5L4 20.5z"/>',
  shorts: '<path d="M14 3 6.5 13H12l-2 8 7.5-10H12z"/>',
  'shorts-redirect': '<rect x="3" y="6" width="10" height="12" rx="2"/><path d="M16 12h5M18.5 9.5 21 12l-2.5 2.5"/>',
  'search-clean-up': '<circle cx="10.5" cy="10.5" r="6"/><path d="m20 20-5-5"/>',
  explore: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2 2 0 0 0 4 0"/>',
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}
const attrs = <E extends Element>(e: E, a: Record<string, string>) => {
  for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
  return e;
};

const master = document.getElementById('enabled') as HTMLInputElement;
const status = document.getElementById('status')!;
const ticks = document.querySelector('.ticks')!;
const tablist = document.querySelector('.tabs')!;
const panels = document.getElementById('panels')!;
document.getElementById('version')!.textContent = 'v' + chrome.runtime.getManifest().version;
for (let i = 0; i < settings.length; i++) ticks.append(el('i'));

const values: Record<string, boolean | string> = {};
const isOn = (s: Setting) => (s.type === 'choice' ? values[s.id] !== 'default' : values[s.id] === true);
const save = (id: string, value: boolean | string) => {
  values[id] = value;
  chrome.storage.sync.set({ [id]: value });
  refresh();
};

/** The count, the ticks, a dot on each tab that has a Setting on, and the off state. */
function refresh() {
  const n = settings.filter(isOn).length;
  document.body.classList.toggle('off', !values.enabled);
  status.replaceChildren(
    ...(values.enabled ? [el('b', {}, String(n)), ` of ${settings.length} on`] : [el('b', {}, 'Off'), ' YouTube shows everything. Your Settings are kept.']),
  );
  ticks.querySelectorAll('i').forEach((t, i) => t.classList.toggle('on', i < n));
  for (const tab of tablist.querySelectorAll<HTMLElement>('[role=tab]'))
    tab.classList.toggle('dot', settings.some((s) => s.group === tab.dataset.group && isOn(s)));
}

function row(s: Setting) {
  const hides = el('p', { className: 'hides', id: s.id + '-hides', hidden: true }, s.hides);
  const more = attrs(el('button', { className: 'more', type: 'button' }, '?'), {
    'aria-label': 'More about ' + s.name,
    'aria-expanded': 'false',
    'aria-controls': hides.id,
  });
  more.addEventListener('click', () => {
    hides.hidden = !hides.hidden;
    more.setAttribute('aria-expanded', String(!hides.hidden));
  });
  const icon = el('span', { className: 'ic' });
  icon.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[s.id] ?? ''}</svg>`;
  const name = el('span', { className: 'nm', id: s.id + '-name' }, el('span', {}, s.name), el('small', {}, s.hint));

  if (s.choices) {
    const seg = attrs(el('div', { className: 'seg' }), { role: 'radiogroup', 'aria-labelledby': name.id, 'aria-describedby': hides.id });
    for (const c of s.choices) {
      const radio = el('input', { type: 'radio', name: s.id, value: c.id, checked: values[s.id] === c.id });
      radio.addEventListener('change', () => save(s.id, c.id));
      seg.append(el('label', {}, radio, c.name));
    }
    return el('div', { className: 'row choice' }, icon, name, more, seg, hides);
  }
  const sw = attrs(el('input', { type: 'checkbox', className: 'sw', id: s.id, checked: values[s.id] === true }), {
    role: 'switch',
    'aria-label': s.name,
    'aria-describedby': hides.id,
  });
  sw.addEventListener('change', () => save(s.id, sw.checked));
  return el('div', { className: 'row' }, icon, el('label', { htmlFor: s.id, className: 'for' }, name), more, sw, hides);
}

function select(tab: HTMLElement, focus = false) {
  for (const t of tablist.querySelectorAll<HTMLElement>('[role=tab]')) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute('aria-controls')!)!.hidden = !on;
  }
  if (focus) tab.focus();
}

// Build only once storage has answered, so no control ever shows the wrong state: a switch drawn
// off and then turned on would undo a click that landed in between.
chrome.storage.sync.get(defaults).then((stored) => {
  Object.assign(values, stored);
  master.checked = values.enabled === true;
  master.disabled = false;
  master.addEventListener('change', () => save('enabled', master.checked));

  for (const g of groups) {
    const id = g.toLowerCase();
    const tab = attrs(el('button', { type: 'button', id: 'tab-' + id }, g), { role: 'tab', 'aria-controls': 'panel-' + id });
    tab.dataset.group = g;
    tab.addEventListener('click', () => select(tab));
    tablist.append(tab);
    const panel = attrs(el('div', { className: 'panel', id: 'panel-' + id }), { role: 'tabpanel', 'aria-labelledby': tab.id });
    panel.append(...settings.filter((s) => s.group === g).map(row));
    panels.append(panel);
  }
  // Arrow keys move between tabs (the tab pattern); Tab goes on into the open panel.
  tablist.addEventListener('keydown', (e) => {
    const tabs = [...tablist.querySelectorAll<HTMLElement>('[role=tab]')];
    const i = tabs.indexOf(document.activeElement as HTMLElement);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[(e as KeyboardEvent).key];
    if (i < 0 || to === undefined) return;
    e.preventDefault();
    select(tabs[(to + tabs.length) % tabs.length]!, true);
  });
  select(tablist.querySelector('[role=tab]')!);
  refresh();
});
