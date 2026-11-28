/**
 * 页面审计（基于 Chrome DevTools Protocol，零依赖）
 *
 *   node scripts/audit.mjs              审计 dist/ 主要页面
 *   node scripts/audit.mjs /tools/      只审计指定路径
 *
 * 检查项：
 *   - 横向溢出（元素宽度超出视口）
 *   - 控制台报错 / 资源加载失败
 *   - 空链接、缺 href
 *   - 标题、描述缺失
 *
 * 依赖本机 Chrome，默认端口 9222。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

const PORT = Number(process.env.AUDIT_PORT || 9222);
const SERVE = process.env.AUDIT_URL || 'http://127.0.0.1:4173';

const PAGES = [
  '/', '/games/', '/games/lumber-tycoon/', '/tools/', '/about/', '/contact/', '/privacy/', '/404.html',
  // keep in step with data/tools.json so a new tool is audited from day one
  '/tools/sens-converter/', '/tools/fov-calculator/', '/tools/steam-id-converter/', '/tools/discord-timestamp/', '/tools/prompt-template-builder/',
  // Chinese tree: one of each page type, which is enough to catch layout problems
  '/zh/', '/zh/games/', '/zh/games/lumber-tycoon/', '/zh/tools/', '/zh/tools/sens-converter/', '/zh/tools/prompt-template-builder/', '/zh/about/', '/zh/privacy/',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'narrow', width: 414, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (fs.existsSync(p)) return p;
  return null;
}

const get = (url) =>
  new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForChrome(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const v = JSON.parse(await get(`http://127.0.0.1:${PORT}/json/version`));
      if (v.webSocketDebuggerUrl) return v;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome 调试端口未就绪');
}

function cdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    const events = [];
    ws.addEventListener('open', () => resolve({ send, on, close: () => ws.close(), events }));
    ws.addEventListener('error', (e) => reject(e));
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      } else if (msg.method) {
        events.push(msg);
      }
    });
    function send(method, params = {}) {
      const myId = ++id;
      return new Promise((res, rej) => {
        pending.set(myId, { res, rej });
        ws.send(JSON.stringify({ id: myId, method, params }));
      });
    }
    function on(fn) { events.push = events.push.bind(events); fn(events); }
  });
}

const EXPR = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = { vw, sw: document.documentElement.scrollWidth, overflow: [], meta: {} };

  // 若某个祖先节点已裁剪溢出（overflow 非 visible），则该元素不会造成页面横向滚动
  const clipped = (el) => {
    let p = el.parentElement;
    while (p && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' && cs.overflowX !== 'clip') return true;
      if (cs.overflow !== 'visible') return true;
      p = p.parentElement;
    }
    return false;
  };

  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.position === 'fixed') continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const right = r.right + window.scrollX;
    if (right > vw + 1.5 && !clipped(el)) {
      out.overflow.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && String(el.className).slice(0, 60)) || '',
        right: Math.round(right),
        width: Math.round(r.width),
        text: (el.textContent || '').trim().slice(0, 40),
      });
    }
  }
  out.overflow = out.overflow.slice(0, 12);
  out.meta.title = document.title;
  out.meta.desc = (document.querySelector('meta[name=description]') || {}).content || '';
  out.meta.h1 = document.querySelectorAll('h1').length;
  out.meta.emptyLinks = [...document.querySelectorAll('a')].filter(a => !a.getAttribute('href') || a.getAttribute('href') === '#').length;
  out.meta.imgNoAlt = [...document.querySelectorAll('img')].filter(i => !i.alt).length;
  return JSON.stringify(out);
})()`;


/**
 * 前置校验：本地服务必须真的在跑，而且返回的是我们的页面。
 *
 * 踩过一次：预览服务挂了，CDP 加载到的是 Chrome 的「无法访问此网站」错误页，
 * 检查脚本照样跑完，还输出了「图片缺 alt 2 / 目标过小 1」这种莫名其妙的结论 ——
 * 因为在测的是 Chrome 的错误页，不是我们的站。
 * 这和「部署失败但线上看着正常」是同一类问题：**检查在验证错误的对象**。
 * 所以先确认可达 + 内容标记正确，否则直接退出，不要给出任何结论。
 */
async function assertServeUp() {
  const hint = '    先启动本地服务：node scripts/serve.mjs';
  try {
    const res = await fetch(SERVE, { signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    if (res.status !== 200) {
      console.error('\n  ✗ ' + SERVE + ' 返回 HTTP ' + res.status + '\n' + hint + '\n');
      process.exit(1);
    }
    if (!/Ealoong Arcade/.test(html)) {
      console.error('\n  ✗ ' + SERVE + ' 返回的不是本站页面（内容标记不匹配）\n' + hint + '\n');
      process.exit(1);
    }
  } catch (e) {
    console.error('\n  ✗ 连不上 ' + SERVE + '：' + e.message + '\n' + hint + '\n');
    process.exit(1);
  }
}

async function main() {
  await assertServeUp();

  const chrome = findChrome();
  if (!chrome) {
    console.error('  未找到 Chrome/Edge，跳过审计');
    process.exit(1);
  }
  try {
    await get(`http://127.0.0.1:${PORT}/json/version`);
  } catch {
    spawn(chrome, [
      '--headless=new', `--remote-debugging-port=${PORT}`,
      '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'ealoong-audit'),
      'about:blank',
    ], { detached: true, stdio: 'ignore' }).unref();
  }
  await waitForChrome();

  const targets = JSON.parse(await get(`http://127.0.0.1:${PORT}/json/list`));
  let page = targets.find((t) => t.type === 'page');
  if (!page) page = JSON.parse(await get(`http://127.0.0.1:${PORT}/json/new?about:blank`));

  const c = await cdp(page.webSocketDebuggerUrl);
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  await c.send('Log.enable');

  const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  const shot = process.argv.includes('--shot');
  const shotDir = path.join(ROOT, '.audit');
  if (shot) fs.mkdirSync(shotDir, { recursive: true });
  const pages = only ? [only] : PAGES;
  let problems = 0;

  console.log('');
  console.log('  页面审计  ' + SERVE);
  console.log('  ' + '─'.repeat(60));

  for (const vp of VIEWPORTS) {
    await c.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width, height: vp.height, deviceScaleFactor: 1, mobile: !!vp.mobile,
    });
    console.log(`\n  [${vp.name} ${vp.width}px]`);

    for (const p of pages) {
      c.events.length = 0;
      await c.send('Page.navigate', { url: SERVE + p });
      await sleep(900);
      let r;
      try {
        r = await c.send('Runtime.evaluate', { expression: EXPR, returnByValue: true });
      } catch (e) {
        console.log(`   ✗ ${p}  求值失败`);
        problems++;
        continue;
      }
      const d = JSON.parse(r.result.value);

      if (shot) {
        try {
          const cap = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
          const slug = p.replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '') || 'home';
          const name = `${vp.name}__${slug}.png`;
          fs.writeFileSync(path.join(shotDir, name), Buffer.from(cap.data, 'base64'));
        } catch {}
      }

      const errs = c.events.filter((e) => e.method === 'Log.entryAdded' && e.params.entry.level === 'error');
      const flags = [];
      if (d.overflow.length) flags.push(`横向溢出 ${d.overflow.length} 处`);
      if (errs.length) flags.push(`控制台报错 ${errs.length}`);
      if (!d.meta.title) flags.push('缺 title');
      if (!d.meta.desc) flags.push('缺 description');
      if (d.meta.h1 !== 1) flags.push(`h1 数量 ${d.meta.h1}`);
      if (d.meta.emptyLinks) flags.push(`空链接 ${d.meta.emptyLinks}`);

      if (!flags.length) {
        console.log(`   ✓ ${p}`);
      } else {
        problems += flags.length;
        console.log(`   ✗ ${p}  →  ${flags.join(' / ')}`);
        (d.overflow || []).slice(0, 5).forEach((o) => {
          console.log(`       溢出 <${o.tag} class="${o.cls}"> right=${o.right} w=${o.width} "${o.text}"`);
        });
        errs.slice(0, 3).forEach((e) => console.log(`       console: ${e.params.entry.text.slice(0, 120)}`));
      }
    }
  }

  c.close();
  console.log('');
  console.log('  ' + '─'.repeat(60));
  console.log(problems ? `  发现 ${problems} 个问题` : '  全部通过');
  console.log('');
  process.exit(problems ? 1 : 0);
}

main().catch((e) => {
  console.error('  审计失败：', e.message);
  process.exit(1);
});
