import { buildCodes, localToEpoch, parseCode, presets, preview, toInputs } from './core.js';
import { bindCopy, fillText, onInput, showError, str, setText, trackTool } from '../shared-ui.js';

const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const S = str;

/** Turn { n, unit, past } into a sentence in this page's language. */
function relText(parts) {
  if (parts.zero) return S('tu.ts.now');
  const unit = S(`tu.ts.u.${parts.unit}`);
  // English units are Latin words and take a plural s; Chinese units are single characters.
  const word = parts.n === 1 || !/^[a-z]+$/i.test(unit) ? unit : `${unit}s`;
  return fillText(S(parts.past ? 'tu.ts.relAgo' : 'tu.ts.relIn'), { n: parts.n, unit: word });
}

const list = document.getElementById('tsList');
const decode = document.getElementById('tsDecode');

function render() {
  const epoch = localToEpoch(document.getElementById('tsDate').value, document.getElementById('tsTime').value);
  if (epoch === null) {
    showError(document.getElementById('toolError'), S('err.pickDate'));
    list.innerHTML = '';
    trackTool('tool_error', { code: 'err.pickDate' });
    return;
  }
  showError(document.getElementById('toolError'), '');
  trackTool('tool_use');
  list.innerHTML = buildCodes(epoch, Date.now() / 1000, navigator.language || 'en-US', relText).map((c) => {
    const label = S(`tu.ts.style.${c.code}`);
    return `<div class="copy-row"><span class="copy-label">${label}</span><code>${escAttr(c.preview)}</code><button class="copy-btn" type="button" data-copy-text="${escAttr(c.syntax)}" aria-label="${escAttr(`${S('copy.button')}: ${label}`)}"><svg class="ic" width="16" height="16" aria-hidden="true" focusable="false"><use href="#i-copy"/></svg><span>${S('copy.button')}</span></button></div>`;
  }).join('');
}

function readDecode() {
  const text = decode.value.trim();
  const out = document.getElementById('tsDecoded');
  if (!text) { out.textContent = ''; return; }
  const seconds = parseCode(text);
  out.textContent = seconds === null
    ? S('tu.ts.noCode')
    : fillText(S('tu.ts.decoded'), {
      when: preview('F', seconds, Date.now() / 1000, navigator.language || 'en-US'),
      rel: preview('R', seconds, Date.now() / 1000, 'en-US', relText),
    });
}

const form = document.getElementById('toolForm');
if (form && list) {
  const initial = toInputs(Date.now() / 1000);
  document.getElementById('tsDate').value = initial.date;
  document.getElementById('tsTime').value = initial.time;
  setText(document.getElementById('tsZone'), fillText(S('tu.tz'), { tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '' }));
  onInput(form, render);
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    const pick = toInputs(presets()[btn.dataset.preset]);
    document.getElementById('tsDate').value = pick.date;
    document.getElementById('tsTime').value = pick.time;
    render();
  });
  bindCopy(list);
  decode.addEventListener('input', readDecode);
  render();
}
