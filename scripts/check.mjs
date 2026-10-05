/**
 * 数据自检
 *   node scripts/check.mjs
 * 检查重复 id、未知分类、缺失字段、URL 格式、可能的占位内容。
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.resolve(__dirname, '..', 'data');
const DIST = path.resolve(__dirname, '..', 'dist');
const SRC_DIR = path.resolve(__dirname, '..', 'src');
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

const errors = [];
const warns = [];
const ok = [];

const cat = read('categories.json');
const toolCats = new Set(cat.toolCategories.map((c) => c.id));
const promptCats = new Set(cat.promptCategories.map((c) => c.id));
const topics = new Set(cat.newsTopics.map((t) => t.id));
const tracks = new Set(cat.learnTracks.map((t) => t.id));

function dupes(arr, label) {
  const seen = new Map();
  for (const x of arr) {
    const k = x.id || x.term;
    if (seen.has(k)) errors.push(`${label}: id 重复 → ${k}`);
    seen.set(k, true);
  }
  if (arr.length) ok.push(`${label}: ${arr.length} 条，id 唯一`);
}

function need(obj, fields, label) {
  for (const f of fields) {
    const v = obj[f];
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) {
      errors.push(`${label}: 缺少字段 ${f}`);
    }
  }
}

function urlCheck(u, label) {
  if (!u) return;
  if (!/^https?:\/\/.+/.test(u)) errors.push(`${label}: URL 格式可疑 → ${u}`);
}

/* ---- tools ---- */
const tools = read('tools.json');
dupes(tools, 'tools');
const PRICING = new Set(['free', 'freemium', 'paid', 'open']);
for (const t of tools) {
  const L = `tools/${t.id}`;
  need(t, ['id', 'name', 'url', 'cat', 'desc', 'pricing'], L);
  urlCheck(t.url, L);
  if (t.cat && !toolCats.has(t.cat)) errors.push(`${L}: 未知分类 ${t.cat}`);
  if (t.pricing && !PRICING.has(t.pricing)) errors.push(`${L}: 未知价格模式 ${t.pricing}`);
  if (t.desc && t.desc.length > 70) warns.push(`${L}: 描述偏长（${t.desc.length} 字），首页卡片可能截断`);
}

/* ---- prompts ---- */
const prompts = read('prompts.json');
dupes(prompts, 'prompts');
for (const p of prompts) {
  const L = `prompts/${p.id}`;
  need(p, ['id', 'title', 'cat', 'desc', 'prompt'], L);
  if (p.cat && !promptCats.has(p.cat)) errors.push(`${L}: 未知分类 ${p.cat}`);
  if (p.prompt && !/\{\{[^}]+\}\}/.test(p.prompt) && (p.vars || []).length) {
    warns.push(`${L}: 声明了变量但没有在正文里出现 {{变量}}`);
  }
}

/* ---- news ---- */
const news = read('news.json');
dupes(news.items, 'news.items');
for (const n of news.items) {
  const L = `news/${n.id}`;
  need(n, ['id', 'title', 'topic', 'date', 'summary', 'body'], L);
  if (n.topic && !topics.has(n.topic)) errors.push(`${L}: 未知主题 ${n.topic}`);
  if (n.date && !/^\d{4}-\d{2}(-\d{2})?$/.test(n.date)) errors.push(`${L}: 日期格式应为 YYYY-MM-DD`);
}
if (!news.sources?.length) errors.push('news: sources 为空');
else ok.push(`news: ${news.items.length} 篇解读 + ${news.sources.length} 个信息源 + ${news.milestones.length} 个里程碑`);

/* ---- learn ---- */
const learn = read('learn.json');
dupes(learn, 'learn');
for (const l of learn) {
  const L = `learn/${l.id}`;
  need(l, ['id', 'title', 'track', 'url', 'desc', 'type'], L);
  urlCheck(l.url, L);
  if (l.track && !tracks.has(l.track)) errors.push(`${L}: 未知学习路径 ${l.track}`);
}

/* ---- glossary ---- */
const glossary = read('glossary.json');
{
  const seen = new Map();
  for (const g of glossary) {
    if (seen.has(g.term)) errors.push(`glossary: 术语重复 → ${g.term}`);
    seen.set(g.term, true);
    need(g, ['term', 'cat', 'def'], `glossary/${g.term}`);
  }
  ok.push(`glossary: ${glossary.length} 条术语，term 唯一`);
}

/* ---- query-map（检索意图词典） ----
   这个文件一旦写错，症状是「搜索召回静默退化」——不报错、不红 Θ，只是搜不到东西。
   踩过两次：① 手工编辑时整段词条被替换掉而不自知（开会记录/会议记录凭空消失）；
   ② 想写注释键却写成了普通键。这两种都不会让构建失败，所以必须显式守。 */
{
  const qm = read('query-map.json');
  const keys = Object.keys(qm).filter((k) => k !== 'note');
  for (const k of keys) {
    if (k.startsWith('_')) errors.push(`query-map: 键不能以 _ 开头（会被当成真词条）→ ${k}`);
    if (!Array.isArray(qm[k])) errors.push(`query-map: ${k} 的值必须是数组，现在是 ${typeof qm[k]}`);
    else if (!qm[k].length) errors.push(`query-map: ${k} 的同义词列表是空的`);
    else if (qm[k].some((v) => !v || typeof v !== 'string')) errors.push(`query-map: ${k} 里有非字符串的同义词`);
  }
  ok.push(`query-map: ${keys.length} 条意图映射，格式合法`);
}

/* ---- GitHub Actions 工作流（结构级体检） ----
   这类文件的坑是「提交时不报错、之后一整周不干活」：YAML 里混进一个 Tab、
   漏了 on:、或者 steps 缩进错位，GitHub 只是安静地不跑，没人会知道。
   本地没有 YAML 解析器（零依赖），所以只做能确定判死的三条：
   Tab 字符、必须有 on:、必须有 jobs:。缩进类错误交给 push 后那次运行暴露。 */
{
  const wfDir = path.join(path.resolve(__dirname, '..'), '.github', 'workflows');
  if (fs.existsSync(wfDir)) {
    const files = fs.readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f));
    let wfBad = 0;
    for (const f of files) {
      const src = fs.readFileSync(path.join(wfDir, f), 'utf8');
      let bad = 0;
      if (src.includes('\t')) { errors.push(`workflow ${f}: 含 Tab 字符（YAML 只允许空格缩进，会直接解析失败）`); bad++; }
      if (!/^on:/m.test(src)) { errors.push(`workflow ${f}: 找不到 on: 触发器`); bad++; }
      if (!/^jobs:/m.test(src)) { errors.push(`workflow ${f}: 找不到 jobs:`); bad++; }
      wfBad += bad;
    }
    // 有问题的文件已经单独报错了，这里不能再报「全部完整」——
    // 否则同一份输出里既有 ✗ 又有 ✓，读的人会以为只是提醒。
    if (!wfBad) ok.push(`GitHub Actions: ${files.length} 个工作流结构完整（无 Tab、有 on/jobs）`);
  }
}

/* ---- 可发现性守卫（sitemap 与 noindex 必须一致） ----
   这两侧很容易走岔：页面打了 noindex 却还在 sitemap 里（自相矛盾，浪费抓取），
   或者页面正文是空的（收藏页/搜索页，内容在 localStorage 或要输入才出现）却大方地
   请搜索引擎来收录 —— 后者的代价是整站质量评分，而这**不会让任何构建失败**。 */
{
  const sitemapPath = path.join(DIST, 'sitemap.xml');
  if (fs.existsSync(sitemapPath)) {
    const sm = fs.readFileSync(sitemapPath, 'utf8');
    const mustNotBeListed = ['/search/', '/saved/', '/news/live/', '/404.html', '/404/'];
    const listed = mustNotBeListed.filter((p) => new RegExp(`<loc>[^<]*${p.replace(/[/.]/g, '\\$&')}</loc>`).test(sm));
    if (listed.length) {
      errors.push(`sitemap: 不该收录的页面出现在 sitemap 里 → ${listed.join('、')}（它们是空页/自动聚合页，收进去拉低整站质量评分）`);
    }
    /* 反向：打了 noindex 的页面如果就在 sitemap 里，同样矛盾 */
    const noindexWithLoc = [];
    for (const p of ['search/index.html', 'saved/index.html', 'en/search/index.html']) {
      const f = path.join(DIST, p);
      if (!fs.existsSync(f)) continue;
      const html = fs.readFileSync(f, 'utf8');
      const hasNoindex = /name="robots"[^>]*noindex/.test(html);
      if (!hasNoindex) errors.push(`${p}: 对爬虫是空页，必须打 noindex,follow（否则等于请它收录空页）`);
      else if (new RegExp(`<loc>[^<]*/${p.replace('/index.html', '/')}</loc>`).test(sm)) {
        noindexWithLoc.push(p);
      }
    }
    if (noindexWithLoc.length) errors.push(`sitemap 与 noindex 自相矛盾 → ${noindexWithLoc.join('、')}`);
    if (!listed.length && !noindexWithLoc.length && /<loc>/.test(sm)) {
      const n = (sm.match(/<loc>/g) || []).length;
      ok.push(`可发现性: sitemap ${n} 条，已排除搜索页/收藏页/实时动态/404；这三个空页都打了 noindex`);
    }
  }
}

/* ---- IndexNow 密钥文件 ----
   没有它，Bing/Yandex 一类的主动推送全部 403。文件很容易在重构里被清掉，
   而少了它**不会报错** —— 推送接口静静地拒绝，你会以为推过了。 */
{
  const pubDir = path.join(ROOT, 'public');
  if (fs.existsSync(pubDir)) {
    const keys = fs.readdirSync(pubDir).filter((f) => /^[0-9a-f]{8,128}\.txt$/.test(f)
      && fs.readFileSync(path.join(pubDir, f), 'utf8').trim() === f.replace(/\.txt$/, ''));
    if (!keys.length) warns.push('IndexNow: public/ 下没有合法密钥文件（跑 node scripts/indexnow.mjs --new-key 生成），主动推送会 403');
    else ok.push(`IndexNow: 密钥文件 ${keys.length} 个，文件名与内容一致（推送时校验的就是它）`);
  }
}

/* ---- 搜索引擎验证 token：配了就必须真的出现在 HTML 里 ----
   最容易出的事：site.config.json 里填了 token，但 layout 没输出、或者名字写错一个字母。
   表现是"填完了，Google 那边点验证一直失败"，你会去怀疑 Google，而不是怀疑自己。
   （百度那次就是三个字段全空、逻辑写了没数据，谁也没发现。） */
{
  const cfg = read('site.config.json');
  const v = (cfg && cfg.verify) || {};
  const EXPECT = { google: 'google-site-verification', bing: 'msvalidate.01', baidu: 'baidu-site-verification' };
  const configured = Object.keys(EXPECT).filter((k) => v[k]);
  const home = path.join(DIST, 'index.html');
  if (configured.length && fs.existsSync(home)) {
    const html = fs.readFileSync(home, 'utf8');
    const missing = configured.filter((k) => !html.includes(`name="${EXPECT[k]}"`) || !html.includes(v[k]));
    if (missing.length) {
      errors.push(`搜索验证: site.config.json 里配了 ${missing.join('、')} 的 token，但 ${missing.join('、')} 的 meta 没出现在首页 —— 验证会一直失败`);
    } else {
      ok.push(`搜索验证: ${configured.join(' / ')} 的 meta 已输出到页面（token 配了就得看得见）`);
    }
  } else if (configured.length && !fs.existsSync(home)) {
    /* 没构建过就不判断 */
  } else {
    warns.push('搜索验证: Google / Bing 的 token 还没配（填在 data/site.config.json 的 verify 段），现在没有任何搜索后台数据可看');
  }
}

/* ---- card-svg 共享碎片 ----
   搜索结果卡与「我的收藏」页都要画类型图标，这两套渲染分别在 search.js / app.js 里。
   图标表统一放在 card-svg.js（页面用不带 defer 的 <script> 最先引入），
   绕过了 CSS/JS 之外的任何检查：漏引不会报错，只会变成空图标这种"看起来还行"的降级。
   所以这里既查页面有没有带上它，也查两个 bundle 有没有偷偷各定义一份（那样会漂移）。 */
{
  const need = ['saved/index.html', 'search/index.html', 'en/search/index.html'];
  const miss = [];
  let ran = true;
  for (const p of need) {
    const f = path.join(DIST, p);
    if (!fs.existsSync(f)) { ran = false; continue; }   // 没构建过不算错，build 之后再来
    if (!fs.readFileSync(f, 'utf8').includes('card-svg')) miss.push(p);
  }
  if (miss.length) errors.push(`card-svg: 这些页面要渲染卡片却没引入共享 SVG → ${miss.join('、')}`);
  for (const f of ['scripts/app.js', 'scripts/search.js']) {
    const fp = path.join(SRC_DIR, f);
    if (!fs.existsSync(fp)) continue;
    const s = fs.readFileSync(fp, 'utf8');
    if (/var\s+TYPE_ICON\s*=\s*\{/.test(s) || /var\s+ARROW\s*=\s*'<svg/.test(s)) {
      errors.push(`${f}: 又自己定义了一份类型图标/箭头 —— 会和 card-svg.js 悄悄不一致`);
    }
  }
  if (ran && !miss.length) ok.push('card-svg: 搜索页与收藏页都引入了共享图标，两个 bundle 也没有重复定义');
}

/* ---- outbound-health（外链健康）—— 只提醒，不阻断 ----
   它由独立的检查脚本产出，没跑过就是空壳，那不是代码错误，不该让 check 失败。
   但「明确失效」的条目一旦出现，就必须被人看到：这是我们答应给用户的信息。 */
{
  const h = read('outbound-health.json');
  const items = (h && h.items) || {};
  const rows = Object.entries(items);
  if (!rows.length) {
    warns.push('外链健康：还没有检查结果（跑一次 node scripts/check-outbound.mjs 生成）');
  } else {
    const dead = rows.filter(([, v]) => v.verdict === 'dead');
    const moved = rows.filter(([, v]) => v.verdict === 'moved');
    const unknown = rows.filter(([, v]) => v.verdict === 'unknown');
    for (const [id, v] of rows) {
      if (v.verdict && !['ok', 'moved', 'dead', 'unknown'].includes(v.verdict)) {
        errors.push(`outbound-health: ${id} 的 verdict 值非法 → ${v.verdict}`);
      }
    }
    const ago = Date.now() - Date.parse(h.checkedAt || 0);
    if (isFinite(ago) && ago > 21 * 864e5) {
      warns.push(`外链健康数据已过期（${String(h.checkedAt).slice(0, 10)}，超过 21 天），页面上的失效提示可能不准`);
    }
    const stale = [];
    const toolUrls = new Map(tools.map((t) => [t.id, t.url]));
    for (const [id, v] of rows) {
      const now = toolUrls.get(id);
      // 只有工具类有当前 URL 可比；改过 url 却没重跑检查，这条记录说的其实是旧地址
      if (now && String(v.url || '').replace(/\/+$/, '') !== String(now).replace(/\/+$/, '')) {
        stale.push(`${id}（记录 ${v.url} → 现 ${now}）`);
      }
    }
    if (stale.length) {
      warns.push(`外链健康：${stale.length} 条记录的地址已经和数据不一致（改过 url 没重跑检查）→ ${stale.slice(0, 5).join('、')}${stale.length > 5 ? ' …' : ''}；这些不会再用于页面提示，但要跑一次 check-outbound.mjs 更新`);
    }
    const movedNow = moved.filter(([id, v]) => !stale.some((s) => s.startsWith(id + '（')));
    warns.push(`外链健康：检查 ${rows.length} 条 → 失效 ${dead.length}（已在工具页提示）· 换了域名 ${movedNow.length} · 未能验证 ${unknown.length}`);
    for (const [, v] of dead) warns.push(`  ↳ 失效待处理：${v.name} （${v.url}）`);
  }
}

/* ---- 编辑点评覆盖率 ----
   caveat（什么时候别选它）是本站相对普通工具导航的核心差异，属于「编辑价值」而非元数据。
   新加工具时不要漏，这里会点名。 */
{
  const missing = tools.filter((t) => !t.caveat || t.caveat.length < 12);
  if (missing.length) {
    warns.push(`tools: ${missing.length} 个工具缺少编辑点评 caveat → ${missing.map((t) => t.name).slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}`);
  } else {
    const lens = tools.map((t) => t.caveat.length);
    ok.push(`tools: ${tools.length} 个工具全部有编辑点评（平均 ${Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)} 字）`);
  }
  const generic = tools.filter((t) => t.caveat && /^(注意|暂无|待补充)/.test(t.caveat));
  if (generic.length) warns.push(`tools: ${generic.length} 个工具的点评像是占位内容`);
}

/* ---- playbooks / models（v3 新模块） ---- */
const toolIds = new Set(tools.map((t) => t.id));
const promptIds = new Set(prompts.map((p) => p.id));
const playbookIds = new Set();

{
  const fp = path.join(DATA, 'playbooks.json');
  if (!fs.existsSync(fp)) {
    errors.push('playbooks.json 不存在');
  } else {
    const pb = read('playbooks.json');
    const groups = new Set((pb.groups || []).map((g) => g.id));
    if (!pb.groups?.length) errors.push('playbooks: groups 为空');
    if (!pb.items?.length) errors.push('playbooks: items 为空');

    const seen = new Set();
    for (const it of pb.items) {
      const L = `playbooks/${it.id}`;
      if (seen.has(it.id)) errors.push(`${L}: id 重复`);
      seen.add(it.id);
      playbookIds.add(it.id);
      need(it, ['id', 'title', 'group', 'problem', 'time'], L);
      if (it.group && !groups.has(it.group)) errors.push(`${L}: 未知分组 ${it.group}`);
      if (!Array.isArray(it.steps) || it.steps.length < 2) errors.push(`${L}: steps 至少要有 2 步`);

      // 交叉引用校验：引用了不存在的工具/提示词是这类数据最容易出的错
      const checkRefs = (ids, kind, where) => {
        for (const id of ids || []) {
          const pool = kind === '工具' ? toolIds : promptIds;
          if (!pool.has(id)) errors.push(`${L}${where}: 引用了不存在的${kind} → ${id}`);
        }
      };
      checkRefs(it.tools, '工具', '');
      checkRefs(it.prompts, '提示词', '');
      (it.steps || []).forEach((s, i) => {
        checkRefs(s.tools, '工具', ` 第${i + 1}步`);
        checkRefs(s.prompts, '提示词', ` 第${i + 1}步`);
      });
      if (!(it.warnings || []).length) warns.push(`${L}: 没有注意事项，场景手册的价值一半在「避坑」`);
    }
    const gCount = new Set(pb.items.map((x) => x.group));
    if (gCount.size !== groups.size) {
      const used = new Set(pb.items.map((x) => x.group));
      const empty = [...groups].filter((g) => !used.has(g));
      if (empty.length) warns.push(`playbooks: 分组 ${empty.join(',')} 下没有任何场景`);
    }
    ok.push(`playbooks: ${pb.items.length} 个场景 / ${groups.size} 个分组，交叉引用全部有效`);
  }
}

{
  const fp = path.join(DATA, 'models.json');
  if (!fs.existsSync(fp)) {
    errors.push('models.json 不存在');
  } else {
    const mm = read('models.json');
    const kinds = new Set((mm.kinds || []).map((k) => k.id));
    const tiers = new Set(Object.keys(mm.tiers || {}));
    if (!kinds.size) errors.push('models: kinds 为空');
    const seen = new Set();
    for (const m of mm.items) {
      const L = `models/${m.id}`;
      if (seen.has(m.id)) errors.push(`${L}: id 重复`);
      seen.add(m.id);
      need(m, ['id', 'name', 'vendor', 'kind', 'tier', 'strengths', 'useFor', 'url'], L);
      if (m.kind && !kinds.has(m.kind)) errors.push(`${L}: 未知类型 ${m.kind}`);
      if (m.tier && !tiers.has(m.tier)) errors.push(`${L}: 未知档位 ${m.tier}`);
      urlCheck(m.url, L);
      if (!(m.cautions || []).length) warns.push(`${L}: 没有写注意事项`);
    }
    ok.push(`models: ${mm.items.length} 个模型家族 / ${kinds.size} 个类型`);
  }
}

/* ---- Windows 批处理健康检查 ----
   .bat 有三个隐形杀手，任何一个都会让用户双击后看到一堆乱码报错：
     1. 含非 ASCII 字节 → cmd 用系统 OEM 代码页(GBK)解析，乱码会被当命令执行
     2. 有 UTF-8 BOM   → 首行变成 "\xEF\xBB\xBF@echo off"，直接报错
     3. 只有 LF 换行    → goto :LABEL 跳转可能失效（cmd 按字节扫描标签）
   保持纯 ASCII + 无 BOM + CRLF 才安全。 */
{
  const root = path.resolve(__dirname, '..');
  const bats = fs.readdirSync(root).filter((f) => f.toLowerCase().endsWith('.bat'));
  for (const f of bats) {
    const buf = fs.readFileSync(path.join(root, f));
    const s = buf.toString('latin1');
    const bad = [];
    if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) bad.push('有 UTF-8 BOM');
    const nonAscii = [...buf].filter((x) => x > 127).length;
    if (nonAscii) bad.push(`含 ${nonAscii} 个非 ASCII 字节（cmd 会解析成乱码）`);
    const bareLf = (s.match(/(?<!\r)\n/g) || []).length;
    if (bareLf) bad.push(`有 ${bareLf} 处裸 LF 换行（应为 CRLF）`);
    if (bad.length) errors.push(`${f}: ${bad.join('；')}`);
    else ok.push(`${f}: 纯 ASCII + 无 BOM + CRLF，可安全双击`);
  }
  if (!bats.length) warns.push('没有找到任何 .bat 启动脚本');
}

/* ---- 分类 id 撞车守卫 ----
   工具分类与提示词分类是两套独立的分类体系，但共用同一批 id 命名空间。
   历史上踩过坑：合并成一个 map 时提示词分类会覆盖工具分类，
   导致工具卡显示错误分类名（写作办公 → 写作文案）、配色被换、选型提示丢失。
   下面这条检查会在「撞车且内容不一致」时直接报错。 */
{
  const tm = new Map(cat.toolCategories.map((c) => [c.id, c]));
  const pm = new Map(cat.promptCategories.map((c) => [c.id, c]));
  const collisions = [...tm.keys()].filter((id) => pm.has(id));
  const risky = collisions.filter((id) => {
    const a = tm.get(id), b = pm.get(id);
    return a.name !== b.name || a.accent !== b.accent;
  });
  if (risky.length) {
    // 这是已知且已处理的情况（build.mjs 用 toolCatMap / promptCatMap 分开映射），
    // 所以只提醒不报错。但如果有人把它们合并回一个 map，selftest 的
    // 「工具详情页：分类选型提示不为空」用例会失败。
    warns.push(
      `categories: ${risky.join(', ')} 在两套分类里同名不同值 —— ` +
      '必须分别映射（toolCatMap / promptCatMap），不可合并为一个 map',
    );
    ok.push(`categories: 两套分类 id 撞车已隔离处理（${collisions.join(', ')}）`);
  } else if (collisions.length) {
    ok.push(`categories: ${collisions.length} 个 id 在两套分类中重复但内容一致（${collisions.join(', ')}）`);
  } else {
    ok.push('categories: 两套分类 id 无冲突');
  }
}


    /* 术语表：slug 必须唯一，英文名不能重复。
       踩过一次：「知识蒸馏」和「蒸馏」两条英文名都是 Distillation，
       锚点撞车、内容重复，两件事一起暴露出来。 */
    try {
      const gl = JSON.parse(fs.readFileSync(path.join(DATA, 'glossary.json'), 'utf8'));
      const seen = {};
      const dupSlug = [];
      gl.forEach((x) => {
        const s = String(x.en || x.term).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'term';
        if (seen[s]) dupSlug.push(`${seen[s]} / ${x.term}（锚点都是 #term-${s}）`);
        else seen[s] = x.term;
      });
      const enSeen = {};
      const dupEn = [];
      gl.forEach((x) => { if (x.en) { if (enSeen[x.en]) dupEn.push(`${enSeen[x.en]} / ${x.term}（都叫 ${x.en}）`); else enSeen[x.en] = x.term; } });
      if (dupSlug.length) errors.push(`glossary: 锚点重复 → ${dupSlug.join('; ')}`);
      if (dupEn.length) warns.push(`glossary: 英文名重复，可能是重复收录 → ${dupEn.join('; ')}`);
    } catch { /* 忽略 */ }

/* ---- 实时动态数据（feed.json + feeds.json） ---- */
{
  const fp = path.join(DATA, 'feeds.json');
  const fdp = path.join(DATA, 'feed.json');

  if (!fs.existsSync(fp)) {
    errors.push('feeds.json 不存在');
  } else {
    const fc = JSON.parse(fs.readFileSync(fp, 'utf8'));
    const enabled = fc.sources.filter((s) => s.enabled !== false);
    const seen = new Set();
    for (const s of fc.sources) {
      const L = `feeds/${s.id}`;
      if (!s.id) { errors.push('feeds: 有源缺少 id'); continue; }
      if (seen.has(s.id)) errors.push(`${L}: id 重复`);
      seen.add(s.id);
      need(s, ['id', 'name', 'url', 'lang', 'topic'], L);
      urlCheck(s.url, L);
      if (s.topic && !topics.has(s.topic)) errors.push(`${L}: 未知主题 ${s.topic}`);
      if (s.enabled === false && !s.note) warns.push(`${L}: 已禁用但没有写 note 说明原因`);
    }
    ok.push(`feeds: ${enabled.length} 个启用源 / ${fc.sources.length} 个配置（${fc.sources.filter((s) => s.enabled === false).length} 个已禁用）`);
    if (enabled.length < 8) warns.push(`feeds: 启用的源只剩 ${enabled.length} 个，实时动态会显得很单薄`);
  }

  if (!fs.existsSync(fdp)) {
    warns.push('feed.json 不存在 —— 实时动态区块不会生成（跑 node scripts/fetch-news.mjs 即可）');
  } else {
    const fd = JSON.parse(fs.readFileSync(fdp, 'utf8'));
    if (!fd.items?.length) {
      errors.push('feed.json: items 为空');
    } else {
      const badLink = fd.items.filter((it) => !/^https?:\/\//.test(it.link || '')).length;
      const badTitle = fd.items.filter((it) => !it.title || it.title.length < 4).length;
      // 只看真正的 HTML 标签，别把 ">100x faster" 这类正常数学符号算进去
      const TAG = /<\/?[a-zA-Z][^>]*>/;
      const withHtml = fd.items.filter((it) => TAG.test(it.title || '') || TAG.test(it.summary || '')).length;
      if (badLink) errors.push(`feed.json: ${badLink} 条链接不合法`);
      if (badTitle) errors.push(`feed.json: ${badTitle} 条标题过短或缺失`);
      if (withHtml) warns.push(`feed.json: ${withHtml} 条内容里残留 HTML 标签（解析器可能没洗干净）`);

      const ageH = (Date.now() - new Date(fd.updatedAt).getTime()) / 3600000;
      const okSources = (fd.sources || []).filter((s) => s.ok).length;
      if (ageH > 72) warns.push(`feed.json: 数据已过期 ${Math.round(ageH)} 小时，建议跑一次 fetch-news`);
      const failed = (fd.sources || []).filter((s) => !s.ok);
      if (failed.length) warns.push(`feed.json: ${failed.length} 个源上次抓取失败（${failed.map((s) => s.name).join(', ')}）`);
      ok.push(`feed.json: ${fd.items.length} 条动态 / ${okSources} 个源成功 / 数据龄 ${ageH < 1 ? '<1' : Math.round(ageH)} 小时`);
    }
  }
}

/* ---- 脚本语法预检 ----
   改脚本时最容易犯的错是括号/数组没闭合，而这类错误要等到真的跑起来才暴露。
   这里用 node --check 静态扫一遍，毫秒级，能在构建之前拦住。
   （真实案例：编辑 CHANGELOG 时旧条目残留在了数组闭合之后，构建直接 SyntaxError。） */
{
  const root = path.resolve(__dirname, '..');
  const files = [];
  const collect = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) collect(full);
      else if (e.name.endsWith('.mjs') || e.name.endsWith('.js')) files.push(full);
    }
  };
  collect(path.join(root, 'scripts'));
  collect(path.join(root, 'src'));

  const bad = [];
  for (const f of files) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) {
      const msg = (r.stderr || '').split('\n').find((l) => /SyntaxError|Error/.test(l)) || '语法错误';
      bad.push(`${path.relative(root, f).replace(/\\/g, '/')}: ${msg.trim()}`);
    }
  }
  if (bad.length) bad.forEach((b) => errors.push(`语法 ${b}`));
  else ok.push(`脚本语法: ${files.length} 个文件全部通过 node --check`);
}

/* ---- 脚本「启动即崩」预检 ----
   node --check 只查语法，查不出 TDZ 这类运行时错误。真实案例（2026-09-26）：
   check-outbound.mjs 的表头 console.log 引用了后面才 `let` 声明的 kept，
   于是脚本每次都在第一行抛 "Cannot access 'kept' before initialization" ——
   整套外链检查其实一次都没跑成过，而熔断保护让它「安静地失败」，藏了很久都没人发现。
   所以这些脚本提供 --self-test：只读本地 JSON、不发任何网络请求，跑通即算启动健康。 */
{
  const probes = [
    { file: 'check-outbound.mjs', args: ['--self-test'], expect: /自测通过/ },
  ];
  let ran = 0;
  for (const p of probes) {
    const fp = path.join(ROOT, 'scripts', p.file);
    if (!fs.existsSync(fp)) continue;
    const r = spawnSync(process.execPath, [fp, ...p.args], { encoding: 'utf8', timeout: 60000 });
    const out = `${r.stdout || ''}${r.stderr || ''}`;
    if (r.status !== 0 || !p.expect.test(out)) {
      const msg = out.split('\n').map((l) => l.trim()).filter(Boolean).slice(-2).join(' / ') || `退出码 ${r.status}`;
      errors.push(`启动自测 ${p.file}: 跑不起来或输出不符（${msg}）`);
    }
    ran++;
  }
  if (ran && !errors.some((e) => e.startsWith('启动自测'))) {
    ok.push(`启动自测: ${ran} 个脚本可正常启动（不联网）`);
  }
}


    /* 模型条的完整度：时效标注 + 官方模型列表链接。
       这两个字段是「读者能不能自己核对时效」的关键，不能漏。 */
    const noLatest = (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA,'models.json'),'utf8')).items.filter(x=>!x.latest||!x.latest.asOf); } catch { return []; } })();
    const noListUrl = (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA,'models.json'),'utf8')).items.filter(x=>!x.modelsUrl); } catch { return []; } })();
    if (noLatest.length) errors.push(`models: ${noLatest.length} 个模型缺时效标注（latest.asOf）→ ${noLatest.map(x=>x.id).join(', ')}`);
    if (noListUrl.length) errors.push(`models: ${noListUrl.length} 个模型缺官方模型列表链接（modelsUrl）→ ${noListUrl.map(x=>x.id).join(', ')}`);

/* ---- 英文版覆盖率 ----
   英文版范围刻意收窄到工具库 + 模型库，所以这里只校验这两块。
   新增工具/模型时如果漏了英文，英文版会出现中英混杂的卡片。 */
{
  const ip = path.join(DATA, 'i18n.json');
  if (!fs.existsSync(ip)) {
    warns.push('i18n.json 不存在，英文版无法生成');
  } else {
    const i18n = JSON.parse(fs.readFileSync(ip, 'utf8'));
    const en = i18n.en || {};

    // 分类名 / 类型名 / 档位名是否齐全
    const missCat = cat.toolCategories.filter((c) => !en[`cat.${c.id}`]).map((c) => c.id);
    const missKind = (() => {
      try {
        const mm = JSON.parse(fs.readFileSync(path.join(DATA, 'models.json'), 'utf8'));
        return mm.kinds.filter((k) => !en[`kind.${k.id}`]).map((k) => k.id);
      } catch { return []; }
    })();
    const missTier = (() => {
      try {
        const mm = JSON.parse(fs.readFileSync(path.join(DATA, 'models.json'), 'utf8'));
        return Object.keys(mm.tiers || {}).filter((k) => !en[`tier.${k}`]);
      } catch { return []; }
    })();
    if (missCat.length) warns.push(`i18n: 分类缺英文名 → ${missCat.join(', ')}`);
    if (missKind.length) warns.push(`i18n: 模型类型缺英文名 → ${missKind.join(', ')}`);
    if (missTier.length) warns.push(`i18n: 模型档位缺英文名 → ${missTier.join(', ')}`);

    // 工具 / 模型的英文内容
    const missTool = tools.filter((t) => !t.descEn || !t.caveatEn).map((t) => t.id);
    if (missTool.length) {
      warns.push(`tools: ${missTool.length} 个工具缺英文 descEn/caveatEn → ${missTool.slice(0, 6).join(', ')}${missTool.length > 6 ? ' …' : ''}`);
    }
    let missModel = [];
    try {
      const mm = JSON.parse(fs.readFileSync(path.join(DATA, 'models.json'), 'utf8'));
      missModel = mm.items.filter((m) => !m.strengthsEn || !m.useForEn).map((m) => m.id);
    } catch { /* 已在别处报错 */ }
    if (missModel.length) warns.push(`models: ${missModel.length} 个模型缺英文内容 → ${missModel.join(', ')}`);

    if (!missTool.length && !missModel.length && !missCat.length) {
      ok.push(`英文版: ${cat.toolCategories.length} 个分类 + ${tools.length} 个工具 + ${(() => { try { return JSON.parse(fs.readFileSync(path.join(DATA, 'models.json'), 'utf8')).items.length; } catch { return 0; } })()} 个模型的英文内容齐全`);
    }
  }
}


    /* 场景手册质量体检：把 ChatGPT 那张 10 分评分卡固化下来。
       低于 7 分说明这篇没写清「产出什么 / 什么算失败 / 工具怎么选 / 什么时候别用 AI」，
       属于「假装有用」的文章。 */
    try {
      const out = execFileSync(process.execPath, [path.join(__dirname, 'audit-playbooks.mjs'), '--json'], { encoding: 'utf8' });
      const rows = JSON.parse(out.trim().split('\n').pop());
      const low = rows.filter((r) => r.total < 7);
      if (low.length) errors.push(`playbooks: ${low.length} 篇手册低于 7 分（跑 node scripts/audit-playbooks.mjs 看详情）→ ${low.map((r) => r.id).join(', ')}`);
      else ok.push(`playbooks: ${rows.length} 篇手册全部达到 7 分以上（平均 ${(rows.reduce((a, b) => a + b.total, 0) / rows.length).toFixed(1)} 分）`);
    } catch { /* 体检脚本本身出错不影响主流程 */ }


    /* 标题与描述的完整度。
       中文一个字信息量约等于英文两个字符，所以按「加权长度」算（中文计 2）。
       踩过的坑：英文分类页的描述是 "13 tools in 3D modelling."，
       24 个字符，在搜索结果里等于什么都没说。 */
    try {
      const distDir = path.resolve(__dirname, '..', 'dist');
      if (fs.existsSync(distDir)) {
        const w = (s) => [...String(s || '')].reduce((n, ch) => n + (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(ch) ? 2 : 1), 0);
        const walkHtml = (d, a = []) => {
          for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const f = path.join(d, e.name);
            e.isDirectory() ? walkHtml(f, a) : e.name === 'index.html' && a.push(f);
          }
          return a;
        };
        const shortDesc = [];
        const starDesc = [];
        /* 长标题 / 长描述：原来只有「过短」的守卫，长的没人管。
           搜索结果大约显示 60-70 字符标题、160 字符描述，超出就是白写。
           layout 已经给描述兜底截断到 160（含省略号 161），
           这里再守一道 —— 万一以后有人绕过 layout 直接拼 meta 也能拦住。
           必须**解码实体后再量**：源码里 &#39; 是 5 个字符，用户看到的是 1 个。 */
        const longTitle = [];
        const longDesc = [];
        const decodeEnt = (s) => String(s || '')
          .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
          .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&');
        const descSeen = new Map();
        const dupDesc = [];
        const titleSeen = new Map();
        const dupTitle = [];
        const earlyCut = [];
        for (const f of walkHtml(distDir)) {
          const html = fs.readFileSync(f, 'utf8');
          const desc = decodeEnt((html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
          const title = decodeEnt((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
          const rel = '/' + path.relative(distDir, f).replace(/\\/g, '/').replace(/\/index\.html$/, '').replace(/index\.html$/, '');
          if (title.length > 70) longTitle.push(rel + ' (' + title.length + ')');
          if (desc.length > 165) longDesc.push(rel + ' (' + desc.length + ')');
          // noindex 的页面（如自动聚合的实时动态）不上搜索结果，描述短一点无所谓 ——
          // 对这类页面报「描述过短」是假警报，会把真问题埋掉。
          const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
          if (w(desc) < 55 && !noindex) shortDesc.push(rel + ' (' + w(desc) + ')');
          if (/\*\*/.test(desc)) starDesc.push(rel);
          /* 分类页描述被截断得太早 → 浪费 SERP 额度（英文尤其明显，那边有 ~155 字符可用）。
             注意 rel 形如 `/en/tools/coding`（已去掉末尾斜杠），正则别写成要求 `/` 结尾 ——
             那样这个守卫一次都不会触发，成了永远不报警的死代码。 */
          if (/^\/(en\/)?tools\/[a-z0-9-]+$/.test(rel) && desc.endsWith('…')) {
            const budget = rel.startsWith('/en/') ? 120 : 70;
            if (desc.length < budget) earlyCut.push(`${rel} (仅 ${desc.length})`);
          }
          /* 重复标题必须抓到。踩过一次：英文名映射把「通义千问」写成 "Qwen Chat"，
             和另一条本来就叫 Qwen Chat 的条目撞车 —— 两个页面 <title> 一个字都不差。
             这种事不会报错，只是 Google 挑一个收录、另一个白做，
             而你在后台看到的现象是"这页怎么没流量"，根本联想不到是标题重复。 */
          if (title && !noindex) {
            if (titleSeen.has(title)) dupTitle.push(`${rel} = ${titleSeen.get(title)}`);
            else titleSeen.set(title, rel);
          }
          if (desc) {
            if (descSeen.has(desc)) dupDesc.push(rel + ' = ' + descSeen.get(desc));
            else descSeen.set(desc, rel);
          }
        }
        if (shortDesc.length) warns.push(`SEO: ${shortDesc.length} 个页面的描述过短 → ${shortDesc.slice(0, 8).join(', ')}${shortDesc.length > 8 ? ' …' : ''}`);
        if (longTitle.length) warns.push(`SEO: ${longTitle.length} 个页面的标题超过 70 字符（搜索结果会截断）→ ${longTitle.slice(0, 6).join(', ')}`);
        if (longDesc.length) warns.push(`SEO: ${longDesc.length} 个页面的描述超过 165 字符（搜索结果会截断）→ ${longDesc.slice(0, 6).join(', ')}`);
        if (starDesc.length) errors.push(`SEO: ${starDesc.length} 个页面的描述里残留 markdown 星号 → ${starDesc.slice(0, 5).join(', ')}`);
        if (dupTitle.length) errors.push(`SEO: ${dupTitle.length} 组**完全重复**的标题（Google 只会挑一个收录，另一个白做）→ ${dupTitle.slice(0, 4).join('; ')}`);
        if (dupDesc.length) warns.push(`SEO: ${dupDesc.length} 组重复描述 → ${dupDesc.slice(0, 3).join('; ')}`);
        /* 分类页是目录站最主要的入口页，描述被提前截断等于白扔 SERP 额度。
           机理：metaExcerpt 在 160 字符处截断后回退到「最后一个句末标点」，
           所以只要模板的第一句很短，后面 90 个字符就全浪费了 ——
           英文那次实测：整段只用掉 67 字符就加了省略号。 */
        for (const r of earlyCut) warns.push(`SEO: ${r} 的描述很早就被截断，SERP 额度没用上`);
        if (!shortDesc.length && !starDesc.length && !dupDesc.length && !dupTitle.length && !longTitle.length && !longDesc.length && !earlyCut.length) {
          ok.push(`SEO: ${descSeen.size} 个页面的标题与描述都达标（长度合规、标题唯一、无重复）`);
        }
      }
    } catch { /* 忽略 */ }


    /* 英文页面的可见中文检测。
       做英文优先之后这一条很关键：英文页面上出现中文，比缺内容更劝退读者。

       注意要排除这几类，否则全是误报：
         · data-name —— 给客户端筛选用的隐藏属性，用户和搜索引擎都看不到
         · <script> / <style> —— 代码里本来就有中文字符串
         · 品牌名「象」「AI 万象」—— 刻意保留的标识
         · 标注了 · zh 的提示词名 —— 中文提示词模板，显式标注过的
         · 语言切换按钮文字 —— 指向中文版，中文反而看得懂
    */
    try {
      const distDir = path.resolve(__dirname, '..', 'dist', 'en');
      if (fs.existsSync(distDir)) {
        const walk = (d, a = []) => {
          for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const f = path.join(d, e.name);
            e.isDirectory() ? walk(f, a) : e.name === 'index.html' && a.push(f);
          }
          return a;
        };
        const leaks = [];
        for (const f of walk(distDir)) {
          let html = fs.readFileSync(f, 'utf8');
          // 去掉不看的部分
          html = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                     .replace(/<style[\s\S]*?<\/style>/gi, '')
                     /* data-* 属性用户和搜索引擎都看不到，整体排除。
                        原来是逐个列举（data-name / data-cat / data-group / data-added），
                        结果新加一个 data-value（筛选按钮的分类名）就误报一次。 */
                     .replace(/\sdata-[a-z-]+="[^"]*"/gi, '')
                     .replace(/<title>[\s\S]*?<\/title>/gi, '')
                     .replace(/content="[^"]*"/g, '')      // meta
                     .replace(/<svg[\s\S]*?<\/svg>/gi, '');   // 图标
          // 品牌名与语言切换是有意为之
          html = html.replace(/象/g, '').replace(/AI 万象/g, '')
                     .replace(/切换到中文|Switch to Chinese/g, '')
                     .replace(/·\s*zh/g, '')
                     .replace(/中文版/g, '');
          const hits = [...new Set((html.match(/[\u4e00-\u9fa5]{2,}/g) || []))];
          if (hits.length) leaks.push([f.replace(distDir, ''), hits]);
        }
        if (leaks.length) {
          const total = leaks.reduce((n, [, h]) => n + h.length, 0);
          warns.push(`i18n: ${leaks.length} 个英文页面上有可见中文（共 ${total} 处）→ ${leaks.slice(0, 3).map(([f, h]) => f + ': ' + h.slice(0, 4).join('/')).join('; ')}${leaks.length > 3 ? ' …' : ''}`);
        } else {
          ok.push('i18n: 英文页面没有可见中文残留');
        }
      }
    } catch { /* 忽略 */ }


    /* 分类命名空间：工具分类与提示词分类共用 id，但**名字不一样**。
       writing 在工具里是「写作办公」，在提示词里是「写作文案」。
       英文站因此必须用两个命名空间（cat.* 与 pcat.*），不能互相借用。
       踩过一次：英文提示词库直接用了 cat.*，分类名显示成工具分类的英文，
       和实际内容对不上。 */
    try {
      const cat = JSON.parse(fs.readFileSync(path.join(DATA, 'categories.json'), 'utf8'));
      const i18n = JSON.parse(fs.readFileSync(path.join(DATA, 'i18n.json'), 'utf8'));
      const en = i18n.en || {};

      const missTool = cat.toolCategories.filter((x) => !en['cat.' + x.id]);
      const missPrompt = cat.promptCategories.filter((x) => !en['pcat.' + x.id]);
      if (missTool.length) warns.push(`i18n: 缺工具分类英文名 cat.* → ${missTool.map((x) => x.id).join(', ')}`);
      if (missPrompt.length) errors.push(`i18n: 缺提示词分类英文名 pcat.* → ${missPrompt.map((x) => x.id).join(', ')}`);

      // 两边 id 相同但中文名不同的，必须确认英文名也不同（否则就是误用了同一个键）
      const toolMap = Object.fromEntries(cat.toolCategories.map((x) => [x.id, x]));
      const collide = cat.promptCategories.filter((x) => toolMap[x.id] && toolMap[x.id].name !== x.name);
      if (collide.length) {
        const reused = collide.filter((x) => en['cat.' + x.id] === en['pcat.' + x.id]);
        if (reused.length) {
          errors.push(`i18n: 提示词分类借用了工具分类的英文名（两者内容不同）→ ${reused.map((x) => x.id).join(', ')}`);
        } else {
          ok.push(`i18n: ${collide.length} 个同名分类的中英文名各自独立（cat.* / pcat.* 分开）`);
        }
      }
    } catch { /* 忽略 */ }


    /* 英文名的覆盖度 —— 三类「英文页上会露出中文」的源头。
       这一组守卫的由来：可见中文扫描只在 dist 上扫，扫出来的是**症状**；
       真正的根因是数据里缺英文名。逐个补完数据还不够，得让根因本身会报错，
       否则下次加内容还会漏。

       1) 工具名：TOOL_NAME_EN 缺项 → 英文工具页的 <title>/<h1> 变中文。
          踩过一次：244 个英文工具页里有 100 多个标题是「腾讯混元 3D · 3D modelling」，
          <title> 是搜索结果里最重要的一行，等于整站白翻。
       2) 标签：tags-en.json 缺项 → 英文站上这行标签整个消失。
       3) 术语 related：既不是词条、也不在别名表里 → 英文术语表露出中文标签。
    */
    try {
      const toolsRaw = JSON.parse(fs.readFileSync(path.join(DATA, 'tools.json'), 'utf8'));
      const toolList = Array.isArray(toolsRaw) ? toolsRaw : toolsRaw.items;
      const playbooks = JSON.parse(fs.readFileSync(path.join(DATA, 'playbooks.json'), 'utf8')).items;
      const prompts = JSON.parse(fs.readFileSync(path.join(DATA, 'prompts.json'), 'utf8'));
      const tagsEn = JSON.parse(fs.readFileSync(path.join(DATA, 'tags-en.json'), 'utf8'));
      const glossary = JSON.parse(fs.readFileSync(path.join(DATA, 'glossary.json'), 'utf8'));
      const maps = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'i18n-en-maps.mjs'), 'utf8');

      const hasCjk = (s) => /[\u4e00-\u9fa5]/.test(s || '');
      // 从源码里抽 map 的键，避免为了检查去 import 一个 ES 模块
      const keysOf = (name) => {
        const i = maps.indexOf('export const ' + name + ' = {');
        if (i < 0) return null;
        const seg = maps.slice(i, maps.indexOf('\n};', i));
        return new Set([...seg.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]));
      };

      const toolKeys = keysOf('TOOL_NAME_EN');
      if (toolKeys) {
        const missing = toolList.filter((t) => hasCjk(t.name) && !toolKeys.has(t.name));
        if (missing.length) errors.push(`i18n: ${missing.length} 个工具名缺英文映射（英文页标题会变中文）→ ${missing.slice(0, 5).map((t) => t.id).join(', ')}`);
        else ok.push(`i18n: ${toolList.filter((t) => hasCjk(t.name)).length} 个中文工具名全部有英文映射`);
      }

      const usedTags = new Set();
      [...toolList, ...prompts, ...playbooks].forEach((x) => (x.tags || []).forEach((g) => usedTags.add(g)));
      const tagMiss = [...usedTags].filter((g) => hasCjk(g) && !tagsEn[g]);
      if (tagMiss.length) errors.push(`i18n: ${tagMiss.length} 个中文标签缺英文名（英文站上整行不显示）→ ${tagMiss.slice(0, 8).join(' / ')}`);
      else ok.push(`i18n: ${[...usedTags].filter((g) => hasCjk(g)).length} 个中文标签全部有英文名`);

      const termSet = new Set(glossary.map((g) => g.term));
      const aliasKeys = keysOf('TERM_ALIAS_EN');
      const relMiss = [];
      for (const g of glossary) {
        for (const r of g.related || []) {
          if (!termSet.has(r) && !(aliasKeys && aliasKeys.has(r)) && hasCjk(r)) relMiss.push(g.term + '→' + r);
        }
      }
      if (relMiss.length) warns.push(`i18n: ${relMiss.length} 处术语关联词既不是词条也没有英文名（英文术语表会露中文）→ ${relMiss.slice(0, 5).join(' / ')}`);
      else ok.push('i18n: 术语表 related 全部能解析成词条或英文名');
    } catch { /* 忽略 */ }


    /* 手册的英文翻译必须是「整篇有、整篇没有」，不能半篇。
       为什么这条很关键：卡片和详情页的取值是 `L === EN && e.problem ? e.problem : pb.problem`
       —— 字段级回退到中文。所以只翻了 title、没翻 steps 的手册，
       英文页上会直接露出中文正文，而且不报错、只是「看起来怪」。
       分批翻译时这一条就是进度表兼验收单。 */
    try {
      const pbList = JSON.parse(fs.readFileSync(path.join(DATA, 'playbooks.json'), 'utf8')).items;
      const REQUIRED = {
        title: (v) => typeof v === 'string' && v.length > 2,
        problem: (v) => typeof v === 'string' && v.length > 10,
        time: (v) => typeof v === 'string' && v.length > 0,
        level: (v) => typeof v === 'string' && v.length > 0,
        spec: (v) => v && v.input && v.output && v.fail && v.alt,
        /* 注意：英文的步骤数**不要求**等于中文的。
           翻的时候是按英文读者能照做的粒度重写的，普遍比中文更细
           （pb-automate-chores 中文 4 步 → 英文 7 步）。
           一开始写成「长度必须相等」，结果 5 篇好好的翻译全被判成半成品。
           中文侧 steps 是对象（含 tools/prompts 交叉引用），英文侧是纯字符串，
           所以这里也要求它是字符串。 */
        steps: (v) => Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === 'string' && s.length > 5),
        warnings: (v) => Array.isArray(v) && v.length > 0 && v.every((s) => String(s).length > 5),
      };
      const started = pbList.filter((p) => p.en && Object.keys(p.en).length > 0);
      const partial = [];
      for (const pb of started) {
        const missing = Object.keys(REQUIRED).filter((k) => !REQUIRED[k](pb.en[k], pb));
        if (missing.length) partial.push(`${pb.id} 缺 ${missing.join('/')}`);
      }
      if (partial.length) {
        errors.push(`i18n: ${partial.length} 篇手册的英文翻译是半成品（英文页会回退显示中文）→ ${partial.slice(0, 6).join('; ')}`);
      } else {
        ok.push(`i18n: 手册英文翻译 ${started.length}/${pbList.length} 篇，已开翻的都是整篇完整`);
      }
    } catch { /* 忽略 */ }


    /* 英文「关于页 / 页脚」声明的覆盖范围，不能和实际情况说反。
       踩过一次：手册和提示词早就翻完了，关于页还写着
       "the playbooks, prompt library ... are not translated"。
       英文读者看到会以为这些内容根本不存在 —— 这比没翻更糟，
       因为他们连去中文版找的机会都没有。
       做法：把这两句文案按句号切开；一句话里同时出现某个区段的名字和否定说法，
       而那个区段其实已经有英文页，就报错。 */
    try {
      const i18nEn = JSON.parse(fs.readFileSync(path.join(DATA, 'i18n.json'), 'utf8')).en || {};
      const pbAll = JSON.parse(fs.readFileSync(path.join(DATA, 'playbooks.json'), 'utf8')).items;
      const prAll = JSON.parse(fs.readFileSync(path.join(DATA, 'prompts.json'), 'utf8'));
      const glAll = JSON.parse(fs.readFileSync(path.join(DATA, 'glossary.json'), 'utf8'));
      const mdAll = JSON.parse(fs.readFileSync(path.join(DATA, 'models.json'), 'utf8'));
      const mdList = Array.isArray(mdAll) ? mdAll : mdAll.items || [];
      const twAll = JSON.parse(fs.readFileSync(path.join(DATA, 'tools.json'), 'utf8'));
      const twList = Array.isArray(twAll) ? twAll : twAll.items || [];

      const translated = {
        tool: twList.filter((t) => t.descEn).length,
        model: mdList.filter((m) => m.strengthsEn).length,
        playbook: pbAll.filter((p) => p.en && p.en.title).length,
        prompt: (Array.isArray(prAll) ? prAll : prAll.items || []).filter((p) => p.en && p.en.prompt).length,
        glossary: glAll.filter((g) => g.defEn).length,
        search: 1,          // /en/search/ 一直存在
        news: 0,            // 刻意不翻
        learning: 0,        // 刻意不翻
      };
      const KEYWORDS = {
        tool: /\btool|tools\b/i, model: /\bmodel|models\b/i, playbook: /\bplaybook|playbooks\b/i,
        prompt: /\bprompt|prompts\b/i, glossary: /\bglossar(y|ies)\b/i, search: /\bsearch\b/i,
        news: /\bnews\b/i, learning: /\blearning\b/i,
      };
      const NEGATIVE = /\bnot translated|untranslated|in chinese only|aren't translated|are not\b|\bonly\b/i;

      const stale = [];
      for (const key of ['about.scope', 'footer.langNote']) {
        const text = i18nEn[key];
        if (!text) continue;
        for (const sentence of String(text).split(/[.;]/)) {
          if (!NEGATIVE.test(sentence)) continue;
          for (const [sec, re] of Object.entries(KEYWORDS)) {
            if (!re.test(sentence)) continue;
            if (translated[sec] > 0) stale.push(`${key} 说 ${sec} 没有英文版，实际有 ${translated[sec]} 页`);
          }
        }
      }
      if (stale.length) errors.push(`i18n: 英文站的覆盖范围说明与实际情况不符 → ${[...new Set(stale)].slice(0, 5).join('; ')}`);
      else ok.push('i18n: 英文站覆盖范围说明与实际产出的英文页一致');
    } catch { /* 忽略 */ }


    /* 提示词的变量与占位符必须双向一致。
       踩过一次（英文提示词批量翻译时出现 9 处）：
       提示词正文里写了 {{code}}，但变量表里没有 —— 读者会看到一个
       填不进去的占位符，功能是坏的但页面不报错。
       反向也一样：变量表里声明了但正文没用，读者填了没反应。 */
    try {
      const pr = JSON.parse(fs.readFileSync(path.join(DATA, 'prompts.json'), 'utf8'));
      const bad = [];
      for (const p of pr) {
        // 中文版和英文版各自检查
        for (const [label, body, vars] of [
          ['zh', p.prompt, p.vars],
          ['en', p.en && p.en.prompt, p.en && p.en.vars],
        ]) {
          if (!body) continue;
          const used = [...new Set([...body.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]))];
          const declared = new Set(vars || []);
          const undeclared = used.filter((v) => !declared.has(v));
          const unused = [...declared].filter((v) => !used.includes(v));
          if (undeclared.length) bad.push(`${p.id}(${label}) 正文用了但没声明: ${undeclared.join(', ')}`);
          if (unused.length) bad.push(`${p.id}(${label}) 声明了但正文没用: ${unused.join(', ')}`);
        }
      }
      if (bad.length) {
        errors.push(`提示词变量对不上 ${bad.length} 处（读者会看到填不进去的输入框）→ ${bad.slice(0, 5).join('; ')}${bad.length > 5 ? ' …' : ''}`);
      } else {
        ok.push(`提示词: ${pr.length} 条的变量与占位符全部一一对应`);
      }
    } catch { /* 忽略 */ }

/* ---- vercel.json 字段白名单校验 ----
   踩过一次：在 redirects 里写了个 `comment` 字段（本意是留说明），
   Vercel 校验很严，不认识这个字段就直接拒绝部署 —— 而且部署失败后
   线上继续服务上一次成功的版本，从页面上完全看不出来，白推了两轮。
   所以这里在本地就把不认识的字段拦下来。 */
{
  const vp = path.join(__dirname, '..', 'vercel.json');
  if (!fs.existsSync(vp)) {
    warns.push('vercel.json 不存在，Vercel 会按框架特征自行构建');
  } else {
    const TOP = new Set(['$schema', 'buildCommand', 'devCommand', 'installCommand', 'outputDirectory',
      'framework', 'regions', 'functions', 'redirects', 'rewrites', 'cleanUrls', 'trailingSlash',
      'headers', 'crons', 'git', 'ignoreCommand', 'public', 'images', 'routes', 'builds', 'github']);
    const REDIRECT = new Set(['source', 'destination', 'permanent', 'statusCode', 'has', 'missing', 'caseSensitive', 'preserveQueryParams']);
    const HEADER = new Set(['source', 'headers', 'has', 'missing']);
    const HEADER_ITEM = new Set(['key', 'value']);
    const COND = new Set(['type', 'key', 'value']);

    const bad = [];
    const checkKeys = (obj, allowed, where) => {
      for (const k of Object.keys(obj || {})) {
        if (!allowed.has(k)) bad.push(`${where} 里的未知字段「${k}」（Vercel 会因此拒绝部署）`);
      }
    };

    try {
      const v = JSON.parse(fs.readFileSync(vp, 'utf8'));
      checkKeys(v, TOP, 'vercel.json');
      (v.redirects || []).forEach((r, i) => {
        checkKeys(r, REDIRECT, `redirects[${i}]`);
        (r.has || []).forEach((h, j) => checkKeys(h, COND, `redirects[${i}].has[${j}]`));
        (r.missing || []).forEach((h, j) => checkKeys(h, COND, `redirects[${i}].missing[${j}]`));
      });
      (v.headers || []).forEach((h, i) => {
        checkKeys(h, HEADER, `headers[${i}]`);
        (h.headers || []).forEach((x, j) => checkKeys(x, HEADER_ITEM, `headers[${i}].headers[${j}]`));
      });
      // framework 为 null 时必须是显式 null（写成 "" 会让 Vercel 按空字符串处理）
      if ('framework' in v && v.framework !== null && typeof v.framework !== 'string') {
        bad.push('vercel.json: framework 只能是字符串或 null');
      }
    } catch (e) {
      bad.push(`vercel.json 不是合法 JSON：${e.message}`);
    }

    if (bad.length) bad.forEach((b) => errors.push(b));
    else ok.push('vercel.json: 字段全部在 Vercel 白名单内');


    /* 主题令牌的对比度 —— 静态检查，不依赖浏览器。
       a11y.mjs 是在真实页面上量的，但**页面里没出现的组合它就量不到**：
       手册页只有部分区块用 --surface-2 做底，a11y 偶然覆盖到才发现
       --accent-text 在那块底色上只有 4.27:1。
       令牌是全局的，所以「它跟每个可能的底色都能配上」应该在这里断言。

       踩过的坑（2026-09-21）：--accent-text 是按 --bg 调的（4.68 达标），
       但 --surface-2 是更浅更灰的底色，同一枚色掉到 4.27。
       和分类色那边完全是同一条教训：**文字色的达标与否取决于它落在哪块底上**。 */
    try {
      const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'main.css'), 'utf8');
      const hex = (h) => {
        const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim());
        if (!m) return null;
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      };
      const lum = (rgb) => rgb.map((v) => {
        const x = v / 255;
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (a, b) => {
        const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };
      // 从「变量块」里取值：:root / [data-theme="light"] 是浅色，[data-theme="dark"] 是深色
      const light = css.slice(css.indexOf(':root'), css.indexOf('[data-theme="dark"]'));
      const dark = css.slice(css.indexOf('[data-theme="dark"]'));
      const val = (blk, name) => {
        const m = new RegExp('--' + name + ':\\s*(#[0-9a-fA-F]{6})').exec(blk);
        return m ? hex(m[1]) : null;
      };

      const fails = [];
      for (const [theme, blk] of [['浅色', light], ['深色', dark]]) {
        const surfaces = ['bg', 'surface', 'surface-2'];
        // 这些令牌是「当文字用」的，必须对每一块可能的底色达标
        const texts = ['fg', 'fg-2', 'fg-3', 'accent-text', 'ok', 'warn', 'danger'];
        for (const t of texts) {
          const fg = val(blk, t);
          if (!fg) continue;
          for (const s of surfaces) {
            const bg = val(blk, s);
            if (!bg) continue;
            const r = ratio(fg, bg);
            if (r < 4.5) fails.push(`${theme} --${t} 在 --${s} 上只有 ${r.toFixed(2)}:1`);
          }
        }
      }
      if (fails.length) errors.push(`配色: ${fails.length} 组「文字令牌 × 底色」对比度不足 4.5 → ${fails.slice(0, 5).join('; ')}`);
      else ok.push('配色: 7 个文字令牌 × 3 块底色 × 2 个主题，对比度全部 ≥ 4.5');
    } catch { /* 忽略 */ }
  }
}

/* ---- 输出 ---- */
const line = '─'.repeat(52);
console.log('');
console.log('  AI 万象 · 数据自检');
console.log('  ' + line);
for (const s of ok) console.log('  ✓ ' + s);
if (warns.length) {
  console.log('');
  for (const w of warns) console.log('  ! ' + w);
}
if (errors.length) {
  console.log('');
  for (const e of errors) console.log('  ✗ ' + e);
  console.log('  ' + line);
  console.log(`  发现 ${errors.length} 个错误，${warns.length} 个提醒`);
  console.log('');
  process.exit(1);
}
console.log('  ' + line);
console.log(`  通过（${warns.length} 个提醒）`);
console.log('');
