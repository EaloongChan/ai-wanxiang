import { blankLabel, extractVars, fillVars } from './core.js';
import { copyOn, fillText, showError, str, trackTool } from '../shared-ui.js';

const S = str;

const pick = document.getElementById('ptPick');
const custom = document.getElementById('ptCustom');
const vars = document.getElementById('ptVars');
const out = document.getElementById('ptOut');
const err = document.getElementById('toolError');

const MAX_TEMPLATE = 20000;
const MAX_BLANKS = 40;
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderVars() {
  // Blank names come from whatever the visitor pasted, so they are text, never markup,
  // and the number of inputs is capped: a pathological template must not build a page
  // with thousands of fields.
  const all = extractVars(custom.value.slice(0, MAX_TEMPLATE));
  const names = all.slice(0, MAX_BLANKS);
  if (!names.length) {
    vars.innerHTML = `<p class="hint">${S('tu.pt.noBlanks')}</p>`;
    return;
  }
  // Keep what the player typed when only the text around the blanks changed.
  const before = {};
  for (const input of vars.querySelectorAll('input')) before[input.dataset.var] = input.value;
  vars.innerHTML = names.map((name, i) => `<label class="field" for="v-${i}">${escAttr(blankLabel(name))}<input class="field" type="text" id="v-${i}" data-var="${escAttr(name)}" autocomplete="off"></label>`).join('');
  for (const input of vars.querySelectorAll('input')) input.value = before[input.dataset.var] || '';
}

function render() {
  const values = {};
  for (const input of vars.querySelectorAll('input')) values[input.dataset.var] = input.value;
  if (custom.value.length > MAX_TEMPLATE) {
    out.textContent = '';
    showError(err, S('tu.pt.tooLong'));
    trackTool('tool_error', { code: 'too_long' });
    return;
  }
  const filled = fillVars(custom.value, values);
  out.textContent = filled.text;
  if (filled.text && filled.missing.length === 0) trackTool('tool_use');
  const tooMany = extractVars(custom.value).length > MAX_BLANKS;
  showError(err, tooMany
    ? S('tu.pt.tooManyBlanks')
    : (filled.missing.length
      ? fillText(S(filled.missing.length === 1 ? 'tu.pt.missingOne' : 'tu.pt.missingMany'), { n: filled.missing.length })
      : ''));
}

if (pick && custom && vars && out) {
  // The full texts are fetched after the page is interactive, so the page itself stays light.
  let full = [];
  let loading = null;
  const loadTexts = () => {
    if (!loading) {
      loading = fetch(PROMPTS_URL)
        .then((r) => r.json())
        .then((list) => { full = list; return list; })
        .catch(() => []);
    }
    return loading;
  };

  const applyPick = () => {
    const chosen = full.find((p) => p.id === pick.value);
    custom.value = chosen ? chosen.prompt : '';
    renderVars();
    render();
  };

  pick.innerHTML = PROMPT_INDEX.map((p) => `<option value="${p.id}">${p.title}</option>`).join('');
  pick.addEventListener('change', () => { loadTexts().then(applyPick); });
  custom.addEventListener('input', () => { renderVars(); render(); });
  vars.addEventListener('input', render);
  document.getElementById('toolForm').addEventListener('submit', (e) => e.preventDefault());
  copyOn(document.getElementById('ptCopy'), () => out.textContent);
  renderVars();
  loadTexts().then(applyPick);
}
