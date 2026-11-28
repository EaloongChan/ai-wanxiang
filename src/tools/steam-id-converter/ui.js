import { convert } from './core.js';
import { bindCopy, fillText, showError, setText, trackTool } from '../shared-ui.js';

const input = document.getElementById('steamInput');
const result = document.getElementById('toolResult');

function render() {
  const r = convert(input.value);
  showError(document.getElementById('toolError'), r.code ? STR[r.code] || r.code : '');
  if (!r.ok) {
    result.hidden = true;
    if (r.code) trackTool('tool_error', { code: r.code });
    return;
  }
  result.hidden = false;
  trackTool('tool_use');
  setText(document.getElementById('resAccount'), r.accountId);
  setText(document.getElementById('resId64'), r.id64);
  setText(document.getElementById('resId3'), r.id3);
  setText(document.getElementById('resId2'), r.id2);
  setText(document.getElementById('resUrl'), r.url);
  setText(document.getElementById('resMeta'), fillText(STR['tu.steam.meta'], { via: r.via }));
}

if (input && result) {
  input.addEventListener('input', render);
  document.getElementById('toolForm').addEventListener('submit', (e) => { e.preventDefault(); render(); });
  bindCopy(result);
  render();
}
