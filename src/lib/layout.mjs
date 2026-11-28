import { esc, metaExcerpt } from './utils.mjs';
import { icon, iconSprite, reserveIcons } from './icons.mjs';
import { T } from './strings.mjs';
import { LANG_ATTR, LANG_LABEL, LANGS, loc } from './i18n.mjs';

/**
 * Page shell.
 *
 * Icon order matters: icon() registers each icon as it is used, and the sprite must
 * precede every <use>. So header and footer are rendered first, the sprite is built
 * after them and placed at the top of <body>.
 *
 * Language: English lives at the root, Chinese under /zh. Every page declares both
 * versions to crawlers through hreflang, and carries a link to its counterpart.
 *
 * @param {object} o
 * @param {object} o.site        Site config (with site.asset from the build)
 * @param {string} o.lang        'en' | 'zh'
 * @param {string} o.title       Page title without the site name; '' for the home page
 * @param {string} o.description Meta description
 * @param {string} o.path        Path of this page in its own language, e.g. /games/
 * @param {string} o.body        HTML inside <main>
 * @param {string} [o.head]      Extra <head> content
 * @param {string} [o.scripts]   Extra scripts at the end of <body>
 * @param {string} [o.styles]    Extra stylesheet URLs, one per line
 * @param {object|object[]} [o.jsonld]
 * @param {string} [o.ogImage]   Absolute or root-relative share image
 * @param {string} [o.ogType]    og:type
 * @param {string} [o.robots]    robots meta content, e.g. 'noindex'
 * @param {boolean} [o.noAlternates] Skip hreflang (the 404 page has no counterpart)
 */
export function layout(o) {
  const {
    site, lang = 'en', title, description = '', path = '/', body = '',
    head = '', scripts = '', styles = '', jsonld = null, ogImage = '', ogType = 'website', robots = '', noAlternates = false,
  } = o;

  const brand = site.brand.name;
  const tagline = lang === 'zh' && site.brand.zh ? site.brand.zh.tagline : site.brand.tagline;
  const siteDesc = lang === 'zh' && site.brand.zh ? site.brand.zh.description : site.brand.description;
  const fullTitle = title ? `${title} · ${brand}` : `${brand} · ${tagline}`;
  const desc = metaExcerpt(description || siteDesc, 160);
  const base = (site.baseUrl || '').replace(/\/$/, '');
  const url = loc(path, lang);
  const canonical = base ? base + url : url;
  const a = site.asset || { css: 'main.css', print: 'print.css', js: 'app.js' };
  const og = ogImage ? (/^https?:/.test(ogImage) ? ogImage : base + ogImage) : (base ? `${base}/og.png` : '/og.png');
  const nav = site.nav || [];

  const navHtml = nav
    .map((n) => {
      const href = loc(n.href, lang);
      const label = lang === 'zh' && n.zh ? n.zh.label : n.label;
      const active = path === n.href || (n.href !== '/' && path.startsWith(n.href));
      return `<a href="${esc(href)}"${active ? ' class="active" aria-current="page"' : ''}>${esc(label)}</a>`;
    })
    .join('');

  const other = lang === 'en' ? 'zh' : 'en';
  // There is one 404 page for the whole site, so its language link goes to the other home page.
  const switchTarget = path === '/404.html' ? loc('/', other) : loc(path, other);
  const langSwitch = `<a class="nav-lang" href="${esc(switchTarget)}" hreflang="${LANG_ATTR[other]}" lang="${LANG_ATTR[other]}" aria-label="${esc(T(lang, 'lang.switch'))}">${esc(LANG_LABEL[other])}</a>`;

  const header = `<header class="header">
  <div class="container header-inner">
    <a class="logo" href="${esc(loc('/', lang))}" aria-label="${esc(T(lang, 'logo.aria', { brand }))}"><span class="logo-mark" aria-hidden="true">${esc(site.brand.logoText)}</span><span class="logo-text">${esc(brand)}</span></a>
    <nav class="nav" id="nav" aria-label="${esc(T(lang, 'nav.main'))}">${navHtml}</nav>
    <div class="header-tools">
      ${langSwitch}
      <button class="icon-btn menu-btn" id="menuBtn" aria-label="${esc(T(lang, 'menu.open'))}" aria-expanded="false" aria-controls="nav" data-open-label="${esc(T(lang, 'menu.open'))}" data-close-label="${esc(T(lang, 'menu.close'))}">${icon('menu', 20)}</button>
    </div>
  </div>
</header>`;

  const footLinks = (site.footer.links || []).map((l) => {
    const label = lang === 'zh' && l.zh ? l.zh.label : l.label;
    return `<a href="${esc(loc(l.href, lang))}">${esc(label)}</a>`;
  }).join('');
  const repo = site.footer.repoUrl
    ? `<a href="${esc(site.footer.repoUrl)}" rel="noopener" target="_blank">${icon('github', 16)} ${esc(T(lang, 'footer.source'))}<span class="sr-only"> (${esc(T(lang, 'footer.opensNew'))})</span></a>`
    : '';
  const footer = `<footer class="footer">
  <div class="container footer-inner">
    <div class="footer-brand">
      <span class="logo-mark" aria-hidden="true">${esc(site.brand.logoText)}</span>
      <p>${esc(tagline)}</p>
    </div>
    <nav class="footer-links" aria-label="${esc(T(lang, 'nav.footer'))}">
      ${footLinks}${repo}
    </nav>
  </div>
  <div class="container footer-bottom"><span>${esc(site.footer.copyright)}</span><span>${esc(site.domain)}</span></div>
</footer>`;

  const ld = (Array.isArray(jsonld) ? jsonld : jsonld ? [jsonld] : [])
    .map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`)
    .join('\n');

  const alternates = noAlternates ? '' : LANGS.map((l) => {
    const href = base + loc(path, l);
    return `<link rel="alternate" hreflang="${LANG_ATTR[l]}" href="${esc(href)}">`;
  }).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${esc(base + loc(path, 'en'))}">`;

  return `<!DOCTYPE html>
<html lang="${esc(LANG_ATTR[lang])}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#0b0e17">
${robots ? `<meta name="robots" content="${esc(robots)}">` : ''}
${site.verify && site.verify.google ? `<meta name="google-site-verification" content="${esc(site.verify.google)}">` : ''}
${site.verify && site.verify.bing ? `<meta name="msvalidate.01" content="${esc(site.verify.bing)}">` : ''}
<link rel="canonical" href="${esc(canonical)}">
${alternates}
<meta property="og:type" content="${esc(ogType)}">
<meta property="og:site_name" content="${esc(brand)}">
<meta property="og:locale" content="${lang === 'zh' ? 'zh_CN' : 'en_US'}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(og)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/ibm-plex-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/ibm-plex-mono-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/${esc(a.css)}">
<link rel="stylesheet" href="/assets/${esc(a.print)}" media="print">
${styles}
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
${head}
${ld}
</head>
<body>
${iconSprite()}
<a href="#main" class="skip-link">${esc(T(lang, 'skip.link'))}</a>
${header}
<main class="main" id="main">
${body}
</main>
${footer}
<script src="/assets/${esc(a.js)}" defer></script>
${scripts}
</body>
</html>`;
}

/** Icons a page's runtime script injects after load. Call before the page's layout() runs. */
export function runtimeIcons(names) {
  reserveIcons(names);
}
