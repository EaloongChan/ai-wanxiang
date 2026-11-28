/** Shared helpers for page rendering. Pure functions only: no file or network access. */

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** For JSON embedded inside <script>: must not be able to close the tag or break the line. */
export function jsonEmbed(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** meta description excerpt: cut at a sentence boundary so the snippet reads whole. */
export function metaExcerpt(text, max = 160) {
  const s = String(text || '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sentence = cut.match(/^[\s\S]*[.!?;]/);
  if (sentence && sentence[0].length > max * 0.5) return sentence[0].trimEnd();
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd() + '…';
}

const fmt = new Intl.NumberFormat('en-US');

export function fmtInt(n) {
  return fmt.format(Math.round(Number(n) || 0));
}

/** "a few seconds" style duration for prose. */
export function fmtDuration(seconds) {
  const s = Math.round(seconds);
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  return `${h} hour${h === 1 ? '' : 's'}`;
}

/** Domain of a URL without the scheme, for display. */
export function hostOf(url) {
  return String(url || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

/** Percentage with one decimal only when it matters. */
export function fmtPct(x, digits = 0) {
  return `${(x * 100).toFixed(digits)}%`;
}
