/**
 * Prompt templates. Pure functions.
 *
 * A blank is written {{like this}}. PROMPTS (the template list) comes from the bundle
 * prelude, built from the legacy prompt dataset.
 */
const VAR = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** Blank names in the order they first appear, without duplicates. */
export function extractVars(template) {
  const out = [];
  for (const [, name] of String(template || '').matchAll(VAR)) {
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/** The template cut into text and blank pieces, for highlighting. */
export function splitTemplate(template) {
  const out = [];
  let last = 0;
  const text = String(template || '');
  for (const m of text.matchAll(VAR)) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) });
    out.push({ type: 'var', value: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

/** Replace every blank with its value. A blank with no value is left in place and named in `missing`. */
export function fillVars(template, values = {}) {
  const missing = [];
  const text = String(template || '').replace(VAR, (whole, name) => {
    const v = values[name];
    if (v === undefined || v === null || String(v).trim() === '') {
      missing.push(name);
      return whole;
    }
    return String(v).trim();
  });
  return { text, missing };
}

/** A label for a blank's input field: "target audience" from "{{targetAudience}}". */
export function blankLabel(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
