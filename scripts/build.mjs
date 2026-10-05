/**
 * AI 万象 — 静态站生成器（零依赖）
 *
 *   node scripts/build.mjs            构建到 dist/
 *   node scripts/build.mjs --watch    监听 data/ 与 src/ 变化自动重建
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  homePage, toolsPage, promptsPage, newsPage, newsDetailPage,
  learnPage, glossaryPage, searchPage, aboutPage, changelogPage, openDataPage, notFoundPage,
  playbooksPage, playbookDetailPage, modelsPage, toolDetailPage, liveNewsPage, comparePage, savedPage,
} from '../src/lib/pages.mjs';
import { enHome, enTools, enToolDetail, enModels, enAbout, enOpenData, enPlaybooks, enPlaybookDetail, enPrompts, enGlossary, enSearch, GROUP_EN } from '../src/lib/pages-en.mjs';
import { EN, tagList } from '../src/lib/labels.mjs';
import { toolNameEn, vendorEn, modelNameEn } from '../src/lib/i18n-en-maps.mjs';
import { countBy, esc } from '../src/lib/utils.mjs';
import { resetIcons } from '../src/lib/icons.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');

const readJSON = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

/**
 * 本次构建实际写出的文件集合。
 * 不再用 fs.rmSync 整树删除——在 Windows 上删 300+ 文件要 15 秒以上，占构建时间的一大半。
 * 改成「覆盖写入 + 收尾时只清理多余文件」，多出来的删除量通常只有个位数，毫秒级。
 */
const written = new Set();

function write(rel, content) {
  const out = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content, 'utf8');
  written.add(path.resolve(out));
  return out;
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) n += copyDir(s, d);
    else {
      fs.copyFileSync(s, d);
      written.add(path.resolve(d));
      n++;
    }
  }
  return n;
}

/** 清理这一轮没有写出、但 dist 里还留着的文件，并删掉空目录 */
function pruneStale() {
  const removed = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
      } else if (!written.has(path.resolve(full))) {
        fs.unlinkSync(full);
        removed.push(path.relative(DIST, full).replace(/\\/g, '/'));
      }
    }
  };
  if (fs.existsSync(DIST)) walk(DIST);
  return removed;
}

const today = () => new Date().toISOString().slice(0, 10);

/* 更新日志挪到了 data/changelog.json —— 内容不该写在代码里（这是本项目的第一条约束），
   而且能写进 data/ 才能被 check.mjs 检查「有没有落后于内容变更」。 */
const CHANGELOG = readJSON('changelog.json');

/**
 * 每个页面的 lastmod。
 *
 * 踩过的坑：原先所有 603 条 URL 的 lastmod 都是构建当天。每日 RSS 更新一次，
 * 全部工具页 / 场景页 / 术语页都被标成「今日更新」—— 这是错误的新鲜度信号，
 * Google 明确说过不要靠改日期假装内容更新。
 *
 * 现在的规则：
 *   · 内容页 → 该内容自己的日期（条目级 reviewed/updated 优先，否则用模块级 contentDates）
 *   · 目录页 → 所属模块的日期
 *   · 首页 / 实时动态 / 更新日志 / 搜索 → 构建日期（这些页面确实每天都在变）
 * 只有 data/feed.json 会每日变动，所以除首页和实时动态外，其他页面的 lastmod 是稳定的。
 */
function lastmodFor(meta, ctx, fallback) {
  const d = ctx.site.contentDates || {};
  const item = meta.item || null;
  switch (meta.type) {
    case 'tool-detail':      return (item && item.reviewed) || d.tools || fallback;
    case 'tools':
    case 'tools-cat':        return d.tools || fallback;
    case 'playbook-detail':  return (item && item.updated) || d.playbooks || fallback;
    case 'playbooks':
    case 'playbooks-group':  return d.playbooks || fallback;
    case 'prompts':
    case 'prompts-cat':      return d.prompts || fallback;
    case 'models':
    case 'models-kind':      return d.models || fallback;
    case 'glossary':         return d.glossary || fallback;
    case 'learn':
    case 'learn-track':      return d.learn || fallback;
    case 'news-detail':      return (item && item.date) || d.news || fallback;
    case 'news':             return d.news || fallback;
    /* 这几页确实每天都在变 */
    case 'home':
    case 'news-live':
    case 'changelog':
    case 'search':           return fallback;
    default:                 return fallback;
  }
}

export function build({ quiet = false } = {}) {
  const t0 = Date.now();
  written.clear();
  fs.mkdirSync(DIST, { recursive: true });

  /* ---------- 0. 静态资源指纹 ----------
     踩过一次：/assets/* 设了 max-age=31536000 + immutable，但文件名永远叫 app.js。
     结果用户第一次访问之后，浏览器把旧版 JS/CSS 缓存了一年 —— 之后不管我们怎么更新，
     老用户看到的都是旧代码（表现为「本地测试正常、用户那边功能是坏的」）。
     解决办法是内容哈希文件名：内容变了文件名就变，缓存自然不会命中旧的。 */
  const hash7 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 7);
  const srcFile = (p) => fs.readFileSync(path.join(SRC, p));
  const ASSET = {
    css: `main.${hash7(srcFile('styles/main.css'))}.css`,
    print: `print.${hash7(srcFile('styles/print.css'))}.css`,
    js: `app.${hash7(srcFile('scripts/app.js'))}.js`,
    /* 搜索逻辑只在 /search/ 用得上，单独一个文件由搜索页按需引入，
       不跟 app.js 一起下（其余 691 个页面只是白白的体积与解析开销）。 */
    search: `search.${hash7(srcFile('scripts/search.js'))}.js`,
    /* 类型图标：搜索卡与收藏页共用，必须单抽出来源源。
       不带 defer，以保证在 defer 的 app.js / search.js 之前执行。 */
    icons: `card-svg.${hash7(srcFile('scripts/card-svg.js'))}.js`,
  };

  /* ---------- 1. 载入数据 ---------- */
  const site = readJSON('site.config.json');
  const categories = readJSON('categories.json');
  const tools = readJSON('tools.json');
  const prompts = readJSON('prompts.json');
  const news = readJSON('news.json');
  const learn = readJSON('learn.json');
  const glossary = readJSON('glossary.json');
  const playbooks = readJSON('playbooks.json');
  const models = readJSON('models.json');
  const i18n = readJSON('i18n.json');
  const queryMap = readJSON('query-map.json');

  /* ---------- 2a-1. 外链健康状态 ----------
     由 scripts/check-outbound.mjs 产出（每周一次，CI 或本地）。
     这里是**可选数据**：文件不存在、格式不对、还是空壳，都必须能正常构建——
     抓取与构建解耦这条原则在这里同样成立，不能让一次没跑的检查拖垮整站构建。
     页面上只展示 verdict === 'dead'（GET 也确认过 404/410）的条目，
     403/超时那些「没能验证成功」的不能当成坏链告诉用户。 */
  let outbound = {};
  let outboundAt = '';
  try {
    const h = readJSON('outbound-health.json');
    outbound = h && typeof h.items === 'object' && h.items ? h.items : {};
    outboundAt = String((h && h.checkedAt) || '').slice(0, 10);
  } catch {
    outbound = {};
  }
  /** URL 归一化：只有记录里的地址和当前数据的地址一致，这条健康记录才算数 */
  const normUrl = (u) => String(u || '').trim().replace(/\/+$/, '');
  /** 只在确凿失效时返回该条目的结论。
     注意这里比对了 URL —— 改过 url 但没重跑 check-outbound 时，旧记录会指向旧地址，
     拿它去标注新地址等于告诉用户「你眼前这个链接是死的」，而它根本没被检查过。 */
  const deadLink = (id, currentUrl) => {
    const it = outbound[id];
    if (!it || it.verdict !== 'dead') return null;
    return normUrl(it.url) === normUrl(currentUrl) ? it : null;
  };
  // 标签字典挂到英文标签表上，供卡片渲染时翻译受控词表
  EN.tagDict = readJSON('tags-en.json');
  delete queryMap.note;

  // 实时动态是可选的：抓取与构建解耦，没有 feed.json 也能正常构建（只是没有实时区块）
  let feed = null;
  const feedPath = path.join(DATA, 'feed.json');
  if (fs.existsSync(feedPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
      // 丢弃没有链接或标题的脏数据，并设上限，避免把页面撑爆
      raw.items = (raw.items || []).filter((it) => it && it.title && /^https?:\/\//.test(it.link || '')).slice(0, 200);
      if (raw.items.length) feed = raw;
    } catch (e) {
      console.warn(`  ! data/feed.json 解析失败，跳过实时动态：${e.message}`);
    }
  }
  const FEED_HOURS = 24;

  // 两套分类体系有 id 撞车（coding/writing/design/data/marketing），必须分开映射，
  // 否则提示词分类会覆盖工具分类，导致工具卡显示错误分类名与配色
  const toolCatMap = Object.fromEntries(categories.toolCategories.map((c) => [c.id, c]));
  const promptCatMap = Object.fromEntries(categories.promptCategories.map((c) => [c.id, c]));
  const topicMap = Object.fromEntries(categories.newsTopics.map((t) => [t.id, t]));
  const trackMap = Object.fromEntries(categories.learnTracks.map((t) => [t.id, t]));
  const groupMap = Object.fromEntries(playbooks.groups.map((g) => [g.id, g]));
  const playbookMap = Object.fromEntries(playbooks.items.map((p) => [p.id, p]));
  const kindMap = Object.fromEntries(models.kinds.map((k) => [k.id, k]));
  const toolMap = Object.fromEntries(tools.map((t) => [t.id, t]));
  const promptMap = Object.fromEntries(prompts.map((p) => [p.id, p]));

  const counts = {
    tools: tools.length,
    prompts: prompts.length,
    learn: learn.length,
    glossary: glossary.length,
    news: news.items.length,
    playbooks: playbooks.items.length,
    models: models.items.length,
    live: feed ? feed.items.length : 0,
    toolsByCat: countBy(tools, 'cat'),
    promptsByCat: countBy(prompts, 'cat'),
    learnByTrack: countBy(learn, 'track'),
    playbooksByGroup: countBy(playbooks.items, 'group'),
  };
  counts.total = counts.tools + counts.prompts + counts.glossary + counts.learn
    + counts.news + counts.playbooks + counts.models;

  // layout 每个页面都会收到 site，所以把资源映射挂在这里，不用改任何调用点
  site.asset = ASSET;

  /* ---------- 2. 派生字段 ---------- */
  // NEW 标记：最近收录的一小批（按 added 倒序取前 8），避免同月大规模入库时徽章泛滥
  const NEW_COUNT = 8;
  const byAdded = [...tools]
    .filter((t) => t.added)
    .sort((a, b) => String(b.added).localeCompare(String(a.added)) || String(a.id).localeCompare(String(b.id)));
  const newIds = new Set(byAdded.slice(0, NEW_COUNT).map((t) => t.id));
  for (const t of tools) t._new = newIds.has(t.id);

  // 全站搜索索引（页面内嵌 + 开放 API 共用一份）
  const searchIndex = [];
  for (const t of tools) {
    searchIndex.push({
      t: 'tool', id: t.id, title: t.name, sub: (toolCatMap[t.cat] || {}).name || '',
      desc: t.desc, caveat: t.caveat || '', url: t.url, detail: `/tools/${t.cat}/${t.id}/`,
      tags: t.tags || [], ext: true, hot: !!t.hot,
    });
  }
  /* prompt/glossary/news/playbook/model 的 url 本身就是站内详情页，
     必须同时写进 detail —— 搜索结果卡片的标题只有在 detail 非空时才渲染成链接。
     踩过一次：只给 tool 写了 detail，于是 608 条结果里有 319 条（全部非工具内容）
     标题点不动，只有底部那颗小按钮能进。learn 类型的 url 是站外资源，
     没有站内详情页，故意不写 detail。 */
  for (const p of prompts) {
    searchIndex.push({ t: 'prompt', id: p.id, title: p.title, sub: (promptCatMap[p.cat] || {}).name || '', desc: p.desc, url: `/prompts/${encodeURIComponent(p.cat)}/#${p.id}`, detail: `/prompts/${encodeURIComponent(p.cat)}/#${p.id}`, tags: p.tags || [], hot: !!p.hot });
  }
  for (const l of learn) {
    searchIndex.push({ t: 'learn', id: l.id, title: l.title, sub: (trackMap[l.track] || {}).name || '', desc: l.desc, url: l.url, tags: l.tags || [], ext: true });
  }
  /* 术语条目额外带 en（英文说法）和 rel（相关术语）——
     只有定义类查询会用到它们（搜索页顶部那张「答案卡」）。
     92 条 × 几十字节，代价可接受；换来的是问「什么叫 X」时
     能直接把答案和相关词条一起给出来，而不是扔一张普通卡片。 */
  for (const g of glossary) {
    searchIndex.push({
      t: 'glossary', id: g.term, title: g.term, sub: g.cat, desc: g.def,
      url: `/glossary/?q=${encodeURIComponent(g.term)}`, detail: `/glossary/?q=${encodeURIComponent(g.term)}`,
      tags: g.abbr ? [g.abbr] : [],
      // 中文版的答案卡要显示中文相关词条，不做英文名映射
      en: g.en || '', abbr: g.abbr || '', rel: (g.related || []).slice(0, 3),
    });
  }
  for (const n of news.items) {
    searchIndex.push({ t: 'news', id: n.id, title: n.title, sub: (topicMap[n.topic] || {}).name || '', desc: n.summary, url: `/news/${n.id}/`, detail: `/news/${n.id}/`, tags: n.tags || [] });
  }
  for (const p of playbooks.items) {
    searchIndex.push({
      t: 'playbook', id: p.id, title: p.title, sub: (groupMap[p.group] || {}).name || '',
      desc: p.problem, url: `/playbooks/${p.id}/`, detail: `/playbooks/${p.id}/`,
      tags: [p.time, p.level].filter(Boolean),
    });
  }
  for (const m of models.items) {
    searchIndex.push({
      t: 'model', id: m.id, title: m.name, sub: m.vendor,
      desc: (m.strengths || []).join('；'), url: `/models/${m.kind}/`, detail: `/models/${m.kind}/`,
      tags: [m.vendor, (kindMap[m.kind] || {}).name, m.open ? '开源' : '闭源'].filter(Boolean),
    });
  }

  const updatedAt = today();

  /* ---------- 2b. 英文站搜索索引 ----------
     英文站已经有 244 个工具 + 78 个模型 + 92 条术语 + 86 条提示词 + 20 篇手册，
     但没有搜索 —— 导航里的搜索按钮一直是隐藏的（当时英文站内容太少，不值得做）。
     内容体量到这个程度，没有搜索就等于让读者一条条翻。

     索引规则和中文一致，但**只收有英文版的条目**：
     宁可少一条结果，也不要把读者送到中文页上。
     类型标签、分类名都走英文命名空间（cat.* / pcat.* / kind.* / gcat.*），
     和页面上的显示完全一致。 */
  const enCatName = (id) => (i18n.en || {})[`cat.${id}`] || id;
  const enPcatName = (id) => (i18n.en || {})[`pcat.${id}`] || id;
  const enKindName = (id) => (i18n.en || {})[`kind.${id}`] || id;
  const enGcatName = (id) => (i18n.en || {})[`gcat.${id}`] || id;

  const enSearchIndex = [];
  for (const t of tools) {
    if (!t.descEn) continue;            // 没翻的工具不进英文索引
    enSearchIndex.push({
      t: 'tool', id: t.id, title: toolNameEn(t.name), sub: enCatName(t.cat),
      desc: t.descEn, caveat: t.caveatEn || '', url: t.url, detail: `/en/tools/${t.cat}/${t.id}/`,
      tags: tagList(t.tags, EN).filter((g) => !/[\u4e00-\u9fa5]/.test(g)),
      ext: true, hot: !!t.hot,
    });
  }
  for (const p of prompts) {
    if (!p.en || !p.en.prompt) continue;
    enSearchIndex.push({
      t: 'prompt', id: p.id, title: p.en.title, sub: enPcatName(p.cat), desc: p.en.desc || '',
      url: `/en/prompts/${p.cat}/#${p.id}`,
      detail: `/en/prompts/${p.cat}/#${p.id}`,
      tags: tagList(p.tags, EN).filter((g) => !/[\u4e00-\u9fa5]/.test(g)), hot: !!p.hot,
    });
  }
  /* 英文答案卡的「相关词条」要显示英文说法，而 data 里的 related 存的是中文术语，
     所以这里按 term 反查每个词条的英文（查不到就退回中文，好过留空）。 */
  const termEn = new Map(glossary.map((g) => [g.term, g.en || g.term]));
  for (const g of glossary) {
    if (!g.defEn) continue;
    enSearchIndex.push({
      t: 'glossary', id: g.en || g.term, title: g.en || g.term, sub: enGcatName(g.cat),
      desc: g.defEn, url: `/en/glossary/?q=${encodeURIComponent(g.en || g.term)}`,
      detail: `/en/glossary/?q=${encodeURIComponent(g.en || g.term)}`,
      tags: g.abbr ? [g.abbr] : [],
      en: g.en || '', abbr: g.abbr || '', rel: (g.related || []).slice(0, 3).map((t) => termEn.get(t) || t),
    });
  }
  for (const p of playbooks.items) {
    if (!p.en || !p.en.steps || !p.en.steps.length) continue;
    enSearchIndex.push({
      t: 'playbook', id: p.id, title: p.en.title, sub: GROUP_EN[p.group] || p.group,
      desc: p.en.problem || '', url: `/en/playbooks/${p.id}/`, detail: `/en/playbooks/${p.id}/`,
      tags: [p.en.time || p.time, p.en.level || p.level].filter(Boolean),
    });
  }
  for (const m of models.items) {
    if (!m.strengthsEn || !m.strengthsEn.length) continue;
    enSearchIndex.push({
      t: 'model', id: m.id, title: modelNameEn(m.name), sub: vendorEn(m.vendor),
      desc: m.strengthsEn.join('; '), url: `/en/models/${m.kind}/`, detail: `/en/models/${m.kind}/`,
      tags: [vendorEn(m.vendor), enKindName(m.kind), m.open ? 'Open source' : 'Closed'].filter(Boolean),
    });
  }

  const ctx = {
    site, categories, tools, prompts, news, learn, glossary, playbooks, models, i18n, queryMap, feed, feedHours: FEED_HOURS,
    toolCatMap, promptCatMap, topicMap, trackMap, groupMap, kindMap, toolMap, promptMap, playbookMap,
    counts, changelog: CHANGELOG,
    searchIndex, enSearchIndex, updatedAt,
    outbound, outboundAt, deadLink,
  };

  /* ---------- 3. 生成页面 ---------- */
  const manifest = [];
  const emit = (rel, htmlOrThunk, meta = {}) => {
    // 传函数时：先重置图标集合再渲染，保证 sprite 只含本页用到的图标
    const html = typeof htmlOrThunk === 'function'
      ? (resetIcons(), htmlOrThunk())
      : htmlOrThunk;
    write(rel, html);
    manifest.push({ url: '/' + rel.replace(/index\.html$/, ''), title: meta.title || '', type: meta.type || 'page', lastmod: meta.lastmod || lastmodFor(meta, ctx, updatedAt) });
  };

  emit('index.html', () => homePage(ctx), { title: site.brand.name, type: 'home' });
  emit('playbooks/index.html', () => playbooksPage(ctx), { title: '场景手册', type: 'playbooks' });
  emit('tools/index.html', () => toolsPage(ctx), { title: 'AI 工具库', type: 'tools' });
  emit('prompts/index.html', () => promptsPage(ctx), { title: '提示词库', type: 'prompts' });
  emit('models/index.html', () => modelsPage(ctx), { title: '模型库', type: 'models' });
  emit('news/index.html', () => newsPage(ctx), { title: 'AI 资讯与解读', type: 'news' });
  if (feed) {
    emit('news/live/index.html', () => liveNewsPage(ctx), { title: '实时动态', type: 'news-live' });
  }
  emit('learn/index.html', () => learnPage(ctx), { title: '学习资源', type: 'learn' });
  emit('glossary/index.html', () => glossaryPage(ctx), { title: 'AI 术语表', type: 'glossary' });
  emit('compare/index.html', () => comparePage(ctx), { title: '工具对比', type: 'compare' });
  emit('saved/index.html', () => savedPage(ctx), { title: '我的收藏', type: 'saved' });
  emit('search/index.html', () => searchPage(ctx), { title: '全站搜索', type: 'search' });
  emit('about/index.html', () => aboutPage(ctx), { title: '关于', type: 'about' });
  emit('changelog/index.html', () => changelogPage(ctx), { title: '更新日志', type: 'changelog' });
  emit('open-data/index.html', () => openDataPage(ctx), { title: '开放数据', type: 'open-data' });
  emit('404.html', () => notFoundPage(ctx), { title: '404', type: '404' });

  for (const g of playbooks.groups) {
    emit(`playbooks/${g.id}/index.html`, () => playbooksPage(ctx, { activeGroup: g.id }), { title: `${g.name} · 场景手册`, type: 'playbooks-group' });
  }
  for (const p of playbooks.items) {
    emit(`playbooks/${p.id}/index.html`, () => playbookDetailPage(ctx, p), { title: p.title, type: 'playbook-detail', item: p });
  }
  for (const k of models.kinds) {
    emit(`models/${k.id}/index.html`, () => modelsPage(ctx, { activeKind: k.id }), { title: `${k.name}模型 · 模型库`, type: 'models-kind' });
  }

  /* ---------- 英文版 ----------
     范围刻意收窄：只覆盖「查询型」内容（工具库 + 模型库）。
     场景手册 / 提示词 / 资讯 / 学习资源是长篇中文内容，不做翻译——
     两套长期并行维护的翻译成本远高于它能带来的价值。 */
  emit('en/index.html', () => enHome(ctx, i18n), { title: i18n.en.siteTagline, type: 'home' });
  emit('en/tools/index.html', () => enTools(ctx, i18n), { title: i18n.en['tools.title'], type: 'tools' });
  emit('en/models/index.html', () => enModels(ctx, i18n), { title: i18n.en['models.title'], type: 'models' });
  emit('en/about/index.html', () => enAbout(ctx, i18n), { title: 'About', type: 'about' });
  emit('en/open-data/index.html', () => enOpenData(ctx, i18n), { title: 'Open data', type: 'open-data' });
  for (const c of categories.toolCategories) {
    emit(`en/tools/${c.id}/index.html`, () => enTools(ctx, i18n, { activeCat: c.id }), { title: `${i18n.en['cat.' + c.id] || c.id} · AI Tools`, type: 'tools-cat' });
  }

  /* 英文场景手册：只生成有翻译的那几篇。没翻译的不生成页面，
     而不是生成一个中文页面挂在 /en/ 下面（那比缺内容更糟）。
     注意这个 emit 必须在分类循环**外面** —— 放进去会被每个分类重复执行一遍。 */
  const pbEnList = playbooks.items.filter((p) => p.en && p.en.steps && p.en.steps.length);
  if (pbEnList.length) {
    emit('en/playbooks/index.html', () => enPlaybooks(ctx, i18n), { title: 'AI playbooks: end-to-end workflows', type: 'playbooks' });
    for (const p of pbEnList) {
      emit(`en/playbooks/${p.id}/index.html`, () => enPlaybookDetail(ctx, i18n, p), { title: `${p.en.title} · Playbook`, type: 'playbook-detail', item: p });
    }
  }

  /* 英文提示词库：同样只生成有翻译的。没翻译的不生成页面。 */
  if (prompts.some((p) => p.en && p.en.prompt)) {
    emit('en/prompts/index.html', () => enPrompts(ctx, i18n), { title: 'Prompt library', type: 'prompts' });
    for (const pc of categories.promptCategories) {
      if (!prompts.some((p) => p.cat === pc.id && p.en && p.en.prompt)) continue;
      emit(`en/prompts/${pc.id}/index.html`, () => enPrompts(ctx, i18n, { activeCat: pc.id }), { title: `${i18n.en['cat.' + pc.id] || pc.id} prompts`, type: 'prompts-cat' });
    }
  }

  /* 英文术语表：只收录有英文定义的 */
  if (glossary.some((g) => g.defEn)) {
    emit('en/glossary/index.html', () => enGlossary(ctx, i18n), { title: 'AI glossary', type: 'glossary' });
  }

  /* 英文全站搜索：有内容才生成（内容为空时搜索页只是一张空壳） */
  if (enSearchIndex.length) {
    emit('en/search/index.html', () => enSearch(ctx, i18n), { title: 'Search', type: 'search' });
  }

  for (const t of tools) {
    emit(`en/tools/${t.cat}/${t.id}/index.html`, () => enToolDetail(ctx, i18n, t), { title: `${t.name} · AI Tools`, type: 'tool-detail', item: t });
  }
  for (const k of models.kinds) {
    emit(`en/models/${k.id}/index.html`, () => enModels(ctx, i18n, { activeKind: k.id }), { title: `${i18n.en['kind.' + k.id] || k.id} · Models`, type: 'models-kind' });
  }

  for (const c of categories.toolCategories) {
    emit(`tools/${c.id}/index.html`, () => toolsPage(ctx, { activeCat: c.id }), { title: `${c.name} · AI 工具`, type: 'tools-cat' });
  }
  // 工具详情页：同类对比 + 出现在哪些场景里（不做「复制官网简介」那种薄内容）
  for (const t of tools) {
    emit(`tools/${t.cat}/${t.id}/index.html`, () => toolDetailPage(ctx, t), { title: `${t.name} · ${(toolCatMap[t.cat] || {}).name}`, type: 'tool-detail', item: t });
  }
  for (const c of categories.promptCategories) {
    emit(`prompts/${c.id}/index.html`, () => promptsPage(ctx, { activeCat: c.id }), { title: `${c.name} · 提示词`, type: 'prompts-cat' });
  }
  for (const t of categories.learnTracks) {
    emit(`learn/${t.id}/index.html`, () => learnPage(ctx, { activeTrack: t.id }), { title: `${t.name} · 学习资源`, type: 'learn-track' });
  }
  for (const n of news.items) {
    emit(`news/${n.id}/index.html`, () => newsDetailPage(ctx, n), { title: n.title, type: 'news-detail', item: n });
  }

  /* ---------- 4. 静态资源 ---------- */
  write('assets/' + ASSET.css, fs.readFileSync(path.join(SRC, 'styles', 'main.css'), 'utf8'));
  write('assets/' + ASSET.print, fs.readFileSync(path.join(SRC, 'styles', 'print.css'), 'utf8'));
  write('assets/' + ASSET.js, fs.readFileSync(path.join(SRC, 'scripts', 'app.js'), 'utf8'));
  write('assets/' + ASSET.search, fs.readFileSync(path.join(SRC, 'scripts', 'search.js'), 'utf8'));
  write('assets/' + ASSET.icons, fs.readFileSync(path.join(SRC, 'scripts', 'card-svg.js'), 'utf8'));
  copyDir(path.join(ROOT, 'public'), DIST);

  /* ---------- 5. 开放数据 ---------- */
  const api = {
    'index.json': {
      site: { name: site.brand.name, nameEn: site.brand.nameEn, slogan: site.brand.slogan, description: site.brand.description },
      updatedAt,
      counts,
      categories,
    },
    'tools.json': tools.map(({ _new, ...rest }) => rest),
    'prompts.json': prompts,
    'news.json': news,
    'learn.json': learn,
    'glossary.json': glossary,
    'playbooks.json': playbooks,
    'models.json': models,
    'search.json': searchIndex,
    'search-en.json': enSearchIndex,
    'query-map.json': queryMap,
    ...(feed ? { 'feed.json': feed } : {}),
  };
  for (const [f, v] of Object.entries(api)) write(`api/${f}`, JSON.stringify(v, null, 2));

  /* ---------- 6. RSS ---------- */
  const base = (site.baseUrl || 'https://example.com').replace(/\/$/, '');
  const rssItems = [...news.items]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((n) => `    <item>
      <title>${esc(n.title)}</title>
      <link>${base}/news/${n.id}/</link>
      <guid isPermaLink="true">${base}/news/${n.id}/</guid>
      <description>${esc(n.summary)}</description>
      <pubDate>${new Date(n.date + 'T09:00:00+08:00').toUTCString()}</pubDate>
    </item>`)
    .join('\n');

  write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(site.brand.name)} · 资讯与解读</title>
    <link>${base}/news/</link>
    <description>${esc(site.brand.description)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>
`);

  /* ---------- 7. SEO ---------- */
  /* 不进 sitemap 的页面类型：
     · 404 —— 本来就不该被索引
     · news-live —— 实时动态是自动抓取的标题摘要聚合，不是自己的原创内容。
       它对人有用（发现入口），但不该占 SEO 名额、也不该和原创解读抢权重。
       该页另外打了 noindex,follow，见 liveNewsPage。
     · search / saved —— 这两个页面对爬虫是**空的**。实测正文只有 534 / 372 字，
       内容还都在浏览器 localStorage 里（收藏）或要靠输入才出现（搜索）。
       把它们写进 sitemap 等于主动请搜索引擎收录空页，只会拖累整站的质量评分；
       而且搜索页一旦被索引，`?q=xxx` 变体会变成无穷多份重复内容。
       两页同样打了 noindex,follow（见 searchPage / savedPage），内部链接照常传权重。 */
  const NO_INDEX_TYPES = new Set(['404', 'news-live', 'search', 'saved']);
  const urls = manifest
    .filter((m) => !NO_INDEX_TYPES.has(m.type))
    .map((m) => `  <url>\n    <loc>${base}${m.url}</loc>\n    <lastmod>${m.lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${m.type === 'home' ? '1.0' : m.type.includes('-detail') || m.type === 'about' ? '0.6' : '0.8'}</priority>\n  </url>`)
    .join('\n');
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`);

  /* ---------- 8. 部署配置 ---------- */
  write('_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/api/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=3600
`);
  // 部署配置以仓库根目录的 vercel.json 为唯一来源（重定向规则、响应头都在那里）。
  // 这里把它复制进 dist，避免出现两份不一致的配置让人搞不清哪份生效。
  // 注意：Vercel 真正读的是仓库根目录那份；dist 里的这份只是「构建产物里也留一份」，
  // 便于别人直接把 dist 丢到别的主机（Netlify / Cloudflare Pages）时也能看到配置。
  const rootVercel = path.join(ROOT, 'vercel.json');
  if (fs.existsSync(rootVercel)) {
    write('vercel.json', fs.readFileSync(rootVercel, 'utf8'));
  }
  write('_redirects', `# Netlify: 旧链接兼容（如未来调整 URL 结构，在这里加 301）\n`);

  /* ---------- 9. 清理与报告 ---------- */
  const stale = pruneStale();
  const ms = Date.now() - t0;
  if (!quiet) {
    console.log('');
    console.log('  AI 万象 · 构建完成');
    console.log('  ' + '─'.repeat(48));
    console.log(`  页面        ${manifest.length} 个`);
    console.log(`  场景手册    ${counts.playbooks}  （${playbooks.groups.length} 个分组）`);
    console.log(`  工具        ${counts.tools}  （NEW 标记 ${tools.filter((t) => t._new).length}）`);
    console.log(`  提示词      ${counts.prompts}`);
    console.log(`  模型        ${counts.models}  （${models.kinds.length} 个类型）`);
    console.log(`  术语        ${counts.glossary}`);
    console.log(`  学习资源    ${counts.learn}`);
    console.log(`  资讯        ${counts.news}`);
    console.log(`  英文版      ${manifest.filter((m) => m.url.startsWith("/en/")).length} 页（工具 / 模型 / 手册 / 提示词 / 术语 / 搜索）`);
    console.log(`  实时动态    ${feed ? `${counts.live} 条（${feed.sources.filter((x) => x.ok).length}/${feed.sources.length} 源，抓取于 ${feed.updatedAt.slice(0, 16).replace('T', ' ')}）` : '无（未跑 fetch-news）'}`);
    console.log(`  搜索索引    ${searchIndex.length} 条`);
    console.log('  ' + '─'.repeat(48));
    console.log(`  附带产物    sitemap.xml / robots.txt / feed.xml / api/ / _headers / vercel.json`);
    console.log(`  清理陈旧    ${stale.length} 个文件${stale.length ? '（' + stale.slice(0, 3).join(', ') + (stale.length > 3 ? ' …' : '') + '）' : ''}`);
    console.log(`  输出目录    dist/  （共 ${written.size} 个文件）`);
    console.log(`  耗时        ${ms}ms`);
    console.log('');
  }
  return { manifest, counts, ms, stale };
}

/* ---------- watch ---------- */
const isMain = process.argv[1] && process.argv[1].endsWith('build.mjs');
if (isMain) {
  build();
  if (process.argv.includes('--watch')) {
    let timer = null;
    const rebuild = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try { build({ quiet: true }); console.log(`  [${new Date().toLocaleTimeString()}] 已重建`); }
        catch (e) { console.error('  构建失败：', e.message); }
      }, 120);
    };
    for (const dir of [DATA, SRC]) {
      if (fs.existsSync(dir)) fs.watch(dir, { recursive: true }, rebuild);
    }
    console.log('  监听 data/ 与 src/ 变化中… (Ctrl+C 退出)');
  }
}
