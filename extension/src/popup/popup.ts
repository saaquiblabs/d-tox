import settings from '../../../settings.json';

// A switch for the master and for every Setting in the list. Each change is written to
// chrome.storage.sync; the content script in every open YouTube tab picks it up at once.
const defaults: Record<string, boolean | string> = { enabled: true };
for (const s of settings) defaults[s.id] = s.calmDefault;

const form = document.getElementById('settings') as HTMLFormElement;
const groups = new Map<string, HTMLFieldSetElement>();

for (const s of settings) {
  let group = groups.get(s.group);
  if (!group) {
    group = document.createElement('fieldset');
    group.append(Object.assign(document.createElement('legend'), { textContent: s.group }));
    groups.set(s.group, group);
    form.append(group);
  }
  const input = Object.assign(document.createElement('input'), { type: 'checkbox', id: s.id });
  input.setAttribute('aria-describedby', s.id + '-hides');
  const label = document.createElement('label');
  label.append(input, ' ' + s.name);
  const hides = Object.assign(document.createElement('small'), { id: s.id + '-hides', textContent: s.hides });
  group.append(label, hides);
}

chrome.storage.sync.get(defaults).then((stored) => {
  for (const id in defaults) {
    const input = document.getElementById(id) as HTMLInputElement;
    input.checked = stored[id] === true;
    input.addEventListener('change', () => chrome.storage.sync.set({ [id]: input.checked }));
  }
});
