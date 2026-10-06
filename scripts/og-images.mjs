/**
 * 生成每页专属的社交分享图（1200×630），零依赖，用本机 Chrome 直出
 *
 *   node scripts/og-images.mjs                为所有场景手册生成（中英各一张），已存在的跳过
 *   node scripts/og-images.mjs --force        重新生成全部
 *   node scripts/og-images.mjs --lang zh      只做中文
 *   node scripts/og-images.mjs --limit 3      只做前 3 篇（调样式时用）
 *
 * 为什么要有它：全站 698 个页面的 og:image 原来都是同一张 /og.png ——
 * 分享到微信/X/社媒时，工具页、手册页、首页长得完全一样，等于没有分享位。
 * 而手册是这个站最有差异化的内容，值得一张能看清「这篇讲什么」的图。
 *
 * 产物落在 public/og/<slug>.png，**跟着仓库走**（不是构建产物）：
 * 构建必须能在无 Chrome、无网络的环境跑通，所以生成与构建解耦 ——
 * 和「抓取与构建解耦」是同一个道理。构建时 layout 只检查文件在不在。
 *
 * 样式沿用站点的视觉体系（栅格纸底纹、1.5px 硬边框、等宽标签、衬线数字）。
 * 字体与 assets.mjs 一样必须**base64 内联**：data: 页面加载不到外部字体。
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const OUTDIR = path.join(PUB, 'og');
const PORT = Number(process.env.OG_PORT || 9226);

const FORCE = process.argv.includes('--force');
const LANG = (() => { const i = process.argv.indexOf('--lang'); return i !== -1 ? process.argv[i + 1] : 'both'; })();
const LIMIT = Number((() => { const i = process.argv.indexOf('--limit'); return i !== -1 ? process.argv[i + 1] : 0; })()) || 0;

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));

const get = (u) => new Promise((res, rej) => http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d)); }).on('error', rej));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.config.json'), 'utf8'));
const playbooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'playbooks.json'), 'utf8')).items;

const FONTS = fs.readdirSync(path.join(PUB, 'fonts'))
  .filter((f) => f.endsWith('.woff2'))
  .map((f) => {
    const m = f.match(/ibm-plex-(\w+)-latin-(\d+)-normal/);
    if (!m) return '';
    return `@font-face{font-family:'Plex ${m[1][0].toUpperCase() + m[1].slice(1)}';src:url('data:font/woff2;base64,${fs.readFileSync(path.join(PUB, 'fonts', f)).toString('base64')}') format('woff2');font-weight:${m[2]};}`;
  }).join('\n');

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* 标题按长度自动降字号：手册标题 9~22 字，固定 78px 会溢出 */
const titleSize = (t) => (t.length <= 12 ? 84 : t.length <= 16 ? 72 : t.length <= 20 ? 62 : 54);

const tpl = ({ kicker, title, sub, stats, foot }) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
/* 2026-10-06：跟着站点改版换成柔和圆角 —— 去掉栅格底纹与 1.5px 黑描边，
   改成「浅灰底 + 白色圆角卡片 + 层叠软影」。分享出去的第一眼要和站内一致。 */
body{width:1200px;height:630px;overflow:hidden;background:#f4f2ec;color:#0e0e0c;
  font-family:'Plex Sans',system-ui,sans-serif;position:relative}
.frame{position:absolute;inset:34px;border-radius:28px;background:#fff;
  box-shadow:0 2px 6px rgba(28,24,12,.06), 0 18px 44px rgba(28,24,12,.10);
  display:flex;flex-direction:column;padding:44px 48px}
.mono{font-family:'Plex Mono',monospace}
.top{display:flex;align-items:center;justify-content:space-between}
.logo{display:flex;align-items:center;gap:14px}
.mark{width:52px;height:52px;border-radius:14px;background:#ff3b00;display:grid;place-items:center;color:#fff;font-family:'Plex Mono',monospace;font-size:30px;font-weight:600}
.brand{font-size:26px;font-weight:700;letter-spacing:-.03em;line-height:1.05}
.brand small{display:block;font-family:'Plex Mono',monospace;font-size:10px;font-weight:500;letter-spacing:.24em;color:#78776d}
.kicker{font-family:'Plex Mono',monospace;font-size:12px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;background:#ff3b00;color:#fff;border-radius:999px;padding:7px 14px}
h1{margin-top:auto;font-size:${titleSize(title)}px;font-weight:700;letter-spacing:-.05em;line-height:1.06;
  box-decoration-break:clone;background:linear-gradient(to top,#ff3b00 0 .1em,transparent .1em);display:inline}
.sub{margin-top:22px;font-size:22px;color:#3f3f39;max-width:900px;line-height:1.5}
.bottom{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;border-top:1px solid #e3dfd4;padding-top:20px}
.stats{display:flex;gap:38px}
.stat b{display:block;font-family:'Plex Serif',serif;font-size:34px;font-weight:600;line-height:1;letter-spacing:-.02em}
.stat span{font-family:'Plex Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#78776d}
.domain{font-family:'Plex Mono',monospace;font-size:13px;letter-spacing:.1em;color:#78776d}
</style></head><body>
<div class="frame">
  <div class="top">
    <div class="logo">
      <span class="mark">象</span>
      <span class="brand">${esc(site.brand.name)}<small>${esc(site.brand.nameEn)}</small></span>
    </div>
    <span class="kicker">${esc(kicker)}</span>
  </div>
  <h1>${esc(title)}</h1>
  ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
  <div class="bottom">
    <div class="stats">${stats.map(([n, l]) => `<div class="stat"><b>${esc(n)}</b><span>${esc(l)}</span></div>`).join('')}</div>
    <span class="domain">${esc(foot)}</span>
  </div>
</div>
</body></html>`;

function cdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    ws.addEventListener('open', () => resolve({ send, close: () => ws.close() }));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    });
    function send(method, params = {}) {
      const my = ++id;
      return new Promise((res, rej) => { pending.set(my, { res, rej }); ws.send(JSON.stringify({ id: my, method, params })); });
    }
  });
}

async function shoot(c, html, out) {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false });
  await c.send('Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(html) });
  /* 等字体真正解码完再截，别用固定 sleep —— 固定值要么白等要么拍成 fallback 字体。
     踩过（assets.mjs 的注释里也写着）：data: 页面加载不到外部字体，必须内联 base64，
     并且截图前要等解码完成，否则会拍到回退字体。 */
  try {
    await c.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true, returnByValue: true });
  } catch { await sleep(900); }
  await sleep(120);
  const cap = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(out, Buffer.from(cap.data, 'base64'));
  return fs.statSync(out).size;
}

const slugOf = (p) => p.replace(/^\/|\/$/g, '').replace(/\//g, '-');

async function main() {
  if (!CHROME) { console.error('  ✗ 未找到 Chrome/Edge，无法生成分享图'); process.exit(1); }
  fs.mkdirSync(OUTDIR, { recursive: true });

  /* 任务表：中文站 + 英文站各一篇手册一张图 */
  const jobs = [];
  for (const pb of playbooks) {
    const stats = [
      [String((pb.steps || []).length), '步骤'],
      [String((pb.tools || []).length), '工具'],
      [String((pb.prompts || []).length), '提示词'],
    ];
    if (LANG !== 'en') {
      jobs.push({
        out: path.join(OUTDIR, slugOf(`/playbooks/${pb.id}/`) + '.png'),
        html: tpl({
          kicker: 'Playbook / 场景手册', title: pb.title, sub: pb.problem,
          stats: [[pb.time || '—', '耗时'], ...stats.slice(0, 2)],
          foot: (site.baseUrl || '').replace(/^https?:\/\//, '') + '/playbooks/',
        }),
      });
    }
    if (LANG !== 'zh' && pb.en) {
      jobs.push({
        out: path.join(OUTDIR, slugOf(`/en/playbooks/${pb.id}/`) + '.png'),
        html: tpl({
          kicker: 'Playbook', title: pb.en.title, sub: pb.en.problem,
          stats: [[pb.en.time || pb.time || '—', 'time'], ...stats.slice(0, 2).map(([n, l]) => [n, l === '步骤' ? 'steps' : l === '工具' ? 'tools' : 'prompts'])],
          foot: (site.baseUrl || '').replace(/^https?:\/\//, '') + '/en/playbooks/',
        }),
      });
    }
  }
  const todo = (LIMIT ? jobs.slice(0, LIMIT) : jobs).filter((j) => FORCE || !fs.existsSync(j.out));

  console.log('');
  console.log('  生成每页分享图');
  console.log('  ' + '─'.repeat(52));
  console.log(`  计划 ${jobs.length} 张 · 需要生成 ${todo.length} 张${todo.length !== jobs.length ? '（其余已存在，--force 可重做）' : ''}`);
  if (!todo.length) { console.log('  没有要生成的。'); console.log(''); return; }

  try { await get(`http://127.0.0.1:${PORT}/json/version`); }
  catch {
    spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu', '--no-first-run',
      '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'aiwx-og'), 'about:blank'],
      { detached: true, stdio: 'ignore' }).unref();
  }
  for (let i = 0; i < 40; i++) { try { await get(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(250); } }

  const list = JSON.parse(await get(`http://127.0.0.1:${PORT}/json/list`));
  const page = list.find((t) => t.type === 'page') || JSON.parse(await get(`http://127.0.0.1:${PORT}/json/new?about:blank`));
  const c = await cdp(page.webSocketDebuggerUrl);
  await c.send('Page.enable');
  await c.send('Runtime.enable');

  let total = 0;
  for (let i = 0; i < todo.length; i++) {
    const bytes = await shoot(c, todo[i].html, todo[i].out);
    total += bytes;
    const name = path.basename(todo[i].out);
    process.stdout.write(`\r  (${i + 1}/${todo.length}) ${name.padEnd(38)} ${(bytes / 1024).toFixed(0)} KB   `);
  }
  c.close();
  console.log('');
  console.log('');
  console.log(`  ✓ 生成 ${todo.length} 张，合计 ${(total / 1024 / 1024).toFixed(1)} MB`);
  console.log(`    目录 public/og/  ·  构建时 layout 会自动认领同名页面`);
  console.log('');
}

await main();
