import { esc, hashColor, initials, highlightVars, accentStyle, accentTextStyle, fmtDate, termSlug } from './utils.mjs';
import { toolNameEn, termAliasEn } from './i18n-en-maps.mjs';
import { promptModelEn } from './i18n-en-maps.mjs';
import { ZH, EN, pick, tagList } from './labels.mjs';
import { icon } from './icons.mjs';

const PRICING = ZH.pricing;
const PRICING_CLS = ZH.pricingCls;

/** 分类色块（统一处理文字对比度） */
function accent(hex, fallback = '#1B4DFF') {
  return accentStyle(hex || fallback);
}

/**
 * 拼 cards 的 `data-name` —— 页内筛选框（`Search the tools…`）唯一的匹配源。
 *
 * 必须是**页面上真正显示出来的那套文字**：卡片显示 descEn，索引里就得有 descEn。
 * 踩过一次：data-name 一直拼原始字段（中文名 / 中文标签 / 中文简介），
 * 而英文站卡片走 pick()/tagList() 显示的是英文 —— 结果英文工具库页上，
 * 242 个看得见的英文标签里有 **189 个用页内搜索框搜不到**。
 * 用户照着卡片上的「Open source」打字，一条都出不来，而且不报错。
 *
 * 规则：一律传 pick()/tagList() 取到的当前语言文本（它们返回数组也能直接被 flat）。
 *
 * 但**别把「点评 / 避坑 / 使用提示」也拼进来** —— 那是建议文本，不是身份信息。
 * 试着拼过 caveat，结果在中英两边的工具页上搜「Midjourney」都会多出一张卡：
 * 某个图像工具的「什么时候别用」里提到了它。用户想找的是 Midjourney 本身，
 * 不是「警告里提到过 Midjourney」的工具。筛选框要的是精确，不是召回。
 */
/**
 * 站内链接的语言前缀：英文站所有页面都在 /en/ 下。
 *
 * 为什么不让调用方传 base（手册卡 playbookCard 用的就是那个做法）：
 * 工具卡的详情页链接曾写死成 `/tools/<cat>/<id>/`，结果 281 个英文页面
 * 上的 2574 条工具链接全部指向中文详情页 —— 英文读者点进去满屏中文。
 * **从一个 shared 组件漏出去的问题，会被引用它的每个页面放大。**
 * 从 L 推导，调用方就没有机会写漏。
 */
const siteRoot = (L) => (L === EN ? '/en' : '');

const matchBlob = (L, ...groups) =>
  esc(groups.flat().filter(Boolean).map(String).join(' ').toLowerCase());

export function crumbs(items, crumbLabel = '面包屑') {
  return `<nav class="crumbs container" aria-label="${esc(crumbLabel || '面包屑')}">${items
    .map((it, i) =>
      i === items.length - 1
        ? `<span style="opacity:1;color:var(--fg-2)">${esc(it.label)}</span>`
        : `<a href="${esc(it.href)}">${esc(it.label)}</a><span>/</span>`,
    )
    .join('')}</nav>`;
}

/**
 * 页头
 * @param {string} title
 * @param {string} desc
 * @param {string} [extra]  额外 HTML（如统计条目）
 * @param {string} [kicker] 等宽小标（如 CATEGORY / 04）
 * @param {string} [srHeading] 仅屏幕阅读器可见的 h2。
 *   列表页在 h1 之后直接就是卡片(h3)，不加这一层会让文档大纲从 h1 跳到 h3。
 */
export function pageHead(title, desc, extra = '', kicker = '', srHeading = '') {
  return `<div class="container"><div class="page-head reveal">
    ${kicker ? `<div class="label label-accent" style="margin-bottom:10px">${esc(kicker)}</div>` : ''}
    <h1>${esc(title)}</h1>
    ${srHeading ? `<h2 class="sr-only">${esc(srHeading)}</h2>` : ''}
    ${desc ? `<p>${esc(desc)}</p>` : ''}
    ${extra}
  </div></div>`;
}

export function emptyState(text = '没有找到匹配的内容', sub = '换个关键词，或清空筛选条件试试。') {
  return `<div class="empty">
    <div class="ei">${icon('search', 36)}</div>
    <p>${esc(text)}</p>
    <p class="label" style="margin-top:8px">${esc(sub)}</p>
  </div>`;
}

/** AI 工具卡片 */
export function toolCard(t, catMap, L = ZH) {
  const cat = catMap[t.cat] || { name: t.cat, accent: hashColor(t.id) };
  const c = cat.accent || hashColor(t.id);
  const badges = [
    t.official ? `<span class="badge-pill" style="color:var(--fg-2)">${L.official}</span>` : '',
    t._new ? `<span class="badge-pill badge-new">${L.new}</span>` : '',
    t.hot ? `<span class="badge-pill badge-hot">${L.hot}</span>` : '',
    `<span class="badge-pill ${L.pricingCls[t.pricing] || 'badge-free'}">${L.pricing[t.pricing] || t.pricing}</span>`,
    t.cn ? `<span class="badge-pill badge-cn">${L.directAccess}</span>` : '',
  ].filter(Boolean).join('');

  return `<article class="card tool-card reveal"
    data-name="${matchBlob(L, t.name, tagList(t.tags, L), pick(t, 'desc', L))}"
    data-cat="${esc(t.cat)}"
    data-pricing="${esc(t.pricing)}"
    data-added="${esc(t.added || '')}"
    data-cn="${t.cn ? '1' : '0'}"
    data-hot="${t.hot ? '1' : '0'}">
    <div class="card-top">
      <span class="avatar" style="${accentTextStyle(c)}" aria-hidden="true">${icon(cat.icon || 'grid', 17)}</span>
      <div style="min-width:0;flex:1">
        <h3 class="card-title"><a class="name" href="${siteRoot(L)}/tools/${esc(t.cat)}/${esc(t.id)}/">${esc(t.name)}</a></h3>
        <div class="card-cat">${esc(cat.name)}</div>
      </div>
    </div>
    <p class="card-desc">${esc(pick(t, 'desc', L))}</p>
    ${pick(t, 'caveat', L) ? `<div class="card-caveat" title="${esc(L.editorNote)}: ${esc(L.whenNotToUse)}">${icon('alert', 12)}<span>${esc(pick(t, 'caveat', L))}</span></div>` : ''}
    <div class="row" style="gap:5px;margin-bottom:12px">${tagList(t.tags, L).slice(0, 3).map((g) => `<span class="tag">${esc(g)}</span>`).join('')}</div>
    <div class="card-foot spread">
      <span class="row" style="gap:5px">${badges}</span>
      <a class="btn btn-sm" href="${esc(t.url)}" target="_blank" rel="noopener nofollow">${L.visit} ${icon('arrow-up-right', 12)}</a>
    </div>
    ${cardActions('tool', t.id, true, L)}
  </article>`;
}

/** 加入对比按钮（仅工具卡使用，状态由前端 localStorage 同步） */
export function cmpButton(id, L = ZH) {
  return `<button class="cmp-btn" type="button" data-cmp="${esc(id)}"
    aria-pressed="false" aria-label="${esc(L === EN ? 'Add to compare' : '加入对比')}" title="${esc(L === EN ? 'Add to compare' : '加入对比')}">${icon('plus', 13)}</button>`;
}

/**
 * 卡片右上角的操作区（收藏 / 对比）
 * @param {string} type  内容类型：tool / prompt / playbook / model / learn / news / glossary
 * @param {string} id    条目 id
 * @param {boolean} [withCompare] 是否显示对比按钮（只有工具用）
 */
export function cardActions(type, id, withCompare = false, L = ZH) {
  // 按钮文案要能跟着语言走，否则英文页上读屏软件会念出中文
  const saveText = L === EN ? 'Save' : '收藏';
  return `<div class="card-actions">
    <button class="act-btn act-save" type="button" data-save="${esc(type)}:${esc(id)}"
      aria-pressed="false" aria-label="${esc(saveText)}" title="${esc(saveText)}">
      ${icon('star', 14, 'ic-star')}
    </button>
    ${withCompare ? cmpButton(id, L) : ''}
  </div>`;
}

/** 分类卡 */
export function catCard(cat, count, href, L = ZH) {
  const c = cat.accent || '#1B4DFF';
  // 英文站必须用 descEn，否则分类卡上会露出中文描述
  const d = L === EN ? (cat.descEn || '') : (cat.desc || '');
  return `<a class="cat-card reveal" href="${esc(href)}" style="${accent(c)}">
    <span class="ci">${icon(cat.icon || 'grid', 17)}</span>
    <h3>${esc(cat.name)} <span class="count">${count}</span></h3>
    <p>${esc(d)}</p>
  </a>`;
}

/** 提示词卡（可展开 + 变量填充 + 复制）
 *
 * 两点刻意的取舍：
 *  1. 变量填充面板不服务端渲染，只输出 data-vars，展开时由前端按需生成。
 *     填充本身就是纯 JS 功能，服务端渲染这 165 个 label 纯属浪费（约 26KB）。
 *  2. 不再输出 data-raw 复制一份正文。原始模板由前端从 <pre> 的 textContent 里取一次并缓存。
 */
export function promptCard(p, catMap, L = ZH) {
  const cat = catMap[p.cat] || { name: p.cat, accent: hashColor(p.id) };
  const c = cat.accent || hashColor(p.id);
  // 英文站取 p.en；没有英文版就不该出现在英文站上（由页面层过滤）
  const e = p.en || {};
  const isEn = L === EN && e.title;
  const title = isEn ? e.title : p.title;
  const desc = isEn ? e.desc : p.desc;
  const body = isEn ? e.prompt : p.prompt;
  const tips = isEn ? e.tips : p.tips;
  const vars = (isEn ? e.vars : p.vars) || (isEn ? [] : p.vars) || [];

  return `<article class="card prompt-card reveal" id="${esc(p.id)}"
    data-name="${matchBlob(L, title, tagList(p.tags, L), desc)}"
    data-cat="${esc(p.cat)}"
    data-vars="${esc(vars.join(','))}"
    data-hot="${p.hot ? '1' : '0'}">
    <div class="prompt-head" data-accordion>
      <span class="avatar" style="${accentTextStyle(c)};width:32px;height:32px" aria-hidden="true">${icon(cat.icon || 'grid', 15)}</span>
      <div class="ph-main">
        <h3>${esc(title)}${p.hot ? `<span class="badge-pill badge-hot">${L === EN ? 'Popular' : '热门'}</span>` : ''}</h3>
        <p>${esc(desc)}</p>
      </div>
      ${cardActions('prompt', p.id, false, L)}
      <span class="prompt-toggle" aria-hidden="true">${icon('chevron-down', 14)}</span>
    </div>
    <div class="prompt-body">
      <div class="prompt-meta">
        <span class="kv">${L === EN ? 'Category' : '分类'} <b>${esc(cat.name)}</b></span>
        <span class="kv">${L === EN ? 'Works with' : '适用'} <b>${esc((p.model || []).map((x) => (L === EN ? promptModelEn(x) : x)).join(' / '))}</b></span>
        ${vars.length ? `<span class="kv">${L === EN ? 'Variables' : '变量'} <b>${vars.length}${L === EN ? '' : ' 个'}</b></span>` : ''}
      </div>
      <div class="prompt-code">
        <button class="copy-btn" data-copy type="button">${icon('copy', 11)} ${L === EN ? 'Copy' : '复制'}</button>
        <pre>${highlightVars(body)}</pre>
      </div>
      ${p.tips ? `<div class="prompt-tip"><b>${L === EN ? 'How to use it:' : '使用提示：'}</b>${esc(tips)}</div>` : ''}
      ${(() => {
      /* 标签一律走受控词表（tagList），中英同一批组件共用。
         踩过一次：这里读的是 e.tags（英文对象上的 tags），但 tags 字段在
         prompt 自己身上，英文版上根本没有 —— 结果整行标签消失。
         另一条防线：万一字典有漏网的中文标签（check.mjs 会拦），
         这里也宁可这条不显示，不把中文露在英文页上。 */
      const tags = tagList(p.tags, L).filter((g) => L !== EN || !/[\u4e00-\u9fa5]/.test(g));
      return tags.length ? `<div class="row" style="gap:5px;padding:0 18px 16px">${tags.map((g) => `<span class="tag">${esc(g)}</span>`).join('')}</div>` : '';
    })()}
    </div>
  </article>`;
}

/** 资讯条目 */
export function newsItem(n, topicMap) {
  const tp = topicMap[n.topic] || { name: n.topic, accent: '#1B4DFF' };
  return `<a class="news-item reveal" href="/news/${esc(n.id)}/">
    <div class="news-meta">
      <span class="tag accent" style="${accentTextStyle(tp.accent)}">${esc(tp.name)}</span>
      <span>${esc(fmtDate(n.date))}</span>
      <span class="dot-sep">/</span>
      <span>${esc(n.source)}</span>
    </div>
    <h3>${esc(n.title)}</h3>
    <p>${esc(n.summary)}</p>
    <span class="more">阅读全文 ${icon('arrow-right', 12)}</span>
  </a>`;
}

/** 里程碑时间线 */
export function milestoneItem(m) {
  return `<div class="tl-item">
    <div class="tl-date">${esc(m.date)}</div>
    <h3>${esc(m.title)}</h3>
    <p>${esc(m.desc)}</p>
  </div>`;
}

/** 资讯源 */
export function sourceRow(s, topicMap) {
  const tp = topicMap[s.topic] || { name: s.topic };
  return `<a class="source-row reveal" href="${esc(s.url)}" target="_blank" rel="noopener nofollow">
    <span class="sr-ic" aria-hidden="true">${esc(s.name.slice(0, 1))}</span>
    <span class="sr-main">
      <b>${esc(s.name)} <span class="tag" style="margin-left:4px">${esc(tp.name)}</span></b>
      <span>${esc(s.desc)} / ${esc(s.lang)}</span>
    </span>
    <span class="sr-go">${icon('arrow-up-right', 14)}</span>
  </a>`;
}

/**
 * 术语条目。
 *
 * 内链设计：术语表原本是个「孤岛」——93 个词条之间只是标签不是链接，
 * 也不通往任何工具。读者看完「什么是 RAG」之后无处可去，只能自己再去搜。
 * 现在三处都接上了：
 *   · 词条自带锚点 id，`related` 变成指向对应词条的链接
 *   · 有对应工具的词条，列出工具并链到详情页
 *   · 有对应场景的词条，链到那篇手册
 */
export function glossItem(g, toolMap, pbMap, slugMap, L = ZH) {
  const slug = termSlug(g);
  // 英文站显示英文词名与英文定义。related 存的是中文词名，
  // 要经 termNameMap 换回英文显示名，否则英文页上会露出中文。
  const isEn = L === EN;
  const shown = isEn ? (g.en || g.term) : g.term;
  const def = isEn ? (g.defEn || g.def) : g.def;
  // related 存的是中文词名，英文站要换成英文显示名；
  // 词表里没有的（别名 / 相关概念）走 termAliasEn，实在没有再退回原值。
  const nameOf = (zh) => (isEn
    ? ((g.__termMap && g.__termMap[zh] && g.__termMap[zh].en) || termAliasEn(zh))
    : zh);
  const tools = (g.tools || []).map((id) => toolMap[id]).filter(Boolean);
  const pb = g.playbook && pbMap ? pbMap[g.playbook] : null;
  // 英文站只有在该工具/手册**确实有英文版**时才链过去，否则点了就是 404 或者中文页
  const toolHref = (t) => (isEn && t.descEn ? `/en/tools/${esc(t.cat)}/${esc(t.id)}/` : `/tools/${esc(t.cat)}/${esc(t.id)}/`);
  const pbHref = (p) => (isEn && p.en ? `/en/playbooks/${esc(p.id)}/` : `/playbooks/${esc(p.id)}/`);

  /* data-name 是页内筛选框（`Search a term…`）的匹配源，必须是**当前语言**的文本。
     踩过一次：这里不管语言一律拼 g.term + g.def，结果英文术语表页
     塞了 92 条中文释义（约 22KB，整页 113KB，比中文页还重），
     而英文读者反而搜不到英文释义 —— 索引里根本没有 defEn。
     现在英文页换成「英文词条 + 缩写 + 英文释义」；中文词条保留（很短，
     顺手让中英混输也能命中），最长的那段中文释义只在中文页出现。 */
  const nameBlob = isEn
    ? [g.en, g.term, g.abbr, g.defEn]
    : [g.term, g.en, g.abbr, g.def];

  return `<div class="gloss-item reveal" id="term-${esc(slug)}"
    data-name="${esc(nameBlob.filter(Boolean).join(' ').toLowerCase())}"
    data-cat="${esc(g.cat)}">
    <div class="g-head">
      <b>${esc(shown)}</b>
      ${g.abbr ? `<span class="g-abbr">${esc(g.abbr)}</span>` : ''}
      <span class="g-en">${esc(g.en || '')}</span>
    </div>
    <p>${esc(def)}</p>
    ${(g.related || []).length ? `<div class="g-rel">
      <span class="label">${L === EN ? 'Related' : '相关'}</span>
      ${g.related.map((r) => {
        // 用「词条名 → slug」表解析，而不是在这里再算一遍 —— 两边规则不一致会链空
        const rs = slugMap && slugMap[r];
        return rs
          ? `<a class="tag tag-link" href="#term-${esc(rs)}">${esc(nameOf(r))}</a>`
          : `<span class="tag">${esc(nameOf(r))}</span>`;
      }).join('')}
    </div>` : ''}
    ${tools.length || pb ? `<div class="g-rel g-rel-tools">
      ${tools.length ? `<span class="label">${L === EN ? 'Tools' : '对应工具'}</span>${tools.map((t) => `<a class="tag tag-link" href="${toolHref(t)}">${esc(isEn ? toolNameEn(t.name) : t.name)}</a>`).join('')}` : ''}
      ${pb ? `<a class="tag tag-link tag-pb" href="${pbHref(pb)}">${icon('target', 10)} ${L === EN ? 'Playbook:' : '场景：'}${esc(isEn && pb.en ? pb.en.title : pb.title)}</a>` : ''}
    </div>` : ''}
  </div>`;
}

/** 学习资源卡 */
export function learnCard(l, trackMap) {
  const tk = trackMap[l.track] || { name: l.track, accent: '#00875A' };
  const c = tk.accent;
  const typeLabel = { video: '视频', course: '课程', docs: '文档', book: '教材', article: '文章' }[l.type] || l.type;
  const typeIcon = { video: 'video', book: 'book', docs: 'file', course: 'book-open', article: 'pen' }[l.type] || 'book';
  return `<article class="card reveal"
    data-name="${esc((l.title + ' ' + (l.tags || []).join(' ')).toLowerCase())}"
    data-cat="${esc(l.track)}"
    data-type="${esc(l.type)}">
    <div class="card-top">
      <span class="avatar" style="${accentTextStyle(c)}" aria-hidden="true">${icon(typeIcon, 17)}</span>
      <div style="min-width:0;flex:1">
        <h3 class="card-title"><span class="name">${esc(l.title)}</span></h3>
        <div class="card-cat">${esc(l.source)} / ${esc(typeLabel)} / ${esc(l.level)}</div>
      </div>
    </div>
    <p class="card-desc">${esc(l.desc)}</p>
    <div class="row" style="gap:5px;margin-bottom:12px">
      ${(l.tags || []).slice(0, 3).map((g) => `<span class="tag">${esc(g)}</span>`).join('')}
      ${l.free ? '<span class="badge-pill badge-free">免费</span>' : ''}
    </div>
    <div class="card-foot spread">
      <span class="tag">${esc(l.lang)}</span>
      <a class="btn btn-sm" href="${esc(l.url)}" target="_blank" rel="noopener nofollow">前往 ${icon('arrow-up-right', 12)}</a>
    </div>
    ${cardActions('learn', l.id)}
  </article>`;
}

/**
 * 场景手册的流程示意图：输入 → N 步 → 产出。
 *
 * 为什么是这种图，而不是给 43 篇各配一张插画：
 *  1. 它**从数据推出来的**（步数 + 分组色），不用人手画，内容变了也不会过时；
 *  2. 它说的是信息 —— 这条流水线多长、入口出口各是什么，不是装饰；
 *  3. 纯几何 + 内联 SVG，零依赖、零额外请求，视觉语言也和本站一致
 *     （硬边框 + 实心偏移投影 + 等宽数字），不会混进渐变光晕那套。
 *
 * 两个坑：
 *  · SVG 的**呈现属性不解析 var()**（fill="var(--pop)" 是无效的），
 *    所有跟主题有关的颜色必须写成 style="fill:var(--pop)"。
 *  · 对读屏它是冗余信息（下面就有完整步骤列表），所以 aria-hidden。
 */
export function playbookFlow(stepCount, accent = '#1B4DFF', L = ZH) {
  const n = Math.max(1, Math.min(12, Number(stepCount) || 1));
  const isEn = L === EN;
  const inLabel = isEn ? 'IN' : '输入';
  const outLabel = isEn ? 'OUT' : '产出';

  const W = 680; const H = 104;
  const pad = 6; const gap = 9;
  const cols = n + 2;                              // 输入 + N 步 + 产出
  const bw = (W - pad * 2 - gap * (cols - 1)) / cols;
  const boxH = 42;
  const y = (H - boxH) / 2;
  const r1 = (v) => Number(v).toFixed(1);
  const xOf = (i) => pad + i * (bw + gap);

  const box = (i, label, highlighted) => {
    const bx = r1(xOf(i));
    const w = r1(bw);
    return ''
      // 实心偏移投影：先画一个位移的同尺寸矩形
      + `<rect x="${r1(xOf(i) + 3)}" y="${y + 3}" width="${w}" height="${boxH}" rx="2" style="fill:var(--pop)"/>`
      + `<rect x="${bx}" y="${y}" width="${w}" height="${boxH}" rx="2" style="fill:var(--surface);stroke:${highlighted ? esc(accent) : 'var(--fg)'};stroke-width:1.5"/>`
      + `<text class="pb-flow-t" x="${r1(xOf(i) + bw / 2)}" y="${y + boxH / 2 + 5}" text-anchor="middle"${highlighted ? ` style="fill:${esc(accent)};font-weight:600"` : ''}>${esc(label)}</text>`;
  };

  const arrow = (i) => {
    const cx = xOf(i) + bw + gap / 2;
    const my = y + boxH / 2;
    return `<path d="M${r1(cx - 3)} ${r1(my - 4)} L${r1(cx + 3)} ${r1(my)} L${r1(cx - 3)} ${r1(my + 4)}" style="fill:none;stroke:var(--fg-3);stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"/>`;
  };

  const parts = [box(0, inLabel, false)];
  for (let i = 0; i < n; i++) parts.push(arrow(i), box(i + 1, String(i + 1).padStart(2, '0'), true));
  parts.push(arrow(n), box(n + 1, outLabel, false));

  return `<div class="pb-flow"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${parts.join('')}</svg></div>`;
}

/** 场景手册卡片 */
export function playbookCard(pb, groupMap, base = '/playbooks/', L = ZH) {
  const g = groupMap[pb.group] || { name: pb.group, accent: '#1B4DFF', icon: 'target' };
  const e = pb.en || {};
  // 英文站要显示英文标题/问题；没有英文版的手册不会出现在英文站上，所以这里不用回退中文
  const title = L === EN && e.title ? e.title : pb.title;
  const problem = L === EN && e.problem ? e.problem : pb.problem;
  const time = L === EN && e.time ? e.time : pb.time;
  const level = L === EN && e.level ? e.level : (pb.level || '');
  const stepsWord = L === EN ? 'steps' : '步';
  const cta = L === EN ? 'View process' : '查看流程';
  return `<div class="card playbook-card reveal"
    data-name="${matchBlob(L, title, problem, g.name, level)}"
    data-group="${esc(pb.group)}">
    <a class="card-hit" href="${base}${esc(pb.id)}/" aria-label="${esc(title)}"></a>
    <div class="card-top">
      <span class="avatar" style="${accentTextStyle(g.accent)}" aria-hidden="true">${icon(g.icon, 17)}</span>
      <div style="min-width:0;flex:1">
        <h3 class="card-title"><span class="name">${esc(title)}</span></h3>
        <div class="card-cat">${esc(g.name)} / ${esc(time)}</div>
      </div>
    </div>
    <p class="card-desc">${esc(problem)}</p>
    <div class="card-foot spread">
      <span class="row" style="gap:5px">
        <span class="tag">${esc(String((pb.steps || []).length))} ${stepsWord}</span>
        <span class="tag">${esc(level)}</span>
      </span>
      <span class="label" style="color:var(--accent-text)">${esc(cta)} ${icon('arrow-right', 11)}</span>
    </div>
    ${cardActions('playbook', pb.id, false, L)}
  </div>`;
}

/** 模型家族卡片 */
/**
 * 时效说明的文字。
 * 注意中文那份 `latest` 是个对象（含 asOf 与 text），英文那份 `latestEn` 是纯字符串，
 * 所以不能直接用 pick() —— 那样中文会渲染成 [object Object]（踩过）。
 */
function latestText(m, L) {
  if (!m.latest) return '';
  return (L === EN && m.latestEn) || m.latest.text || '';
}

export function modelCard(m, kindMap, tierLabels, L = ZH) {
  const k = kindMap[m.kind] || { name: m.kind, accent: '#1B4DFF', icon: 'cpu' };
  return `<article class="card model-card reveal"
    data-name="${matchBlob(L, m.name, m.vendor, latestText(m, L), (m.latest && m.latest.asOf) || '', pick(m, 'strengths', L), pick(m, 'useFor', L))}"
    data-kind="${esc(m.kind)}"
    data-open="${m.open ? '1' : '0'}"
    data-cn="${m.cn ? '1' : '0'}">
    <div class="card-top">
      <span class="avatar" style="${accentTextStyle(k.accent)}" aria-hidden="true">${icon(k.icon || 'grid', 17)}</span>
      <div style="min-width:0;flex:1">
        <h3 class="card-title"><span class="name">${esc(m.name)}</span></h3>
        <div class="card-cat">${esc(m.vendor)} / ${esc(k.name)} / ${esc(tierLabels[m.tier] || m.tier)}</div>
      </div>
    </div>

    <div class="model-flags">
      ${m.open ? `<span class="badge-pill badge-open">${L.openDeployable}</span>` : `<span class="badge-pill" style="color:var(--fg-3)">${L.closedSource}</span>`}
      ${m.cn ? `<span class="badge-pill badge-cn">${L.directAccess}</span>` : `<span class="badge-pill" style="color:var(--fg-3)">${L.needsOverseas}</span>`}
    </div>

    ${latestText(m, L) ? `<div class="model-latest">
      <span class="ml-tag">${L.versionAsOf} ${esc(m.latest.asOf)}</span>
      <p>${esc(latestText(m, L))}</p>
    </div>` : ''}

    <ul class="model-list model-list-pro">
      ${(pick(m, 'strengths', L) || []).map((s) => `<li>${icon('check', 13)}<span>${esc(s)}</span></li>`).join('')}
    </ul>
    ${(pick(m, 'cautions', L) || []).length ? `<ul class="model-list model-list-con">
      ${(pick(m, 'cautions', L) || []).map((s) => `<li>${icon('alert', 13)}<span>${esc(s)}</span></li>`).join('')}
    </ul>` : ''}

    <div class="model-use">
      <span class="label" style="color:var(--fg-3)">${L.useFor}</span>
      ${(pick(m, 'useFor', L) || []).map((u) => `<span class="tag">${esc(u)}</span>`).join('')}
    </div>

    <div class="card-foot spread">
      <span class="label">${esc(k.name)}</span>
      <span class="row" style="gap:6px">
        ${m.modelsUrl ? `<a class="btn btn-sm btn-ghost" href="${esc(m.modelsUrl)}" target="_blank" rel="noopener nofollow">${L.modelList} ${icon('arrow-up-right', 12)}</a>` : ''}
        <a class="btn btn-sm" href="${esc(m.url)}" target="_blank" rel="noopener nofollow">${L.officialDoc} ${icon('arrow-up-right', 12)}</a>
      </span>
    </div>
    ${cardActions('model', m.id, false, L)}
  </article>`;
}

/** 实时动态条目（来自 RSS 抓取，时间为绝对时间，由前端增强为相对时间） */
export function liveItem(it, topicMap) {
  const tp = topicMap[it.topic] || { name: it.topic, accent: '#1B4DFF' };
  const d = it.date ? new Date(it.date) : null;
  const abs = d && !Number.isNaN(+d)
    ? `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : '—';
  return `<a class="live-item reveal" href="${esc(it.link)}" target="_blank" rel="noopener nofollow"
    data-name="${esc((it.title + ' ' + (it.summary || '') + ' ' + it.source).toLowerCase())}"
    data-source="${esc(it.sourceId)}"
    data-lang="${esc(it.lang)}">
    <time class="live-time" datetime="${esc(it.date || '')}" data-abs="${esc(abs)}">${esc(abs)}</time>
    <div class="live-main">
      <h3>${esc(it.title)}</h3>
      ${it.summary ? `<p>${esc(it.summary)}</p>` : ''}
      <div class="live-meta">
        <span class="tag accent" style="${accentTextStyle(tp.accent)}">${esc(it.source)}</span>
        <span class="label">${esc(it.lang)}</span>
        <span class="label">${esc(tp.name)}</span>
      </div>
    </div>
    <span class="live-go" aria-hidden="true">${icon('arrow-up-right', 14)}</span>
  </a>`;
}

export { PRICING, PRICING_CLS, icon };
