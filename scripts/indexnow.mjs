/**
 * IndexNow 主动推送（零依赖，不需要任何账号和 token）
 *
 *   node scripts/indexnow.mjs           增量：只推上次之后新出现的 URL
 *   node scripts/indexnow.mjs --seed    首次播种：推首页 + 各栏目 + 最新详情页
 *   node scripts/indexnow.mjs --dry     只列出要推什么，不真推
 *   node scripts/indexnow.mjs --status  看已推过多少条、上次什么时候
 *
 * 为什么需要它：
 *   搜索引擎"自己发现"新站的周期很长（可能几周）。IndexNow 是「发布即通知」，
 *   Bing / Yandex / Seznam / Naver 都支持，而且**不需要备案、不需要 token、
 *   不需要登录任何后台** —— 只要域名下能访问到那个密钥文件。
 *   对比 push-search.mjs（百度）：那个必须去百度搜索资源平台拿 token，只有你能做。
 *
 * 两条纪律：
 *   1. **只推新增/变更的 URL**，不要每次推全站（记录在 data/indexnow-submitted.json）
 *   2. URL 清单**直接读 dist/sitemap.xml** —— 那份清单已经被 build 裁剪过
 *      （排除了 404），在这里再维护一套必然分叉
 *
 * 密钥文件放在 public/<key>.txt，构建时会被原样复制到 dist/ 根目录。
 * 生成/更换：node scripts/indexnow.mjs --new-key
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SITEMAP = path.join(ROOT, 'dist', 'sitemap.xml');
const STATE = path.join(ROOT, 'data', 'indexnow-submitted.json');
const SITE = process.env.SITE_HOST || 'www.ealoongchan.top';
const KEY_RE = /^[0-9a-f]{8,128}\.txt$/;

const SEED = process.argv.includes('--seed');
const ALL = process.argv.includes('--all');
const DRY = process.argv.includes('--dry');
const STATUS = process.argv.includes('--status');
const NEW_KEY = process.argv.includes('--new-key');

/* ---------- 密钥文件 ---------- */
const findKey = () => {
  for (const f of fs.readdirSync(PUBLIC)) {
    if (!KEY_RE.test(f)) continue;
    const content = fs.readFileSync(path.join(PUBLIC, f), 'utf8').trim();
    // 文件名必须等于内容，这是 IndexNow 的校验方式，不是随意约定
    if (content === f.replace(/\.txt$/, '')) return { file: f, key: content };
  }
  return null;
};

if (NEW_KEY) {
  const key = crypto.randomBytes(16).toString('hex');
  // 换密钥前先清掉旧的，避免留下多个校验文件（IndexNow 只认一个，多个会让人困惑）
  for (const f of fs.readdirSync(PUBLIC)) {
    if (KEY_RE.test(f) && fs.readFileSync(path.join(PUBLIC, f), 'utf8').trim() === f.replace(/\.txt$/, '')) {
      fs.unlinkSync(path.join(PUBLIC, f));
      console.log('  已删除旧密钥文件', f);
    }
  }
  fs.writeFileSync(path.join(PUBLIC, `${key}.txt`), key + '\n', 'utf8');
  console.log(`  已生成新密钥：public/${key}.txt`);
  console.log(`  推送地址将是 https://${SITE}/${key}.txt —— 构建部署后才会生效`);
  process.exit(0);
}

const found = findKey();
if (!found) {
  console.error('  ✗ public/ 下没有合法的 IndexNow 密钥文件');
  console.error('    生成一个：node scripts/indexnow.mjs --new-key');
  process.exit(1);
}
const KEY_URL = `https://${SITE}/${found.file}`;

/* ---------- 状态 ---------- */
const state = fs.existsSync(STATE)
  ? JSON.parse(fs.readFileSync(STATE, 'utf8'))
  : { lastRun: '', submitted: {} };
state.submitted = state.submitted || {};

if (STATUS) {
  const n = Object.keys(state.submitted).length;
  console.log(`  已推 ${n} 条，上次运行 ${state.lastRun || '（从未）'}`);
  console.log(`  密钥文件 ${KEY_URL}`);
  process.exit(0);
}

/* ---------- URL 清单：直接用 sitemap（已被 build 裁剪过） ---------- */
if (!fs.existsSync(SITEMAP)) {
  console.error('  ✗ 找不到 dist/sitemap.xml，先跑 node scripts/build.mjs');
  process.exit(1);
}
const xml = fs.readFileSync(SITEMAP, 'utf8');
const all = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const pending = all.filter((u) => !state.submitted[u]);

if (!pending.length) {
  console.log(`  sitemap 里 ${all.length} 条 URL 都已经推过，无需重复推送`);
  console.log(`  （IndexNow 明确要求不要重复推，重复会被降低信任）`);
  process.exit(0);
}

/* ---------- 决定这次推哪些 ---------- */
const PRIORITY = ['/$', '/games/$', '/tools/$', '/about/'];
let picked;
if (ALL) {
  /* 一次性补推：站点刚在 Bing 后台验证过、而 sitemap 那边还停在几个月前的旧记录
     （实测：Bing 只认 103 条，上次爬网时间是很久以前），等它慢慢处理不划算。
     Bing / Yandex 对已验证站点允许每天 1 万条，693 条完全在额度内，且不会重复推。 */
  picked = pending;
} else if (SEED) {
  const core = pending.filter((u) => PRIORITY.some((p) => new RegExp(p).test(u)));
  const rest = pending.filter((u) => !core.includes(u));
  // 播种时优先推「核心页 + 各栏目的最新详情页」，一次别推几百条（新站推送量要有节制）
  picked = core.concat(rest.slice(0, Math.max(0, 60 - core.length))).slice(0, 60);
} else {
  picked = pending.slice(0, 40);
}

console.log('');
console.log('  IndexNow 推送');
console.log('  ' + '─'.repeat(58));
console.log(`  sitemap 共 ${all.length} 条 · 已推 ${Object.keys(state.submitted).length} 条 · 本次待推 ${picked.length} 条`);
console.log(`  密钥 ${KEY_URL}`);
console.log('');
picked.slice(0, 12).forEach((u) => console.log('    ' + u.replace(`https://${SITE}`, '')));
if (picked.length > 12) console.log(`    … 还有 ${picked.length - 12} 条`);

if (DRY) {
  console.log('');
  console.log('  --dry：未实际推送');
  process.exit(0);
}

/* ---------- 推送 ---------- */
const body = { host: SITE, key: found.key, keyLocation: KEY_URL, urlList: picked };
let res;
try {
  res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  });
} catch (e) {
  console.error('');
  console.error(`  ✗ 推送请求失败：${e.message}`);
  console.error('    网络问题不影响站点，下次再跑即可');
  process.exit(1);
}

/* 200/202 = 受理。其他码的含义（官方文档）：
   400 格式错 / 403 密钥校验不过（密钥文件没部署或内容不对）/ 422 URL 不属于该 host / 429 推太快 */
const OK_CODE = res.status === 200 || res.status === 202;
const HINT = {
  400: '请求格式有问题',
  403: '密钥校验失败 —— 确认 https://' + SITE + '/' + found.file + ' 能打开、且内容就是那串 key',
  422: '有 URL 不属于该 host，或和 host 对不上',
  429: '推送太频繁，等一会儿再跑',
};
console.log('');
if (OK_CODE) {
  const now = new Date().toISOString();
  for (const u of picked) state.submitted[u] = now;
  state.lastRun = now;
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n', 'utf8');
  console.log(`  ✓ 已推送 ${picked.length} 条（HTTP ${res.status}），记录写入 data/indexnow-submitted.json`);
} else {
  console.error(`  ✗ 推送被拒：HTTP ${res.status}${HINT[res.status] ? ' —— ' + HINT[res.status] : ''}`);
  console.error('    未记录为已推，下次会重试');
  process.exit(1);
}
