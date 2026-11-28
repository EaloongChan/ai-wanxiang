/**
 * Inline SVG icon set (stroke style, follows currentColor)
 *
 * Rendered as an SVG sprite: each icon is defined once per page (<symbol>) and used
 * with <use href="#i-name">, so a repeated icon costs a few bytes.
 *
 *   icon('play', 18)
 */
const P = {
  'gamepad': '<path d="M6.5 7.5h11a4.5 4.5 0 0 1 4.4 5.5l-.9 3.6a2.2 2.2 0 0 1-3.8 1l-1.9-2.3H8.7l-1.9 2.3a2.2 2.2 0 0 1-3.8-1l-.9-3.6a4.5 4.5 0 0 1 4.4-5.5z"/><path d="M8 10.5v3M6.5 12h3M16.5 11.2v.01M18.2 12.8v.01"/>',
  'tool': '<path d="M14.5 6.5a4 4 0 0 0-5.3 5L4 16.7a1.8 1.8 0 0 0 2.5 2.5l5.2-5.2a4 4 0 0 0 5-5.3l-2.3 2.3-2.3-2.3z"/>',
  'mouse': '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 3v6"/>',
  'screen': '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M9 20h6M12 17v3"/>',
  'id-card': '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 9.5h5M14 13h3.5"/>',
  'clock': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  'spark': '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="2.4"/>',
  'chat': '<path d="M20 12.5a7.5 7.5 0 0 1-10.9 6.7L4 20.5l1.4-4.9A7.5 7.5 0 1 1 20 12.5z"/>',
  'gear': '<path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9c.26.63.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09c-.68 0-1.3.4-1.51.97z"/><circle cx="12" cy="12" r="3"/>',
  'play': '<path d="M7 4.5v15l12-7.5z"/>',
  'axe': '<path d="M13.5 8.5 5 20"/><path d="M12 4.5c2.5-1.5 5.5-1.5 7.5 0 1 3-1 5.5-3.5 6.5-1.5-2-2.5-4.5-4-6.5z"/>',
  'tree': '<path d="M12 21v-5"/><path d="M12 3 6.5 11h3L5.5 16h13l-4-5h3z"/>',
  'bolt': '<path d="M13.5 3 5 13.5h5.5L10 21l8.5-10.5H13z"/>',
  'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
  'x': '<path d="M6 6l12 12M18 6 6 18"/>',
  'arrow-right': '<path d="M4 12h15M13 6l6 6-6 6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M8.5 7H17v8.5"/>',
  'chevron-down': '<path d="M6 9.5 12 15.5l6-6"/>',
  'chevron-up': '<path d="M6 14.5 12 8.5l6 6"/>',
  'copy': '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  'check': '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  'external': '<path d="M14 4.5h5.5V10"/><path d="M19 5 10.5 13.5"/><path d="M18 14.5v4a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.4"/>',
  'lock': '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  'refresh': '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5V10H9"/>',
  'sound-on': '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
  'sound-off': '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  'download': '<path d="M12 4v11M7.5 11 12 15.5 16.5 11"/><path d="M5 19.5h14"/>',
  'upload': '<path d="M12 15V4M7.5 8 12 3.5 16.5 8"/><path d="M5 19.5h14"/>',
  'github': '<path d="M9 20.5c-4.5 1.4-4.5-2.3-6-2.7m12 4.2v-3.3a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6 0C6.5 3.7 5.5 4 5.5 4a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 10.4c0 4.7 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3v3.3"/>',
};

/** Icons used on the current page; layout() turns this into the sprite. */
const used = new Set();

export function icon(name, size = 18, cls = '') {
  const key = Object.prototype.hasOwnProperty.call(P, name) ? name : 'bolt';
  used.add(key);
  return `<svg class="ic ${cls}" width="${size}" height="${size}" aria-hidden="true" focusable="false"><use href="#i-${key}"/></svg>`;
}

/** Call before rendering each page so icons from the previous page do not leak in. */
export function resetIcons() {
  used.clear();
}

/** The <symbol> definitions for this page. Must come before any <use>. */
export function iconSprite() {
  const names = [...used].sort();
  if (!names.length) return '';
  const body = names.map(
    (n) => `<symbol id="i-${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${P[n]}</symbol>`,
  ).join('');
  // A class, not a style attribute: the site runs under `style-src 'self'` and an inline
  // style here would be refused (it was, once) and log a CSP violation on every page.
  return `<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(P, name);
}

/** Icons a page's runtime script may swap in dynamically (so they are always in the sprite). */
export function reserveIcons(names) {
  for (const n of names) if (P[n]) used.add(n);
}
