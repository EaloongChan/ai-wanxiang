/**
 * Page templates. Each function takes the build context ({ site, games, tools, docs }),
 * a content record and a language, and returns a complete HTML document.
 *
 * Every visible string comes from one of three places:
 *   · src/lib/strings.mjs  — fixed labels (nav, buttons, table heads, hints)
 *   · data/*.json          — content, English at the top level and Chinese under `zh`
 *   · data/…/config.json   — game numbers and the names of trees, districts and upgrades
 * No language is ever hard-coded in a template.
 */
import { layout, runtimeIcons } from './layout.mjs';
import { esc, fmtInt, metaExcerpt } from './utils.mjs';
import { icon } from './icons.mjs';
import { T } from './strings.mjs';
import { fill, loc, localizeLinks, pick } from './i18n.mjs';
import { gameCard, toolCard, gameShell, GAME_RUNTIME_ICONS, toolShell, prose, faq } from './components.mjs';

export { gameShell, GAME_RUNTIME_ICONS };

const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pct0 = (x) => `${Math.round(x * 100)}%`;
const t = (lang, key, vars) => esc(T(lang, key, vars));

/** Replace {{tokens}} in data text with values taken from the game config, so prose never drifts from the numbers. */
function fromConfig(config) {
  return {
    comboWindow: config.combo.baseWindow,
    comboStep: config.combo.step,
    comboBonus: pct0(config.combo.bonusPerStep),
    comboMax: `${(1 + config.combo.maxSteps * config.combo.bonusPerStep).toFixed(1)}×`,
    prestigeBonus: pct0(config.prestige.bonusPerPoint),
    offlineEff: pct0(config.offline.baseEfficiency),
    // Hours only: the unit belongs to the prose, which is written per language.
    offlineCapHours: config.offline.baseCapSeconds / 3600,
  };
}

const fillText = (text, values, lang) => localizeLinks(fill(text, values), lang);

const toc = (lang, items) => `<nav class="toc" aria-label="${t(lang, 'toc.label')}"><span>${t(lang, 'toc.label')}</span>${items.map(([href, label]) => `<a href="#${href}">${esc(label)}</a>`).join('')}</nav>`;

const crumbsJson = (items, lang) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: loc(path, lang) })),
});

/** Visible breadcrumb. The last item is the page itself, so it is text, not a link. */
const crumbTrail = (lang, items) => `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([name, href], i) => (i === items.length - 1
  ? `<span aria-current="page">${esc(name)}</span>`
  : `<a href="${esc(href)}">${esc(name)}</a>`)).join('<span class="crumb-sep" aria-hidden="true">/</span>')}</nav>`;

const ogName = (lang, slug) => `/og/${lang === 'zh' ? 'zh-' : ''}${slug}.png`;

/* ---------------- home ---------------- */

export function homePage(ctx, lang) {
  const { site, games } = ctx;
  const lead = games[0];
  const leadName = pick(lead, 'name', lang);
  const brand = site.brand.name;
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', name: brand, url: site.baseUrl + loc('/', lang), description: pick(site.brand, 'description', lang), inLanguage: lang === 'zh' ? 'zh-CN' : 'en' },
    {
      '@context': 'https://schema.org', '@type': 'ItemList', name: brand + ' games',
      inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
      itemListElement: games.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: pick(g, 'name', lang), url: site.baseUrl + loc(g.path, lang) })),
    },
  ];
  const links = {
    about: `<a href="${esc(loc('/about/', lang))}">${t(lang, 'home.aboutLink')}</a>`,
    contact: `<a href="${esc(loc('/contact/', lang))}">${t(lang, 'home.contactLink')}</a>`,
    privacy: `<a href="${esc(loc('/privacy/', lang))}">${t(lang, 'home.privacyLink')}</a>`,
  };
  return layout({
    site, lang, path: '/', title: '', description: pick(site.brand, 'description', lang), ogImage: ogName(lang, 'home'), jsonld, body: `
<section class="hero">
  <div class="container hero-inner">
    <div class="hero-copy">
      <p class="eyebrow">${icon('gamepad', 16)} ${t(lang, 'home.eyebrow')}</p>
      <h1>${t(lang, 'home.h1')}</h1>
      <p class="lead">${esc(pick(site.brand, 'description', lang))}</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg" href="${esc(loc(lead.path, lang))}">${icon('play', 18)} ${t(lang, 'home.play', { game: leadName })}</a>
        <a class="btn btn-lg" href="${esc(loc('/games/', lang))}">${t(lang, 'home.allGames')}</a>
      </div>
      <ul class="hero-points">
        <li>${icon('check', 16)} ${t(lang, 'home.pointDownload')}</li>
        <li>${icon('check', 16)} ${t(lang, 'home.pointSignup')}</li>
        <li>${icon('check', 16)} ${t(lang, 'home.pointSaves')}</li>
      </ul>
    </div>
    <span class="hero-art">
      ${lead.cover ? `<img src="${esc(lead.cover)}" alt="" width="960" height="540" fetchpriority="high">` : ''}
    </span>
  </div>
</section>

<section class="container section" id="games" aria-labelledby="games-h">
  <div class="section-head"><h2 id="games-h">${t(lang, 'home.gamesH2')}</h2><span class="section-note">${t(lang, games.length === 1 ? 'home.gamesNoteOne' : 'home.gamesNoteMany', { n: games.length })}</span></div>
  <div class="game-grid">${games.map((g) => gameCard({ ...g, href: loc(g.path, lang) }, lang)).join('')}</div>
</section>

<section class="container section" id="tools" aria-labelledby="tools-h">
  <div class="section-head"><h2 id="tools-h">${t(lang, 'home.toolsH2')}</h2><a class="section-link" href="${esc(loc('/tools/', lang))}">${t(lang, 'home.allTools')} ${icon('arrow-right', 16)}</a></div>
  <p class="section-lead">${t(lang, 'home.toolsLead')}</p>
  <div class="tool-grid">${ctx.tools.map((x) => toolCard({ ...x, href: loc(x.path, lang) }, lang)).join('')}</div>
</section>

<section class="container section prose-narrow" aria-labelledby="about-h">
  <h2 id="about-h">${t(lang, 'home.aboutH2', { brand })}</h2>
  <p>${t(lang, 'home.aboutP1', { brand })}</p>
  <p>${T(lang, 'home.aboutP2', links)}</p>
</section>`,
  });
}

/* ---------------- game pages ---------------- */

export function gamesIndexPage(ctx, lang) {
  const { site, games } = ctx;
  return layout({
    site, lang, path: '/games/', title: t(lang, 'games.h1'), description: T(lang, 'games.metaDescription'),
    ogImage: ogName(lang, 'games'),
    body: `
<header class="container page-head">
  <p class="eyebrow">${icon('gamepad', 16)} ${t(lang, 'games.eyebrow')}</p>
  <h1>${t(lang, 'games.h1')}</h1>
  <p class="lead">${t(lang, 'games.lead')}</p>
</header>
<section class="container section"><div class="game-grid game-grid-large">${games.map((g) => gameCard({ ...g, href: loc(g.path, lang) }, lang)).join('')}</div></section>
<section class="container section prose-narrow" aria-labelledby="games-notes-h">
  <h2 id="games-notes-h">${t(lang, 'games.notesH2')}</h2>
  <p>${t(lang, 'games.note1')}</p>
  <p>${t(lang, 'games.note2')}</p>
  <p>${T(lang, 'games.note3', { link: `<a href="${esc(loc('/tools/', lang))}">${t(lang, 'games.note3Link')}</a>` })}</p>
</section>`,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'CollectionPage', name: T(lang, 'games.h1'),
        url: site.baseUrl + loc('/games/', lang), inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
        mainEntity: {
          '@type': 'ItemList', inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
          itemListElement: games.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: pick(g, 'name', lang), url: site.baseUrl + loc(g.path, lang) })),
        },
      },
      crumbsJson([['Home', '/'], ['Games', '/games/']], lang),
    ],
  });
}

export function gamePage(ctx, game, lang) {
  const { site } = ctx;
  const c = game.config;
  const n = fromConfig(c);
  const fillAll = (s) => fillText(s, n, lang);
  const tocItems = [
    ['how-to', T(lang, 'game.tocHowTo')], ['world', T(lang, 'game.tocWorld')], ['districts', T(lang, 'game.tocDistricts')],
    ['upgrades', T(lang, 'game.tocUpgrades')], ['offline', T(lang, 'game.tocOffline')], ['tips', T(lang, 'game.tocTips')], ['faq', T(lang, 'faq.heading')],
  ];

  const tierOf = (tier) => (lang === 'zh' && c.tiers && c.tiers[tier] ? c.tiers[tier] : tier);
  const treeRows = c.trees.map((x) => [esc(pick(x, 'name', lang)), esc(tierOf(x.tier)), fmtInt(x.hp), fmtInt(x.yield), x.gears ? String(x.gears) : '—']);
  const districtRows = c.zones.map((z, i) => [esc(pick(z, 'name', lang)), i === 0 ? t(lang, 'game.free') : fmtInt(z.unlockCost), esc(c.trees.filter((x) => z.pool[x.id]).map((x) => pick(x, 'name', lang)).join(', '))]);
  const upRows = c.upgrades.map((u) => [esc(pick(u, 'name', lang)), esc(fillAll(pick(u, 'desc', lang))), fmtInt(u.baseCost) + ' ' + (u.currency === 'gears' ? t(lang, 'gr.gears') : t(lang, 'gr.sparkwood')), String(u.max)]);

  // The Chinese how-to lives at game.zh.howto, not at game.howto.zh: read the whole field
  // through pick(), otherwise the Chinese page prints the English instructions.
  const howto = pick(game, 'howto', lang);
  const sections = [
    { id: 'how-to', h: howto.title, list: howto.steps.map(fillAll) },
    { id: 'world', h: T(lang, 'game.tocWorld'), p: pick(game, 'intro', lang).map(fillAll), table: { head: [t(lang, 'game.tableTree'), t(lang, 'game.tableTier'), t(lang, 'game.tableHealth'), t(lang, 'game.tableSparkwood'), t(lang, 'game.tableGears')], rows: treeRows } },
    { id: 'districts', h: T(lang, 'game.tocDistricts'), list: c.zones.map((z, i) => `<b>${esc(pick(z, 'name', lang))}</b>${i === 0 ? ` (${t(lang, 'game.free')})` : ` (${fmtInt(z.unlockCost)} ${t(lang, 'gr.sparkwood')})`}: ${fillAll(pick(z, 'blurb', lang))}`), table: { head: [t(lang, 'game.tableDistrict'), t(lang, 'game.tableUnlock'), t(lang, 'game.tableTrees')], rows: districtRows } },
    { id: 'upgrades', h: T(lang, 'game.tocUpgrades'), p: [t(lang, 'game.upgradesNote')], table: { head: [t(lang, 'game.tableUpgrade'), t(lang, 'game.tableEffect'), t(lang, 'game.tableFirstCost'), t(lang, 'game.tableMaxLevel')], rows: upRows } },
    { id: 'offline', h: T(lang, 'game.tocOffline'), p: [
      T(lang, 'game.offlineP1', { eff: pct0(c.offline.baseEfficiency), cap: c.offline.baseCapSeconds / 3600 }),
      T(lang, 'game.offlineP2', { bonus: pct0(c.prestige.bonusPerPoint) }),
    ] },
    { id: 'tips', h: T(lang, 'game.tocTips'), list: pick(game, 'tips', lang).map(fillAll) },
  ];

  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'VideoGame', name: pick(game, 'name', lang), description: metaExcerpt(pick(game, 'metaDescription', lang) || pick(game, 'tagline', lang), 300),
      url: site.baseUrl + loc(game.path, lang), image: site.baseUrl + game.cover,
      genre: ['Idle', 'Incremental', 'Tycoon'], gamePlatform: ['Web browser'], applicationCategory: 'Game',
      operatingSystem: 'Any', playMode: 'SinglePlayer', inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    },
    crumbsJson([['Home', '/'], ['Games', '/games/'], [pick(game, 'name', lang), game.path]], lang),
  ];

  runtimeIcons(GAME_RUNTIME_ICONS);
  return layout({
    site, lang, path: game.path, title: pick(game, 'metaTitle', lang) || pick(game, 'name', lang), description: pick(game, 'metaDescription', lang) || pick(game, 'tagline', lang),
    ogType: 'article', ogImage: ogName(lang, slugify(game.path)), jsonld,
    styles: `<link rel="stylesheet" href="/assets/${esc(site.asset.gameCss)}">`,
    scripts: `<script src="${esc(game.scripts[lang])}" defer></script>`,
    body: `
<article class="game-page">
  <header class="container page-head page-head-row">
    <div>
      <p class="eyebrow">${icon('gamepad', 16)} ${t(lang, 'game.eyebrow')}</p>
      <h1>${esc(pick(game, 'name', lang))}</h1>
      <p class="lead">${esc(pick(game, 'tagline', lang))}</p>
    </div>
  </header>
  ${gameShell(game, { lang })}
  <div class="container">${crumbTrail(lang, [[T(lang, 'crumb.home'), loc('/', lang)], [T(lang, 'crumb.games'), loc('/games/', lang)], [pick(game, 'name', lang), loc(game.path, lang)]])}</div>
  <div class="container article-layout">
    ${toc(lang, tocItems)}
    <div class="article-body">
      ${prose(sections)}
      ${faq(pick(game, 'faq', lang).map((f) => ({ q: f.q, a: fillAll(f.a) })), lang)}
    </div>
  </div>
</article>`,
  });
}

/* ---------------- tool pages ---------------- */

export function toolsIndexPage(ctx, lang) {
  const { site, tools } = ctx;
  return layout({
    site, lang, path: '/tools/', title: t(lang, 'tools.h1'), description: T(lang, 'tools.metaDescription'),
    ogImage: ogName(lang, 'tools'),
    body: `
<header class="container page-head">
  <p class="eyebrow">${icon('tool', 16)} ${t(lang, 'tools.eyebrow')}</p>
  <h1>${t(lang, 'tools.h1')}</h1>
  <p class="lead">${t(lang, 'tools.lead')}</p>
</header>
<section class="container section"><div class="tool-grid tool-grid-large">${tools.map((x) => toolCard({ ...x, href: loc(x.path, lang) }, lang)).join('')}</div></section>
<section class="container section prose-narrow" aria-labelledby="tools-notes-h">
  <h2 id="tools-notes-h">${t(lang, 'tools.notesH2')}</h2>
  <p>${t(lang, 'tools.note1')}</p>
  <p>${T(lang, 'tools.note2', { link: `<a href="${esc(loc('/contact/', lang))}">${t(lang, 'tools.note2Link')}</a>` })}</p>
</section>`,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'CollectionPage', name: T(lang, 'tools.h1'),
        url: site.baseUrl + loc('/tools/', lang), inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
        mainEntity: {
          '@type': 'ItemList', inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
          itemListElement: tools.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: pick(x, 'name', lang), url: site.baseUrl + loc(x.path, lang) })),
        },
      },
      crumbsJson([['Home', '/'], ['Tools', '/tools/']], lang),
    ],
  });
}

export function toolPage(ctx, tool, lang) {
  const { site } = ctx;
  const sections = pick(tool, 'sections', lang).map((s) => ({ ...s, p: (s.p || []).map((p) => localizeLinks(p, lang)) }));
  const tocItems = sections.map((s) => [s.id, s.h]).concat([['faq', T(lang, 'faq.heading')]]);
  const faqItems = pick(tool, 'faq', lang).map((f) => ({ q: f.q, a: localizeLinks(f.a, lang) }));
  const jsonld = [
    {
      '@context': 'https://schema.org', '@type': 'WebApplication', name: pick(tool, 'name', lang), url: site.baseUrl + loc(tool.path, lang),
      description: metaExcerpt(pick(tool, 'metaDescription', lang), 300), applicationCategory: 'UtilityApplication', operatingSystem: 'Any',
      inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, isAccessibleForFree: true, browserRequirements: 'Requires JavaScript',
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage', inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
      mainEntity: faqItems.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    crumbsJson([['Home', '/'], ['Tools', '/tools/'], [pick(tool, 'name', lang), tool.path]], lang),
  ];
  runtimeIcons(['copy', 'check']);
  return layout({
    site, lang, path: tool.path, title: pick(tool, 'metaTitle', lang) || pick(tool, 'name', lang), description: pick(tool, 'metaDescription', lang) || pick(tool, 'summary', lang),
    ogImage: ogName(lang, slugify(tool.path)), jsonld,
    scripts: `<script src="${esc(tool.scripts[lang])}" defer></script>`,
    body: `
<article class="tool-page">
  <header class="container page-head">
    <p class="eyebrow">${icon(tool.icon, 16)} ${t(lang, 'tool.eyebrow')}</p>
    <h1>${esc(pick(tool, 'h1', lang))}</h1>
    <p class="lead">${localizeLinks(pick(tool, 'lead', lang), lang)}</p>
  </header>
  <div class="container">${crumbTrail(lang, [[T(lang, 'crumb.home'), loc('/', lang)], [T(lang, 'crumb.tools'), loc('/tools/', lang)], [pick(tool, 'name', lang), loc(tool.path, lang)]])}</div>
  <div class="container">${toolShell(tool, lang)}</div>
  <div class="container article-layout">
    ${toc(lang, tocItems)}
    <div class="article-body">
      ${prose(sections)}
      ${faq(faqItems, lang)}
    </div>
  </div>
</article>`,
  });
}

/* ---------------- documents and 404 ---------------- */

export function docPage(ctx, slug, doc, lang) {
  const { site } = ctx;
  const sections = pick(doc, 'sections', lang)
    .filter((s) => !s.flag || (site.flags && site.flags[s.flag]))
    .map((s) => ({ ...s, p: (s.p || []).map((p) => localizeLinks(p, lang)) }));
  const title = pick(doc, 'title', lang);
  return layout({
    site, lang, path: `/${slug}/`, title, description: pick(doc, 'metaDescription', lang), ogType: 'article', ogImage: ogName(lang, slug),
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'WebPage', name: title,
        url: site.baseUrl + loc(`/${slug}/`, lang), inLanguage: lang === 'zh' ? 'zh-CN' : 'en',
        description: pick(doc, 'metaDescription', lang),
      },
      crumbsJson([['Home', '/'], [title, `/${slug}/`]], lang),
    ],
    body: `
<article class="doc-page">
  <header class="container page-head">
    <p class="eyebrow">${icon('info', 16)} ${t(lang, 'updated', { date: doc.updated })}</p>
    <h1>${esc(title)}</h1>
    <p class="lead">${localizeLinks(pick(doc, 'lead', lang), lang)}</p>
  </header>
  <div class="container">${crumbTrail(lang, [[T(lang, 'crumb.home'), loc('/', lang)], [title, loc(`/${slug}/`, lang)]])}</div>
  <div class="container article-layout">
    ${toc(lang, sections.map((s) => [s.id, s.h]))}
    <div class="article-body">${prose(sections)}</div>
  </div>
</article>`,
  });
}

export function notFoundPage(ctx) {
  const { site, games } = ctx;
  const lang = 'en';
  const game = games[0];
  return layout({
    site, lang, path: '/404.html', title: 'Page not found', description: 'That page does not exist. Head back to the games, or start again from the home page.', robots: 'noindex', noAlternates: true,
    body: `
<section class="container section notfound">
  <p class="eyebrow">404</p>
  <h1>${t(lang, 'nf.h1')}</h1>
  <p class="lead">${t(lang, 'nf.lead', { brand: site.brand.name })}</p>
  <!-- One 404 file serves both languages, so Chinese readers get a line they can read
       without switching the whole page. -->
  <p class="nf-zh" lang="zh-CN">${t(lang, 'nf.zhLine')} <a href="/zh/" hreflang="zh-CN">${t(lang, 'nf.zhHome')}</a></p>
  <div class="hero-actions">
    <a class="btn btn-primary" href="${esc(game.path)}">${t(lang, 'nf.play', { game: pick(game, 'name', 'en') })}</a>
    <a class="btn" href="/tools/">${t(lang, 'nf.tools')}</a>
    <a class="btn" href="/">${t(lang, 'nf.home')}</a>
  </div>
</section>`,
  });
}
