import { resolveFov } from './core.js';
import { format, onInput, readNumber, setText, showError, trackTool } from '../shared-ui.js';

const fill = (text, vars) => String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));

function render() {
  const shapes = TOOL.aspects;
  const find = (id) => shapes.find((s) => s.id === id);
  const from = find(document.getElementById('fromAspect').value);
  const to = find(document.getElementById('toAspect').value);
  const r = resolveFov({ fov: readNumber('fov'), type: document.getElementById('fovType').value, from, to });
  const box = document.getElementById('toolResult');
  if (!r.ok) {
    showError(document.getElementById('toolError'), STR[r.code] || r.code);
    box.hidden = true;
    trackTool('tool_error', { code: r.code });
    return;
  }
  showError(document.getElementById('toolError'), '');
  box.hidden = false;
  trackTool('tool_use');
  const degText = (x) => `${format(x, 2)}°`;
  setText(document.getElementById('resV'), degText(r.v));
  setText(document.getElementById('resHFrom'), degText(r.hFrom));
  setText(document.getElementById('resHTo'), degText(r.hTo));
  setText(document.getElementById('resH169'), degText(r.h169));
  setText(document.getElementById('resFromLabel'), from.id);
  setText(document.getElementById('resToLabel'), to.id);
  setText(document.getElementById('fovNote'), fill(STR['tu.fov.multNote'], {
    from: degText(r.hFrom), to: degText(r.hTo), mult: format(r.sensMult, 4),
  }));
}

const form = document.getElementById('toolForm');
if (form) {
  onInput(form, render);
  render();
}
