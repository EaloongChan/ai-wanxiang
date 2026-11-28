import { convertAll } from './core.js';
import { bindCopy, format, onInput, readNumber, setText, showError, trackTool } from '../shared-ui.js';

function render() {
  const games = TOOL.games;
  const from = games.find((g) => g.id === document.getElementById('fromGame').value);
  const to = games.find((g) => g.id === document.getElementById('toGame').value);
  const dpiToRaw = document.getElementById('dpiTo').value.trim();
  const result = convertAll({ sens: readNumber('sens'), dpi: readNumber('dpi'), dpiTo: dpiToRaw === '' ? '' : Number(dpiToRaw), from, to, games });
  const box = document.getElementById('toolResult');
  if (!result.ok) {
    showError(document.getElementById('toolError'), STR[result.code] || result.code);
    box.hidden = true;
    trackTool('tool_error', { code: result.code });
    return;
  }
  showError(document.getElementById('toolError'), '');
  box.hidden = false;
  trackTool('tool_use');
  setText(document.getElementById('resToName'), to.name);
  setText(document.getElementById('resSens'), format(result.toSens, 4));
  setText(document.getElementById('resCm'), `${format(result.cm, 2)} cm`);
  setText(document.getElementById('resIn'), `${format(result.inches, 2)} in`);
  setText(document.getElementById('resCounts'), format(result.counts, 0));
  setText(document.getElementById('resEdpi'), format(result.edpi, 1));
  document.getElementById('resTable').innerHTML = result.rows.map((r) => `<tr${r.id === to.id ? ' class="is-target"' : ''}><td>${r.name}</td><td>${format(r.sens, 4)}</td><td>${r.yaw}</td></tr>`).join('');
}

const form = document.getElementById('toolForm');
if (form) {
  onInput(form, render);
  bindCopy(document.getElementById('toolResult'));
  render();
}
