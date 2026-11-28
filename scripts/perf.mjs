/**
 * 体积与性能预算检查（零依赖）
 *
 *   node scripts/perf.mjs              检查
 *   node scripts/perf.mjs --budgets    列出生效中的预算和当前体积
 *
 * 两类预算：
 *   硬预算 —— 每个访客每页都要下载的东西（全站 CSS、全站脚本、首屏 HTML）。超了 exit 1。
 *   软预算 —— 只在某一类页面才加载的东西（游戏、某个工具）。超了只提醒，但要看住别继续涨。
 * 预算按实测留约 10% 余量：太松等于没有守卫，太紧会被正常增长触发。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const SHOW = process.argv.includes('--budgets');

/** gzip KB. `hard` makes an overrun fail the build. */
const BUDGET = [
  { glob: /^main\.[0-9a-f]{7}\.css$/, name: 'main.css (every page)', budget: 15, hard: true },
  { glob: /^app\.[0-9a-f]{7}\.js$/, name: 'app.js (every page)', budget: 2, hard: true },
  { glob: /^game\.[0-9a-f]{7}\.css$/, name: 'game.css (game pages)', budget: 7 },
  { glob: /^game-.*\.js$/, name: 'game script', budget: 20 },   // balance config + all game text; Chinese is ~10% larger per character
  { glob: /^tool-.*\.js$/, name: 'tool script', budget: 8 },
  { glob: /^prompts-(en|zh)\..*\.json$/, name: 'prompt texts (fetched after load)', budget: 34 },
  { file: 'index.html', name: 'home page HTML', budget: 10, hard: true },
  { file: 'games/lumber-tycoon/index.html', name: 'game page HTML', budget: 16 },
  { file: 'tools/prompt-template-builder/index.html', name: 'heaviest tool page HTML', budget: 12 },
];

if (!fs.existsSync(DIST)) {
  console.error('  dist/ 不存在，请先构建');
  process.exit(1);
}

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
const gz = (rel) => zlib.gzipSync(fs.readFileSync(path.join(DIST, rel)), { level: 9 }).length;
const raw = (rel) => fs.statSync(path.join(DIST, rel)).size;
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

const rows = [];
for (const b of BUDGET) {
  const hits = b.file ? [b.file] : files.filter((f) => f.startsWith('assets/') && b.glob.test(path.basename(f)));
  if (!hits.length) {
    // The entry itself vanished: that is a naming change this script has not been told about.
    rows.push({ ...b, rel: '(missing)', over: true, hard: true, g: 0, r: 0, missing: true });
    continue;
  }
  for (const rel of hits) rows.push({ ...b, rel, g: gz(rel), r: raw(rel), over: gz(rel) > b.budget * 1024 });
}

console.log('');
console.log('  体积检查');
console.log('  ' + '─'.repeat(64));
console.log(`  ${'resource'.padEnd(34)}${'raw'.padStart(9)}${'gzip'.padStart(10)}   budget`);
for (const r of rows) {
  const flag = r.missing ? '✗ 找不到产物（改名了？请同步 perf.mjs）' : r.over ? `✗ 超 ${r.budget}KB` : '✓';
  console.log(`  ${r.rel.padEnd(44)}${kb(r.r).padStart(9)}${kb(r.g).padStart(10)}   ${String(r.budget).padStart(3)}KB ${r.hard ? '硬' : '软'}  ${flag}`);
}

const html = files.filter((f) => f.endsWith('.html') && !f.startsWith('portal/'));
const largest = html.map((f) => ({ f, g: gz(f) })).sort((a, b) => b.g - a.g).slice(0, 3);
console.log('');
console.log('  最大的 3 个页面（gzip）');
for (const { f, g } of largest) console.log(`    ${f.padEnd(42)} ${kb(g).padStart(9)}`);

const critical = rows.filter((r) => r.hard);
const criticalRaw = critical.reduce((s, r) => s + r.r, 0);
const criticalGz = critical.reduce((s, r) => s + r.g, 0);
const hardOver = critical.filter((r) => r.over).length;
const softOver = rows.filter((r) => !r.hard && r.over).length;
console.log('');
console.log(`  首屏合计（全站 CSS + 脚本 + 首页 HTML）  ${kb(criticalRaw)} → gzip ${kb(criticalGz)}`);
console.log(`  整站产物  ${files.length} 个文件，${kb(files.reduce((s, f) => s + raw(f), 0))}`);
if (softOver) console.log(`  ! ${softOver} 项软预算超标。要么优化，要么把预算调高——但要知道自己在付出什么代价。`);
console.log('');
process.exit(hardOver ? 1 : 0);
