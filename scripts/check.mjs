/**
 * 数据与配置校验（零依赖，不需要构建，不需要浏览器）
 *
 *   node scripts/check.mjs
 *
 * 检查 data/ 下的每个文件能否自洽：id 唯一、引用能解析、字段齐全、数值在合理范围。
 * 越早发现越好：这里的每一条错误，如果漏过去，要么让构建在半路崩掉，
 * 要么更糟 —— 构建成功、页面上线了，但某个页面是空的或数字是错的。
 *
 * 另外守住三类「本地看着正常、线上才出问题」的东西：
 *   · Windows 批处理必须纯 ASCII + 无 BOM + CRLF
 *   · vercel.json 只能含 Vercel 认识的字段（不认识就拒绝部署，而线上仍是旧版本）
 *   · 旧地址跳转规则必须覆盖全部旧地址、且不误伤新地址
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hasIcon } from '../src/lib/icons.mjs';
import { S } from '../src/lib/strings.mjs';
import { verify as verifyRedirects } from './redirects.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const errors = [];
const ok = [];
const bad = (msg) => errors.push(msg);
const good = (msg) => ok.push(msg);
const read = (rel) => JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8'));

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const NEED = (obj, fields, label) => {
  for (const f of fields) if (obj[f] === undefined || obj[f] === '' || obj[f] === null) bad(`${label}: 缺少字段 "${f}"`);
};
const unique = (list, label) => {
  const seen = new Set();
  for (const id of list) {
    if (seen.has(id)) bad(`${label}: id 重复 "${id}"`);
    seen.add(id);
  }
};
const desc = (text, label) => {
  if (typeof text !== 'string' || text.length < 50 || text.length > 160) bad(`${label}: metaDescription 应为 50-160 字符，现在 ${text ? text.length : 0}`);
};
const date = (d, label) => {
  if (d !== undefined && !ISO_DATE.test(d)) bad(`${label}: 日期应为 YYYY-MM-DD，现在是 "${d}"`);
  if (d && d > new Date().toISOString().slice(0, 10)) bad(`${label}: 日期 ${d} 在未来`);
};

/* ---------------- site.config.json ---------------- */
const site = read('site.config.json');
NEED(site.brand, ['name', 'tagline', 'description', 'logoText'], 'site.config.json brand');
NEED(site, ['baseUrl', 'locale', 'nav', 'footer'], 'site.config.json');
if (!/^https:\/\/[a-z0-9.-]+$/i.test(site.baseUrl || '')) bad(`site.config.json: baseUrl 应形如 https://www.example.com，现在是 "${site.baseUrl}"`);
if (site.baseUrl && site.baseUrl.replace('https://', '') !== site.domain) bad('site.config.json: baseUrl 与 domain 不一致');
for (const [i, n] of (site.nav || []).entries()) if (!/^\/[a-z0-9/-]*\/$/.test(n.href || '')) bad(`site.config.json: nav[${i}] 的 href "${n.href}" 不是站内路径`);
for (const [i, l] of (site.footer?.links || []).entries()) if (!/^\/[a-z0-9/-]*\/$/.test(l.href || '')) bad(`site.config.json: footer.links[${i}] 的 href "${l.href}" 不是站内路径`);
if (site.repoUrl && /^https:\/\/github\.com\//.test(site.repoUrl) === false) bad('site.config.json: repoUrl 应是 GitHub 地址');
for (const k of ['google', 'bing']) if (site.verify?.[k] && !/^[A-Za-z0-9_-]{20,}$/.test(site.verify[k])) bad(`site.config.json: verify.${k} 的格式不对`);
if (!errors.length) good(`site.config.json: ${site.brand.name} · ${site.baseUrl}`);

/* ---------------- games ---------------- */
const games = read('games.json');
unique(games.map((g) => g.id), 'games.json');
for (const g of games) {
  const label = `games.json ${g.id}`;
  if (!ID_RE.test(g.id)) bad(`${label}: id 只能用小写字母、数字和连字符`);
  NEED(g, ['name', 'metaTitle', 'tagline', 'short', 'path', 'cover', 'metaDescription'], label);
  if (g.path !== `/games/${g.id}/`) bad(`${label}: path 应为 "/games/${g.id}/"`);
  desc(g.metaDescription, label);
  date(g.updated, label);
  if (!fs.existsSync(path.join(ROOT, 'public', g.path.replace(/^\//, ''), 'cover.svg'))) bad(`${label}: 缺封面 public${g.path}cover.svg`);
  for (const dir of ['logic', 'view', 'main']) if (!fs.existsSync(path.join(ROOT, 'src', 'game', g.id, `${dir}.js`))) bad(`${label}: 缺 src/game/${g.id}/${dir}.js`);
  if (!fs.existsSync(path.join(ROOT, 'src', 'game', g.id, 'logic.test.js'))) bad(`${label}: 缺 logic.test.js`);
  for (const key of ['tips', 'faq', 'intro']) if (!Array.isArray(g[key]) || !g[key].length) bad(`${label}: ${key} 不能为空`);
  if (!g.howto || !Array.isArray(g.howto.steps) || !g.howto.steps.length) bad(`${label}: howto.steps 不能为空`);
  for (const f of g.faq || []) NEED(f, ['q', 'a'], `${label} faq`);
}

/* game config: the numbers behind the rules */
const EFFECT_KEYS = ['click', 'crit', 'comboWindow', 'comboMax', 'chopper', 'interval', 'autoPower', 'value', 'overdrive', 'offline', 'offlineCap'];
for (const g of games) {
  const file = path.join(DATA, 'games', g.id, 'config.json');
  if (!fs.existsSync(file)) continue;
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  const label = `games/${g.id}/config.json`;
  NEED(c, ['tickMs', 'baseClick', 'critMult', 'fellBonus', 'treeGapSeconds', 'combo', 'auto', 'offline', 'trees', 'zones', 'upgrades', 'prestige'], label);
  unique(c.trees.map((t) => t.id), `${label} trees`);
  unique(c.zones.map((z) => z.id), `${label} zones`);
  unique(c.upgrades.map((u) => u.id), `${label} upgrades`);
  const treeIds = new Set(c.trees.map((t) => t.id));
  for (const t of c.trees) {
    const tl = `${label} tree ${t.id}`;
    NEED(t, ['name', 'tier', 'hp', 'yield', 'gears', 'scale', 'leaf', 'leafDark', 'trunk', 'glow'], tl);
    for (const k of ['leaf', 'leafDark', 'trunk', 'glow']) if (t[k] && !HEX.test(t[k])) bad(`${tl}: ${k} 应为 #rrggbb`);
    if (!(t.hp > 0 && t.yield > 0)) bad(`${tl}: hp 与 yield 必须大于 0`);
    if (!(t.gears >= 0)) bad(`${tl}: gears 不能为负`);
  }
  if (c.zones[0].unlockCost !== 0) bad(`${label}: 第一个区必须免费`);
  for (const [i, z] of c.zones.entries()) {
    const zl = `${label} zone ${z.id}`;
    NEED(z, ['name', 'unlockCost', 'blurb', 'pool'], zl);
    for (const [tid, w] of Object.entries(z.pool || {})) {
      if (!treeIds.has(tid)) bad(`${zl}: 引用了不存在的树 "${tid}"`);
      if (!(w > 0)) bad(`${zl}: 树 "${tid}" 的权重必须大于 0`);
    }
    if (i && z.unlockCost <= c.zones[i - 1].unlockCost) bad(`${zl}: 解锁成本应高于上一个区`);
  }
  const currencies = new Set();
  for (const u of c.upgrades) {
    const ul = `${label} upgrade ${u.id}`;
    NEED(u, ['name', 'currency', 'baseCost', 'growth', 'max', 'effect', 'desc'], ul);
    currencies.add(u.currency);
    if (!['timber', 'gears'].includes(u.currency)) bad(`${ul}: currency 只能是 timber 或 gears`);
    if (!(u.baseCost > 0 && u.growth >= 1 && u.max >= 1)) bad(`${ul}: baseCost > 0、growth ≥ 1、max ≥ 1`);
    for (const k of Object.keys(u.effect || {})) if (!EFFECT_KEYS.includes(k)) bad(`${ul}: effect "${k}" 不是逻辑层认识的属性（可用：${EFFECT_KEYS.join(', ')}）`);
    if (u.effect && !Object.keys(u.effect).length) bad(`${ul}: effect 不能为空`);
  }
  if (currencies.has('gears') && !c.trees.some((t) => t.gears > 0)) bad(`${label}: 有齿轮升级，但没有任何树掉齿轮`);
  NEED(c.prestige, ['requiresZone', 'divisor', 'exponent', 'bonusPerPoint'], `${label} prestige`);
  if (!c.zones.some((z) => z.id === c.prestige?.requiresZone)) bad(`${label}: prestige.requiresZone 指向不存在的区`);
  if (!(c.prestige?.divisor > 0 && c.prestige?.exponent > 0 && c.prestige?.exponent <= 1)) bad(`${label}: prestige 的 divisor > 0 且 0 < exponent ≤ 1（>1 会让数值失控）`);
  if (!(c.prestige?.bonusPerPoint > 0 && c.prestige?.bonusPerPoint < 0.25)) bad(`${label}: prestige.bonusPerPoint 应在 0 到 0.25 之间`);
  if (!(c.offline?.baseEfficiency > 0 && c.offline?.baseEfficiency <= 1 && c.offline?.baseCapSeconds > 0)) bad(`${label}: offline 的 baseEfficiency 在 (0,1]，baseCapSeconds > 0`);
  if (!(c.auto?.minInterval > 0 && c.auto?.minInterval <= c.auto?.baseInterval)) bad(`${label}: auto.minInterval 必须 > 0 且不大于 baseInterval`);
  if (!(c.daily?.amountSeconds > 0 && c.daily?.minAmount >= 0)) bad(`${label}: daily.amountSeconds > 0，daily.minAmount ≥ 0`);
  for (const [i, z] of c.zones.entries()) {
    if (i > 0 && !(z.reward && z.reward.gears > 0)) bad(`${label}: 区域 "${z.id}" 没有诚齿轮奖励（reward.gears）`);
  }

  /* achievements: ids unique, metrics known, targets strictly increasing per metric */
  const achFile = path.join(DATA, 'games', g.id, 'achievements.json');
  if (!fs.existsSync(achFile)) {
    bad(`games/${g.id}: 缺 achievements.json`);
  } else {
    const ach = JSON.parse(fs.readFileSync(achFile, 'utf8'));
    if (ach.length !== 20) bad(`games/${g.id}/achievements.json: 应为 20 条，现在是 ${ach.length}`);
    unique(ach.map((a) => a.id), `games/${g.id}/achievements.json`);
    const METRICS = ['felled', 'clicks', 'total', 'lifetime', 'zones', 'prestiges', 'playTime', 'upgradeLevels'];
    const byMetric = new Map();
    for (const a of ach) {
      const al = `games/${g.id}/achievements.json ${a.id}`;
      NEED(a, ['id', 'group', 'metric', 'target', 'name', 'desc'], al);
      if (!METRICS.includes(a.metric)) bad(`${al}: metric "${a.metric}" 不是逻辑层认识的指标`);
      if (!(a.target > 0)) bad(`${al}: target 必须大于 0`);
      if (!a.zh || !a.zh.name || !a.zh.desc) bad(`${al}: 缺中文名或中文说明`);
      byMetric.set(a.metric, [...(byMetric.get(a.metric) || []), a.target]);
    }
    for (const [metric, targets] of byMetric) {
      const sorted = [...targets].sort((a, b) => a - b);
      if (sorted.join() !== targets.join()) bad(`games/${g.id}/achievements.json: "${metric}" 的 target 必须递增（${targets.join(', ')}）`);
    }
    if (!errors.some((e) => e.includes('achievements.json'))) good(`games/${g.id}/achievements.json: ${ach.length} 条成就，指标与目标递增均合法`);
  }
  if (!errors.some((e) => e.startsWith(label))) good(`${label}: ${c.trees.length} 种树 · ${c.zones.length} 个区 · ${c.upgrades.length} 项升级`);
}

/* ---------------- tools ---------------- */
const tools = read('tools.json');
unique(tools.map((t) => t.id), 'tools.json');
const oldCategories = new Set(read('legacy/categories.json').toolCategories.map((c) => c.id));
for (const t of tools) {
  const label = `tools.json ${t.id}`;
  if (!ID_RE.test(t.id)) bad(`${label}: id 只能用小写字母、数字和连字符`);
  if (oldCategories.has(t.id)) bad(`${label}: 与旧站 /tools/ 分类同名，跳转规则会把新页面导向首页`);
  NEED(t, ['name', 'metaTitle', 'summary', 'icon', 'path', 'metaDescription', 'h1', 'lead', 'sections', 'faq'], label);
  if (t.path !== `/tools/${t.id}/`) bad(`${label}: path 应为 "/tools/${t.id}/"`);
  desc(t.metaDescription, label);
  date(t.updated, label);
  if (!hasIcon(t.icon)) bad(`${label}: 图标 "${t.icon}" 不存在（见 src/lib/icons.mjs）`);
  if (!Array.isArray(t.sections) || !t.sections.length) bad(`${label}: sections 不能为空`);
  unique((t.sections || []).map((s) => s.id), `${label} sections`);
  for (const s of t.sections || []) {
    NEED(s, ['id', 'h'], `${label} section`);
    if (s.id && !ID_RE.test(s.id)) bad(`${label}: section id "${s.id}" 含非法字符`);
    if (!(s.p || s.list || s.table)) bad(`${label}: section "${s.id}" 没有内容`);
  }
  if ((t.faq || []).length < 2) bad(`${label}: 至少 2 条常见问题`);
  for (const f of t.faq || []) NEED(f, ['q', 'a'], `${label} faq`);
  for (const f of ['core.js', 'ui.js', 'core.test.js']) if (!fs.existsSync(path.join(ROOT, 'src', 'tools', t.id, f))) bad(`${label}: 缺 src/tools/${t.id}/${f}`);
  if (t.id === 'sens-converter') {
    const gs = t.client?.games || [];
    if (gs.length < 2) bad(`${label}: 至少要两个游戏才能换算`);
    unique(gs.map((x) => x.id), `${label} games`);
    for (const x of gs) if (!(x.yaw > 0)) bad(`${label}: ${x.name} 的 yaw 必须大于 0`);
  }
  if (t.id === 'fov-calculator') {
    const as = t.client?.aspects || [];
    if (as.length < 2) bad(`${label}: 至少要两种屏幕比例`);
    for (const x of as) if (!(x.w > 0 && x.h > 0)) bad(`${label}: ${x.id} 的宽高必须大于 0`);
  }
}
if (!errors.some((e) => e.startsWith('tools.json'))) good(`tools.json: ${tools.length} 个工具，字段齐全`);

/* ---------------- pages.json ---------------- */
const docs = read('pages.json');
for (const [slug, p] of Object.entries(docs)) {
  if (slug.startsWith('$')) continue;
  const label = `pages.json ${slug}`;
  if (!ID_RE.test(slug)) bad(`${label}: 路径名只能用小写字母、数字和连字符`);
  NEED(p, ['title', 'lead', 'metaDescription', 'sections', 'updated'], label);
  desc(p.metaDescription, label);
  date(p.updated, label);
  unique((p.sections || []).map((s) => s.id), `${label} sections`);
  for (const s of p.sections || []) if (!(s.p || s.list || s.table)) bad(`${label}: section "${s.id}" 没有内容`);
}
const enabledFlags = new Set(Object.keys(site.flags || {}).filter((k) => site.flags[k]));
const privacy = docs.privacy?.sections || [];
const privacyDocHasAnalytics = privacy.some((s) => s.flag === 'analytics');
if (enabledFlags.has('analytics') && !privacyDocHasAnalytics) bad('site.config.json: 开启了 analytics，但隐私页没有对应的说明段落');

/* ---------------- 中英文完整性 ----------------
   中文缺一块不会报错，只会让读者看到半页空白或英文，所以在这里逐条对齐：
   结构（段落/条目/行数）必须与英文一致，缺了就是漏翻译。 */
{
  const FIELDS = ['name', 'metaTitle', 'summary', 'metaDescription', 'h1', 'lead', 'tagline', 'short', 'intro', 'sections', 'faq', 'howto', 'tips'];
  const checkMirror = (en, zh, where) => {
    for (const f of FIELDS) {
      const hasEn = en[f] !== undefined;
      if (hasEn && (!zh || zh[f] === undefined)) bad(`中英不一致：${where} 缺中文 ${f}`);
    }
    if (en.sections && zh && zh.sections) {
      const enIds = en.sections.map((s) => s.id).join(',');
      const zhIds = zh.sections.map((s) => s.id).join(',');
      if (enIds !== zhIds) bad(`中英不一致：${where} 的 sections id 顺序不同（${enIds} vs ${zhIds}）`);
      en.sections.forEach((s, i) => {
        const mirrored = zh.sections[i];
        const enRows = s.table ? s.table.rows.length : 0;
        const zhRows = mirrored.table ? mirrored.table.rows.length : 0;
        if (enRows !== zhRows) bad(`中英不一致：${where} 的 section "${s.id}" 表格行数不同`);
        if (s.table && mirrored.table && s.table.head.length !== mirrored.table.head.length) bad(`中英不一致：${where} 的 section "${s.id}" 表头列数不同`);
        if ((s.p || []).length !== (mirrored.p || []).length) bad(`中英不一致：${where} 的 section "${s.id}" 段落数不同`);
        if ((s.list || []).length !== (mirrored.list || []).length) bad(`中英不一致：${where} 的 section "${s.id}" 列表条目数不同`);
      });
    }
    if (en.faq && (!zh.faq || en.faq.length !== zh.faq.length)) bad(`中英不一致：${where} 的 faq 条数不同`);
    if (en.howto && en.howto.steps.length !== ((zh && zh.howto && zh.howto.steps.length) || 0)) bad(`中英不一致：${where} 的 howto.steps 条数不同`);
    if (en.tips && en.tips.length !== ((zh && zh.tips && zh.tips.length) || 0)) bad(`中英不一致：${where} 的 tips 条数不同`);
    if (en.intro && en.intro.length !== ((zh && zh.intro && zh.intro.length) || 0)) bad(`中英不一致：${where} 的 intro 段数不同`);
  };

  for (const g of games) if (!g.zh) bad(`games.json ${g.id}: 没有中文（zh）`);
  else checkMirror(g, g.zh, `games.json ${g.id}`);
  for (const t of tools) if (!t.zh) bad(`tools.json ${t.id}: 没有中文（zh）`);
  else checkMirror(t, t.zh, `tools.json ${t.id}`);
  for (const [slug, p] of Object.entries(docs)) {
    if (slug.startsWith('$')) continue;
    if (!p.zh) bad(`pages.json ${slug}: 没有中文（zh）`);
    else checkMirror(p, p.zh, `pages.json ${slug}`);
  }

  // 游戏内的名字也要有中文，否则中文页面上会突然冒出英文树名。
  for (const g of games) {
    const file = path.join(DATA, 'games', g.id, 'config.json');
    if (!fs.existsSync(file)) continue;
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const list of ['trees', 'zones', 'upgrades']) {
      for (const item of c[list] || []) {
        if (!item.zh || !item.zh.name) bad(`games/${g.id}/config.json: ${list} 的 "${item.id}" 缺中文名`);
      }
    }
    for (const z of c.zones || []) if (!z.zh || !z.zh.blurb) bad(`games/${g.id}/config.json: zone "${z.id}" 缺中文简介`);
    for (const u of c.upgrades || []) if (!u.zh || !u.zh.desc) bad(`games/${g.id}/config.json: upgrade "${u.id}" 缺中文说明`);
    for (const tier of new Set((c.trees || []).map((t) => t.tier))) {
      if (!c.tiers || !c.tiers[tier]) bad(`games/${g.id}/config.json: 稀有度 "${tier}" 缺中文（tiers）`);
    }
  }

  /* 两个开关必须一起动：隐私页的承诺与实际行为不能分叉。 */
  {
    const analytics = !!(site.flags && site.flags.analytics);
    const beaconOn = !!(site.beacon && site.beacon.enabled);
    if (beaconOn && !analytics) bad('site.config.json: beacon.enabled 为真但 flags.analytics 为假 —— 会收数据，隐私页却不显示说明');
    if (analytics && !beaconOn) bad('site.config.json: flags.analytics 为真但 beacon.enabled 为假 —— 隐私页会描述一份并不存在的统计');
    if (beaconOn && !fs.existsSync(path.join(ROOT, 'workers', 'beacon', 'src', 'index.js'))) bad('beacon.enabled 为真，但 workers/beacon 不存在');
    if (analytics && !privacyDocHasAnalytics) bad('flags.analytics 为真，但隐私页没有 analytics 段落');
    if (!errors.some((e) => e.startsWith('site.config.json')) && !errors.some((e) => e.includes('隐私页'))) {
      good(`统计开关：flags.analytics=${analytics} · beacon=${beaconOn}（两者一致）`);
    }
  }

  /* 门户提交状态：状态值不能写错，提交日期要么为空要么是日期。
     这张表是「上次到底投过没有」的唯一记录，写错了比没有更糟。 */
  {
    const statusFile = path.join(DATA, 'portal-status.json');
    if (!fs.existsSync(statusFile)) bad('data/portal-status.json 不存在');
    else {
      const ps = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      const ALLOWED = ['not-submitted', 'submitted', 'in-review', 'live', 'rejected', 'hold'];
      if (!Array.isArray(ps.portals) || !ps.portals.length) bad('data/portal-status.json: portals 不能为空');
      else {
        unique(ps.portals.map((p) => p.id), 'data/portal-status.json');
        for (const p of ps.portals) {
          NEED(p, ['id', 'url', 'status'], `portal-status ${p.id}`);
          if (!ALLOWED.includes(p.status)) bad(`portal-status ${p.id}: 状态 "${p.status}" 不在允许值里（${ALLOWED.join(' / ')}）`);
          if (p.submittedAt !== null && !ISO_DATE.test(String(p.submittedAt))) bad(`portal-status ${p.id}: submittedAt 应为 YYYY-MM-DD 或 null`);
          if (p.status !== 'not-submitted' && p.status !== 'hold' && !p.submittedAt) bad(`portal-status ${p.id}: 已提交却没有 submittedAt`);
        }
        if (!errors.some((e) => e.includes('portal-status'))) good(`portal-status: ${ps.portals.length} 家门户，状态值合法`);
      }
    }
  }

  // 界面文案表：每一条都必须是双语。
  const missing = Object.entries(S).filter(([, v]) => !v || v.en === undefined || v.zh === undefined).map(([k]) => k);
  if (missing.length) bad(`strings.mjs: ${missing.length} 条文案缺 en 或 zh（例如 ${missing.slice(0, 3).join(', ')}）`);
  if (!missing.length) good(`strings.mjs: ${Object.keys(S).length} 条界面文案均为中英双语`);
}

/* ---------------- 旧提示词数据集：中英都要有 ---------------- */
{
  const file = path.join(DATA, 'legacy', 'prompts.json');
  if (fs.existsSync(file)) {
    const prompts = JSON.parse(fs.readFileSync(file, 'utf8'));
    const zhOk = prompts.filter((p) => p.prompt).length;
    const enOk = prompts.filter((p) => p.en && p.en.prompt).length;
    if (zhOk !== prompts.length || enOk !== prompts.length) {
      bad(`data/legacy/prompts.json: ${prompts.length} 条里只有 ${zhOk} 条有中文正文、${enOk} 条有英文正文 —— 缺的那一半会让提示词工具显示成另一种语言`);
    } else {
      good(`data/legacy/prompts.json: ${prompts.length} 条提示词中英正文齐全`);
    }
  }
}

/* ---------------- legacy dataset is still shipped ---------------- */
const legacyDir = path.join(DATA, 'legacy');
const legacyCount = fs.readdirSync(legacyDir).filter((f) => f.endsWith('.json')).length;
if (legacyCount < 11) bad(`data/legacy: 数据集文件只剩 ${legacyCount} 个，应为 11 个（tools / prompts / glossary / playbooks / models / learn / news / categories / tags-en / i18n / feeds）`);
else good(`data/legacy: ${legacyCount} 个数据集文件仍在，会输出到 /api/legacy/`);

/* ---------------- robots.txt ---------------- */
const robotsFile = path.join(ROOT, 'public', 'robots.txt');
if (!fs.existsSync(robotsFile)) {
  bad('public/robots.txt 不存在');
} else {
  const robots = fs.readFileSync(robotsFile, 'utf8');
  if (!/^User-agent: \*\s*$/m.test(robots) || !/^Allow: \/$/m.test(robots)) bad('public/robots.txt: 必须有 "User-agent: *" 和 "Allow: /"');
  if (!robots.includes(`Sitemap: ${site.baseUrl}/sitemap.xml`)) bad(`public/robots.txt: 应含 "Sitemap: ${site.baseUrl}/sitemap.xml"`);
  if (/Disallow: \/$/.test(robots)) bad('public/robots.txt: 不能整站 Disallow');
  if (!errors.some((e) => e.includes('robots.txt'))) good('public/robots.txt: 全部爬虫放行，sitemap 地址正确');
}

/* ---------------- Windows 批处理健康检查 ----------------
   .bat 有三个隐形杀手，任何一个都会让用户双击后看到一堆乱码报错：
     1. 含非 ASCII 字节 → cmd 用系统 OEM 代码页(GBK)解析，乱码会被当命令执行
     2. 有 UTF-8 BOM   → 首行变成 "\xEF\xBB\xBF@echo off"，直接报错
     3. 只有 LF 换行    → goto :LABEL 跳转可能失效（cmd 按字节扫描标签）
   保持纯 ASCII + 无 BOM + CRLF 才安全。 */
const bats = fs.readdirSync(ROOT).filter((f) => f.toLowerCase().endsWith('.bat'));
for (const f of bats) {
  const buf = fs.readFileSync(path.join(ROOT, f));
  const s = buf.toString('latin1');
  const problems = [];
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) problems.push('有 UTF-8 BOM');
  const nonAscii = [...buf].filter((x) => x > 127).length;
  if (nonAscii) problems.push(`含 ${nonAscii} 个非 ASCII 字节（cmd 会解析成乱码）`);
  const bareLf = (s.match(/(?<!\r)\n/g) || []).length;
  if (bareLf) problems.push(`有 ${bareLf} 处裸 LF 换行（应为 CRLF）`);
  if (buf.length && !s.endsWith('\r\n')) problems.push('末尾缺 CRLF');
  if (problems.length) bad(`${f}: ${problems.join('；')}`);
  else good(`${f}: 纯 ASCII + 无 BOM + CRLF，可安全双击`);
}
if (!bats.length) bad('没有找到任何 .bat 启动脚本');

/* ---------------- vercel.json 字段白名单 ----------------
   踩过一次：在 redirects 里写了个 `comment` 字段（本意是留说明），
   Vercel 校验很严，不认识这个字段就直接拒绝部署 —— 而且部署失败后
   线上继续服务上一次成功的版本，从页面上完全看不出来。 */
{
  const vp = path.join(ROOT, 'vercel.json');
  if (!fs.existsSync(vp)) {
    bad('vercel.json 不存在');
  } else {
    const TOP = new Set(['$schema', 'buildCommand', 'devCommand', 'installCommand', 'outputDirectory', 'framework', 'regions', 'functions', 'redirects', 'rewrites', 'cleanUrls', 'trailingSlash', 'headers', 'crons', 'git', 'ignoreCommand', 'public', 'images', 'routes', 'builds', 'github']);
    const REDIRECT = new Set(['source', 'destination', 'permanent', 'statusCode', 'has', 'missing', 'caseSensitive', 'preserveQueryParams']);
    const HEADER = new Set(['source', 'headers', 'has', 'missing']);
    const HEADER_ITEM = new Set(['key', 'value']);
    const COND = new Set(['type', 'key', 'value']);
    const wrong = [];
    const checkKeys = (obj, allowed, where) => {
      for (const k of Object.keys(obj || {})) if (!allowed.has(k)) wrong.push(`${where} 里的未知字段「${k}」（Vercel 会因此拒绝部署）`);
    };
    try {
      const v = JSON.parse(fs.readFileSync(vp, 'utf8'));
      checkKeys(v, TOP, 'vercel.json');
      (v.redirects || []).forEach((r, i) => {
        checkKeys(r, REDIRECT, `redirects[${i}]`);
        (r.has || []).forEach((h, j) => checkKeys(h, COND, `redirects[${i}].has[${j}]`));
        (r.missing || []).forEach((h, j) => checkKeys(h, COND, `redirects[${i}].missing[${j}]`));
        if (!r.source || !r.destination) wrong.push(`redirects[${i}] 缺 source 或 destination`);
      });
      (v.headers || []).forEach((h, i) => {
        checkKeys(h, HEADER, `headers[${i}]`);
        (h.headers || []).forEach((x, j) => checkKeys(x, HEADER_ITEM, `headers[${i}].headers[${j}]`));
      });
      if ('framework' in v && v.framework !== null && typeof v.framework !== 'string') wrong.push('framework 只能是字符串或 null');
      if (v.outputDirectory !== 'dist') wrong.push(`outputDirectory 应为 "dist"，现在是 "${v.outputDirectory}"`);
      if (!v.redirects?.some((r) => r.has?.some((h) => h.type === 'host'))) wrong.push('缺少 vercel.app 域名跳到自有域名的规则');
      if (wrong.length) wrong.forEach((w) => bad(`vercel.json: ${w}`));
      else good(`vercel.json: 字段全部在 Vercel 白名单内，${(v.redirects || []).length} 条跳转`);
    } catch (e) {
      bad(`vercel.json 不是合法 JSON：${e.message}`);
    }
  }
}

/* ---------------- 旧地址跳转 ---------------- */
{
  const { problems, oldCount } = verifyRedirects();
  problems.forEach((p) => bad(`跳转规则：${p}`));
  if (!problems.length) good(`跳转规则：${oldCount} 条旧地址全部有去处，新地址不受影响`);
}

/* ---------------- package.json scripts point at files that exist ---------------- */
{
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
    for (const [, rel] of cmd.matchAll(/node (scripts\/[\w.-]+\.mjs)/g)) {
      if (!fs.existsSync(path.join(ROOT, rel))) bad(`package.json: 脚本 "${name}" 指向不存在的 ${rel}`);
    }
  }
  if (pkg.dependencies && Object.keys(pkg.dependencies).length) bad('package.json: 出现了 dependencies，本项目约定零第三方依赖');
  if (pkg.devDependencies && Object.keys(pkg.devDependencies).length) bad('package.json: 出现了 devDependencies，本项目约定零第三方依赖');
}

/* ---------------- 输出 ---------------- */
const line = '─'.repeat(60);
console.log('');
console.log('  数据与配置校验');
console.log('  ' + line);
if (ok.length) ok.forEach((o) => console.log(`  ✓ ${o}`));
if (errors.length) {
  console.log('');
  errors.forEach((e) => console.log(`  ✗ ${e}`));
}
console.log('  ' + line);
console.log(errors.length ? `  发现 ${errors.length} 个问题` : '  全部通过');
console.log('');
process.exit(errors.length ? 1 : 0);
