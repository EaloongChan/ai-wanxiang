/**
 * 线上站点验证（零依赖，只发 HTTP 请求）
 *
 *   node scripts/verify-live.mjs
 *   node scripts/verify-live.mjs --base https://www.ealoongchan.top
 *
 * 部署完之后跑这个，确认线上真的是我们要的东西：首页、爬虫产物、关键页面、
 * 静态资源、旧地址跳转、404、安全响应头。
 * 本地构建通过了不等于线上部署对了——构建配置、重定向规则、缓存都可能出岔子。
 *
 * 只在部署之后运行：它不改任何东西，也不需要登录。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (() => {
  const i = process.argv.indexOf('--base');
  return (i !== -1 ? process.argv[i + 1] : '') || 'https://www.ealoongchan.top';
})().replace(/\/$/, '');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRAND = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.config.json'), 'utf8')).brand.name;
const UA = 'Mozilla/5.0 (compatible; EaloongDeployCheck/1.0)';

const results = [];
const ok = (name, detail = '') => results.push({ pass: true, name, detail });
const bad = (name, detail = '') => results.push({ pass: false, name, detail });
const line = (s = '') => console.log(s);

/**
 * One request, retried once on a network failure. This machine's link to the edge is
 * occasionally slow enough that a 20 s request is dropped; that is not a verdict on the
 * deployed site, so a single failure must not be reported as one.
 */
async function req(pathname, opts = {}) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeout || 25000);
    try {
      const res = await fetch(BASE + pathname, {
        redirect: 'manual',
        headers: { 'User-Agent': UA, ...(opts.headers || {}) },
        signal: ctl.signal,
      });
      const body = opts.head ? '' : await res.text();
      return { status: res.status, headers: res.headers, body };
    } catch (e) {
      lastError = e;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function main() {
  line('');
  line(`  线上验证  ${BASE}`);
  line('  ' + '─'.repeat(64));

  /* ---------- 1. 首页 ---------- */
  try {
    const r = await req('/');
    if (r.status !== 200) {
      bad('首页返回 200', `实际 ${r.status}`);
    } else {
      const title = (r.body.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
      if (r.body.includes(BRAND) && r.body.includes('id="games"')) ok('首页已是新站', `title「${title.slice(0, 40)}」`);
      else bad('首页不是新站', `title「${title.slice(0, 60)}」—— Vercel 可能还在部署上一版`);

      const canon = (r.body.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || '';
      if (canon === `${BASE}/`) ok('canonical 指向 www 域名', canon);
      else bad('canonical 不对', `实际「${canon}」`);

      const sec = ['x-content-type-options', 'referrer-policy', 'x-frame-options'].filter((k) => r.headers.get(k));
      if (sec.length >= 2) ok('安全响应头已生效', sec.join(', '));
      else bad('安全响应头缺失', `只有 ${sec.join(', ') || '无'}—— vercel.json 的 headers 可能没读到`);

      if (!/AI 万象|AI WANXIANG/.test(r.body)) ok('首页已无旧站残留');
      else bad('首页仍有旧站内容', '页面上出现了旧站名');
    }
  } catch (e) {
    bad('首页请求失败', e.message);
  }

  /* ---------- 2. 爬虫与接口 ---------- */
  for (const [pathname, name, test] of [
    ['/robots.txt', 'robots.txt', (b) => /Allow: \//.test(b) && /Sitemap:\s*https?:\/\/\S+\/sitemap\.xml/.test(b)],
    ['/sitemap.xml', 'sitemap.xml', (b) => b.includes('<urlset') && b.includes(`${BASE}/games/lumber-tycoon/`) && b.includes(`${BASE}/zh/`) && b.includes('hreflang="zh-CN"') && !b.includes('/en/')],
    ['/api/legacy/index.json', '旧数据集索引', (b) => { try { const j = JSON.parse(b); return !!j.datasets && Object.keys(j.datasets).length >= 11; } catch { return false; } }],
    ['/api/legacy/prompts.json', '旧提示词数据', (b) => { try { const j = JSON.parse(b); return Array.isArray(j) && j.length === 86; } catch { return false; } }],
  ]) {
    try {
      const r = await req(pathname);
      if (r.status === 200 && test(r.body)) ok(name, `${(r.body.length / 1024).toFixed(1)} KB`);
      else if (r.status !== 200) bad(name, `HTTP ${r.status}`);
      else bad(name, '内容不符合预期');
    } catch (e) {
      bad(name, e.message);
    }
  }

  /* ---------- 3. 关键页面 ---------- */
  const games = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'games.json'), 'utf8'));
  const tools = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tools.json'), 'utf8'));
  const pages = [
    ['/games/', '游戏列表', /game-card/],
    ...games.map((g) => [g.path, `游戏页 ${g.name}`, /id="game"/]),
    ['/tools/', '工具列表', /tool-card/],
    ...tools.map((t) => [t.path, `工具页 ${t.id}`, new RegExp(`data-tool="${t.id}"`)]),
    ['/about/', '关于页', /<h1>About<\/h1>/],
    ['/contact/', '联系页', /<h1>Contact<\/h1>/],
    ['/privacy/', '隐私页', /<h1>Privacy policy<\/h1>/],
    ['/zh/', '中文首页', /<html lang="zh-CN">/],
    ['/zh/games/lumber-tycoon/', '中文游戏页', /id="game"/],
    ['/zh/tools/sens-converter/', '中文工具页', /data-tool="sens-converter"/],
  ];
  for (const [pathname, name, test] of pages) {
    try {
      const r = await req(pathname);
      const size = (r.body.length / 1024).toFixed(0);
      if (r.status !== 200) bad(`${name} ${pathname}`, `HTTP ${r.status}`);
      else if (!test.test(r.body)) bad(`${name} ${pathname}`, `内容不符合预期（${size} KB）`);
      else ok(`${name} ${pathname}`, `${size} KB`);
    } catch (e) {
      bad(`${name} ${pathname}`, e.message);
    }
  }

  /* ---------- 4. 静态资源 ----------
     资源名带内容哈希，**不能写死 /assets/main.css** —— 以前这里就是写死的，于是这条检查
     恒为 404，等于"线上资源是否部署成功"从来没被验证过。从本地 dist/assets 解析真实文件名；
     解析不到就直接失败（说明该同步本脚本了）。 */
  const ASSET_DIR = path.join(ROOT, 'dist', 'assets');
  const assetFiles = fs.existsSync(ASSET_DIR) ? fs.readdirSync(ASSET_DIR) : [];
  const resolve = (pattern, name) => {
    const hit = assetFiles.find((n) => pattern.test(n));
    if (hit) return `/assets/${hit}`;
    bad(name, '本地 dist/assets 里找不到对应产物（构建过了吗 / 命名规则变了？）');
    return '';
  };
  const assets = [
    [resolve(/^main\.[0-9a-f]{7}\.css$/, '样式表'), '样式表'],
    [resolve(/^app\.[0-9a-f]{7}\.js$/, '全站脚本'), '全站脚本'],
    [resolve(/^game\.[0-9a-f]{7}\.css$/, '游戏样式'), '游戏样式'],
    [resolve(/^game-.+\.[0-9a-f]{7}\.js$/, '游戏脚本'), '游戏脚本'],
    ['/fonts/ibm-plex-sans-latin-400-normal.woff2', '自托管字体'],
    ['/og.png', '默认分享图'],
    ...games.map((g) => [g.cover, `封面 ${g.id}`]),
  ].filter(([p]) => p);
  for (const [pathname, name] of assets) {
    try {
      const r = await req(pathname, { head: true });
      if (r.status === 200) ok(name, `${pathname.split('/').pop()} · ${(r.headers.get('content-type') || '').trim()}`);
      else bad(name, `HTTP ${r.status}  ${pathname}`);
    } catch (e) {
      bad(name, e.message);
    }
  }

  /* ---------- 5. 跳转 ----------
     最要紧的两件事：旧地址要 301，新工具页**不能**被旧规则带走。 */
  const redirects = [
    ['/tools', '/tools/'],
    ['/en/tools/chat/chatgpt/', '/'],
    ['/playbooks/pb-weekly-report/', '/'],
    ['/prompts/writing/', '/tools/prompt-template-builder/'],
    ['/api/tools.json', '/api/legacy/tools.json'],
    ['/feed.xml', '/'],
  ];
  for (const [pathname, expect] of redirects) {
    try {
      const r = await req(pathname);
      const loc = r.headers.get('location') || '';
      if ([301, 308].includes(r.status) && loc.includes(expect)) ok(`旧地址 ${pathname}`, `${r.status} → ${loc}`);
      else bad(`旧地址跳转 ${pathname}`, `期望 → ${expect}，实际 ${r.status} ${loc || '(无 location)'}`);
    } catch (e) {
      bad(`旧地址跳转 ${pathname}`, e.message);
    }
  }
  for (const t of tools) {
    try {
      const r = await req(t.path, { head: true });
      if (r.status === 200) ok(`新工具页未被误伤 ${t.path}`, '200');
      else bad(`新工具页被跳转规则带走 ${t.path}`, `HTTP ${r.status} → ${r.headers.get('location') || ''}`);
    } catch (e) {
      bad(`新工具页 ${t.path}`, e.message);
    }
  }

  /* ---------- 6. 404 与裸域 ---------- */
  try {
    const r = await req('/this-page-does-not-exist-12345/');
    if (r.status === 404) ok('不存在的页面返回 404', '而非 200 软 404');
    else bad('404 处理异常', `返回 ${r.status}`);
  } catch (e) {
    bad('404 检查', e.message);
  }

  try {
    const apex = BASE.replace('//www.', '//');
    if (apex !== BASE) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15000);
      const res = await fetch(apex + '/', { redirect: 'manual', headers: { 'User-Agent': UA }, signal: ctl.signal });
      clearTimeout(t);
      const loc = res.headers.get('location') || '';
      if ([301, 302, 307, 308].includes(res.status) && loc.includes('www.')) ok('裸域跳到 www', `${res.status} → ${loc}`);
      else if (res.status === 200) ok('裸域直接可用', '没有跳转（也可以，但 canonical 要一致）');
      else bad('裸域行为异常', `${res.status} ${loc}`);
    }
  } catch (e) {
    bad('裸域检查', e.message);
  }

  /* ---------- 汇总 ---------- */
  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;
  line('');
  results.forEach((r) => line(`  ${r.pass ? '✓' : '✗'} ${r.name.padEnd(34)} ${r.detail}`));
  line('');
  line('  ' + '─'.repeat(64));
  line(`  通过 ${pass} / ${results.length}`);
  if (fail) {
    line('');
    line('  排查顺序建议：');
    line('    1. 首页还是旧站 → Vercel 项目 Settings 里 Framework Preset 应为 Other，Output Directory 为 dist');
    line('    2. 页面 404 一片 → 这次构建可能失败了，去 Deployments 看构建日志');
    line('    3. 旧地址不跳 → vercel.json 的 redirects 没生效，或部署时用了旧文件');
    line('    4. 新工具页被跳走 → 跳转规则与工具 id 冲突，跑 node scripts/redirects.mjs --check');
    line('');
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('  验证失败：', e.message);
  process.exit(1);
});
