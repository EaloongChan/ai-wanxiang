/**
 * The analytics script tag, or nothing.
 *
 * Two switches must both be on: `flags.analytics` (the promise made on the privacy page)
 * and `beacon.enabled` (the Worker is actually deployed). Until then the site ships without
 * any analytics at all, which is what the privacy page says by default.
 *
 * The endpoint and page travel in data attributes rather than an inline script, so a strict
 * Content-Security-Policy with `script-src 'self'` can stay in force.
 */
export function beaconTag(site, lang, path) {
  const on = site.flags && site.flags.analytics && site.beacon && site.beacon.enabled && site.asset && site.asset.beacon;
  if (!on) return '';
  const page = (lang === 'zh' ? '/zh' : '') + path;
  return `<script src="/assets/${site.asset.beacon}" id="beacon" data-endpoint="${site.beacon.endpoint || '/api/e'}" data-page="${page}" data-lang="${lang === 'zh' ? 'zh' : 'en'}" defer></script>`;
}
