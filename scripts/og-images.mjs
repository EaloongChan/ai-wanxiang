/**
 * Social share images (1200×630), rendered by the local copy of Chrome. Zero dependencies.
 *
 *   node scripts/og-images.mjs             one image per game, tool and long-form page; existing files are kept
 *   node scripts/og-images.mjs --force     redraw everything
 *   node scripts/og-images.mjs --limit 2   only the first two jobs (while tuning the style)
 *
 * Why: every page used to share the same picture, so a link to a game looked like a link
 * to a privacy policy. layout.mjs picks the image up automatically when it is named
 * after the page path (/games/lumber-tycoon/ → public/og/games-lumber-tycoon.png).
 *
 * Output goes to public/og/ and is committed with the site. The build must run on a
 * machine with no browser, so rendering is a separate step: build → og → commit.
 *
 * Fonts are inlined as data: URLs because a data: page cannot load external fonts.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const OUTDIR = path.join(PUB, 'og');
const PORT = Number(process.env.OG_PORT || 9226);

const arg = (name) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : ''; };
const FORCE = process.argv.includes('--force');
const LIMIT = Number(arg('--limit')) || 0;

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
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));

const FONTS = fs.existsSync(path.join(PUB, 'fonts'))
  ? fs.readdirSync(path.join(PUB, 'fonts'))
    .filter((f) => f.endsWith('.woff2'))
    .map((f) => {
      const m = f.match(/^ibm-plex-(\w+)-latin-(\d+)-normal/);
      if (!m) return '';
      const family = m[1][0].toUpperCase() + m[1].slice(1);
      return `@font-face{font-family:'Plex ${family}';src:url('data:font/woff2;base64,${fs.readFileSync(path.join(PUB, 'fonts', f)).toString('base64')}') format('woff2');font-weight:${m[2]};}`;
    })
    .join('\n')
  : '';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Titles range from "FOV Calculator" to "Mouse sensitivity converter…": shrink by length so nothing is cut. */
const titleSize = (t) => (t.length <= 16 ? 92 : t.length <= 26 ? 76 : t.length <= 40 ? 60 : 48);

const page = ({ kicker, title, sub, foot }) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#0b0e17;color:#eef1f7;font-family:'Plex Sans',system-ui,sans-serif;position:relative}
.frame{position:absolute;inset:34px;border-radius:28px;background:#111624;border:1px solid #2a3450;
  box-shadow:0 24px 60px rgba(0,0,0,.5);display:flex;flex-direction:column;padding:44px 48px;overflow:hidden}
.frame::before{content:'';position:absolute;width:520px;height:520px;right:-160px;top:-200px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,176,32,.22),transparent 65%)}
.frame::after{content:'';position:absolute;width:460px;height:460px;left:-180px;bottom:-220px;border-radius:50%;
  background:radial-gradient(circle,rgba(63,214,197,.16),transparent 65%)}
.top{display:flex;align-items:center;justify-content:space-between;position:relative}
.logo{display:flex;align-items:center;gap:14px}
.mark{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#ffb020,#ff7a1a);display:grid;place-items:center;color:#1a1200;font-family:'Plex Mono',monospace;font-size:20px;font-weight:600;letter-spacing:-.04em}
.brand{font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1.05}
.kicker{font-family:'Plex Mono',monospace;font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#ffc855;border:1px solid rgba(255,176,32,.55);border-radius:999px;padding:8px 16px}
h1{margin-top:auto;font-size:${titleSize(title)}px;font-weight:700;letter-spacing:-.035em;line-height:1.04;position:relative;max-width:1000px}
.sub{margin-top:20px;font-size:23px;line-height:1.45;color:#b4bdd0;max-width:940px;position:relative}
.bottom{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;border-top:1px solid #2a3450;padding-top:20px;position:relative;font-family:'Plex Mono',monospace;font-size:14px;color:#8d97ae}
</style></head><body>
<div class="frame">
  <div class="top"><div class="logo"><span class="mark">${esc(site.brand.logoText)}</span><span class="brand">${esc(site.brand.name)}</span></div><span class="kicker">${esc(kicker)}</span></div>
  <h1>${esc(title)}</h1>
  ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
  <div class="bottom"><span>${esc(foot)}</span><span>${esc((site.baseUrl || '').replace(/^https?:\/\//, ''))}</span></div>
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

/**
 * Render jobs = [{ out, html, width, height }] through one headless Chrome session.
 * Resolves to the list of written files. Throws if no browser is available.
 */
export async function shoot(jobs) {
  if (!CHROME) throw new Error('no Chrome or Edge found');
  fs.mkdirSync(OUTDIR, { recursive: true });
  try { await get(`http://127.0.0.1:${PORT}/json/version`); }
  catch {
    spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu', '--no-first-run',
      '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'ealoong-og'), 'about:blank'],
      { detached: true, stdio: 'ignore' }).unref();
  }
  for (let i = 0; i < 40; i++) { try { await get(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(250); } }

  const list = JSON.parse(await get(`http://127.0.0.1:${PORT}/json/list`));
  const target = list.find((t) => t.type === 'page') || JSON.parse(await get(`http://127.0.0.1:${PORT}/json/new?about:blank`));
  const c = await cdp(target.webSocketDebuggerUrl);
  await c.send('Page.enable');
  await c.send('Runtime.enable');

  for (let i = 0; i < jobs.length; i++) {
    const j = jobs[i];
    await c.send('Emulation.setDeviceMetricsOverride', { width: j.width || 1200, height: j.height || 630, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(j.html) });
    // Wait for the fonts to decode instead of guessing with a fixed sleep: a wrong guess photographs a fallback font.
    try { await c.send('Runtime.evaluate', { expression: 'document.fonts.ready.then(()=>1)', awaitPromise: true, returnByValue: true }); }
    catch { await sleep(900); }
    await sleep(120);
    const cap = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const buf = Buffer.from(cap.data, 'base64');
    if (!j.out) { j.png = buf; continue; }        // caller takes the bytes
    fs.mkdirSync(path.dirname(j.out), { recursive: true });
    fs.writeFileSync(j.out, buf);
    j.png = buf;
    process.stdout.write(`\r  (${i + 1}/${jobs.length}) ${path.basename(j.out).padEnd(40)} ${(buf.length / 1024).toFixed(0)} KB   `);
  }
  c.close();
  return jobs;
}

const slugOf = (p) => p.replace(/^\/|\/$/g, '').replace(/\//g, '-');

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const jobs = [];
  const KICKER = {
    en: { game: 'Game · Play free in your browser', tool: 'Gamer tool · Free, no sign-up', brand: 'Ealoong Arcade', games: 'Ealoong Arcade · Games', tools: 'Ealoong Arcade · Tools' },
    zh: { game: '游戏 · 浏览器里免费玩', tool: '玩家工具 · 免费，不用注册', brand: 'Ealoong Arcade', games: 'Ealoong Arcade · 游戏', tools: 'Ealoong Arcade · 工具' },
  };
  for (const lang of ['en', 'zh']) {
    const prefix = lang === 'zh' ? 'zh-' : '';
    const k = KICKER[lang];
    for (const g of read('games.json')) {
      jobs.push({ out: path.join(OUTDIR, `${prefix}${slugOf(g.path)}.png`), html: page({ kicker: k.game, title: (lang === 'zh' && g.zh && g.zh.name) || g.name, sub: (lang === 'zh' && g.zh && g.zh.tagline) || g.tagline, foot: k.games }) });
    }
    for (const t of read('tools.json')) {
      jobs.push({ out: path.join(OUTDIR, `${prefix}${slugOf(t.path)}.png`), html: page({ kicker: k.tool, title: (lang === 'zh' && t.zh && t.zh.name) || t.name, sub: (lang === 'zh' && t.zh && t.zh.summary) || t.summary, foot: k.tools }) });
    }
    for (const [slug, d] of Object.entries(read('pages.json'))) {
      if (slug.startsWith('$')) continue;
      jobs.push({ out: path.join(OUTDIR, `${prefix}${slug}.png`), html: page({ kicker: k.brand, title: (lang === 'zh' && d.zh && d.zh.title) || d.title, sub: (lang === 'zh' && d.zh && d.zh.lead) || d.lead, foot: (lang === 'zh' && site.brand.zh && site.brand.zh.tagline) || site.brand.tagline }) });
    }
  }
  const todo = (LIMIT ? jobs.slice(0, LIMIT) : jobs).filter((j) => FORCE || !fs.existsSync(j.out));

  console.log('');
  console.log('  分享图');
  console.log('  ' + '─'.repeat(56));
  console.log(`  共 ${jobs.length} 张 · 需要生成 ${todo.length} 张${todo.length !== jobs.length ? '（其余已存在，--force 重做）' : ''}`);
  if (!todo.length) { console.log('  没有要生成的。'); console.log(''); process.exit(0); }
  try {
    await shoot(todo);
    console.log('');
    console.log(`  ✓ 已写入 public/og/，构建时 layout 会按路径自动认领`);
    console.log('');
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    process.exit(1);
  }
}
