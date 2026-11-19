import settings from '../../../settings.json' with { type: 'json' };

// A switch for the master and for every switch Setting, a select for a choice (Home). Each change
// is written to chrome.storage.sync; the content script in every open YouTube tab picks it up at once.
const defaults: Record<string, boolean | string> = { enabled: true };
for (const s of settings) defaults[s.id] = s.calmDefault;

const form = document.getElementById('settings') as HTMLFormElement;
const groups = new Map<string, HTMLFieldSetElement>();

// Build the switches only once storage has answered, so none ever shows the wrong state: a
// switch drawn off and then turned on would undo a click that landed in between.
chrome.storage.sync.get(defaults).then((stored) => {
  const master = document.getElementById('enabled') as HTMLInputElement;
  master.checked = stored.enabled === true;
  master.disabled = false;
  master.addEventListener('change', () => chrome.storage.sync.set({ enabled: master.checked }));

  for (const s of settings) {
    let group = groups.get(s.group);
    if (!group) {
      group = document.createElement('fieldset');
      group.append(Object.assign(document.createElement('legend'), { textContent: s.group }));
      groups.set(s.group, group);
      form.append(group);
    }
    const label = document.createElement('label');
    if (s.choices) {
      const select = Object.assign(document.createElement('select'), { id: s.id });
      for (const c of s.choices) select.append(new Option(c.name, c.id, false, stored[s.id] === c.id));
      select.setAttribute('aria-describedby', s.id + '-hides');
      select.addEventListener('change', () => chrome.storage.sync.set({ [s.id]: select.value }));
      label.append(s.name + ' ', select);
    } else {
      const input = Object.assign(document.createElement('input'), { type: 'checkbox', id: s.id, checked: stored[s.id] === true });
      input.setAttribute('aria-describedby', s.id + '-hides');
      input.addEventListener('change', () => chrome.storage.sync.set({ [s.id]: input.checked }));
      label.append(input, ' ' + s.name);
    }
    const hides = Object.assign(document.createElement('small'), { id: s.id + '-hides', textContent: s.hides });
    group.append(label, hides);
  }
});
