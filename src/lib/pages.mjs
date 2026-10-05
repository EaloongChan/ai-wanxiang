import { esc, jsonEmbed, fmtDateCN, initials, accentStyle, accentTextStyle, termSlug, buildGlossSlugMap, metaExcerpt } from './utils.mjs';
import { icon } from './icons.mjs';
import { layout } from './layout.mjs';
import {
  crumbs, pageHead, emptyState, toolCard, catCard, promptCard,
  newsItem, milestoneItem, sourceRow, glossItem, learnCard,
  playbookCard, playbookFlow, modelCard, liveItem, cmpButton, PRICING, PRICING_CLS,
} from './components.mjs';

const BASE = (site) => (site.baseUrl || '').replace(/\/$/, '');

/** 带编号的章节头。n 为数字时补零，为字符串（如 '—' / '!'）时原样输出 */
export function shead(n, title, sub, moreHref, moreLabel) {
  const tag = typeof n === 'number' ? String(n).padStart(2, '0') : String(n);
  return `<div class="section-head">
    <div class="sh-main">
      <span class="idx" aria-hidden="true">[ ${esc(tag)} ]</span>
      <div>
        <h2>${esc(title)}</h2>
        ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
      </div>
    </div>
    ${moreHref ? `<a class="section-more" href="${esc(moreHref)}">${esc(moreLabel)} ${icon('arrow-right', 12)}</a>` : ''}
  </div>`;
}

export const breadcrumbLd = (site, items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: it.label,
    ...(it.href ? { item: BASE(site) + it.href } : {}),
  })),
});

export const siteLd = (site) => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: site.brand.name,
  alternateName: site.brand.nameEn,
  description: site.brand.description,
  url: BASE(site) || undefined,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${BASE(site)}/search/?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

/* ============================ 首页 ============================ */
export function homePage(ctx) {
  const { site, toolCatMap, promptCatMap, topicMap, tools, prompts, news, playbooks, models, counts } = ctx;

  const hotTools = tools.filter((t) => t.hot).slice(0, 8);
  const newest = [...tools].sort((a, b) => String(b.added || '').localeCompare(String(a.added || ''))).slice(0, 4);
  const hotPrompts = prompts.filter((p) => p.hot).slice(0, 6);
  const latestNews = [...news.items].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);
  const featuredPlaybooks = playbooks.items.slice(0, 6);

  const catGrid = ctx.categories.toolCategories
    .map((c) => catCard(c, counts.toolsByCat[c.id] || 0, `/tools/${c.id}/`))
    .join('');

  const groupGrid = playbooks.groups
    .map((g) => catCard(g, counts.playbooksByGroup[g.id] || 0, `/playbooks/${g.id}/`))
    .join('');

  const kindGrid = models.kinds
    .map((k) => catCard(k, models.items.filter((m) => m.kind === k.id).length, `/models/${k.id}/`))
    .join('');

  const body = `
<section class="hero">
  <div class="container hero-inner">
    <div class="hero-kicker">
      <span class="kicker-box">● 持续收录中</span>
      <span class="kicker-plain">已收录 ${counts.total} 条资源 · 最近更新 ${esc(ctx.updatedAt)}</span>
    </div>

    <h1>不只告诉你<span class="hl">用什么</span><br>还告诉你怎么用、别踩什么坑</h1>

    <p class="lead">${esc(site.brand.description)}</p>

    <form class="search-hero" action="/search/" method="get" role="search">
      <span class="s-icon" aria-hidden="true">${icon('search', 17)}</span>
      <input type="search" name="q" placeholder="搜索，或直接描述你想做的事……" autocomplete="off" aria-label="站内搜索">
      <button class="s-btn" type="submit">搜索</button>
    </form>

    <div class="hero-tags">
      <span class="label">大家常找</span>
      ${['写周报', '修 bug', '做落地页', '会议纪要', '本地部署', '微调还是 RAG'].map((t) => `<a class="tag" href="/search/?q=${encodeURIComponent(t)}">${esc(t)}</a>`).join('')}
    </div>

    ${site.stats?.showOnHome ? `<div class="stats reveal">
      <div class="stat"><b>${counts.playbooks}</b><span>场景手册</span></div>
      <div class="stat"><b>${counts.tools}</b><span>收录工具</span></div>
      <div class="stat"><b>${counts.prompts}</b><span>提示词模板</span></div>
      <div class="stat"><b>${counts.models}</b><span>模型家族</span></div>
      <div class="stat"><b>${counts.glossary}</b><span>术语条目</span></div>
      <div class="stat"><b>${counts.learn}</b><span>学习资源</span></div>
    </div>` : ''}
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead(1, '先说你想做什么', '每个场景一篇：完整流程 + 该用哪个工具 + 该配哪条提示词 + 最容易踩的坑', '/playbooks/', '全部场景')}
    <div class="grid">${featuredPlaybooks.map((p) => playbookCard(p, ctx.groupMap)).join('')}</div>
    <div class="grid grid-6 mt-3">${groupGrid}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead(2, '模型怎么选', '按「最强的地方 / 主要注意 / 适合什么」摆在一起对比，不写会过期的参数', '/models/', '全部模型')}
    <div class="grid grid-6">${kindGrid}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead(3, '按用途找工具', `${ctx.categories.toolCategories.length} 个分类，覆盖从对话到本地部署的全部环节`, '/tools/', '全部工具')}
    <div class="grid grid-4">${catGrid}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead(4, '精选工具', '编辑挑选、覆盖面广、上手门槛低的入门首选', '/tools/?hot=1', '看全部热门')}
    <div class="grid">${hotTools.map((t) => toolCard(t, toolCatMap)).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead(5, '最新收录', '工具迭代快，这里只放最近加进来的', '/tools/?sort=new', '按更新排序')}
    <div class="grid">${newest.map((t) => toolCard(t, toolCatMap)).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead(6, '提示词库', '可直接复制、可填变量、附「为什么这么写」的说明', '/prompts/', '全部提示词')}
    <div class="grid grid-2">${hotPrompts.map((p) => promptCard(p, promptCatMap)).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead(7, '最新解读', '把前沿进展翻译成看得懂、用得上的内容', '/news/', '全部资讯')}
    <div class="news-list">${latestNews.map((n) => newsItem(n, topicMap)).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="card" style="padding:36px;text-align:center">
      <div class="label label-accent" style="margin-bottom:12px">长期维护 · 欢迎共建</div>
      <h2 style="font-size:1.45rem;font-weight:700;letter-spacing:-.03em;margin-bottom:10px">发现了好用的 AI，欢迎告诉我们</h2>
      <p style="color:var(--fg-2);max-width:56ch;margin:0 auto 24px;font-size:.92rem">
        你提交的工具、提示词、场景或纠错，都会真正被收进来。这个站不靠广告，靠的是有人愿意把好东西贡献出来。
      </p>
      <div class="row" style="justify-content:center;gap:10px">
        <a class="btn btn-primary" href="/about/#submit">${icon('send', 14)} 提交收录</a>
        <a class="btn" href="/about/">这个站怎么做的 ${icon('arrow-right', 13)}</a>
      </div>
    </div>
  </div>
</section>`;

  return layout({
    altPath: '/en/',
    altLang: 'en',
    altLabel: '切换到英文版（Tools & Models）',
    site,
    path: '/',
    title: '',
    description: site.brand.description,
    body,
    jsonld: [
      siteLd(site),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '精选 AI 工具',
        numberOfItems: hotTools.length,
        itemListElement: hotTools.map((t, i) => ({
          '@type': 'ListItem', position: i + 1, name: t.name, url: t.url,
        })),
      },
    ],
  });
}

/* ============================ 工具库 ============================ */
export function toolsPage(ctx, { activeCat = '', sort = '' } = {}) {
  const { site, toolCatMap, tools, categories } = ctx;
  const list = activeCat ? tools.filter((t) => t.cat === activeCat) : tools;
  const activeName = activeCat && toolCatMap[activeCat] ? toolCatMap[activeCat].name : '';

  const seg = [
    `<button data-facet="cat" data-value="all"${!activeCat ? ' class="on"' : ''}>全部</button>`,
    ...categories.toolCategories.map(
      (c) => `<button data-facet="cat" data-value="${esc(c.id)}"${activeCat === c.id ? ' class="on"' : ''}>${esc(c.name)}</button>`,
    ),
  ].join('');

  const pricingSeg = [
    ['all', '不限'], ['free', '免费'], ['freemium', '免费+付费'], ['paid', '付费'], ['open', '开源'],
  ].map(([v, l], i) => `<button data-facet="pricing" data-value="${v}"${i === 0 ? ' class="on"' : ''}>${l}</button>`).join('');

  const title = activeName ? `${activeName}工具` : 'AI 工具库';
  /* 分类页是目录站最重要的入口页，而「分类名」和「用户搜的词」是两回事：
     站内叫「编程开发」，用户搜的是「AI 编程工具」；站内叫「对话助手」，用户搜「AI 对话工具」。
     所以搜索结果标题另用 seoName，h1 与面包屑保持分类名不变（不为了 SEO 把界面改成怪话）。 */
  const catMeta = activeCat ? toolCatMap[activeCat] || {} : null;
  const seoTitle = activeCat ? (catMeta.seoName || title) : title;
  const desc = activeName
    ? `「${activeName}」分类下的 ${list.length} 个 AI 工具：${(toolCatMap[activeCat] || {}).desc || ''}。每个都标注了价格、是否国内可直连，并附「什么时候别用」的编辑点评和同分类横向对比。选型要点：${((toolCatMap[activeCat] || {}).guide || '').replace(/\*\*/g, '').split('。')[0]}。`
    : `AI 工具库：收录 ${tools.length} 个常用 AI 工具，按用途分成 ${categories.toolCategories.length} 类，逐个标注是否国内直连、免费还是付费。每个工具都附一条「什么时候别选它」的编辑点评。`;

  const crumbItems = activeName
    ? [{ label: '首页', href: '/' }, { label: 'AI 工具', href: '/tools/' }, { label: activeName }]
    : [{ label: '首页', href: '/' }, { label: 'AI 工具' }];

  const body = `
${crumbs(crumbItems)}
${pageHead(title, desc, `<div class="ph-meta">
  <span class="label">分类 <b style="color:var(--fg)">${activeName || '全部'}</b></span>
  <span class="label">收录 <b style="color:var(--fg)">${list.length}</b></span>
</div>`, 'DIRECTORY / 工具库', '工具列表与筛选', '工具列表与筛选')}

<div data-filter-root>
  <div class="toolbar">
    <div class="container">
      <div class="toolbar-row">
        <div class="filter-wrap">
          <span class="f-icon" aria-hidden="true">${icon('search', 15)}</span>
          <input class="filter-input" type="search" data-query placeholder="搜索工具名、标签或用途……" aria-label="搜索工具">
        </div>
        <button class="btn btn-sm" data-toggle="cn" aria-pressed="false">${icon('globe', 12)} 国内直连</button>
        <button class="btn btn-sm" data-toggle="hot" aria-pressed="false">${icon('zap', 12)} 热门</button>
        <select class="filter-input" data-sort aria-label="排序" style="width:auto;min-width:126px">
          <option value="default">默认排序</option>
          <option value="new">最新收录</option>
          <option value="name">按名称</option>
        </select>
        <button class="btn btn-sm btn-ghost" data-reset>重置</button>
      </div>
      <div class="toolbar-row">
        <div class="seg" style="flex:1">${seg}</div>
      </div>
      <div class="toolbar-row">
        <span class="label">价格</span>
        <div class="seg">${pricingSeg}</div>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="result-count" data-count></div>
    <div class="grid" data-list>${list.map((t) => toolCard(t, toolCatMap)).join('')}</div>
    <div class="hidden" data-empty>${emptyState()}</div>
  </div>
</div>

${activeCat ? (() => {
  /* 分类页原本只列工具卡片，读者看完还是不知道拿这些工具做什么。
     这里按「该分类的工具在某篇手册里出现了几次」排序——出现 ≥2 次才算真的相关，
     只出现一次多半只是顺带提了一句。 */
  const catTools = new Set(list.map((t) => t.id));
  const related = ctx.playbooks.items
    .map((pb) => {
      const ids = new Set([...(pb.tools || [])]);
      (pb.steps || []).forEach((s) => (s.tools || []).forEach((t) => ids.add(t)));
      return { pb, hits: [...ids].filter((t) => catTools.has(t)).length };
    })
    .filter((x) => x.hits >= 2)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map((x) => x.pb);
  return related.length ? `<section class="section">
  <div class="container">
    ${shead('01', `这些${activeName}工具怎么用`, '按「你想做的事」组织的完整流程', '/playbooks/', '全部场景')}
    <div class="grid">${related.map((pb) => playbookCard(pb, ctx.groupMap)).join('')}</div>
  </div>
</section>` : '';
})() : ''}`;

  return layout({
    altPath: activeCat ? `/en/tools/${activeCat}/` : '/en/tools/',
    altLang: 'en',
    altLabel: '切换到英文版（Tools & Models）',
    site,
    path: activeCat ? `/tools/${activeCat}/` : '/tools/',
    title: seoTitle, description: desc, body,
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: title,
        numberOfItems: list.length,
        itemListElement: list.slice(0, 40).map((t, i) => ({
          '@type': 'ListItem', position: i + 1, name: t.name, url: t.url, description: t.desc,
        })),
      },
    ],
  });
}

/* ============================ 工具详情 ============================ */
export function toolDetailPage(ctx, t) {
  const { site, toolCatMap, toolMap } = ctx;
  const cat = toolCatMap[t.cat] || { name: t.cat, accent: '#1B4DFF' };
  const c = cat.accent || '#1B4DFF';

  /* 外链健康提示：只有 check-outbound.mjs 用 GET 确认过 404/410 才会出现。
     措辞必须是「本次检查访问不到」，不是「官网已关闭」——
     后者是我们给不了保证的判断，而且上线=打停在 CDN/地区层面的正常产品。 */
  const dead = typeof ctx.deadLink === 'function' ? ctx.deadLink(t.id, t.url) : null;
  const deadNote = dead
    ? `<p class="dead-link">${icon('alert', 14)}<span>最近一次自动检查（${esc(String(dead.checkedAt || '').slice(0, 10))}）访问这个地址返回 <b>${esc(String(dead.status || '404'))}</b>。
       可能已经下线、换了域名，或者只是屏蔽了我们的检查。链接仍然保留，点之前有个数。</span></p>`
    : '';

  // 同类工具：同一分类下，精选与其他
  const siblings = ctx.tools.filter((x) => x.cat === t.cat && x.id !== t.id);
  const compare = [t, ...siblings].slice(0, 12);

  // 这个工具出现在哪些场景手册里 —— 这是详情页最有价值的部分
  const usedIn = ctx.playbooks.items.filter(
    (p) => (p.tools || []).includes(t.id) || (p.steps || []).some((s) => (s.tools || []).includes(t.id)),
  );

  /* 没被任何手册引用的工具（全站大多数），这一节原本是空的，页面就只剩一张资料卡——
     这就是「薄内容」的来源。这里按相关性补几条：
     手册里用到的工具与本工具同分类 +2、同标签 +1，用了本工具 +3，取前 3 篇。
     措辞必须如实说「没直接收录它」：推荐同类工具所在的流程，
     不能让用户点进去发现根本没提到这个工具。靠虚构相关性换链接是骗过去的另一种写法。 */
  const usedIds = new Set(usedIn.map((p) => p.id));
  const relatedPb = usedIn.length ? [] : ctx.playbooks.items
    .map((p) => {
      const ids = new Set([...(p.tools || []), ...(p.steps || []).flatMap((s) => s.tools || [])]);
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
    { label: '首页', href: '/' },
    { label: 'AI 工具', href: '/tools/' },
    { label: cat.name, href: `/tools/${t.cat}/` },
    { label: t.name },
  ];

  const badges = [
    t.official ? `<span class="badge-pill" style="color:var(--fg-2)">官方产品</span>` : '',
    t._new ? `<span class="badge-pill badge-new">NEW</span>` : '',
    t.hot ? `<span class="badge-pill badge-hot">热门</span>` : '',
    `<span class="badge-pill ${PRICING_CLS[t.pricing] || 'badge-free'}">${PRICING[t.pricing] || t.pricing}</span>`,
    t.cn ? `<span class="badge-pill badge-cn">国内直连</span>` : `<span class="badge-pill" style="color:var(--fg-3)">需境外访问</span>`,
  ].filter(Boolean).join('');


  // 核验状态：默认「按公开资料整理」。将来某条真做了实测或按官方资料核验过，
  // 在 tools.json 里给它加 review:{status:'tested'|'source-verified'} 就会自动变。
  const reviewStatus = (t.review && t.review.status) || site.review?.defaultStatus || 'editorial';
  const statusLabel = (site.review?.statusLabels || {})[reviewStatus] || reviewStatus;
  const reviewedAt = (t.review && t.review.reviewedAt) || t.reviewed || (site.contentDates && site.contentDates.tools) || '';

  const facts = [
    ['分类', cat.name],
    ['价格模式', PRICING[t.pricing] || t.pricing],
    ['国内直连', t.cn ? '可以' : '需要自备访问方式'],
    ['是否官方', t.official ? '官方产品' : '第三方/社区'],
    ['收录日期', t.added || '未记录'],
  ];

  const compareRows = compare.map((x) => {
    const cur = x.id === t.id;
    return `<tr class="${cur ? 'is-current' : ''}">
      <td><a href="/tools/${esc(x.cat)}/${esc(x.id)}/">${esc(x.name)}</a>${cur ? '<span class="tag" style="margin-left:6px">当前</span>' : ''}</td>
      <td>${esc(PRICING[x.pricing] || x.pricing)}</td>
      <td>${x.cn ? '可直连' : '—'}</td>
      <td>${x.official ? '官方' : '—'}</td>
      <td>${x.hot ? '热门' : '—'}</td>
      <td><a href="${esc(x.url)}" target="_blank" rel="noopener nofollow" class="table-link" aria-label="访问 ${esc(x.name)} 官网" title="访问官网">${icon('arrow-up-right', 12)}</a></td>
    </tr>`;
  }).join('');

  const body = `
${crumbs(crumbItems)}
<div class="container">
  <div class="tool-hero">
    <span class="avatar avatar-lg" style="${accentStyle(c)}" aria-hidden="true">${esc(initials(t.name))}</span>
    <div class="tool-hero-main">
      <div class="label label-accent" style="margin-bottom:8px">${esc(cat.name)}</div>
      <h1>${esc(t.name)}</h1>
      <p>${esc(t.desc)}</p>
      <div class="row" style="gap:6px;margin-top:14px">${badges}</div>
      <div class="row" style="gap:5px;margin-top:10px">${(t.tags || []).map((g) => `<span class="tag">${esc(g)}</span>`).join('')}</div>
    </div>
    <div class="tool-hero-act">
      ${deadNote}
      <a class="btn btn-primary" href="${esc(t.url)}" target="_blank" rel="noopener nofollow">访问官网 ${icon('arrow-up-right', 13)}</a>
      <button class="btn" type="button" data-cmp="${esc(t.id)}" data-cmp-label aria-pressed="false">${icon('plus', 13)} 加入对比</button>
      <a class="btn" href="/compare/">查看对比清单 ${icon('arrow-right', 12)}</a>
    </div>
  </div>
</div>

${t.caveat ? `<section class="section" style="padding-top:30px;padding-bottom:0">
  <div class="container">
    <div class="caveat-box">
      <div class="cb-head">${icon('alert', 17)}<span>编辑点评 · 什么时候别选它</span></div>
      <p>${esc(t.caveat)}</p>
    </div>
  </div>
</section>` : ''}

<section class="section" style="padding-top:38px">
  <div class="container">
    ${shead('01', '这个分类怎么挑', `${cat.name} 的选型要点`)}
    <div class="card" style="padding:22px 24px;border-left:3px solid ${esc(c)}">
      <p style="font-size:.94rem;color:var(--fg-2);line-height:1.85;margin:0">${esc(cat.guide || cat.desc || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead('02', '同类横向对比', `同分类 ${compare.length} 个工具的并排对照`)}
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>工具</th><th>价格</th><th>国内</th><th>官方</th><th>热门</th><th>官网</th></tr></thead>
        <tbody>${compareRows}</tbody>
      </table>
    </div>
    ${siblings.length > compare.length - 1 ? `<p class="label" style="margin-top:12px">表格只展示前 12 个，<a href="/tools/${esc(t.cat)}/" style="color:var(--accent-text)">查看该分类全部 ${ctx.tools.filter((x) => x.cat === t.cat).length} 个</a></p>` : ''}
  </div>
</section>

${usedIn.length ? `<section class="section">
  <div class="container">
    ${shead('03', '它出现在哪些场景里', '想知道具体怎么用它，看这些流程')}
    <div class="grid">${usedIn.map((p) => playbookCard(p, ctx.groupMap)).join('')}</div>
  </div>
</section>` : ''}

${relatedPb.length ? `<section class="section">
  <div class="container">
    ${shead('03', '可以照着做的流程', '这些手册没有点名收录它，但用的是同一类工具')}
    <div class="grid">${relatedPb.map((p) => playbookCard(p, ctx.groupMap)).join('')}</div>
  </div>
</section>` : ''}

<section class="section">
  <div class="container">
    ${shead(usedIn.length || relatedPb.length ? '04' : '03', '基本信息', '')}
    <div class="fact-grid">
      ${facts.map(([k, v]) => `<div class="fact"><span class="label">${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
    </div>
  </div>
</section>

${siblings.length ? `<section class="section">
  <div class="container">
    ${shead(usedIn.length ? '05' : '04', `${cat.name}的其他工具`, '', `/tools/${esc(t.cat)}/`, '查看全部')}
    <div class="grid">${siblings.slice(0, 8).map((x) => toolCard(x, toolCatMap)).join('')}</div>
  </div>
</section>` : ''}

<section class="section" style="padding-top:0">
  <div class="container">
    <div class="review-note">
      <div class="rn-head">
        <span class="rn-status">${esc(statusLabel)}</span>
        ${reviewedAt ? `<span class="rn-date">更新于 ${esc(reviewedAt)}</span>` : ''}
        ${(t.evidence || []).length ? `<span class="rn-date">核验依据 ${t.evidence.length} 项</span>` : ''}
      </div>
      <p>${esc(site.review?.policy || '')} 发现信息有误或已过时，<a href="/about/#submit">欢迎指出</a>。</p>
    </div>
  </div>
</section>`;

  return layout({
    altPath: `/en/tools/${t.cat}/${t.id}/`,
    altLang: 'en',
    altLabel: '切换到英文版（Tools & Models）',
    site,
    path: `/tools/${t.cat}/${t.id}/`,
    title: `${t.name} · ${cat.name}`,
    description: `${t.desc}（${cat.name}类 AI 工具，${PRICING[t.pricing] || t.pricing}${t.cn ? '，国内可直连' : ''}）`,
    pageType: 'article',
    body,
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: t.name,
        description: t.desc,
        url: t.url,
        applicationCategory: cat.name,
        operatingSystem: 'Web',
        keywords: (t.tags || []).join(','),
        ...(t.pricing === 'free' || t.pricing === 'open' ? { offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' } } : {}),
      },
    ],
  });
}

/* ============================ 提示词库 ============================ */
export function promptsPage(ctx, { activeCat = '' } = {}) {
  const { site, promptCatMap, prompts, categories } = ctx;
  const list = activeCat ? prompts.filter((p) => p.cat === activeCat) : prompts;
  const activeName = activeCat && promptCatMap[activeCat] ? promptCatMap[activeCat].name : '';

  const seg = [
    `<button data-facet="cat" data-value="all"${!activeCat ? ' class="on"' : ''}>全部</button>`,
    ...categories.promptCategories.map(
      (c) => `<button data-facet="cat" data-value="${esc(c.id)}"${activeCat === c.id ? ' class="on"' : ''}>${esc(c.name)}</button>`,
    ),
  ].join('');

  const title = activeName ? `${activeName}提示词` : '提示词库';
  const desc = activeName
    ? `「${activeName}」分类下的 ${list.length} 条提示词。展开后可填变量，一键复制成完整提示词。`
    : `收录 ${prompts.length} 条经过结构设计的提示词。展开卡片可以直接填变量、一键复制成完整提示词，每条都附了「为什么这么写」。`;

  const crumbItems = activeName
    ? [{ label: '首页', href: '/' }, { label: '提示词库', href: '/prompts/' }, { label: activeName }]
    : [{ label: '首页', href: '/' }, { label: '提示词库' }];

  const body = `
${crumbs(crumbItems)}
${pageHead(title, desc, `<div class="ph-meta">
  <span class="label">分类 <b style="color:var(--fg)">${activeName || '全部'}</b></span>
  <span class="label">收录 <b style="color:var(--fg)">${list.length}</b></span>
  <span class="label">全部可复制</span>
</div>`, 'PROMPTS / 提示词库', '提示词列表与筛选')}

<div data-filter-root>
  <div class="toolbar">
    <div class="container">
      <div class="toolbar-row">
        <div class="filter-wrap">
          <span class="f-icon" aria-hidden="true">${icon('search', 15)}</span>
          <input class="filter-input" type="search" data-query placeholder="搜索提示词……" aria-label="搜索提示词">
        </div>
        <button class="btn btn-sm" data-toggle="hot" aria-pressed="false">${icon('zap', 12)} 热门</button>
        <button class="btn btn-sm btn-ghost" data-all-open>全部展开</button>
        <button class="btn btn-sm btn-ghost" data-reset>重置</button>
      </div>
      <div class="toolbar-row">
        <div class="seg" style="flex:1">${seg}</div>
      </div>
    </div>
  </div>

  <div class="container">
    <div class="result-count" data-count></div>
    <div class="grid grid-2" data-list>${list.map((p) => promptCard(p, promptCatMap)).join('')}</div>
    <div class="hidden" data-empty>${emptyState()}</div>
  </div>
</div>

<section class="section">
  <div class="container">
    ${shead('—', '按分类找提示词', '每个分类是一类任务，模板可以互相借用', '', '')}
    <div class="grid grid-4">
      ${categories.promptCategories.map((c) => catCard(
        { ...c, desc: `${prompts.filter((p) => p.cat === c.id).length} 条模板` },
        prompts.filter((p) => p.cat === c.id).length,
        `/prompts/${c.id}/`,
      )).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead('—', '怎么用好这些提示词', '这四条规律比多背 100 个模板有用')}
    <div class="grid grid-2">
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('sliders', 15)} 先填变量，别直接发</h3><p class="card-desc" style="margin:0">展开卡片用「变量填充」把 <span class="var-hl">{{变量}}</span> 换成你的真实情况，再复制。填得越具体，效果差得越明显。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('layers', 15)} 需要长输出就拆两轮</h3><p class="card-desc" style="margin:0">第一轮只要大纲，确认方向后再让它展开。这一步能挡掉 80% 的跑题和废话。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('shield', 15)} 事实类任务加一句约束</h3><p class="card-desc" style="margin:0">涉及数字、法条、引用时，追加「不确定请直接说不知道」，能大幅减少编造。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('spark', 15)} 复杂的活让它先问</h3><p class="card-desc" style="margin:0">加一句「信息不足请先问我最关键的 2 个问题」，比让它硬答一堆猜测强得多。</p></div>
    </div>
  </div>
</section>`;

  // 中文提示词页的英文版：只要该范围里有已翻译的提示词就该指过去。
  // 没翻的不指 —— 单向 hreflang 会被 Google 整条忽略，指到 404 更糟。
  const enPrompts = list.filter((p) => p.en && p.en.prompt);
  const altPrompts = enPrompts.length
    ? (activeCat ? `/en/prompts/${activeCat}/` : '/en/prompts/')
    : '';

  return layout({
    site,
    path: activeCat ? `/prompts/${activeCat}/` : '/prompts/',
    title, description: desc, body,
    altPath: altPrompts,
    altLang: 'en',
    altLabel: 'Switch to English (prompts)',
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: title,
        numberOfItems: list.length,
        itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.title, description: p.desc })),
      },
    ],
  });
}

/* ============================ 资讯 ============================ */
export function newsPage(ctx) {
  const { site, topicMap, news, feed } = ctx;
  const items = [...news.items].sort((a, b) => (a.date < b.date ? 1 : -1));
  const sourceGrid = news.sources.map((s) => sourceRow(s, topicMap)).join('');
  const crumbItems = [{ label: '首页', href: '/' }, { label: '资讯' }];
  const live = feed?.items?.slice(0, 8) || [];

  const body = `
${crumbs(crumbItems)}
${pageHead('AI 资讯与解读', '这里不追热点标题，只做两件事：把重要的进展讲清楚，把真正有用的信息源整理出来。', `<div class="ph-meta">
  <span class="label">解读 <b style="color:var(--fg)">${news.items.length}</b></span>
  <span class="label">信息源 <b style="color:var(--fg)">${news.sources.length}</b></span>
  <span class="label">里程碑 <b style="color:var(--fg)">${news.milestones.length}</b></span>
  ${feed?.items?.length ? `<span class="label">实时抓取 <b style="color:var(--fg)">${feed.items.length}</b></span>` : ''}
</div>`, 'SIGNAL / 资讯')}

${live.length ? `<section class="section" style="padding-top:0">
  <div class="container">
    ${shead(1, '实时动态', `从 ${feed.sources.filter((s) => s.ok).length} 个公开源自动抓取，每 ${ctx.feedHours || 24} 小时更新`, '/news/live/', '看全部动态')}
    <div class="live-list">${live.map((it) => liveItem(it, topicMap)).join('')}</div>
  </div>
</section>` : ''}

<section class="section">
  <div class="container">
    ${shead(live.length ? 2 : 1, '精选解读', '长期有效的内容，不是会过期的新闻')}
    <div class="news-list">${items.map((n) => newsItem(n, topicMap)).join('')}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead(live.length ? 3 : 2, '信息源导航', '想自己追前沿，从这些地方开始，比刷二手转述强（本站的实时动态也是抓它们）')}
    <div class="grid grid-2">${sourceGrid}</div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead(live.length ? 4 : 3, 'AI 发展里程碑', '理解今天的格局，得先知道它是怎么走到这里的')}
    <div class="card" style="padding:32px 30px"><div class="timeline">${news.milestones.map(milestoneItem).join('')}</div></div>
  </div>
</section>`;

  return layout({
    site, path: '/news/', title: 'AI 资讯与解读',
    description: 'AI 实时动态聚合、精选解读、信息源导航与 AI 发展里程碑时间线。每天自动抓取 18 个中英文 AI 资讯源，另收录 18 篇长期有效的深度解读。',
    body,
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: 'AI 资讯与解读',
        hasPart: items.map((n) => ({ '@type': 'Article', headline: n.title, datePublished: n.date })),
      },
    ],
  });
}

export function newsDetailPage(ctx, item) {
  const { site, topicMap, news } = ctx;
  const tp = topicMap[item.topic] || { name: item.topic, accent: '#1B4DFF' };
  const others = news.items.filter((n) => n.id !== item.id).slice(0, 4);
  const crumbItems = [{ label: '首页', href: '/' }, { label: '资讯', href: '/news/' }, { label: tp.name }];

  const body = `
${crumbs(crumbItems)}
<article>
  <div class="container container-narrow">
    <header class="article-head">
      <div class="news-meta">
        <span class="tag accent" style="${accentTextStyle(tp.accent)}">${esc(tp.name)}</span>
        <span>${esc(fmtDateCN(item.date))}</span>
        <span class="dot-sep">/</span>
        <span>${esc(item.source)}</span>
      </div>
      <h1>${esc(item.title)}</h1>
      <p style="color:var(--fg-2);font-size:1rem;line-height:1.75;max-width:66ch">${esc(item.summary)}</p>
      <div class="row" style="gap:5px;margin-top:18px">${(item.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    </header>
    <div class="article-body">
      ${item.body.map((p) => `<p>${esc(p)}</p>`).join('')}
    </div>
  </div>
</article>

<section class="section">
  <div class="container">
    ${shead('—', '继续阅读', '', '/news/', '全部资讯')}
    <div class="news-list">${others.map((n) => newsItem(n, topicMap)).join('')}</div>
  </div>
</section>`;

  return layout({
    site,
    path: `/news/${item.id}/`,
    title: item.title,
    // 只用 summary 太短（最短的加权只有 46），搜索结果里信息量不够。
    // 正文第一段是现成的、信息密度更高的文本，取到句子边界即可。
    description: `${item.summary}${metaExcerpt((item.body || [])[0], 60)}`,
    pageType: 'article',
    body,
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: item.title,
        description: item.summary,
        datePublished: item.date,
        dateModified: item.date,
        author: { '@type': 'Organization', name: item.source },
        publisher: { '@type': 'Organization', name: site.brand.name },
        keywords: (item.tags || []).join(','),
      },
    ],
  });
}

/* ============================ 学习 ============================ */
export function learnPage(ctx, { activeTrack = '' } = {}) {
  const { site, trackMap, learn, categories } = ctx;
  const list = activeTrack ? learn.filter((l) => l.track === activeTrack) : learn;
  const activeName = activeTrack && trackMap[activeTrack] ? trackMap[activeTrack].name : '';

  const seg = [
    `<button data-facet="track" data-value="all"${!activeTrack ? ' class="on"' : ''}>全部</button>`,
    ...categories.learnTracks.map(
      (t) => `<button data-facet="track" data-value="${esc(t.id)}"${activeTrack === t.id ? ' class="on"' : ''}>${esc(t.name)}</button>`,
    ),
  ].join('');

  const title = activeName ? `${activeName} · 学习资源` : '学习资源';
  const desc = activeName
    ? `${(trackMap[activeTrack] || {}).desc || ''} 这条路径下有 ${list.length} 份免费材料，按「先看什么、后看什么」排好了顺序，每份都标注了语言、难度和大概要花多久。`
    : `AI 学习资源：${learn.length} 份精选教程、课程与书籍，从零基础到能动手做产品。全部标注免费与否和难度，按入门 / 动手做 / 提示词 / 商业四个方向分类。`;

  const crumbItems = activeName
    ? [{ label: '首页', href: '/' }, { label: '学习资源', href: '/learn/' }, { label: activeName }]
    : [{ label: '首页', href: '/' }, { label: '学习' }];

  const body = `
${crumbs(crumbItems)}
${pageHead(title, desc, '', 'LEARNING / 学习路径', '学习资源列表与筛选')}

<div data-filter-root>
  <div class="toolbar">
    <div class="container">
      <div class="toolbar-row">
        <div class="filter-wrap">
          <span class="f-icon" aria-hidden="true">${icon('search', 15)}</span>
          <input class="filter-input" type="search" data-query placeholder="搜索课程、教材、文档……" aria-label="搜索资源">
        </div>
        <div class="seg">${seg}</div>
      </div>
    </div>
  </div>
  <div class="container">
    <div class="result-count" data-count></div>
    <div class="grid" data-list>${list.map((l) => learnCard(l, trackMap)).join('')}</div>
    <div class="hidden" data-empty>${emptyState()}</div>
  </div>
</div>

<section class="section">
  <div class="container">
    ${shead('—', '四条学习路径', '不知道从哪开始，就按你的目标挑一条', '', '')}
    <div class="grid grid-4">
      ${categories.learnTracks.map((t) => catCard(t, learn.filter((l) => l.track === t.id).length, `/learn/${t.id}/`)).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead('—', '一条不绕弯的学习路线', '顺序比努力更重要')}
    <div class="card" style="padding:32px 30px"><div class="timeline">
      <div class="tl-item"><div class="tl-date">STEP 01 / 建立直觉</div><h3>先看懂，别急着写代码</h3><p>用可视化课程建立对神经网络和大模型的基本感觉。这个阶段的目标是「能跟人聊明白」，不是「会训练模型」。</p></div>
      <div class="tl-item"><div class="tl-date">STEP 02 / 学会提问</div><h3>把提示词练成一项技能</h3><p>提示词是当前投入产出比最高的 AI 技能。系统学一遍结构、约束、示例的写法，你用任何模型的效率都会翻倍。</p></div>
      <div class="tl-item"><div class="tl-date">STEP 03 / 动手实现</div><h3>从一个最小可用项目开始</h3><p>调 API、做 RAG、搭一个属于自己的小工具。不用大，但要完整跑通一遍——这一步会打通你对整个技术栈的理解。</p></div>
      <div class="tl-item"><div class="tl-date">STEP 04 / 落到业务</div><h3>找到那个值得被解决的问题</h3><p>技术都会之后，差距在于选题。观察你所在领域里最重复、最耗时、最需要经验判断的环节，那里通常就是 AI 的落点。</p></div>
    </div></div>
  </div>
</section>`;

  return layout({
    site,
    path: activeTrack ? `/learn/${activeTrack}/` : '/learn/',
    title, description: desc, body,
    jsonld: breadcrumbLd(site, crumbItems),
  });
}

/* ============================ 术语表 ============================ */
export function glossaryPage(ctx) {
  const { site, glossary, toolMap, playbookMap } = ctx;
  // 词条名 → 锚点 slug。related 用这张表解析，保证和锚点用同一套规则。
  const slugMap = buildGlossSlugMap(glossary);
  const cats = [...new Set(glossary.map((g) => g.cat))];
  const crumbItems = [{ label: '首页', href: '/' }, { label: 'AI 术语表' }];

  const seg = [`<button data-facet="cat" data-value="all" class="on">全部</button>`,
    ...cats.map((c) => `<button data-facet="cat" data-value="${esc(c)}">${esc(c)}</button>`)].join('');

  const body = `
${crumbs(crumbItems)}
${pageHead('AI 术语表', `收录 ${glossary.length} 个 AI 领域常用名词。每个词都给「人话版」解释，而不是把维基百科抄一遍。`, '', 'GLOSSARY / 术语表', '术语列表与筛选')}

<div data-filter-root>
  <div class="toolbar">
    <div class="container">
      <div class="toolbar-row">
        <div class="filter-wrap">
          <span class="f-icon" aria-hidden="true">${icon('search', 15)}</span>
          <input class="filter-input" type="search" data-query placeholder="搜索术语、英文名或缩写……" aria-label="搜索术语">
        </div>
        <button class="btn btn-sm btn-ghost" data-reset>重置</button>
      </div>
      <div class="toolbar-row">
        <div class="seg" style="flex:1">${seg}</div>
      </div>
    </div>
  </div>
  <div class="container">
    <div class="result-count" data-count></div>
    <div class="grid grid-2" data-list>${glossary.map((g) => glossItem(g, toolMap, playbookMap, slugMap)).join('')}</div>
    <div class="hidden" data-empty>${emptyState('没有找到这个术语', '换个说法试试，或者去资讯页看看相关解读。')}</div>
  </div>
</div>`;

  return layout({
    site, path: '/glossary/', title: 'AI 术语表',
    altPath: glossary.some((g) => g.defEn) ? '/en/glossary/' : '',
    description: `AI 术语表：${glossary.length} 条常见 AI 名词的「人话」解释，涵盖大模型、训练、提示词、RAG、Agent 等方向。每条都写明它解决什么问题、什么时候不适用，不抄百科定义。`,
    body,
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org',
        '@type': 'DefinedTermSet',
        name: 'AI 术语表',
        hasDefinedTerm: glossary.slice(0, 60).map((g) => ({
          '@type': 'DefinedTerm', name: g.term, description: g.def,
        })),
      },
    ],
  });
}

/* ============================ 全站搜索 ============================ */
export function searchPage(ctx) {
  const { site } = ctx;
  const crumbItems = [{ label: '首页', href: '/' }, { label: '搜索' }];

  const body = `
${crumbs(crumbItems)}
${pageHead('全站搜索', '一次搜索覆盖场景手册、工具、提示词、模型、学习资源、术语和资讯。数据在页面加载时已就绪，输入即出结果，不发请求。', '', 'SEARCH / 全站搜索', '搜索结果与筛选')}

<div class="container">
  <form class="search-hero" style="max-width:100%;margin-bottom:24px" onsubmit="return false" role="search">
    <span class="s-icon" aria-hidden="true">${icon('search', 17)}</span>
    <input type="search" id="globalSearch" placeholder="输入关键词，例如：视频生成 / RAG / 提示词 / 本地部署" autocomplete="off" autofocus aria-label="全站搜索">
  </form>

  <div class="row" style="gap:6px;margin-bottom:22px" id="typeFilters">
    <button class="btn btn-sm btn-primary" data-type="all" type="button">全部</button>
    <button class="btn btn-sm" data-type="playbook" type="button">场景</button>
    <button class="btn btn-sm" data-type="tool" type="button">工具</button>
    <button class="btn btn-sm" data-type="prompt" type="button">提示词</button>
    <button class="btn btn-sm" data-type="model" type="button">模型</button>
    <button class="btn btn-sm" data-type="learn" type="button">学习</button>
    <button class="btn btn-sm" data-type="glossary" type="button">术语</button>
    <button class="btn btn-sm" data-type="news" type="button">资讯</button>
  </div>

  <div class="result-count" id="searchCount"></div>
  <div class="grid" id="searchResults"></div>
  <div class="hidden" id="searchEmpty">${emptyState('还没有输入关键词', '试试搜索工具名、能力描述或者术语。')}</div>
  <div class="hidden" id="searchNone">${emptyState('没有找到相关内容', '换个关键词，或者去对应的分类页看看。')}</div>
</div>

<section class="section">
  <div class="container">
    ${shead('—', '按场景找', '不知道用什么工具时，从「你要做的事」进', '/playbooks/', '全部场景')}
    <div class="grid grid-4">
      ${ctx.playbooks.groups.map((g) => catCard(g, ctx.counts.playbooksByGroup[g.id] || 0, `/playbooks/${g.id}/`)).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead('—', '按用途找工具', '')}
    <div class="grid grid-4">
      ${ctx.categories.toolCategories.slice(0, 8).map((c) => catCard(c, ctx.counts.toolsByCat[c.id] || 0, `/tools/${c.id}/`)).join('')}
    </div>
  </div>
</section>`;

  return layout({
    site, path: '/search/', title: '全站搜索',
    description: '全站搜索：一次搜遍 AI 工具、场景手册、提示词、模型、术语、学习资源与资讯，共 500 多条内容。数据在页面加载时已就绪，输入即出结果。',
    body,
    altPath: '/en/search/',
    altLang: 'en',
    altLabel: 'Switch to English (search)',
    /* 搜索页对爬虫是空页（结果要输入才出现），且 ?q= 变体会被当成无穷多份重复内容。
       noindex 但 follow：不进索引，链接权重照常传。sitemap 里也同步排除了。 */
    robots: 'noindex, follow',
    scripts: `<script src="/assets/${esc(site.asset.icons)}"></script>`
      + `<script>window.__AIWX_INDEX__=${jsonEmbed(ctx.searchIndex)};window.__AIWX_QUERY_MAP__=${jsonEmbed(ctx.queryMap || {})};</script>`
      // 搜索逻辑按需加载：defer 保证排在 app.js 之后执行，而 app.js 已经不再认得它
      + `<script src="/assets/${esc(site.asset.search)}" defer></script>`,
    jsonld: breadcrumbLd(site, crumbItems),
  });
}

/* ============================ 场景手册 ============================ */
export function playbooksPage(ctx, { activeGroup = '' } = {}) {
  const { site, playbooks } = ctx;
  const list = activeGroup ? playbooks.items.filter((p) => p.group === activeGroup) : playbooks.items;
  const activeName = activeGroup ? (ctx.groupMap[activeGroup] || {}).name : '';

  const seg = [
    `<button data-facet="group" data-value="all"${!activeGroup ? ' class="on"' : ''}>全部</button>`,
    ...playbooks.groups.map(
      (g) => `<button data-facet="group" data-value="${esc(g.id)}"${activeGroup === g.id ? ' class="on"' : ''}>${esc(g.name)}</button>`,
    ),
  ].join('');

  const title = activeName ? `${activeName}场景` : '场景手册';
  /* 分组页原来直接用 group.desc（「接手代码、修 bug、自动化」这种短语），
     加权长度只有 43，在搜索结果里等于没描述。
     改成列出这个组里真实存在的场景名 —— 既是给搜索引擎的信息，也是给读者的菜单。 */
  const desc = activeName
    ? `「${activeName}」下的 ${list.length} 个场景：${list.slice(0, 5).map((p) => p.title).join('、')}${list.length > 5 ? ' 等' : ''}。每个场景都给出完整流程、配套提示词和最容易踩的坑。`
    : `收录 ${playbooks.items.length} 个「我想做某件事」的完整流程。每个场景都写清了用哪些工具、配哪条提示词、以及最容易踩的坑——比单纯列工具更有用。`;

  const crumbItems = activeName
    ? [{ label: '首页', href: '/' }, { label: '场景手册', href: '/playbooks/' }, { label: activeName }]
    : [{ label: '首页', href: '/' }, { label: '场景手册' }];

  const body = `
${crumbs(crumbItems)}
${pageHead(title, desc, `<div class="ph-meta">
  <span class="label">场景 <b style="color:var(--fg)">${list.length}</b></span>
  <span class="label">分组 <b style="color:var(--fg)">${playbooks.groups.length}</b></span>
  <span class="label">每篇含流程 / 工具 / 提示词 / 避坑</span>
</div>`, 'PLAYBOOKS / 场景手册', '场景列表与筛选')}

<div data-filter-root>
  <div class="toolbar">
    <div class="container">
      <div class="toolbar-row">
        <div class="filter-wrap">
          <span class="f-icon" aria-hidden="true">${icon('search', 15)}</span>
          <input class="filter-input" type="search" data-query placeholder="描述你想做的事，例如：写周报、修 bug、做落地页……" aria-label="搜索场景">
        </div>
        <button class="btn btn-sm btn-ghost" data-reset>重置</button>
      </div>
      <div class="toolbar-row">
        <div class="seg" style="flex:1">${seg}</div>
      </div>
    </div>
  </div>
  <div class="container">
    <div class="result-count" data-count></div>
    <div class="grid" data-list>${list.map((p) => playbookCard(p, ctx.groupMap)).join('')}</div>
    <div class="hidden" data-empty>${emptyState('还没有这个场景', '换个说法试试，或者直接去工具库按分类找。')}</div>
  </div>
</div>

<section class="section">
  <div class="container">
    ${shead('—', '这份手册的写法', '每个场景都刻意写了「做不到什么」')}
    <div class="grid grid-2">
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('route', 15)} 按流程走，而不是按工具找</h3><p class="card-desc" style="margin:0">真实工作是「我想做某件事」，不是「我想用某个工具」。所以每个场景先给流程，再标出每一步该用什么。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('layers', 15)} 工具和提示词是配套的</h3><p class="card-desc" style="margin:0">同一件事用不同的工具，提示词写法也不一样。场景里直接给出可用的组合，省掉试错。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('alert', 15)} 避坑比技巧更值钱</h3><p class="card-desc" style="margin:0">AI 工具的翻车点很集中（编数据、改串味、静默失败）。每个场景都把这些坑单独列出来。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('shield', 15)} 明确说「不要用 AI 做什么」</h3><p class="card-desc" style="margin:0">有些环节用脚本比用模型又稳又便宜。手册里会直接告诉你哪里该放弃 AI。</p></div>
    </div>
  </div>
</section>`;

  // 英文站只有手册总览页，没有分组页 —— 所以只有总览页能配对。
  // 分组页硬指 /en/playbooks/ 会让两边的 hreflang 语义对不上。
  const altPb = !activeGroup && playbooks.items.some((p) => p.en) ? '/en/playbooks/' : '';

  return layout({
    site,
    path: activeGroup ? `/playbooks/${activeGroup}/` : '/playbooks/',
    title, description: desc, body,
    altPath: altPb,
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: title,
        numberOfItems: list.length,
        itemListElement: list.map((p, i) => ({
          '@type': 'ListItem', position: i + 1, name: p.title, description: p.problem,
        })),
      },
    ],
  });
}


/** 验收区：把「这篇手册到底要产出什么、什么算失败、什么时候别用 AI」摆到最前面。
    ChatGPT 的审查意见里最有用的一条 —— 判断一篇手册是不是「假装有用」有客观标准：
   有没有明确的输入与完成标准、有没有真实失败模式、有没有给出「不该用 AI」的边界。 */
const pbSpec = (sp) => !sp ? '' : `<section class="section" style="padding-top:0">
  <div class="container container-narrow">
    <div class="pb-spec">
      <div class="pbs-head">做完应该得到什么</div>
      <dl>
        <div><dt>输入</dt><dd>${esc(sp.input || '')}</dd></div>
        <div><dt>产出</dt><dd>${esc(sp.output || '')}</dd></div>
        <div><dt>什么算失败</dt><dd>${esc(sp.fail || '')}</dd></div>
        <div><dt>什么时候别用 AI</dt><dd>${esc(sp.alt || '')}</dd></div>
      </dl>
    </div>
  </div>
</section>`;

export function playbookDetailPage(ctx, pb) {
  const { site, groupMap, toolMap, promptMap } = ctx;
  const g = groupMap[pb.group] || { name: pb.group, accent: '#1B4DFF', icon: 'target' };
  const others = ctx.playbooks.items.filter((x) => x.id !== pb.id && x.group === pb.group);
  const fallback = ctx.playbooks.items.filter((x) => x.id !== pb.id && x.group !== pb.group).slice(0, 3);
  const more = [...others, ...fallback].slice(0, 3);
  const crumbItems = [{ label: '首页', href: '/' }, { label: '场景手册', href: '/playbooks/' }, { label: g.name, href: `/playbooks/${pb.group}/` }, { label: pb.title }];

  const chip = (id, type) => {
    const it = type === 'tool' ? toolMap[id] : promptMap[id];
    if (!it) return '';
    if (type === 'tool') {
      return `<a class="tag accent" href="${esc(it.url)}" target="_blank" rel="noopener nofollow" style="${accentTextStyle(g.accent)}">${esc(it.name)}${icon('arrow-up-right', 10)}</a>`;
    }
    return `<a class="tag accent" href="/prompts/${esc(it.cat)}/#${esc(it.id)}" style="${accentTextStyle(g.accent)}">${icon('spark', 10)} ${esc(it.title)}</a>`;
  };

  const steps = (pb.steps || []).map((s, i) => `
    <div class="step">
      <div class="step-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="step-body">
        <p>${esc(s.text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p>
        ${(s.tools || []).length || (s.prompts || []).length
          ? `<div class="step-refs">${(s.tools || []).map((id) => chip(id, 'tool')).join('')}${(s.prompts || []).map((id) => chip(id, 'prompt')).join('')}</div>`
          : ''}
      </div>
    </div>`).join('');

  const toolGrid = (pb.tools || []).map((id) => toolMap[id]).filter(Boolean);
  const promptCards = (pb.prompts || []).map((id) => promptMap[id]).filter(Boolean);

  const body = `
${crumbs(crumbItems)}
<div class="container container-narrow">
  <header class="article-head">
    <div class="news-meta">
      <span class="tag accent" style="${accentTextStyle(g.accent)}">${esc(g.name)}</span>
      <span>预计 ${esc(pb.time)}</span>
      <span class="dot-sep">/</span>
      <span>${esc(pb.level || '')}</span>
      <span class="dot-sep">/</span>
      <span>${(pb.steps || []).length} 步</span>
    </div>
    <h1>${esc(pb.title)}</h1>
    <p style="color:var(--fg-2);font-size:1rem;line-height:1.75;max-width:66ch">${esc(pb.problem)}</p>
  </header>
  ${playbookFlow((pb.steps || []).length, g.accent)}
</div>

${pbSpec(pb.spec)}

<section class="section" style="padding-top:34px">
  <div class="container container-narrow">
    ${shead('01', '流程', '按顺序做，每一步都标注了用什么')}
    <div class="steps">${steps}</div>
  </div>
</section>
${promptCards.length ? `<section class="section">
  <div class="container">
    ${shead('02', '用到的提示词', '展开可填变量，直接复制成完整提示词')}
    <div class="grid grid-2">${promptCards.map((p) => promptCard(p, ctx.promptCatMap)).join('')}</div>
  </div>
</section>` : ''}

${toolGrid.length ? `<section class="section">
  <div class="container">
    ${shead(promptCards.length ? '03' : '02', '推荐工具', `${toolGrid.length} 个，按流程里出现的顺序`)}
    <div class="grid">${toolGrid.map((t) => toolCard(t, ctx.toolCatMap)).join('')}</div>
  </div>
</section>` : ''}

<section class="section">
  <div class="container container-narrow">
    ${shead('!', '避坑', '这些是同一件事上最常见的翻车点')}
    <div class="warn-list">
      ${(pb.warnings || []).map((w) => `<div class="warn-item">${icon('alert', 16)}<p>${esc(w).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</p></div>`).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead('—', '相关场景', '', '/playbooks/', '全部场景')}
    <div class="grid">${more.map((p) => playbookCard(p, groupMap)).join('')}</div>
  </div>
</section>`;

  return layout({
    site,
    path: `/playbooks/${pb.id}/`,
    // 英译手册才配对，没翻的不指过去
    altPath: pb.en ? `/en/playbooks/${pb.id}/` : '',
    altLang: 'en',
    altLabel: 'Switch to English (playbook)',
    title: pb.title,
    description: `${pb.problem} 共 ${(pb.steps || []).length} 步，预计 ${pb.time}。${pb.spec ? '产出：' + pb.spec.output + '。' : ''}`,
    pageType: 'article',
    body,
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: pb.title,
        description: `${pb.problem}${pb.spec ? ' 产出：' + pb.spec.output : ''}`,
        totalTime: pb.time,
        step: (pb.steps || []).map((s, i) => ({
          '@type': 'HowToStep', position: i + 1, text: s.text.replace(/\*\*/g, ''),
        })),
      },
    ],
  });
}

/* ============================ 模型库 ============================ */
export function modelsPage(ctx, { activeKind = '' } = {}) {
  const { site, models, kindMap } = ctx;
  const list = activeKind ? models.items.filter((m) => m.kind === activeKind) : models.items;
  const activeName = activeKind ? (kindMap[activeKind] || {}).name : '';

  const seg = [
    `<button data-facet="kind" data-value="all"${!activeKind ? ' class="on"' : ''}>全部</button>`,
    ...models.kinds.map(
      (k) => `<button data-facet="kind" data-value="${esc(k.id)}"${activeKind === k.id ? ' class="on"' : ''}>${esc(k.name)}</button>`,
    ),
  ].join('');

  const counts = {};
  for (const m of models.items) counts[m.kind] = (counts[m.kind] || 0) + 1;

  const title = activeName ? `${activeName}模型` : '模型选型库';
  const desc = activeName
    ? `${activeName}方向的 ${list.length} 个模型家族对比：每个都标注了是否开源、国内能否直连、最强的地方和要注意的坑，并附官方模型列表链接。只对比稳定的维度，不含几个月就过期的参数。`
    : `把 ${models.items.length} 个模型家族按「最强的地方 / 主要注意 / 适合什么」摆在一起对比。刻意不写版本号和具体参数——那类信息几个月就过期。`;

  const crumbItems = activeName
    ? [{ label: '首页', href: '/' }, { label: '模型库', href: '/models/' }, { label: activeName }]
    : [{ label: '首页', href: '/' }, { label: '模型库' }];

  const summary = models.kinds
    .map((k) => `<a class="tag" href="/models/${esc(k.id)}/">${esc(k.name)} <b class="num" style="color:var(--fg-2)">${counts[k.id] || 0}</b></a>`)
    .join('');

  const body = `
${crumbs(crumbItems)}
${pageHead(title, desc, `<div class="ph-meta">${summary}</div>`, 'MODELS / 模型库', '模型列表与筛选')}

<section class="section" style="padding-top:0">
  <div class="container">
    <div class="card" style="padding:18px 22px;border-left:3px solid var(--accent);max-width:880px">
      <div class="label label-accent" style="margin-bottom:8px">先读这段</div>
      <p style="font-size:.89rem;color:var(--fg-2);line-height:1.75;margin:0">${esc(models.note)}</p>
    </div>
  </div>
</section>

<div data-filter-root>
  <div class="toolbar">
    <div class="container">
      <div class="toolbar-row">
        <div class="filter-wrap">
          <span class="f-icon" aria-hidden="true">${icon('search', 15)}</span>
          <input class="filter-input" type="search" data-query placeholder="搜索模型家族或厂商……" aria-label="搜索模型">
        </div>
        <button class="btn btn-sm" data-toggle="open" aria-pressed="false">${icon('server', 12)} 只要开源</button>
        <button class="btn btn-sm" data-toggle="cn" aria-pressed="false">${icon('globe', 12)} 国内可直连</button>
        <button class="btn btn-sm btn-ghost" data-reset>重置</button>
      </div>
      <div class="toolbar-row">
        <div class="seg" style="flex:1">${seg}</div>
      </div>
    </div>
  </div>
  <div class="container">
    <div class="result-count" data-count></div>
    <div class="grid" data-list>${list.map((m) => modelCard(m, kindMap, models.tiers)).join('')}</div>
    <div class="hidden" data-empty>${emptyState()}</div>
  </div>
</div>

<section class="section">
  <div class="container">
    ${shead('—', '怎么选：三条够用的规则', '')}
    <div class="grid grid-2">
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('shield', 15)} 数据敏感 → 先看开源</h3><p class="card-desc" style="margin:0">金融、医疗、政企场景通常不允许数据出内网。这时开源模型不是"将就"，而是唯一可行解。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('zap', 15)} 任务可验证 → 先上便宜档</h3><p class="card-desc" style="margin:0">分类、抽取、格式转换这类任务有明确对错，小模型或开源模型基本够用，成本能降一个数量级。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('target', 15)} 失败说不清 → 别省这个钱</h3><p class="card-desc" style="margin:0">写方案、做决策建议这类任务，失败的表现是「说不清哪里不对」。这种地方能力差距会被放大。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('flow', 15)} 混合用最划算</h3><p class="card-desc" style="margin:0">实操中最优解通常是混搭：难题给旗舰模型，批量重复的活交给便宜模型或本地模型。</p></div>
    </div>
  </div>
</section>`;

  return layout({
    altPath: activeKind ? `/en/models/${activeKind}/` : '/en/models/',
    altLang: 'en',
    altLabel: '切换到英文版（Tools & Models）',
    site,
    path: activeKind ? `/models/${activeKind}/` : '/models/',
    title, description: desc, body,
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: title,
        numberOfItems: list.length,
        itemListElement: list.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: `${m.name}（${m.vendor}）`, description: (m.strengths || []).join('；') })),
      },
    ],
  });
}

/* ============================ 实时动态（RSS 聚合） ============================ */
export function liveNewsPage(ctx, { activeSource = '' } = {}) {
  const { site, feed, topicMap } = ctx;

  if (!feed || !feed.items?.length) {
    return layout({
      robots: 'noindex, follow',
      site, path: '/news/live/', title: '实时动态',
      description: '来自各大 AI 资讯源的实时抓取。',
      body: `${crumbs([{ label: '首页', href: '/' }, { label: '资讯', href: '/news/' }, { label: '实时动态' }])}
${pageHead('实时动态', '还没抓到内容。', '', 'LIVE / 实时动态', '实时动态列表与筛选')}
<section class="section"><div class="container">${emptyState('暂无抓取数据', '运行 node scripts/fetch-news.mjs 抓取一次。')}</div></section>`,
    });
  }

  const sources = feed.sources.filter((s) => s.ok);
  const failed = feed.sources.filter((s) => !s.ok);
  const updated = new Date(feed.updatedAt);

  const seg = [
    `<button data-facet="source" data-value="all" class="on">全部</button>`,
    ...sources.map((s) => `<button data-facet="source" data-value="${esc(s.id)}">${esc(s.name)}</button>`),
  ].join('');

  const langSeg = ['all', '中文', 'English']
    .map((l, i) => `<button data-facet="lang" data-value="${esc(l)}"${i === 0 ? ' class="on"' : ''}>${l === 'all' ? '不限语种' : l}</button>`)
    .join('');

  const crumbItems = [{ label: '首页', href: '/' }, { label: '资讯', href: '/news/' }, { label: '实时动态' }];

  const body = `
${crumbs(crumbItems)}
${pageHead(
    '实时动态',
    `从 ${sources.length} 个公开资讯源自动抓取的最新内容，每 ${esc(String(ctx.feedHours || 24))} 小时更新一次。这里的条目是别人的内容，只做标题与摘要聚合，点击直达原文。`,
    `<div class="ph-meta">
      <span class="label">条目 <b style="color:var(--fg)">${feed.items.length}</b></span>
      <span class="label">来源 <b style="color:var(--fg)">${sources.length}</b></span>
      <span class="label">抓取于 <b style="color:var(--fg)">${esc(updated.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-'))}</b></span>
      <a class="btn btn-sm" href="/feed.xml">${icon('send', 12)} 订阅本站精选</a>
    </div>`,
    'LIVE / 实时动态',
  )}

<div data-filter-root>
  <div class="toolbar">
    <div class="container">
      <div class="toolbar-row">
        <div class="filter-wrap">
          <span class="f-icon" aria-hidden="true">${icon('search', 15)}</span>
          <input class="filter-input" type="search" data-query placeholder="筛选标题、摘要或来源……" aria-label="筛选动态">
        </div>
        <div class="seg">${langSeg}</div>
        <button class="btn btn-sm btn-ghost" data-reset>重置</button>
      </div>
      <div class="toolbar-row">
        <div class="seg" style="flex:1">${seg}</div>
      </div>
    </div>
  </div>
  <div class="container">
    <div class="result-count" data-count></div>
    <h2 class="sr-only">最新抓取的内容</h2>
    <div class="live-list" data-list>${feed.items.map((it) => liveItem(it, topicMap)).join('')}</div>
    <div class="hidden" data-empty>${emptyState('没有匹配的动态', '换个关键词，或切换来源。')}</div>
  </div>
</div>

<section class="section">
  <div class="container">
    ${shead('—', '数据说明', '聚合别人的内容，边界要讲清楚')}
    <div class="grid grid-2">
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('info', 15)} 只是索引，不搬运全文</h3><p class="card-desc" style="margin:0">这里只展示标题、时间与摘要，全部点击直达原文。版权归各来源所有，本站不做全文转载。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('clock', 15)} 抓取有延迟</h3><p class="card-desc" style="margin:0">按固定周期批量抓取，不是实时的。想第一时间看到，建议直接订阅你关心的那几个源（见下方）。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('alert', 15)} 标题可能有偏差</h3><p class="card-desc" style="margin:0">摘要由源站的描述字段自动清洗而来，可能出现断句或缺失。判断内容质量请点进原文。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('shield', 15)} 源失效会被标注</h3><p class="card-desc" style="margin:0">下面是当前抓取状态。失效的源不会静默消失，会如实列出来，方便替换或修复。</p></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead('—', '抓取状态', `成功 ${sources.length} / 配置 ${feed.sources.length}`)}
    <div class="grid grid-2">
      ${feed.sources
        .map((s) => `<div class="source-row" style="cursor:default">
          <span class="sr-ic" style="color:${s.ok ? 'var(--ok)' : 'var(--danger)'}" aria-hidden="true">${s.ok ? '✓' : '✗'}</span>
          <span class="sr-main"><b>${esc(s.name)}</b><span>${s.ok ? `本次抓取 ${s.count} 条` : `失败：${esc(s.error || '未知原因')}`}</span></span>
        </div>`)
        .join('')}
    </div>
    ${failed.length ? `<p class="label" style="margin-top:14px;color:var(--warn)">有 ${failed.length} 个源抓取失败，不影响其他源；界面会持续重试。</p>` : ''}
  </div>
</section>

<section class="section">
  <div class="container">
    ${shead('—', '想看更完整的解读？', '', '/news/', '回精选解读')}
    <div class="container-narrow" style="padding:0">
      <div class="card" style="padding:26px">
        <p style="font-size:.92rem;color:var(--fg-2);line-height:1.8;margin:0">
          实时动态是「别人说了什么」，精选解读是「这件事意味着什么」。后者是本站自己写的长期内容，不会过期，也有 RSS 可以订阅。
        </p>
      </div>
    </div>
  </div>
</section>`;

  return layout({
    site,
    path: activeSource ? `/news/live/${activeSource}/` : '/news/live/',
    robots: 'noindex, follow', // 自动聚合页不进索引，但保留链接权重传递
    title: '实时动态',
    description: `从 ${sources.length} 个公开资讯源自动抓取的最新 AI 动态，共 ${feed.items.length} 条。`,
    body,
    jsonld: [
      breadcrumbLd(site, crumbItems),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'AI 实时动态',
        numberOfItems: feed.items.length,
        itemListElement: feed.items.slice(0, 40).map((it, i) => ({
          '@type': 'ListItem', position: i + 1, name: it.title, url: it.link,
        })),
      },
    ],
  });
}

/* ============================ 工具对比 ============================ */
export function comparePage(ctx) {
  const { site, toolCatMap, tools, counts } = ctx;
  // 内嵌一份精简工具索引，供对比页在浏览器里直接取用（不需要请求接口）
  const compact = tools.map((t) => ({
    id: t.id, name: t.name, cat: t.cat, catName: (toolCatMap[t.cat] || {}).name || t.cat,
    accent: (toolCatMap[t.cat] || {}).accent || '#1B4DFF',
    pricing: t.pricing, cn: !!t.cn, official: !!t.official, hot: !!t.hot,
    added: t.added || '', tags: t.tags || [], desc: t.desc, caveat: t.caveat || '', url: t.url,
  }));

  const crumbItems = [{ label: '首页', href: '/' }, { label: '工具对比' }];

  // 默认推荐：优先放热门工具，方便用户直接开始
  const suggest = tools.filter((t) => t.hot).slice(0, 8);

  const body = `
${crumbs(crumbItems)}
${pageHead(
    '工具对比',
    `从工具库任意挑 ${4} 个以内的工具放进来并排比较。有差异的维度会被高亮出来——你不需要自己一行行找不同。选择保存在本机浏览器里，不上传任何数据。`,
    '',
    'COMPARE / 工具对比',
  )}

<div class="container" id="cmpRoot" data-total="${compact.length}">
  <div id="cmpEmpty">
    <div class="card" style="padding:34px;text-align:center">
      <div class="empty" style="padding:0">
        <div class="ei">${icon('layers', 36)}</div>
        <p>还没有选择任何工具</p>
        <p class="label" style="margin-top:8px">去工具库点卡片右上角的「+」，或者用下面的一键添加</p>
      </div>
      <div class="row" style="justify-content:center;gap:10px;margin-top:22px">
        <a class="btn btn-primary" href="/tools/">${icon('grid', 14)} 去工具库挑</a>
        <button class="btn" type="button" id="cmpFillHot">${icon('zap', 13)} 一键放入 3 个热门</button>
      </div>
    </div>
  </div>

  <div id="cmpResult" class="hidden">
    <div class="row spread mb-3" style="align-items:center">
      <span class="label" id="cmpCount"></span>
      <span class="row" style="gap:8px">
        <button class="btn btn-sm" type="button" id="cmpShare">${icon('send', 12)} 复制分享链接</button>
        <button class="btn btn-sm" type="button" id="cmpCopy">${icon('copy', 12)} 复制为表格</button>
        <button class="btn btn-sm btn-ghost" type="button" id="cmpClear">清空</button>
      </span>
    </div>
    <div class="table-wrap" id="cmpTable"></div>
    <p class="label" style="margin-top:12px">
      高亮的行表示各工具在该维度上存在差异。想加更多工具，去
      <a href="/tools/" style="color:var(--accent-text)">工具库</a> 点卡片右上角的「+」。
    </p>
  </div>

  <section class="section" style="padding-top:44px">
    ${shead('—', '快速添加', '点一下即可放进去', '/tools/', '全部工具')}
    <div class="grid grid-4">
      ${suggest.map((t) => `<button class="cmp-quick" type="button" data-cmp-add="${esc(t.id)}">
        <span class="avatar" style="${accentStyle((toolCatMap[t.cat] || {}).accent || '#1B4DFF')}" aria-hidden="true">${esc(initials(t.name))}</span>
        <span class="cmp-quick-main">
          <b>${esc(t.name)}</b>
          <span class="label">${esc((toolCatMap[t.cat] || {}).name || t.cat)}</span>
        </span>
        ${icon('plus', 14)}
      </button>`).join('')}
    </div>
  </section>

  <section class="section">
    ${shead('—', '怎么用这个对比表', '')}
    <div class="grid grid-2">
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('target', 15)} 差异行会被高亮</h3><p class="card-desc" style="margin:0">四个工具价格都一样时那一行会淡下去——相同的维度不需要你的注意力，不同的才需要。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('shield', 15)} 数据只存在你本机</h3><p class="card-desc" style="margin:0">选择记录在浏览器 localStorage 里，不上传、不跟踪。换个设备或清缓存就没了，这是刻意的。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('alert', 15)} 别只看价格</h3><p class="card-desc" style="margin:0">免费的不一定省钱——数据出不出内网、能不能批量跑、失败时你能不能定位问题，这些往往比价格更重要。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('compass', 15)} 拿不定主意就问场景</h3><p class="card-desc" style="margin:0">如果对比完还是选不出来，通常是需求没说清。去<a href="/playbooks/" style="color:var(--accent-text)">场景手册</a>看你这件事的完整流程，答案往往在那里。</p></div>
    </div>
  </section>
</div>`;

  return layout({
    site,
    path: '/compare/',
    title: '工具对比',
    description: `AI 工具对比：从 ${counts.tools} 个工具里挑最多 4 个并排比较，价格、国内可访问性、开源与否、编辑点评等维度自动高亮差异。选择保存在本机浏览器，可生成分享链接。`,
    body,
    scripts: `<script>window.__AIWX_TOOLS__=${jsonEmbed(compact)};</script>`,
    jsonld: breadcrumbLd(site, crumbItems),
  });
}

/* ============================ 我的收藏 ============================ */
export function savedPage(ctx) {
  const { site } = ctx;
  const crumbItems = [{ label: '首页', href: '/' }, { label: '我的收藏' }];

  const body = `
${crumbs(crumbItems)}
${pageHead(
    '我的收藏',
    '你收藏的工具、提示词、场景和模型都汇总在这里。数据存在本机浏览器中，不上传、不跟踪，换设备或清缓存就会丢失——这是刻意的设计。',
    '',
    'SAVED / 我的收藏',
  )}

<div class="container" id="savedRoot">
  <div id="savedEmpty">
    <div class="card" style="padding:34px;text-align:center">
      <div class="empty" style="padding:0">
        <div class="ei">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5 14.7 9l6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9z"/></svg>
        </div>
        <p>还没有收藏任何内容</p>
        <p class="label" style="margin-top:8px">在任意卡片右上角点一下星标即可收藏</p>
      </div>
      <div class="row" style="justify-content:center;gap:10px;margin-top:22px">
        <a class="btn btn-primary" href="/tools/">${icon('grid', 14)} 去逛工具库</a>
        <a class="btn" href="/playbooks/">${icon('compass', 13)} 看场景手册</a>
        <a class="btn" href="/prompts/">${icon('spark', 13)} 找提示词</a>
      </div>
    </div>
  </div>

  <div id="savedToolbar" class="hidden">
    <div class="row spread mb-3" style="align-items:center">
      <span class="label" id="savedCount"></span>
      <button class="btn btn-sm btn-ghost" type="button" id="savedClear">${icon('x', 12)} 清空收藏</button>
    </div>
  </div>
  <div id="savedBody"></div>

  <section class="section" style="padding-top:40px">
    ${shead('—', '关于收藏的几个说明', '')}
    <div class="grid grid-2">
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('shield', 15)} 只存在你这台设备</h3><p class="card-desc" style="margin:0">没有账号、没有服务端存储。好处是隐私完全在你手里，代价是换浏览器或清缓存就没了。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('layers', 15)} 和对比是分开的</h3><p class="card-desc" style="margin:0">收藏是「以后再看」，对比是「现在就要选」。工具可以同时进两个清单，互不影响。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('alert', 15)} 下架的条目会被自动忽略</h3><p class="card-desc" style="margin:0">本站会定期清理失效工具。如果你收藏的东西被下架了，页面会如实告诉你少了几项，而不是显示一个打不开的卡片。</p></div>
      <div class="card"><h3 class="card-title" style="margin-bottom:8px">${icon('send', 15)} 想跨设备同步？</h3><p class="card-desc" style="margin:0">可以订阅 <a href="/feed.xml" style="color:var(--accent-text)">RSS</a>，或者把需要的提示词复制到自己的笔记里——那才是最可靠的长期保存方式。</p></div>
    </div>
  </section>
</div>`;

  return layout({
    site,
    path: '/saved/',
    title: '我的收藏',
    description: '我的收藏：把 AI 工具、提示词、场景手册、模型和学习资源收在一处，按类型分组。数据只存在本机浏览器里，不上传、不跟踪，也不需要注册账号。',
    body,
    // 收藏内容存在浏览器里，爬虫看到的永远是空态 —— 对搜索结果是垃圾，对用户是功能
    robots: 'noindex, follow',
    // 收藏页要渲染带类型图标的卡片，图标表由 card-svg.js 提供（普通 script，先于 defer 执行）
    scripts: `<script src="/assets/${esc(site.asset.icons)}"></script>`
      + `<script>window.__AIWX_INDEX__=${jsonEmbed(ctx.searchIndex)};</script>`,
    jsonld: breadcrumbLd(site, crumbItems),
  });
}

/* ============================ 关于 ============================ */
export function aboutPage(ctx) {
  const { site, counts } = ctx;
  const crumbItems = [{ label: '首页', href: '/' }, { label: '关于' }];

  const body = `
${crumbs(crumbItems)}
${pageHead('关于 AI 万象', '一个打算长期做下去的 AI 资料站。', '', 'ABOUT / 关于')}

<section class="section" style="padding-top:0">
  <div class="container container-narrow">
    <div class="article-body" style="padding-top:0">
      <p>AI 领域的信息有三个毛病：<b>散</b>（散落在无数公众号、推特、Discord 里）、<b>快</b>（今天的教程明天就过时）、<b>水</b>（到处都是「10 个你不知道的 AI 神器」这种凑数内容）。</p>
      <p>AI 万象想做的事很简单——把这些东西收起来、分好类、标清楚，让一个人从「我想用 AI 做某件事」到「找到能用的工具并上手」，中间不需要绕十个网站。</p>

      <h2>收录标准</h2>
      <p>只有一条：<b>它是否真的对使用者有帮助</b>。不收录纯概念演示、不收录需要留手机号才能试用的、不收录已经停止维护的。工具类的判断标准是「现在还值得用吗」，而不是「它曾经很火吗」——发现失效或明显变差的会直接下架，而不是留着凑数。</p>

      <h2>怎么保证不过期</h2>
      <p>每一项都标注了收录日期，首页有「最新收录」入口。数据层做了自动校验（重复 ID、未知分类、缺字段会在构建时直接报错），页面层有横向溢出与可访问性审计。这些都是为了让「长期维护」不只是句口号。</p>

      <h2>数据是开放的</h2>
      <p>全站数据以 JSON 形式公开，任何人都可以取用：<a href="/api/index.json" style="color:var(--accent-text)">/api/index.json</a>。资讯有 <a href="/feed.xml" style="color:var(--accent-text)">RSS</a> 可以订阅。如果你也想做一个类似的站，直接拿去做，不用问。</p>

      <h2>关于变现</h2>
      <p>目前没有广告、没有联盟链接、没有付费收录位。如果未来有，会明确标注出来。现在唯一的成本是时间。</p>

      <h2>这个站怎么做的</h2>
      <p>技术上刻意做得很轻：<b>零第三方依赖</b>的静态站——没有 npm 包、没有框架、没有跟踪脚本，构建脚本只用 Node 内置模块。内容全部存在 JSON 里，页面在构建时生成成纯静态 HTML。这意味着它加载快、十年后还能跑、任何人 fork 走都能立刻上手。视觉上走的是 <b>Swiss 编辑网格 + 新粗野主义</b>：栅格纸底纹、硬边框、等宽字体承担所有标签信息、单一强调色。刻意避开那套「渐变 + 玻璃拟态 + 大圆角」的模板感审美。</p>

      <h2>现在的规模</h2>
      <p>${counts.playbooks} 个场景手册、${counts.tools} 个工具、${counts.prompts} 条提示词、${counts.models} 个模型家族、${counts.glossary} 条术语、${counts.learn} 份学习资源、${counts.news} 篇解读。这个数字会一直涨。</p>

      <h2>为什么要有「场景手册」</h2>
      <p>单纯的工具列表有个根本问题：用户脑子里想的是「我要做某件事」，不是「我要找一个叫 XX 的工具」。所以除了收录工具，我们还把 ${counts.playbooks} 件常见的具体事拆成完整流程——每一步用哪个工具、配哪条提示词、以及最容易在哪里翻车。手册里刻意写了「不要用 AI 做」的部分，因为有些环节用脚本比用模型又稳又便宜。</p>

      <h2>模型库为什么没有具体参数</h2>
      <p>版本号、上下文长度、价格这类数字几个月就会过期，写上去反而会误导人。所以模型库只对比那些相对稳定的维度：谁最擅长什么、有什么坑、适合什么场景、是不是开源、国内能不能直连。要精确参数，页面上每一项都链到了官方文档。</p>
    </div>
  </div>
</section>

<section class="section" id="submit" style="padding-top:0">
  <div class="container container-narrow">
    ${shead('—', '提交收录 / 报错', '')}
    <div class="card" style="padding:32px">
      <p style="color:var(--fg-2);font-size:.92rem;margin-bottom:20px">发现好用的 AI 工具、写了一条特别好用的提示词，或者发现这里的信息过期了——都欢迎告诉我。</p>
      <div class="grid grid-2">
        <div>
          <h3 class="label" style="color:var(--fg);margin-bottom:8px">提交格式</h3>
          <pre style="font-family:var(--font-mono);font-size:.78rem;line-height:1.85;padding:14px;border:var(--bw) solid var(--line);background:var(--code-bg);overflow:auto">名称：
网址：
一句话说明：
分类：
免费还是付费：
国内能否直连：</pre>
        </div>
        <div>
          <h3 class="label" style="color:var(--fg);margin-bottom:8px">提交方式</h3>
          <p style="color:var(--fg-2);font-size:.87rem;line-height:1.85">
            格式随意，能看懂就行。说明一下「你为什么觉得它好用」会大大增加被收录的概率——因为这说明你真的用过，而不是从别处抄来的。
          </p>
          <p style="color:var(--fg-3);font-size:.84rem;line-height:1.85;margin-top:10px">
            本站的代码与数据都在 GitHub 上开源：代码 MIT，数据 CC BY 4.0（可自由使用，署名即可）。
          </p>
          <div class="row" style="gap:10px;margin-top:16px">
            <a class="btn btn-primary" href="https://github.com/EaloongChan/ai-wanxiang/issues" target="_blank" rel="noopener">${icon('inbox', 14)} 在 GitHub 提 Issue</a>
            <a class="btn" href="https://github.com/EaloongChan/ai-wanxiang" target="_blank" rel="noopener">${icon('code', 14)} 直接提 PR</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</section><section class="section" id="links" style="padding-top:0">
  <div class="container container-narrow">
    ${shead('—', '友情链接', '')}
    <div class="card" style="padding:24px">
      <p style="color:var(--fg-3);font-size:.88rem;margin:0">
        暂时还没有。等站做起来，这里会放上同样认真做内容的朋友。
        如果你也在做类似的站，欢迎通过上面的方式联系我。
      </p>
    </div>
  </div>
</section>`;

  return layout({
    altPath: '/en/about/',
    altLang: 'en',
    altLabel: '切换到英文版（Tools & Models）',
    site, path: '/about/', title: '关于', pageType: 'article',
    description: '关于 AI 万象：这个站是什么、怎么决定收录哪些工具、编辑点评的写法、数据开放情况，以及如何提交你发现的工具或纠错。',
    body,
    jsonld: breadcrumbLd(site, crumbItems),
  });
}

/* ============================ 更新日志 ============================ */
export function changelogPage(ctx) {
  const { site, changelog = [] } = ctx;
  const crumbItems = [{ label: '首页', href: '/' }, { label: '更新日志' }];
  const body = `
${crumbs(crumbItems)}
${pageHead('更新日志', '这个站每改一次都会记在这里。想跟踪进展可以订阅 RSS。', `<div class="ph-meta"><a class="btn btn-sm" href="/feed.xml">${icon('send', 12)} 订阅 RSS</a></div>`, 'CHANGELOG / 更新日志', '更新记录')}
<section class="section" style="padding-top:0">
  <div class="container container-narrow">
    <div class="card" style="padding:32px 30px"><div class="timeline">
      ${changelog.map((c) => `<div class="tl-item"><div class="tl-date">${esc(c.date)}${c.tag ? ' / ' + esc(c.tag) : ''}</div><h3>${esc(c.title)}</h3><p>${esc(c.desc)}</p></div>`).join('')}
    </div></div>
  </div>
</section>`;
  return layout({ site, path: '/changelog/', title: '更新日志', description: `${changelog.length} 次更新记录：新增了多少工具、新写了哪些场景手册、修了哪些问题。这个站是长期维护的，改动都在这里留痕。`, body, jsonld: breadcrumbLd(site, crumbItems) });
}

/* ============================ 404 ============================ */
export function notFoundPage(ctx) {
  const { site } = ctx;
  const body = `
<section class="section" style="padding:110px 0">
  <div class="container container-narrow center">
    <div class="serif" style="font-size:6rem;font-weight:600;letter-spacing:-.05em;color:var(--accent);line-height:1">404</div>
    <h1 style="font-size:1.5rem;font-weight:700;letter-spacing:-.03em;margin:18px 0 10px">这个页面不存在</h1>
    <p style="color:var(--fg-2);margin-bottom:26px">可能是链接过期了，或者内容还没被收录。</p>
    <div class="row" style="justify-content:center;gap:10px">
      <a class="btn btn-primary" href="/">${icon('home', 14)} 回首页</a>
      <a class="btn" href="/search/">${icon('search', 13)} 搜一下</a>
    </div>
  </div>
</section>`;
  return layout({ site, path: '/404.html', title: '页面不存在', body });
}
