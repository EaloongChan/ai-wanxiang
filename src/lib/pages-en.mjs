/**
 * 英文版页面
 *
 * 覆盖范围：工具库 + 模型库 + 场景手册 + 提示词库 + 术语表 + 搜索。
 * **资讯与学习资源刻意不翻** —— 那是长期连载型的长文，两套并行维护的成本
 * 远高于它带来的价值；关于页里对读者明确说明了这一点。
 */
import { esc, jsonEmbed, initials, accentStyle, hashColor, accentTextStyle, termSlug, buildGlossSlugMap, metaExcerpt } from './utils.mjs';
import { pageHead, crumbs, toolCard, modelCard, catCard, playbookCard, playbookFlow, promptCard, glossItem, emptyState } from './components.mjs';
import { EN, pick, tagList } from './labels.mjs';
import { vendorEn, modelNameEn, toolNameEn } from './i18n-en-maps.mjs';
import { layout } from './layout.mjs';
import { icon } from './icons.mjs';
import { breadcrumbLd, siteLd, shead } from './pages.mjs';

/** 英文版导航 */
/** 二级章节头（h2）。注意 pageHead 渲染的是 h1，只能用于页面主标题 */
const sec = (title, sub = '', href = '', more = '') => `<div class="section-head">
  <div class="sh-main">
    <div>
      <h2>${esc(title)}</h2>
      ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
    </div>
  </div>
  ${href ? `<a class="section-more" href="${esc(href)}">${esc(more)} →</a>` : ''}
</div>`;

/* 英文站的场景分组名。中文分组名不能直接出现在英文页面上。
   build.mjs 要用同一张表给搜索索引填分类名，所以导出。 */
export const GROUP_EN = {
  office: 'Office & admin',
  content: 'Content',
  media: 'Media production',
  code: 'Engineering',
  learn: 'Learning & research',
  data: 'Data',
  growth: 'Growth',
};
const enGroupMap = (groups) => Object.fromEntries(
  groups.map((g) => [g.id, { ...g, name: GROUP_EN[g.id] || g.name }]),
);
/** 只有翻译好的手册才进英文站 —— 英文页上出现中文比缺内容更糟 */
const enReady = (ctx) => ctx.playbooks.items.filter((p) => p.en && p.en.steps && p.en.steps.length);

const enNav = [
  { label: 'Playbooks', href: '/en/playbooks/' },
  { label: 'Prompts', href: '/en/prompts/' },
  { label: 'Glossary', href: '/en/glossary/' },
  { label: 'Tools', href: '/en/tools/' },
  { label: 'Models', href: '/en/models/' },
  { label: 'About', href: '/en/about/' },
];

const enFooter = [
  { label: '中文版', href: '/' },
  { label: 'Open data', href: '/en/open-data/' },
  { label: 'RSS (Chinese)', href: '/feed.xml' },
];

/** 分类 / 类型名的英文表 */
function nameMaps(i18n) {
  const en = i18n.en;
  const catName = (id) => en[`cat.${id}`] || id;
  const kindName = (id) => en[`kind.${id}`] || id;
  return { catName, kindName };
}

/** 英文版工具卡：把分类名换成英文后再交给通用组件 */
function ecard(t, i18n, extra = {}) {
  const { catName } = nameMaps(i18n);
  // 中文工具名要换成英文写法，否则英文站上会露出「豆包」「通义千问」
  const tEn = { ...t, name: toolNameEn(t.name) };
  return toolCard(tEn, { [t.cat]: { name: catName(t.cat), accent: hashColor(t.cat) }, ...extra }, EN);
}

/** 英文版模型卡 */
function mcard(m, i18n, kindMap) {
  // 英文站显示英文厂商名与模型名，否则会露出「腾讯」「通义万相」
  const mEn = { ...m, vendor: vendorEn(m.vendor), name: modelNameEn(m.name) };
  const { kindName } = nameMaps(i18n);
  return modelCard(mEn, { ...kindMap, [m.kind]: { ...(kindMap[m.kind] || {}), name: kindName(m.kind) } }, i18n.en, EN);
}

const shell = (o) =>
  layout({
    siteTagline: o.tagline,
    ...o,
    lang: 'en',
    navItems: enNav,
    footerLinks: enFooter,
    altLang: 'zh-CN',
    altLabel: 'Switch to Chinese',
    navLabel: 'Main navigation',
    skipLabel: 'Skip to content',
    footerCopyright: '© 2026 AI Wanxiang — an AI tools and models directory',
    footerLicense: 'Data is published as JSON under an open licence',
    footerNavTitle: 'Site navigation',
    footerMore: [{ label: '中文版', href: '/' }, { label: 'RSS (Chinese)', href: '/feed.xml' }],
    footerData: [
      { label: 'Open data', href: '/en/open-data/' },
      { label: 'Tools JSON', href: '/api/tools.json' },
      { label: 'Search index', href: '/api/search.json' },
    ],
    crumbLabel: 'Breadcrumb',
    // 英文站已经有 500 多条可搜内容，搜索入口不再隐藏
    hideSearch: false,
    searchHref: '/en/search/',
    searchLabel: 'Search the site',
    searchText: 'Search',
    brandName: 'AI Wanxiang',
    brandSlogan: o.siteTagline || 'AI Tools & Models Directory',
    themeLabel: 'Toggle light/dark theme',
    menuLabel: 'Open menu',
    brandHref: '/en/',
    brandDesc: o.brandDesc,
  });

/* ---------------- 首页 ---------------- */
export function enHome(ctx, i18n) {
  const { site, tools, models, categories } = ctx;
  const en = i18n.en;
  const { catName, kindName } = nameMaps(i18n);
  const hot = tools.filter((t) => t.hot).slice(0, 8);
  const newest = [...tools].sort((a, b) => String(b.added || '').localeCompare(String(a.added || ''))).slice(0, 4);
  const body = `
<section class="hero">
  <div class="container hero-inner">
    <div class="hero-kicker">
      <span class="kicker-box">● Directory</span>
      <span class="kicker-plain">${tools.length} tools · ${models.items.length} model families · updated ${esc(ctx.updatedAt)}</span>
    </div>
    <h1>Not just <span class="hl">what to use</span><br>but when <em>not</em> to use it</h1>
    <p class="lead">${esc(en['siteDesc'])}</p>
    <div class="row" style="gap:10px;flex-wrap:wrap">
      <a class="btn btn-primary" href="/en/tools/">Browse ${tools.length} tools</a>
      <a class="btn" href="/en/models/">Compare models</a>
      <a class="btn btn-ghost" href="/">中文版</a>
    </div>
    <div class="stats reveal">
      <div class="stat"><b>${tools.length}</b><span>Tools</span></div>
      <div class="stat"><b>${models.items.length}</b><span>Model families</span></div>
      <div class="stat"><b>${categories.toolCategories.length}</b><span>Categories</span></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${sec('Browse by category', "Every tool carries an editor's note on when not to use it — the part most directories leave out.")}
    <div class="grid grid-4">
      ${categories.toolCategories
        .map((c) => catCard({ ...c, name: catName(c.id, EN) }, tools.filter((t) => t.cat === c.id).length, `/en/tools/${c.id}/`, EN))
        .join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${sec('Popular picks', '', '/en/tools/', 'All tools')}
    <div class="grid">${hot.map((t) => ecard(t, i18n)).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${sec('Recently added', '', '/en/tools/', 'All tools')}
    <div class="grid">${newest.map((t) => ecard(t, i18n)).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${sec('Model library', en['models.note'], '/en/models/', 'All models')}
    <div class="grid grid-6">
      ${models.kinds.map((k) => catCard({ ...k, name: kindName(k.id, EN) }, models.items.filter((m) => m.kind === k.id).length, `/en/models/${k.id}/`, EN)).join('')}
    </div>
  </div>
</section>`;

  return shell({
    site, path: '/en/', title: '', description: en['siteDesc'], body,
    altPath: '/', brandDesc: en['siteDesc'],
    jsonld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: en.siteName, inLanguage: 'en', description: en.siteDesc }],
  });
}

/* ---------------- 工具列表 ---------------- */
export function enTools(ctx, i18n, { activeCat = '' } = {}) {
  const { site, tools, categories } = ctx;
  const en = i18n.en;
  const { catName } = nameMaps(i18n);
  const list = activeCat ? tools.filter((t) => t.cat === activeCat) : tools;
  const cat = categories.toolCategories.find((c) => c.id === activeCat);

  const seg = [`<button data-facet="cat" data-value="all"${!activeCat ? ' class="on"' : ''}>All</button>`]
    .concat(categories.toolCategories.map((c) => `<button data-facet="cat" data-value="${esc(c.id)}"${activeCat === c.id ? ' class="on"' : ''}>${esc(catName(c.id))}</button>`))
    .join('');

  const catMeta = cat || {};
  const title = cat ? catName(cat.id) : en['tools.title'];
  /* 同中文站：h1 用站内分类名，<title> 用用户会搜的说法（seoNameEn）。
     另外这里原来漏了句号 —— descEn 不含结尾标点，模板直接接下一句，
     结果描述里出现 "coding agents Each entry notes..." 这种粘连。 */
  const seoTitle = cat ? catMeta.seoNameEn || title : title;
  /* descEn 不含结尾标点，模板直接接下一句会粘连（原文是 "coding agents Each entry notes…"）：
     这里补上句号，并且**控制总长在 160 字符以内**。
     因为 metaExcerpt 的做法是「截到 160，再回退到最后一个句末标点 + …」——
     英文模板原来第一句只有 67 字符，于是 160 的额度只用了 67，剩下 90 个字白扔，
     而英文 SERP 有 ~155 字符可用。收尾那句因此写得紧凑，保证整句装得下、不被截。 */
  const tail = (t) => {
    const v = String(t || '').trim().replace(/[.。]+$/, '');
    return v ? v + '. ' : '';
  };
  const desc = cat
    ? `${list.length} AI tools for ${catName(cat.id).toLowerCase()}: ${tail(catMeta.descEn)}Each with pricing, China access, caveats and a comparison.`
    : en['tools.desc'];

  const crumbItems = cat
    ? [{ label: 'Home', href: '/en/' }, { label: 'Tools', href: '/en/tools/' }, { label: catName(cat.id) }]
    : [{ label: 'Home', href: '/en/' }, { label: 'Tools' }];

  const body = `
${crumbs(crumbItems, 'Breadcrumb')}
${pageHead(title, desc, `<div class="ph-meta"><span class="label">Tools <b style="color:var(--fg)">${list.length}</b></span></div>`, 'TOOLS')}
<div data-filter-root>
  <div class="toolbar">
    <div class="container">
      <div class="toolbar-row">
        <div class="filter-wrap">
          <span class="f-icon" aria-hidden="true">${'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'}</span>
          <input class="filter-input" type="search" data-query placeholder="${esc(en['search.placeholder'])}" aria-label="Filter tools">
        </div>
        <button class="btn btn-sm" type="button" data-toggle="cn" aria-pressed="false">${esc(en['filter.onlyDirect'])}</button>
        <button class="btn btn-sm btn-ghost" data-reset>Reset</button>
      </div>
      <div class="toolbar-row"><div class="seg" style="flex:1">${seg}</div></div>
    </div>
  </div>
  <div class="container">
    <div class="result-count" data-count></div>
    <h2 class="sr-only">Tool list</h2>
    <div class="grid" data-list>${list.map((t) => ecard(t, i18n)).join('')}</div>
    <div class="hidden" data-empty>${'<div class="empty"><p>No matches</p><p class="label" style="margin-top:8px">Try another keyword or category.</p></div>'}</div>
  </div>
</div>`;

  return shell({
    site,
    path: activeCat ? `/en/tools/${activeCat}/` : '/en/tools/',
    title: seoTitle, description: desc, body, brandDesc: en['siteDesc'],
    altPath: activeCat ? `/tools/${activeCat}/` : '/tools/',
    jsonld: [
      breadcrumbLd(site, crumbItems),
      { '@context': 'https://schema.org', '@type': 'ItemList', name: title, numberOfItems: list.length, itemListElement: list.slice(0, 40).map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: toolNameEn(t.name), description: pick(t, 'desc', EN) })) },
    ],
  });
}

/* ---------------- 工具详情 ---------------- */
export function enToolDetail(ctx, i18n, t) {
  const { site, tools } = ctx;
  const en = i18n.en;
  const { catName } = nameMaps(i18n);
  const c = hashColor(t.cat);
  /* 核验说明：中文工具页一直有这一块，英文页原来完全没有 ——
     246 个英文工具页因此少了「这条信息是怎么来的」这一层交代，
     而这恰好是 AI 内容站最需要交代的东西。现在两边一致，文案从配置读。 */
  const reviewStatus = (t.review && t.review.status) || site.review?.defaultStatus || 'editorial';
  const statusLabelEn = (site.review?.statusLabelsEn || {})[reviewStatus] || reviewStatus;
  const reviewedAt = (t.review && t.review.reviewedAt) || t.reviewed || (site.contentDates && site.contentDates.tools) || '';
  /* 英文名必须走映射表，不能直接用 t.name。
     踩过的坑：详情页的 <title> / <h1> / 面包屑用的都是 t.name，
     结果 244 个英文工具页里有 100 多个标题还是中文（如「腾讯混元 3D · 中文分类」）。
     <title> 是搜索结果里最重要的一行，中文标题在英文查询下不可能有排名。
     只有同分类对比表用了 toolNameEn —— 漏改的地方正好是最该改的地方。 */
  const tName = toolNameEn(t.name);
  const toolCat = (ctx.categories?.toolCategories || []).find((x) => x.id === t.cat) || {};
  const siblings = tools.filter((x) => x.cat === t.cat && x.id !== t.id);
  const compare = [t, ...siblings].slice(0, 12);

  /* 这个工具出现在哪些（已翻译的）手册里 —— 中文工具详情页一直有这块，
     英文版漏了。少了它有两个后果：读者看完工具不知道下一步做什么；
     英文手册也少了最主要的入链来源（中文手册每篇能从工具页拿到好几条内链，
     英文的只能靠 /en/playbooks/ 列表页一条）。 */
  const usedIn = enReady(ctx).filter(
    (p) => (p.tools || []).includes(t.id) || (p.en.steps || []).some((s) => (s.tools || []).includes(t.id)),
  );
  const pbGroups = enGroupMap(ctx.playbooks.groups);

  /* 与中文版同一套补救（详见 pages.mjs 的注释）：大多数工具没被手册点名，
     英文页更薄。这里只挑**已有英文版**的手册推荐，否则点过去是中文页。 */
  const usedIds = new Set(usedIn.map((p) => p.id));
  const relatedPb = usedIn.length ? [] : enReady(ctx)
    .map((p) => {
      const ids = new Set([...(p.tools || []), ...(p.en.steps || []).flatMap((s) => s.tools || [])]);
      let sc = 0;
      for (const id of ids) {
        if (id === t.id) sc += 3;
        const x = ctx.toolMap[id];
        if (!x) continue;
        if (x.cat === t.cat) sc += 2;
        sc += (x.tags || []).filter((g) => (t.tags || []).includes(g)).length;
      }
      return { p, sc: usedIds.has(p.id) ? 0 : sc };
    })
    .filter((x) => x.sc > 0)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 3)
    .map((x) => x.p);

  const crumbItems = [
    { label: 'Home', href: '/en/' },
    { label: 'Tools', href: '/en/tools/' },
    { label: catName(t.cat), href: `/en/tools/${t.cat}/` },
    { label: tName },
  ];

  const badges = [
    t.official ? `<span class="badge-pill" style="color:var(--fg-2)">${EN.official}</span>` : '',
    t._new ? `<span class="badge-pill badge-new">NEW</span>` : '',
    t.hot ? `<span class="badge-pill badge-hot">${EN.hot}</span>` : '',
    `<span class="badge-pill ${EN.pricingCls[t.pricing] || 'badge-free'}">${EN.pricing[t.pricing] || t.pricing}</span>`,
    t.cn ? `<span class="badge-pill badge-cn">${EN.directAccess}</span>` : `<span class="badge-pill" style="color:var(--fg-3)">${EN.proxyAccess}</span>`,
  ].filter(Boolean).join('');

  const facts = [
    ['Category', catName(t.cat)],
    ['Pricing', EN.pricing[t.pricing] || t.pricing],
    ['Access from China', t.cn ? 'Yes, directly' : 'Needs a VPN'],
    ['Official product', t.official ? 'Yes' : 'Third party / community'],
    ['Added', t.added || '—'],
  ];

  const rows = compare.map((x) => {
    const cur = x.id === t.id;
    return `<tr class="${cur ? 'is-current' : ''}">
      <td><a href="/en/tools/${esc(x.cat)}/${esc(x.id)}/">${esc(toolNameEn(x.name))}</a>${cur ? `<span class="tag" style="margin-left:6px">current</span>` : ''}</td>
      <td>${esc(EN.pricing[x.pricing] || x.pricing)}</td>
      <td>${x.cn ? 'Direct' : '—'}</td>
      <td>${x.official ? 'Official' : '—'}</td>
      <td>${x.hot ? 'Popular' : '—'}</td>
      <td><a href="${esc(x.url)}" target="_blank" rel="noopener nofollow" class="table-link" aria-label="Visit ${esc(toolNameEn(x.name))}">↗</a></td>
    </tr>`;
  }).join('');

  /* 与中文版同一套措辞逻辑：只报「上次自动检查访问不到」，
     不报「这个产品没了」——后者是我们给不了保证的判断（见 pages.mjs 的注释）。 */
  const dead = typeof ctx.deadLink === 'function' ? ctx.deadLink(t.id, t.url) : null;
  const deadNote = dead
    ? `<p class="dead-link">${icon('alert', 14)}<span>Our last automated check (${esc(String(dead.checkedAt || '').slice(0, 10))}) got <b>${esc(String(dead.status || '404'))}</b> from this URL. It may have shut down, moved, or simply blocked our crawler. The link is kept as-is — just go in knowing that.</span></p>`
    : '';

  const body = `
${crumbs(crumbItems, 'Breadcrumb')}
<div class="container">
  <div class="tool-hero">
    <span class="avatar avatar-lg" style="${accentStyle(c)}" aria-hidden="true">${esc(initials(tName))}</span>
    <div class="tool-hero-main">
      <div class="label label-accent" style="margin-bottom:8px">${esc(catName(t.cat))}</div>
      <h1>${esc(tName)}</h1>
      <p>${esc(pick(t, 'desc', EN))}</p>
      <div class="row" style="gap:6px;margin-top:14px">${badges}</div>
      <div class="row" style="gap:5px;margin-top:10px">${tagList(t.tags, EN).map((g) => `<span class="tag">${esc(g)}</span>`).join('')}</div>
    </div>
    <div class="tool-hero-act">
      ${deadNote}
      <a class="btn btn-primary" href="${esc(t.url)}" target="_blank" rel="noopener nofollow">Visit website ↗</a>
      <a class="btn" href="/en/tools/${esc(t.cat)}/">More in ${esc(catName(t.cat))}</a>
    </div>
  </div>
</div>

${pick(t, 'caveat', EN) ? `<section class="section" style="padding-top:30px;padding-bottom:0">
  <div class="container">
    <div class="caveat-box">
      <div class="cb-head">⚠ <span>${esc(EN.editorNote)} · ${esc(EN.whenNotToUse)}</span></div>
      <p>${esc(pick(t, 'caveat', EN))}</p>
    </div>
  </div>
</section>` : ''}

${pick(toolCat, 'guide', EN) ? `<section class="section" style="padding-top:30px;padding-bottom:0">
  <div class="container">
    ${shead('01', 'How to choose in this category', esc(catName(t.cat)))}
    <div class="card" style="padding:22px 24px;border-left:3px solid ${esc(c)}">
      <p style="font-size:.94rem;color:var(--fg-2);line-height:1.85;margin:0">${esc(pick(toolCat, 'guide', EN)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>
    </div>
  </div>
</section>` : ''}

${usedIn.length ? `<section class="section" style="padding-top:30px;padding-bottom:0">
  <div class="container">
    ${sec('Where this tool fits in', `Step-by-step workflows that use it (${usedIn.length})`, '/en/playbooks/', 'All playbooks')}
    <div class="grid">${usedIn.map((p) => playbookCard(p, pbGroups, '/en/playbooks/', EN)).join('')}</div>
  </div>
</section>` : ''}

${relatedPb.length ? `<section class="section" style="padding-top:30px;padding-bottom:0">
  <div class="container">
    ${sec('Workflows worth following', 'These do not feature this tool by name, but they run on the same kind of tool', '/en/playbooks/', 'All playbooks')}
    <div class="grid">${relatedPb.map((p) => playbookCard(p, pbGroups, '/en/playbooks/', EN)).join('')}</div>
  </div>
</section>` : ''}

<section class="section" style="padding-top:34px">
  <div class="container">
    ${sec('Compare with others in this category', `All ${compare.length} tools above are from the same category.`)}
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Tool</th><th>Pricing</th><th>China</th><th>Official</th><th>Popular</th><th>Site</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${sec('Basic info')}
    <div class="fact-grid">
      ${facts.map(([k, v]) => `<div class="fact"><span class="label">${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="review-note">
      <div class="rn-head">
        <a class="rn-status" href="/en/about/#editorial" title="What these labels mean">${esc(statusLabelEn)}</a>
        ${reviewedAt ? `<span class="rn-date">Updated ${esc(reviewedAt)}</span>` : ''}
      </div>
      <p>${esc(site.review?.policyEn || '')}
        Spotted something wrong or out of date?
        <a href="https://github.com/EaloongChan/ai-wanxiang/issues" target="_blank" rel="noopener">Open an issue</a>
        — corrections are welcome.</p>
    </div>
  </div>
</section>

${siblings.length ? `<section class="section">
  <div class="container">
    ${sec(`More in ${catName(t.cat)}`, '', `/en/tools/${esc(t.cat)}/`, 'View all')}
    <div class="grid">${siblings.slice(0, 8).map((x) => ecard(x, i18n)).join('')}</div>
  </div>
</section>` : ''}`;

  return shell({
    site,
    path: `/en/tools/${t.cat}/${t.id}/`,
    title: `${tName} · ${catName(t.cat)}`,
    // 只写一句工具简介太短（最短的只有 48 个字符），搜索结果里等于没信息。
    // 中文版一直是拼「分类 / 定价 / 是否国内可直连」的，英文版补齐同样的信息量。
    description: `${pick(t, 'desc', EN)} — ${catName(t.cat)} AI tool, ${EN.pricing[t.pricing] || t.pricing}${t.cn ? ', directly accessible from mainland China' : ''}.`,
    pageType: 'article',
    body,
    brandDesc: en['siteDesc'],
    altPath: `/tools/${t.cat}/${t.id}/`,
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication',
        name: tName, description: pick(t, 'desc', EN), url: t.url,
        applicationCategory: catName(t.cat), operatingSystem: 'Web', inLanguage: 'en',
        ...(t.pricing === 'free' || t.pricing === 'open' ? { offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } } : {}),
      },
    ],
  });
}

/* ---------------- 模型库 ---------------- */
export function enModels(ctx, i18n, { activeKind = '' } = {}) {
  const { site, models } = ctx;
  const en = i18n.en;
  const { kindName } = nameMaps(i18n);
  const list = activeKind ? models.items.filter((m) => m.kind === activeKind) : models.items;
  const kind = models.kinds.find((k) => k.id === activeKind);

  const counts = {};
  for (const m of models.items) counts[m.kind] = (counts[m.kind] || 0) + 1;

  const seg = [`<button data-facet="kind" data-value="all"${!activeKind ? ' class="on"' : ''}>All</button>`]
    .concat(models.kinds.map((k) => `<button data-facet="kind" data-value="${esc(k.id)}"${activeKind === k.id ? ' class="on"' : ''}>${esc(kindName(k.id))}</button>`))
    .join('');

  const title = kind ? kindName(kind.id) : en['models.title'];
  const desc = kind ? `${list.length} model families for ${kindName(kind.id).toLowerCase()} compared on stable dimensions: biggest strengths, what to watch, open or closed, and China accessibility. Every entry shows a verification month and links to the official model list.` : en['models.desc'];

  const crumbItems = kind
    ? [{ label: 'Home', href: '/en/' }, { label: 'Models', href: '/en/models/' }, { label: kindName(kind.id) }]
    : [{ label: 'Home', href: '/en/' }, { label: 'Models' }];

  const kindMap = Object.fromEntries(models.kinds.map((k) => [k.id, k]));

  /* 类型链接行。中文模型页一直有（pageHead 的 ph-meta），英文版漏了 ——
     没有它的话，9 个 /en/models/<kind>/ 页面只由英文首页链过去一次，
     相当于藏在导航里。这类「分类页没有稳定入口」的问题不会报错，
     只有主动数内链才看得出来（scripts/orphans.mjs）。 */
  const summary = models.kinds
    .map((k) => `<a class="tag" href="/en/models/${esc(k.id)}/">${esc(kindName(k.id))} <b class="num" style="color:var(--fg-2)">${counts[k.id] || 0}</b></a>`)
    .join('');

  const body = `
${crumbs(crumbItems, 'Breadcrumb')}
${pageHead(title, desc, `<div class="ph-meta">${summary}</div>`, 'MODELS / Model library')}
<section class="section" style="padding-top:0">
  <div class="container">
    <div class="card" style="padding:18px 22px;border-left:3px solid var(--accent);max-width:880px">
      <div class="label label-accent" style="margin-bottom:8px">Read this first</div>
      <p style="font-size:.89rem;color:var(--fg-2);line-height:1.75;margin:0">${esc(en['models.note'])}</p>
    </div>
  </div>
</section>
<div data-filter-root>
  <div class="toolbar">
    <div class="container">
      <div class="toolbar-row">
        <div class="filter-wrap">
          <span class="f-icon" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span>
          <input class="filter-input" type="search" data-query placeholder="Search model families or vendors…" aria-label="Filter models">
        </div>
        <button class="btn btn-sm" type="button" data-toggle="open" aria-pressed="false">${esc(en['filter.onlyOpen'])}</button>
        <button class="btn btn-sm" type="button" data-toggle="cn" aria-pressed="false">${esc(en['filter.onlyDirect'])}</button>
        <button class="btn btn-sm btn-ghost" data-reset>Reset</button>
      </div>
      <div class="toolbar-row"><div class="seg" style="flex:1">${seg}</div></div>
    </div>
  </div>
  <div class="container">
    <div class="result-count" data-count></div>
    <h2 class="sr-only">Model list</h2>
    <div class="grid" data-list>${list.map((m) => mcard(m, i18n, kindMap)).join('')}</div>
    <div class="hidden" data-empty><div class="empty"><p>No matches</p></div></div>
  </div>
</div>`;

  return shell({
    site,
    path: activeKind ? `/en/models/${activeKind}/` : '/en/models/',
    title, description: desc, body, brandDesc: en['siteDesc'],
    altPath: activeKind ? `/models/${activeKind}/` : '/models/',
    jsonld: [
      breadcrumbLd(site, crumbItems),
      { '@context': 'https://schema.org', '@type': 'ItemList', name: title, numberOfItems: list.length, itemListElement: list.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: `${modelNameEn(m.name)} (${vendorEn(m.vendor)})`, description: (m.strengthsEn || m.strengths || []).join('; ') })) },
    ],
  });
}

/* ---------------- Open data ---------------- */
export function enOpenData(ctx, i18n) {
  const { site, tools, prompts, models, playbooks, glossary, learn, news, searchIndex, enSearchIndex, queryMap, feed } = ctx;
  const en = i18n.en;
  const n = (x) => (Array.isArray(x) ? x.length : 0);
  const rows = [
    ['/api/index.json', 'Site info, item counts, category list', '1 object'],
    ['/api/tools.json', 'AI tools: pricing tier, China reachability, editor’s caveat', n(tools) + ' items'],
    ['/api/prompts.json', 'Prompt templates: variables, models, both languages', n(prompts) + ' items'],
    ['/api/models.json', 'Model families: only the dimensions that stay stable', n(models) + ' items'],
    ['/api/playbooks.json', 'Playbooks: steps + tools + prompts + failure modes', n(playbooks) + ' items'],
    ['/api/glossary.json', 'AI terms: full name, abbreviation, related terms', n(glossary) + ' items'],
    ['/api/learn.json', 'Learning resources with a credited source', n(learn) + ' items'],
    ['/api/news.json', 'News commentary, sources and a timeline', n(news.items) + ' + ' + n(news.sources) + ' sources'],
    ['/api/feed.json', 'Live feed (RSS aggregation, rebuilt daily)', n(feed && feed.items) + ' items'],
    ['/api/search.json', 'Search index, Chinese site', n(searchIndex) + ' entries'],
    ['/api/search-en.json', 'Search index, English site', n(enSearchIndex) + ' entries'],
    ['/api/query-map.json', 'Colloquial phrasing → canonical term map', n(queryMap) + ' entries'],
  ];
  const crumbItems = [{ label: 'Home', href: '/en/' }, { label: 'Open data' }];
  const body = `
${crumbs(crumbItems, 'Breadcrumb')}
${pageHead('Open data', 'Everything on this site is published as JSON under /api/: no key, no signup, no rate limit. Build a directory, run an analysis, or train on it.', `<div class="ph-meta">
  <span class="label">Endpoints <b style="color:var(--fg)">12</b></span>
  <span class="label">Data date <b style="color:var(--fg)">${esc(String(ctx.updatedAt || '').slice(0, 10))}</b></span>
</div>`, 'OPEN DATA')}

<section class="section" style="padding-top:0">
  <div class="container container-narrow">
    <div class="card" style="padding:28px 30px">
      <p style="color:var(--fg-2);line-height:1.9;margin:0 0 16px">
        Just fetch it. The largest payloads are the playbooks and the search index at roughly 250 KB each.
      </p>
      <pre style="font-family:var(--font-mono);font-size:.78rem;line-height:1.9;padding:14px;border:var(--bw) solid var(--line);background:var(--code-bg);overflow:auto">curl https://www.ealoongchan.top/api/tools.json</pre>
      <p style="color:var(--fg-3);font-size:.84rem;line-height:1.85;margin:14px 0 0">
        Rebuilt daily at 09:00 (UTC+8). <code style="font-family:var(--font-mono)">/api/index.json</code>
        carries an <code style="font-family:var(--font-mono)">updatedAt</code> field —
        <strong style="color:var(--fg)">quote that date when you reuse the data</strong>, because pricing and availability move.
      </p>
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="container">
    ${shead(1, 'Endpoints', 'Counts are recomputed on every build')}
    <div class="card" style="padding:22px 24px">
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Path</th><th>Contents</th><th style="text-align:right">Size</th></tr></thead>
        <tbody>${rows.map(([p, d, c]) => `<tr><td><code style="font-family:var(--font-mono);font-size:.8rem">${esc(p)}</code></td><td>${esc(d)}</td><td style="text-align:right;white-space:nowrap">${esc(c)}</td></tr>`).join('')}</tbody>
      </table></div>
      <p style="color:var(--fg-3);font-size:.84rem;line-height:1.85;margin:14px 0 0">
        Chinese-only datasets (glossary, learn, news, feed) are the ones this English site doesn’t
        render — they’re still in the API, and still worth having if you read Chinese.
      </p>
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="container container-narrow">
    ${shead(1, 'Licence and attribution', '')}
    <div class="card" style="padding:26px 28px">
      <ul style="color:var(--fg-2);line-height:1.95;margin:0 0 14px;padding-left:20px">
        <li><strong style="color:var(--fg)">Data (data/ and /api/): CC BY 4.0</strong> — use it, remix it, ship it commercially.
          <strong style="color:var(--fg)">Attribution and a link back is the only condition.</strong></li>
        <li>Code (build scripts and templates): MIT, in the
          <a href="https://github.com/EaloongChan/ai-wanxiang" target="_blank" rel="noopener">GitHub repo</a>.</li>
      </ul>
      <p style="color:var(--fg-3);font-size:.85rem;line-height:1.9;margin:0">
        Some of it is third-party: tool names and links belong to their owners, and learning/news
        entries are credited in a <code style="font-family:var(--font-mono)">source</code> field.
        <strong style="color:var(--fg)">We don’t mirror anyone’s articles or images</strong> — so this dataset contains
        structured facts and our own commentary, not text you could pass off as your own reporting.
      </p>
    </div>
  </div>
</section>`;

  return shell({
    site, path: '/en/open-data/', title: 'Open data · 12 JSON endpoints',
    description: `JSON endpoints for the whole dataset: ${n(tools)} AI tools, ${n(prompts)} prompts, ${n(models)} model families and ${n(playbooks)} playbooks with bilingual fields. No key, no signup, CC BY 4.0.`,
    body, brandDesc: en['siteDesc'], altPath: '/open-data/',
    jsonld: breadcrumbLd(site, crumbItems),
  });
}

/* ---------------- 关于 ---------------- */
export function enAbout(ctx, i18n) {
  const { site, tools, models } = ctx;
  const en = i18n.en;
  const crumbItems = [{ label: 'Home', href: '/en/' }, { label: 'About' }];
  const body = `
${crumbs(crumbItems, 'Breadcrumb')}
${pageHead('About', '', '', 'ABOUT')}
<section class="section" style="padding-top:0">
  <div class="container container-narrow">
    <div class="card" style="padding:28px">
      <h2 style="font-size:1.15rem;font-weight:700;margin-bottom:10px">${esc(en['about.scopeTitle'])}</h2>
      <p style="color:var(--fg-2);line-height:1.85;margin:0 0 22px">${esc(en['about.scope'])}</p>
      <h2 style="font-size:1.15rem;font-weight:700;margin-bottom:10px">What we cover</h2>
      <p style="color:var(--fg-2);line-height:1.85;margin:0 0 22px">
        ${tools.length} AI tools across ${ctx.categories.toolCategories.length} categories, and ${models.items.length} model families.
        Every tool has an editor's note on when <em>not</em> to use it, because the failure modes matter more than the feature list.
      </p>
      <h2 style="font-size:1.15rem;font-weight:700;margin-bottom:10px">On the missing spec sheets</h2>
      <p style="color:var(--fg-2);line-height:1.85;margin:0 0 22px">
        You won't find context-window sizes or per-token prices here. That data goes stale within months and then
        actively misleads. We compare the dimensions that stay stable and link each entry to its official docs.
      </p>
      <h2 style="font-size:1.15rem;font-weight:700;margin-bottom:10px">Source &amp; license</h2>
      <p style="color:var(--fg-2);line-height:1.85;margin:0">
        All data on this site is public: take it, remix it, build on it. Machine-readable at
        <a href="/api/index.json" style="color:var(--accent-text)">/api/index.json</a>, or browse the whole
        source on <a href="https://github.com/EaloongChan/ai-wanxiang" target="_blank" rel="noopener" style="color:var(--accent-text)">GitHub</a>.
        Code is MIT; the data is CC BY 4.0 — attribution is all we ask for.
      </p>
    </div>
  </div>
</section>
<section class="section" id="editorial">
  <div class="container container-narrow">
    <div class="card" style="padding:26px 28px">
      <h2 style="font-size:1.15rem;font-weight:700;margin-bottom:10px">How we compile this</h2>
      <p style="color:var(--fg-2);line-height:1.85;margin:0 0 18px">${esc(site.review?.policyEn || '')}</p>
      <p style="color:var(--fg-3);font-size:.85rem;line-height:1.9;margin:0">
        <strong style="color:var(--fg)">Why we don’t hands-on test all of them:</strong>
        testing each of ${tools.length} tools properly would drop the update rate to a handful of entries a month,
        while pricing and availability move weekly. So we spend the effort where it pays instead —
        an explicit note on <strong style="color:var(--fg)">when not to use it</strong>,
        and an honest label for <strong style="color:var(--fg)">how each entry was verified</strong>,
        so you can decide how much to trust it.
      </p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container container-narrow">
    <div class="card" style="padding:26px;border-left:3px solid var(--accent)">
      <div class="label label-accent" style="margin-bottom:10px">Looking for the rest?</div>
      <p style="color:var(--fg-2);line-height:1.8;margin:0 0 16px">
        The Chinese version carries substantially more: ${ctx.playbooks.items.length} step-by-step playbooks,
        ${ctx.prompts.length} prompt templates, ${ctx.glossary.length} glossary terms,
        ${ctx.learn.length} learning resources and a live news feed.
      </p>
      <a class="btn btn-primary" href="/">View the Chinese version →</a>
    </div>
  </div>
</section>`;

  return shell({
    site, path: '/en/about/', title: 'About', description: en['about.scope'], body,
    brandDesc: en['siteDesc'], altPath: '/about/',
    jsonld: breadcrumbLd(site, crumbItems),
  });
}


/* ============================ 场景手册（英文） ============================ */
/* 英文版的覆盖面比中文窄：只收录已翻译的手册。
   没翻译的不出现，而不是回退显示中文。 */

export function enPlaybooks(ctx, i18n) {
  const en = i18n.en;
  const { site, playbooks } = ctx;
  const groups = enGroupMap(playbooks.groups);
  const list = enReady(ctx);
  const crumbItems = [{ label: 'Home', href: '/en/' }, { label: 'Playbooks' }];

  const byGroup = playbooks.groups
    .map((g) => ({ g, items: list.filter((p) => p.group === g.id) }))
    .filter((x) => x.items.length);

  const body = `
${crumbs(crumbItems, 'Breadcrumb')}
${pageHead(
  'Playbooks',
  `${list.length} end-to-end workflows for doing real work with AI. Each states its input, its expected output, what counts as failure, and — the part most guides skip — when you should not use AI at all.`,
  '', 'PLAYBOOKS / Workflows', 'Workflow list',
)}
${byGroup.map(({ g, items }) => `<section class="section">
  <div class="container">
    ${shead('', GROUP_EN[g.id] || g.name, `${items.length} workflows`)}
    <div class="grid">${items.map((p) => playbookCard(p, groups, '/en/playbooks/', EN)).join('')}</div>
  </div>
</section>`).join('')}`;

  return shell({
    site,
    path: '/en/playbooks/',
    title: 'AI playbooks: end-to-end workflows',
    description: `${list.length} end-to-end AI workflows. Each one states its input, expected output, what counts as failure, and when you should not use AI at all.`,
    body,
    brandDesc: en['siteDesc'],
    altPath: '/playbooks/',
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org', '@type': 'ItemList',
        name: 'AI playbooks', numberOfItems: list.length, inLanguage: 'en',
        itemListElement: list.map((p, i) => ({
          '@type': 'ListItem', position: i + 1, name: p.en.title, url: `/en/playbooks/${p.id}/`,
        })),
      },
    ],
  });
}

export function enPlaybookDetail(ctx, i18n, pb) {
  const en = i18n.en;
  const { site, toolMap, promptMap } = ctx;
  const groups = enGroupMap(ctx.playbooks.groups);
  const g = groups[pb.group] || { name: pb.group, accent: '#1B4DFF', icon: 'target' };
  const e = pb.en;

  const others = ctx.playbooks.items.filter((x) => x.id !== pb.id && x.group === pb.group && x.en && x.en.steps).slice(0, 2);
  const fallback = enReady(ctx).filter((x) => x.id !== pb.id && x.group !== pb.group).slice(0, Math.max(0, 3 - others.length));
  const more = [...others, ...fallback].slice(0, 3);

  const crumbItems = [
    { label: 'Home', href: '/en/' },
    { label: 'Playbooks', href: '/en/playbooks/' },
    { label: e.title },
  ];

  /* 工具链到英文工具页；提示词只有中文版，所以显式标 · zh，不假装它是英文的 */
  const toolChip = (id) => {
    const t = toolMap[id];
    if (!t) return '';
    return `<a class="tag accent" href="/en/tools/${esc(t.cat)}/${esc(t.id)}/" style="${accentTextStyle(g.accent)}">${esc(toolNameEn(t.name))}${icon('arrow-up-right', 10)}</a>`;
  };
  const promptChip = (id) => {
    const p = promptMap[id];
    if (!p) return '';
    // 有英文版就链到英文提示词库；没有才回退到中文版并显式标明
    const hasEn = !!(p.en && p.en.prompt);
    const href = hasEn ? `/en/prompts/${esc(p.cat)}/#${esc(p.id)}` : `/prompts/${esc(p.cat)}/#${esc(p.id)}`;
    const label = hasEn ? p.en.title : p.title;
    const mark = hasEn ? '' : ' <span style="opacity:.65">· zh</span>';
    const note = hasEn ? 'Prompt template' : 'Prompt template (Chinese only)';
    return `<a class="tag accent" href="${href}" style="${accentTextStyle(g.accent)}" title="${note}">${icon('spark', 10)} ${esc(label)}${mark}</a>`;
  };

  const steps = (e.steps || []).map((text, i) => {
    const zh = (pb.steps || [])[i] || {};
    return `<div class="step">
      <div class="step-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="step-body">
        <p>${esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>
        ${(zh.tools || []).length || (zh.prompts || []).length
          ? `<div class="step-refs">${(zh.tools || []).map(toolChip).join('')}${(zh.prompts || []).map(promptChip).join('')}</div>`
          : ''}
      </div>
    </div>`;
  }).join('');

  const specBlock = e.spec ? `<section class="section" style="padding-top:0">
  <div class="container container-narrow">
    <div class="pb-spec">
      <div class="pbs-head">What you should end up with</div>
      <dl>
        <div><dt>Input</dt><dd>${esc(e.spec.input)}</dd></div>
        <div><dt>Output</dt><dd>${esc(e.spec.output)}</dd></div>
        <div><dt>Counts as failure</dt><dd>${esc(e.spec.fail)}</dd></div>
        <div><dt>When not to use AI</dt><dd>${esc(e.spec.alt)}</dd></div>
      </dl>
    </div>
  </div>
</section>` : '';

  const warnBlock = (e.warnings || []).length ? `<section class="section" style="background:var(--surface-2)">
  <div class="container container-narrow">
    ${shead('02', 'What goes wrong', 'Failure modes we actually hit, not generic advice')}
    <ul class="warn-list">
      ${e.warnings.map((w) => `<li>${icon('alert', 14)}<span>${esc(w).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</span></li>`).join('')}
    </ul>
  </div>
</section>` : '';

  const tools = (pb.tools || []).map((id) => toolMap[id]).filter(Boolean);

  const body = `
${crumbs(crumbItems, 'Breadcrumb')}
<div class="container container-narrow">
  <header class="article-head">
    <div class="news-meta">
      <span class="tag accent" style="${accentTextStyle(g.accent)}">${esc(g.name)}</span>
      <span>About ${esc(e.time)}</span>
      <span class="dot-sep">/</span>
      <span>${esc(e.level || '')}</span>
      <span class="dot-sep">/</span>
      <span>${(e.steps || []).length} steps</span>
    </div>
    <h1>${esc(e.title)}</h1>
    <p style="color:var(--fg-2);font-size:1rem;line-height:1.75;max-width:66ch">${esc(e.problem)}</p>
  </header>
  ${playbookFlow((e.steps || []).length, g.accent, EN)}
</div>

${specBlock}

<section class="section" style="padding-top:34px">
  <div class="container container-narrow">
    ${shead('01', 'The process', 'In order, with the tools for each step')}
    <div class="steps">${steps}</div>
  </div>
</section>

${warnBlock}

${tools.length ? `<section class="section">
  <div class="container">
    ${shead('03', 'Tools used here', '', '/en/tools/', 'All tools')}
    <div class="grid">${tools.slice(0, 8).map((t) => ecard(t, i18n)).join('')}</div>
  </div>
</section>` : ''}

${more.length ? `<section class="section">
  <div class="container">
    ${shead('04', 'Other playbooks', '', '/en/playbooks/', 'All playbooks')}
    <div class="grid">${more.map((p) => playbookCard(p, groups, '/en/playbooks/', EN)).join('')}</div>
  </div>
</section>` : ''}`;

  return shell({
    site,
    path: `/en/playbooks/${pb.id}/`,
    /* 不加「· Playbook」：中文版的手册页标题就是「标题 · AI 万象」，
       英文版多加一段既不一致，又把标题顶到 80 多字符（搜索结果里会被截断）。 */
    title: e.title,
    /* 描述要老实截断到 ~160 字符。拼上 problem + 步数 + 产出动辄 300 多字符，
       搜索结果里只会显示前 160，剩下的白写。 */
    description: metaExcerpt(
      `${e.problem} ${(e.steps || []).length} steps, about ${e.time}.${e.spec ? ' Output: ' + e.spec.output : ''}`,
      160,
    ),
    pageType: 'article',
    body,
    brandDesc: en['siteDesc'],
    altPath: `/playbooks/${pb.id}/`,
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org', '@type': 'HowTo',
        name: e.title,
        description: `${e.problem}${e.spec ? ' Output: ' + e.spec.output : ''}`,
        totalTime: e.time, inLanguage: 'en',
        step: (e.steps || []).map((text, i) => ({
          '@type': 'HowToStep', position: i + 1, text: text.replace(/\*\*/g, ''),
        })),
      },
    ],
  });
}

/* ============================ 提示词库（英文） ============================ */
/* 只收录翻译好的。没翻译的不出现 —— 英文页上出现中文比缺内容更糟。 */
const enPromptReady = (ctx) => ctx.prompts.filter((p) => p.en && p.en.prompt);

export function enPrompts(ctx, i18n, { activeCat = '' } = {}) {
  const en = i18n.en;
  const { site, categories } = ctx;
  // 提示词分类和工具分类共用 id 但名字不同，所以用独立命名空间 pcat.*
  const pcatName = (id) => en[`pcat.${id}`] || id;
  const catMap = Object.fromEntries(categories.promptCategories.map((c) => [c.id, { ...c, name: pcatName(c.id) }]));
  const list = enPromptReady(ctx);
  const shown = activeCat ? list.filter((p) => p.cat === activeCat) : list;

  const seg = [
    `<button data-facet="cat" data-value="all"${!activeCat ? ' class="on"' : ''}>All</button>`,
    ...categories.promptCategories
      .filter((c) => list.some((p) => p.cat === c.id))
      .map((c) => `<button data-facet="cat" data-value="${esc(c.id)}"${activeCat === c.id ? ' class="on"' : ''}>${esc(pcatName(c.id))}</button>`),
  ].join('');

  const catLabel = activeCat ? pcatName(activeCat) : '';
  const crumbItems = activeCat
    ? [{ label: 'Home', href: '/en/' }, { label: 'Prompts', href: '/en/prompts/' }, { label: catLabel }]
    : [{ label: 'Home', href: '/en/' }, { label: 'Prompts' }];
  const title = activeCat ? `${catLabel} prompts` : 'Prompt library';

  const body = `
${crumbs(crumbItems, 'Breadcrumb')}
${pageHead(
  title,
  activeCat
    ? `${list.length} ${catLabel} prompt templates, ready to paste. Each one states what to provide, what you get back, and why it is worded that way.`
    : `${list.length} prompt templates that are ready to paste. Each one explains what to put in, what you get back, and why it is written that way.`,
  '', 'PROMPTS / Templates', 'Prompt list',
)}
<div data-filter-root>
  <div class="toolbar">
    <div class="container">
      <div class="toolbar-row">
        <div class="filter-wrap">
          <span class="f-icon" aria-hidden="true">${icon('search', 15)}</span>
          <input class="filter-input" type="search" data-query placeholder="Search prompts…" aria-label="Search prompts">
        </div>
        <button class="btn btn-sm btn-ghost" data-reset>Reset</button>
      </div>
      <div class="toolbar-row"><div class="seg" style="flex:1">${seg}</div></div>
    </div>
  </div>
  <div class="container">
    <div class="result-count" data-count></div>
    <div class="grid" data-list>${shown.map((p) => promptCard(p, catMap, EN)).join('')}</div>
    <div class="hidden" data-empty>${emptyState('No prompts match', 'Try a different word.')}</div>
  </div>
</div>

<section class="section">
  <div class="container">
    ${sec('Browse by category', 'Each category is one kind of task, with its own templates.')}
    <div class="grid grid-4">
      ${categories.promptCategories
    .filter((c) => list.some((p) => p.cat === c.id))
    .map((c) => catCard(
      { ...c, name: pcatName(c.id), desc: '' },
      list.filter((p) => p.cat === c.id).length,
      `/en/prompts/${c.id}/`, EN,
    )).join('')}
    </div>
  </div>
</section>`;

  return shell({
    site,
    path: activeCat ? `/en/prompts/${activeCat}/` : '/en/prompts/',
    title,
    // 分类页必须带上分类名，否则 life / data 这类页面的描述会完全相同 ——
    // 重复描述会让 Google 自己挑一条显示，通常挑中最不相关的那条。
    description: activeCat
      ? `${shown.length} ${catLabel} prompt templates, ready to paste, with variables you fill in. What to provide, what you get back, and why the wording works.`
      : `${shown.length} ready-to-paste AI prompt templates across ${new Set(shown.map((p) => p.cat)).size} categories, with variables you fill in. Each states what to provide, what you get back, and the reasoning behind the wording.`,
    body,
    brandDesc: en['siteDesc'],
    altPath: activeCat ? `/prompts/${activeCat}/` : '/prompts/',
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org', '@type': 'ItemList', inLanguage: 'en',
        name: title, numberOfItems: shown.length,
        itemListElement: shown.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.en.title })),
      },
    ],
  });
}

/* ============================ 全站搜索（英文） ============================ */
/* 英文站已经有 500 多条可搜内容（244 工具 / 78 模型 / 92 术语 / 86 提示词 / 20 手册），
   没有搜索就等于让读者一条条翻。索引里的条目**全部有英文版**，
   点进去不会撞到中文页。
   渲染逻辑与中文搜索共用 app.js —— 界面文案通过 window.__AIWX_UI__ 传进去，
   避免为了两种语言维护两套搜索结果渲染。 */
export function enSearch(ctx, i18n) {
  const { site } = ctx;
  const list = [...(ctx.enSearchIndex || [])];
  const crumbItems = [{ label: 'Home', href: '/en/' }, { label: 'Search' }];

  const types = [
    ['all', 'All'],
    ['playbook', 'Playbooks'],
    ['tool', 'Tools'],
    ['prompt', 'Prompts'],
    ['model', 'Models'],
    ['glossary', 'Glossary'],
  ];
  const filters = types.map(([k, label], i) =>
    `<button class="btn btn-sm${i === 0 ? ' btn-primary' : ''}" data-type="${k}" type="button">${esc(label)}</button>`).join('');

  const body = `
${crumbs(crumbItems, 'Breadcrumb')}
${pageHead(
  'Search',
  `One query across all ${list.length} entries: playbooks, tools, prompt templates, models and glossary terms. The index is already in the page — results appear as you type, nothing is sent to a server.`,
  '', 'SEARCH / Everything', 'Results and filters',
)}

<div class="container">
  <form class="search-hero" style="max-width:100%;margin-bottom:24px" onsubmit="return false" role="search">
    <span class="s-icon" aria-hidden="true">${icon('search', 17)}</span>
    <input type="search" id="globalSearch" placeholder="e.g. RAG / video generation / local model / agent" autocomplete="off" autofocus aria-label="Search the site">
  </form>

  <div class="row" style="gap:6px;margin-bottom:22px" id="typeFilters">${filters}</div>

  <div class="result-count" id="searchCount"></div>
  <div class="grid" id="searchResults"></div>
  <div class="hidden" id="searchEmpty">${emptyState('Type something to start', 'Try a tool name, a capability, or a term like RAG.')}</div>
  <div class="hidden" id="searchNone">${emptyState('Nothing matched', 'Try another word, or browse the category pages.')}</div>
</div>

<section class="section">
  <div class="container">
    ${sec('Browse by task', `Not sure which tool to use? Start from what you are trying to do.`, '/en/playbooks/', 'All playbooks')}
    <div class="grid grid-4">
      ${ctx.playbooks.items.filter((p) => p.en).length ? Object.entries(GROUP_EN)
    .filter(([gid]) => ctx.playbooks.items.some((p) => p.group === gid && p.en))
    .map(([gid, name]) => `<a class="card reveal" href="/en/playbooks/" style="padding:16px 18px">
        <div class="label label-accent">${esc(name)}</div>
        <p style="margin:8px 0 0;font-size:.9rem;color:var(--fg-2)">${ctx.playbooks.items.filter((p) => p.group === gid && p.en).length} playbooks</p>
      </a>`).join('') : ''}
    </div>
  </div>
</section>`;

  return shell({
    site,
    path: '/en/search/',
    title: 'Search',
    description: `Search all ${list.length} entries on the English site — ${countsLine(ctx)}. Results are computed in the browser, so typing is instant and nothing is sent anywhere.`,
    body,
    brandDesc: i18n.en['siteDesc'],
    altPath: '/search/',
    scripts: `<script src="/assets/${esc(site.asset.icons)}"></script>`
      + `<script>window.__AIWX_INDEX__=${jsonEmbed(list)};`
      + `window.__AIWX_QUERY_MAP__={};`
      + `window.__AIWX_UI__=${jsonEmbed({
        types: { playbook: 'Playbook', tool: 'Tool', prompt: 'Prompt', model: 'Model', glossary: 'Term' },
        order: ['playbook', 'tool', 'prompt', 'model', 'glossary'],
        visit: 'Visit', view: 'View',
        countPrefix: '', countSuffix: ' results',
        expandedPrefix: ' (expanded from “', expandedSuffix: '”)',
        morePrefix: '', moreMiddle: ' more — pick “', moreSuffix: '” above to see all',
        searchPath: '/en/search/',
        // 答案卡（定义类查询）：路径必须指向英文术语表，不能沿用中文默认值
        answerRelated: 'Related terms', answerMore: 'Open in the glossary',
        glossPath: '/en/glossary/?q=',
      })};</script>`
      + `<script src="/assets/${esc(site.asset.search)}" defer></script>`,
    // 与中文搜索页同理：爬虫看到的是空页，且 ?q= 变体会成为重复内容
    robots: 'noindex, follow',
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org', '@type': 'WebSite', inLanguage: 'en',
        name: `${i18n.en.siteName} · Search`,
        potentialAction: { '@type': 'SearchAction', target: `${(site.baseUrl || '').replace(/\/$/, '')}/en/search/?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
      },
    ],
  });
}

/** 搜索结果页描述里那句「包含哪些类型」的统计，用真实条数拼，不写死。 */
function countsLine(ctx) {
  const idx = ctx.enSearchIndex || [];
  const n = (t) => idx.filter((x) => x.t === t).length;
  return `${n('tool')} tools, ${n('model')} model families, ${n('glossary')} glossary terms, ${n('prompt')} prompt templates and ${n('playbook')} playbooks`;
}

/* ============================ 术语表（英文） ============================ */
/* 术语是「what is X」这类查询的天然落点，也是英文站上搜索意图最明确的一块。
   只收录有英文定义的；没有的不会出现。 */
export function enGlossary(ctx, i18n) {
  const en = i18n.en;
  const { site, glossary, toolMap, playbookMap } = ctx;
  const list = glossary.filter((g) => g.defEn);

  // 词名 → 词条，供 related 的中文名换英文显示名用
  const termMap = Object.fromEntries(glossary.map((g) => [g.term, g]));
  const slugMap = buildGlossSlugMap(glossary);
  const withMap = list.map((g) => ({ ...g, __termMap: termMap }));

  const cats = [...new Set(list.map((g) => g.cat))];
  const gcatName = (c) => en['gcat.' + c] || c;
  const seg = [
    `<button data-facet="cat" data-value="all" class="on">All</button>`,
    ...cats.map((c) => `<button data-facet="cat" data-value="${esc(c)}">${esc(gcatName(c))}</button>`),
  ].join('');

  const crumbItems = [{ label: 'Home', href: '/en/' }, { label: 'Glossary' }];

  const body = `
${crumbs(crumbItems, 'Breadcrumb')}
${pageHead(
  'AI glossary',
  `${list.length} terms explained in plain language — what it is, what problem it solves, and where it stops being true. No encyclopaedia definitions.`,
  '', 'GLOSSARY / Terms', 'Term list',
)}
<div data-filter-root>
  <div class="toolbar">
    <div class="container">
      <div class="toolbar-row">
        <div class="filter-wrap">
          <span class="f-icon" aria-hidden="true">${icon('search', 15)}</span>
          <input class="filter-input" type="search" data-query placeholder="Search a term…" aria-label="Search terms">
        </div>
        <button class="btn btn-sm btn-ghost" data-reset>Reset</button>
      </div>
      <div class="toolbar-row"><div class="seg" style="flex:1">${seg}</div></div>
    </div>
  </div>
  <div class="container">
    <div class="result-count" data-count></div>
    <div class="grid grid-2" data-list>${withMap.map((g) => glossItem(g, toolMap, playbookMap, slugMap, EN)).join('')}</div>
    <div class="hidden" data-empty>${emptyState('No term matches', 'Try a different word.')}</div>
  </div>
</div>`;

  return shell({
    site,
    path: '/en/glossary/',
    title: 'AI glossary: plain-language definitions',
    description: `${list.length} AI terms explained without jargon — what each one is, what it solves, and the conditions under which it breaks down. Includes the misconceptions people most often hold.`,
    body,
    brandDesc: en['siteDesc'],
    altPath: '/glossary/',
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org', '@type': 'DefinedTermSet', inLanguage: 'en',
        name: 'AI glossary',
        hasDefinedTerm: list.map((g) => ({ '@type': 'DefinedTerm', name: g.en || g.term, description: g.defEn })),
      },
    ],
  });
}
