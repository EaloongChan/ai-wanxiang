/**
 * Small helpers shared by every tool page's ui.js. Pure DOM glue: no maths here.
 *
 * STR is a const from the bundle prelude (see scripts/build.mjs): the flat table of this
 * page's language. Tool scripts are built once per language, so no lookup logic is needed.
 */

/** A string from this page's language table (STR, injected by the build). */
export const str = (key) => (typeof STR !== 'undefined' && STR[key] !== undefined ? STR[key] : key);

/** Fill {name} placeholders in a string taken from STR. */
export function fillText(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/**
 * Report a tool event, once per page. The beacon is absent unless analytics is enabled, in
 * which case this is a silent no-op. The tool id comes from the bundle prelude (TOOL.id).
 */
const reported = new Set();
export function trackTool(kind, extra = {}) {
  if (typeof window.__track !== 'function') return;
  const tool = (typeof TOOL !== 'undefined' && TOOL && TOOL.id) || 'unknown';
  const key = `${tool}:${kind}:${extra.code || ''}`;
  if (reported.has(key)) return;
  reported.add(key);
  window.__track(kind, Object.assign({ tool }, extra));
}

/** Copy to the clipboard. Resolves to whether it worked. Never throws. */
export function copyText(text) {
  return new Promise((resolve) => {
    const fallback = () => {
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        area.remove();
        resolve(ok);
      } catch {
        resolve(false);
      }
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => resolve(true), fallback);
    } else {
      fallback();
    }
  });
}

const flash = (btn, ok) => {
  const label = btn.querySelector('span');
  const before = label ? label.textContent : '';
  btn.classList.remove('copied');
  btn.classList.add(ok ? 'copied' : 'failed');
  if (label) label.textContent = ok ? str('copy.done') : str('copy.fail');
  clearTimeout(btn._flashTimer);
  btn._flashTimer = setTimeout(() => {
    btn.classList.remove('copied', 'failed');
    if (label) label.textContent = before;
  }, 1400);
};

/**
 * Handle every [data-copy] button under root. The attribute names the id of the element
 * whose text is copied; data-copy-text copies the attribute value itself.
 */
export function bindCopy(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-copy], [data-copy-text]');
    if (!btn) return;
    const text = btn.dataset.copyText || (document.getElementById(btn.dataset.copy) || {}).textContent || '';
    if (!text) return;
    copyText(text).then((ok) => flash(btn, ok));
  });
}

export function copyOn(btn, getText) {
  if (btn) btn.addEventListener('click', () => copyText(getText()).then((ok) => flash(btn, ok)));
}

export function showError(node, message) {
  if (!node) return;
  node.textContent = message;
  node.hidden = !message;
}

export function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

/** Value of a number input as a number, or NaN when empty or invalid. */
export function readNumber(id) {
  const raw = (document.getElementById(id) || {}).value;
  if (raw === undefined || String(raw).trim() === '') return NaN;
  return Number(raw);
}

/** Fixed decimals, trailing zeros trimmed, thousands separated. */
export function format(value, maxDigits = 4) {
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(maxDigits)).toLocaleString('en-US', { maximumFractionDigits: maxDigits });
}

export function onInput(form, handler) {
  form.addEventListener('input', handler);
  form.addEventListener('change', handler);
  form.addEventListener('submit', (e) => { e.preventDefault(); handler(); });
}
