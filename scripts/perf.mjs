/**
 * 体积与性能预算检查（零依赖）
 *
 *   node scripts/perf.mjs
 *
 * 站点的「重量」只有两个地方真正影响体验：首屏要下载的 CSS/JS，以及最大页面的 HTML。
 * 这个脚本把它们量出来，并给出预算告警——避免内容一直加、体积悄悄失控。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', 'dist');

/** 预算（gzip 后 KB）。
 *  首屏 CSS/JS 是**硬预算**：超了 exit 1，因为每个用户、每次访问都要付这份钱。
 *  单页 HTML 是**软预算**：只提醒不阻断。页面重只影响点进那一页的人，
 *  而且内容增长（比如工具从 236 条长到 244 条）本来就会让它变重。
 *  预算按实测留 ~10% 余量，太松等于没有守卫，太紧会被正常增长触发。 */
const BUDGET = {
  // 硬预算
  'assets/main.css': 24,
  'assets/app.js': 16,
  // 按需加载的软预算（不是每个页面都要下，超标只提醒）
  'assets/search.js': 9,
  // 软预算
  'index.html': 24,
  'prompts/index.html': 64,
  // 236 张卡片 + 每张一条编辑点评；这是本站最有价值的一页，允许它重一些
  'tools/index.html': 52,
  'en/tools/index.html': 60,
  'models/index.html': 40,
  'en/models/index.html': 40,
  'en/prompts/index.html': 62,
  'en/index.html': 26,
  'news/live/index.html': 40,
  // 搜索页与收藏页把整份索引内嵌在 HTML 里（设计如此：打开即可搜，不依赖接口），
  // 所以它们天然是全场最重的两页，预算单独放宽，但要盯住别继续膨胀。
  'search/index.html': 70,
  'en/search/index.html': 70,
  'saved/index.html': 68,
  'glossary/index.html': 30,
  'en/glossary/index.html': 36,
};

/* ---------- 内容驱动的列表页：预算随条目数增长，而不是写死一个数 ----------
   写死的预算**一定会被「内容正常增长」撞破**（工具从 236 条长到 300 条本来就会变重），
   然后被当成「又是这个假警报」而一次次放宽 —— 那之后就再也抓不到真正的体积回归了。

   下面这些系数不是拍脑袋：是拿**同一套模板、不同条目数**的页面反推出来的
   （斜率 = 每条成本，截距 = 与条目数无关的固定开销）：
     /tools/     16 条 9.0KB → 34 条 13.9KB → 246 条 49.3KB   ⇒ 6.2 + 0.18×n
     /en/tools/  16 条 7.3KB → 34 条 11.6KB → 246 条 48.8KB   ⇒ 4.4 + 0.18×n
     /prompts/    9 条 11.5KB → 12 条 13.2KB → 86 条 56.7KB   ⇒ 6.3 + 0.59×n（提示词整段内嵌，重得多）
     /en/prompts/ 9 条 9.6KB → 12 条 11.2KB → 86 条 49.3KB    ⇒ 5.0 + 0.51×n
     搜索/收藏页内嵌整份索引（609 条 ≈ 68.7KB）               ⇒ 10 + 0.10×n
   三个点连成直线且互相吻合，所以线性模型是站得住的。统一留 10% 余量。 */
const countIn = (f, key) => {
  try {
    const j = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'data', f), 'utf8'));
    return (key ? j[key] : j).length;
  } catch { return 0; }
};
const indexCount = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(DIST, 'api', 'search.json'), 'utf8')).length; } catch { return 0; }
})();
const nTools = countIn('tools.json');
const nPrompts = countIn('prompts.json');
const head = (kb) => Math.round(kb * 1.1);
if (nTools) {
  BUDGET['tools/index.html'] = head(6.2 + 0.18 * nTools);
  BUDGET['en/tools/index.html'] = head(4.4 + 0.18 * nTools);
}
if (nPrompts) {
  BUDGET['prompts/index.html'] = head(6.3 + 0.59 * nPrompts);
  BUDGET['en/prompts/index.html'] = head(5.0 + 0.51 * nPrompts);
}
if (indexCount) {
  BUDGET['search/index.html'] = head(10 + 0.10 * indexCount);
  BUDGET['saved/index.html'] = head(10 + 0.10 * indexCount);
  BUDGET['en/search/index.html'] = head(8 + 0.09 * indexCount);
}
/* 取不到计数就别覆盖（否则预算会算成个位数，立刻全是假警报） */
if (!nTools || !nPrompts || !indexCount) {
  console.log('  ! 有数据文件读不到（tools / prompts / 搜索索引），这几个页面的预算沿用写死值');
}

/* 预算平时只在超标时才露出来，加个开关方便核对「这页现在到底被卡在多少」 */
if (process.argv.includes('--budgets')) {
  console.log('');
  console.log('  生效中的预算（gzip KB）');
  console.log(`    条目数：工具 ${nTools} · 提示词 ${nPrompts} · 搜索索引 ${indexCount}`);
  console.log('');
  for (const [k, v] of Object.entries(BUDGET)) {
    const f = path.join(DIST, k);
    let now = '';
    try { now = `（当前 ${(zlib.gzipSync(fs.readFileSync(f)).length / 1024).toFixed(1)}）`; } catch { /* 文件不在就算了 */ }
    console.log(`    ${k.padEnd(30)} ${String(v).padStart(4)} KB  ${now}`);
  }
  console.log('');
  process.exit(0);
}

if (!fs.existsSync(DIST)) { console.error('  dist/ 不存在，请先构建'); process.exit(1); }

/* 静态资源带内容哈希（main.3edd4fc.css），文件名不能写死。
   踩过一次：这里硬编码 assets/main.css 与 assets/app.js，而产物早已改成内容哈希
   —— statSync 抛 ENOENT，整个脚本崩在第一步。因为它当时没接进 verify，
   崩了也没人发现，这个体积预算等于不存在。现在按内容哈希解析，找不到就直接报错。 */
const ASSET_DIR = path.join(DIST, 'assets');
const ASSET_FILES = fs.existsSync(ASSET_DIR) ? fs.readdirSync(ASSET_DIR) : [];
const resolveAsset = (base, ext) => {
  const hit = ASSET_FILES.find((n) => n === `${base}.${ext}` || new RegExp(`^${base}\\.[0-9a-f]{7,}\\.${ext}$`).test(n));
  return hit ? `assets/${hit}` : null;
};

const SOFT_ASSET = 'assets/search.js';
const KEY_FILE = {
  'assets/main.css': resolveAsset('main', 'css'),
  'assets/app.js': resolveAsset('app', 'js'),
  'assets/print.css': resolveAsset('print', 'css'),
  [SOFT_ASSET]: resolveAsset('search', 'js'),
};
if (!KEY_FILE[SOFT_ASSET]) {
  // 找不到就报错：这东西如果静默消失，说明拆分/哈希规则变了而本脚本没跟上
  console.error('  ✗ 找不到 search.js 的构建产物（拆分改名了？请同步 perf.mjs）');
  process.exit(1);
}
if (!KEY_FILE['assets/main.css'] || !KEY_FILE['assets/app.js']) {
  console.error('  ✗ 找不到 main.css / app.js 的构建产物（命名规则变了？请同步 perf.mjs）');
  process.exit(1);
}

const gz = (file) => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
const raw = (file) => fs.statSync(file).size;
const kb = (n) => n / 1024;
const fmt = (n) => `${kb(n).toFixed(1)} KB`;

const walk = (dir, prefix = '') => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
};

const files = walk(DIST);
const html = files.filter((f) => f.endsWith('.html'));
const assets = files.filter((f) => /\.(css|js|woff2|png|svg)$/.test(f));

/* ---------- 关键资源 ---------- */
console.log('');
console.log('  体积检查');
console.log('  ' + '─'.repeat(62));
console.log('  关键资源（首屏必下）');
const criticalRaw = raw(path.join(DIST, KEY_FILE['assets/main.css'])) + raw(path.join(DIST, KEY_FILE['assets/app.js']));
let budgetHit = 0;
let criticalHit = 0;   // 首屏 CSS/JS 超预算 —— 硬失败

for (const key of ['assets/main.css', 'assets/app.js', 'assets/print.css']) {
  const rel = KEY_FILE[key];
  if (!rel) continue;
  const p = path.join(DIST, rel);
  const g = gz(p);
  const budget = BUDGET[key];
  const over = budget && kb(g) > budget;
  if (over) { budgetHit++; criticalHit++; }
  // 括号里带上真实文件名，方便对着 dist/ 直接核对
  console.log(`    ${key.padEnd(22)} ${fmt(raw(p)).padStart(9)} → ${fmt(g).padStart(9)}${budget ? `  (预算 ${budget}KB)${over ? '  ✗ 超了' : '  ✓'}` : ''}  ${path.basename(rel)}`);
}
console.log(`    ${'首屏 CSS+JS 合计'.padEnd(20)} ${fmt(criticalRaw).padStart(9)} → ${fmt(gz(path.join(DIST, KEY_FILE['assets/main.css'])) + gz(path.join(DIST, KEY_FILE['assets/app.js']))).padStart(9)}`);

/* ---------- 按需加载的资源（软预算） ----------
   search.js 只有 /search/ 两个页面要下，其余 696 页根本碰不到它，
   所以不能算硬预算（硬预算的意义是「每个用户每次访问都要付」）。
   但它仍然要有个数：曾经这套搜索代码就是塞在 app.js 里、平摊给所有页面的。 */
console.log('');
console.log('  按需加载（软预算）');
{
  const rel = KEY_FILE[SOFT_ASSET];
  const p = path.join(DIST, rel);
  const g = gz(p);
  const budget = BUDGET[SOFT_ASSET];
  const over = budget && kb(g) > budget;
  if (over) budgetHit++;
  console.log(`    ${SOFT_ASSET.padEnd(22)} ${fmt(raw(p)).padStart(9)} → ${fmt(g).padStart(9)}  (预算 ${budget}KB)${over ? '  ✗ 超了' : '  ✓'}  ${path.basename(rel)}`);
}

/* ---------- 最大的页面 ---------- */
console.log('');
console.log('  最大的 8 个页面');
const sizeOf = html
  .map((f) => ({ f, g: gz(path.join(DIST, f)) }))
  .sort((a, b) => b.g - a.g)
  .slice(0, 8);
for (const { f, g } of sizeOf) {
  const budget = BUDGET[f];
  const over = budget && kb(g) > budget;
  if (over) budgetHit++;
  console.log(`    ${f.padEnd(30)} ${fmt(raw(path.join(DIST, f))).padStart(9)} → ${fmt(g).padStart(9)}${over ? `  ✗ 超预算 ${budget}KB` : ''}`);
}

/* ---------- 汇总 ---------- */
const totalRaw = html.reduce((s, f) => s + raw(path.join(DIST, f)), 0);
const totalGz = html.reduce((s, f) => s + gz(path.join(DIST, f)), 0);
const assetGz = assets.reduce((s, f) => s + gz(path.join(DIST, f)), 0);
const avg = totalGz / Math.max(1, html.length);

console.log('');
console.log('  ' + '─'.repeat(62));
console.log(`  页面        ${html.length} 个，HTML 合计 ${fmt(totalRaw)} → gzip ${fmt(totalGz)}`);
console.log(`  资源        ${assets.length} 个，gzip 合计 ${fmt(assetGz)}`);
console.log(`  单页均值    ${fmt(avg)}（gzip 后）`);
console.log(`  整站产物    ${fmt(files.reduce((s, f) => s + raw(path.join(DIST, f)), 0))}`);

if (budgetHit) {
  console.log('');
  console.log(`  ! ${budgetHit} 项超出预算。要么优化，要么把预算调高——但要知道自己在付出什么代价。`);
}
if (criticalHit) {
  console.log('');
  console.log(`  ✗ 首屏 CSS/JS 有 ${criticalHit} 项超预算 —— 这是每个用户每次访问都要付的钱，按硬失败处理。`);
}
console.log('');
process.exit(criticalHit ? 1 : 0);
