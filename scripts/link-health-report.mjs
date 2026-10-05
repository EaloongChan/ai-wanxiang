/**
 * 外链巡检报告（把 data/outbound-health.json 翻译成人能看的 markdown）
 *
 *   node scripts/link-health-report.mjs           输出到 stdout
 *   node scripts/link-health-report.mjs --out f.md  写到文件
 *   node scripts/link-health-report.mjs --summary   只输出一行给 CI 摘要用
 *
 * 为什么单独一个脚本而不是写在 workflow 里：
 *   workflow 里的逻辑没法本地跑、没法测，还容易在引号转义上翻车。
 *   判定规则集中在这里，`gh issue` 只负责搬运。
 *
 * 分档规则（和 check-outbound.mjs 保持一致，别在这里重新发明）：
 *   dead     GET 也确认 404/410 —— 能在页面上提示用户
 *   moved    有效但跳走了 —— 只有**域名变了**才算「URL 该更新」，
 *            同域名换路径多半只是默认跳转/语言前缀，不值得动数据
 *   unknown  403/429/超时 —— 是反爬或网络问题，**永远不要报成坏链**
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, 'data', 'outbound-health.json');

const outArg = process.argv.indexOf('--out');
const OUT = outArg !== -1 ? process.argv[outArg + 1] : '';
const SUMMARY = process.argv.includes('--summary');
/** 只输出一个数字（失效条数），给 CI 判「要不要开 issue」用。
    这样 workflow 里就不用塞内联 node 脚本 —— 那种写法引号一多就坏，而且在本地没法测。 */
const COUNT = process.argv.includes('--dead-count');

let data = { checkedAt: '', items: {} };
try {
  data = JSON.parse(fs.readFileSync(STATE, 'utf8'));
} catch {
  console.error('读不到 data/outbound-health.json —— 先跑 node scripts/check-outbound.mjs');
  process.exit(2);
}

const rows = Object.entries(data.items || {}).map(([id, v]) => ({ id, ...v }));
const dead = rows.filter((r) => r.verdict === 'dead');
const unknown = rows.filter((r) => r.verdict === 'unknown');

/** 只有 host 变了才算真的换了域名 */
const hostOf = (u) => {
  try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; }
};

/* 地区封禁 / 反爬落地页，不能当成「新域名」。
   踩过：claude.ai 从国内访问会 302 到 claude.com/app-unavailable-in-region，
   照单全收就会把一个海外正常的域名改成「地区不可用」页 —— 用户点过去更差。
   这类落地页的共同点是 URL 里带着失败语义的词，命中就不动数据。 */
const BLOCKED_LANDING = /unavailable-in-region|not-available|denied|blocked|forbidden|access-?denied|geo-?block|captcha|challenge/i;

const isRealMove = (r) =>
  r.verdict === 'moved' &&
  hostOf(r.finalUrl) &&
  hostOf(r.finalUrl) !== hostOf(r.url) &&
  !BLOCKED_LANDING.test(r.finalUrl);

const realMove = rows.filter(isRealMove);
const pathMove = rows.filter((r) => r.verdict === 'moved' && !realMove.includes(r));
const blockedLanding = pathMove.filter((r) => BLOCKED_LANDING.test(r.finalUrl || ''));

const checkedAt = String(data.checkedAt || '').slice(0, 10);
const ageDays = data.checkedAt ? Math.floor((Date.now() - Date.parse(data.checkedAt)) / 864e5) : -1;

if (COUNT) {
  console.log(String(dead.length));
  process.exit(0);
}

if (SUMMARY) {
  console.log(`外链巡检 ${checkedAt || '（无记录）'}：检查 ${rows.length} 条 · 失效 ${dead.length} · 换域名 ${realMove.length} · 未能验证 ${unknown.length}`);
  process.exit(0);
}

const L = [];
L.push(`自动巡检结果，数据时间 **${checkedAt || '未知'}**${ageDays > 21 ? '（⚠️ 已过期，可能因为流水线失败）' : ''}。`);
L.push('');
L.push('| 结论 | 条数 | 含义 |');
L.push('|---|---:|---|');
L.push(`| 正常 | ${rows.length - dead.length - unknown.length - realMove.length - pathMove.length} | 能打开 |`);
L.push(`| **明确失效** | ${dead.length} | GET 也确认 404/410，工具页上已经给用户提示了 |`);
L.push(`| 换了域名 | ${realMove.length} | 有效但跳到了别的域名，**数据里的 URL 该更新** |`);
L.push(`| 同域换路径 | ${pathMove.length} | 多半只是默认跳转或语言前缀，一般不用动 |`);
L.push(`| 未能验证 | ${unknown.length} | 403 / 429 / 超时 —— 是反爬或网络问题，不是链接坏了 |`);
L.push('');

if (dead.length) {
  /* 升级提醒：连续多次检查都失败，说明这条已经被看过好几周却一直没处理。
     光说「失效 1 条」是不会有人动手的 —— 每次周报都长一样，读者就学会跳过它了。
     把「连续 N 次」摆到最前面，并明确写出两条出路（改 URL / 写进 caveat），
     否则这种条目会永远挂在失效列表里，慢慢把整份报告变成噪音。 */
  const stale = dead.filter((r) => (r.failCount || 0) >= 3).sort((a, b) => (b.failCount || 0) - (a.failCount || 0));
  if (stale.length) {
    L.push('## ⚠️ 长期未处理（连续 ≥3 次检查失败）');
    L.push('');
    for (const r of stale) {
      L.push(`- **${r.name}** —— 已连续 ${r.failCount} 次检查失败${r.firstFailedAt ? `，自 ${String(r.firstFailedAt).slice(0, 10)} 起就没通过` : ''}`);
      L.push(`  \`${r.url}\``);
      L.push('  → 二选一：查到新地址就更新 `url`；确认停运就把结论写进 `caveat` 并从失效名单里移出，');
      L.push('    这样它不会再每周出现一次占着版面（条目本身照旧保留，用户搜索仍能找到）。');
    }
    L.push('');
    L.push('> 说明：已知停运且故意保留历史地址的条目（例如 Tome）属于**已处理**状态，');
    L.push('> 如果它出现在这里，是提醒信息不够 —— 应该改进 caveat 的措辞，而不是重复处理。');
    L.push('');
  }
  L.push('## 明确失效（需要在页面/数据上处理）');
  L.push('');
  L.push('| 名称 | 状态 | 连续失败 | URL | 处理建议 |');
  L.push('|---|---:|---:|---|---|');
  for (const r of dead) L.push(`| ${r.name} | HTTP ${r.status} | ${r.failCount || 1} 次 | ${r.url} | 查到新域名就更新 URL；确认停运就把结论写进 caveat |`);
  L.push('');
}

if (realMove.length) {
  L.push('## 换了域名（建议更新 data 里的 url）');
  L.push('');
  L.push('| 名称 | 原地址 | 现在落到 |');
  L.push('|---|---|---|');
  for (const r of realMove) L.push(`| ${r.name} | ${r.url} | ${r.finalUrl} |`);
  L.push('');
}

if (blockedLanding.length) {
  L.push('## 被地区限制挡住（**不要**改数据里的 URL）');
  L.push('');
  L.push('这些站点对访问来源做了限制，抓到的是失败落地页。原域名对目标用户是好的，照单全收会把 URL 改坏。');
  L.push('');
  L.push('| 名称 | 数据里的地址 | 抓到的落地页 |');
  L.push('|---|---|---|');
  for (const r of blockedLanding) L.push(`| ${r.name} | ${r.url} | ${r.finalUrl} |`);
  L.push('');
}

L.push('## 怎么处理');
L.push('');
L.push('- **失效**：先人工搜一下这个产品是不是改了域名或停运，再动数据。');
L.push('  页面上的提示措辞是「最后一次自动检查访问不到」，不是「官网已关闭」——');
L.push('  连续失败不等于结论，绝不能凭 HTTP 码断定一个产品死了。');
L.push('- **换了域名**：核实后更新 `data/tools.json` 的 `url`，下一轮巡检会自动消掉。');
L.push('- **未能验证**：只在 GitHub runner（海外 IP）上跑得出的结论才可信，');
L.push('  本地在国内跑会把一堆海外站点判成超时。数量持续偏高时先查网络，别急着动数据。');
L.push('');
L.push('<sub>由 scripts/link-health-report.mjs 生成</sub>');

const body = L.join('\n');
if (OUT) {
  fs.writeFileSync(OUT, body);
  console.log(`已写入 ${OUT}（失效 ${dead.length} · 换域名 ${realMove.length}）`);
} else {
  console.log(body);
}
