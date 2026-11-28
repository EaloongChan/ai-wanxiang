/**
 * 无障碍审计（CDP 驱动真实浏览器，零依赖）
 *
 *   node scripts/a11y.mjs                审计默认页面集（浅色 + 深色）
 *   node scripts/a11y.mjs /tools/        只审计指定路径
 *   node scripts/a11y.mjs --theme=dark   只测深色
 *
 * 检查项：
 *   - 文字对比度（按 WCAG AA：正文 4.5:1，大字 3:1）
 *   - 图片缺少 alt
 *   - 可点击元素缺少无障碍名称（aria-label / 文本）
 *   - 表单控件缺少标签
 *   - 标题层级跳跃（h1 → h3 这种）
 *   - 重复 id
 *   - 触摸目标过小（< 24px）
 *   - 语言属性缺失
 *
 * 需要本机 Chrome，且 serve.mjs 已在 4173 端口运行。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.A11Y_PORT || 9225);
const SERVE = process.env.AUDIT_URL || 'http://127.0.0.1:4173';

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));

const PAGES = [
  '/', '/games/', '/games/lumber-tycoon/', '/tools/', '/about/', '/contact/', '/privacy/', '/404.html',
  // keep in step with data/tools.json so a new tool is audited from day one
  '/tools/sens-converter/', '/tools/fov-calculator/', '/tools/steam-id-converter/', '/tools/discord-timestamp/', '/tools/prompt-template-builder/',
  // Chinese tree: one of each page type, which is enough to catch layout problems
  '/zh/', '/zh/games/', '/zh/games/lumber-tycoon/', '/zh/tools/', '/zh/tools/sens-converter/', '/zh/tools/prompt-template-builder/', '/zh/about/', '/zh/privacy/',
];

const get = (u) => new Promise((res, rej) => http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d)); }).on('error', rej));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- 注入页面的审计逻辑 ---------------- */
const AUDIT = `(() => {
  const out = { contrast: [], noAlt: [], namelessBtn: [], unlabeledInput: [], headingJump: [],
                dupId: [], smallTarget: [], noLang: 0, landmarks: 0, counts: {} };

  const toRGB = (s) => {
    const m = String(s).match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  // 从自身往上找第一个不透明背景（跳过半透明层，简化处理）
  const effBg = (el) => {
    let p = el;
    while (p && p.nodeType === 1) {
      const bg = toRGB(getComputedStyle(p).backgroundColor);
      if (bg && bg.a >= 0.9) return bg;
      p = p.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const label = (el) => {
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    const t = (el.textContent || '').trim();
    if (t) return t.slice(0, 30);
    const img = el.querySelector('img[alt]');
    if (img) return img.getAttribute('alt');
    return '';
  };
  const sel = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = (el.className || '').toString().split(/\\s+/).filter(Boolean).slice(0, 2).join('.');
    if (cls) s += '.' + cls;
    return s;
  };

  out.noLang = document.documentElement.hasAttribute('lang') ? 0 : 1;
  out.landmarks = document.querySelectorAll('header, nav, main, footer').length;

  // 1. 对比度：只查有直接文本子节点的元素
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!direct) continue;
    const fg = toRGB(cs.color);
    if (!fg || fg.a < 0.1) continue;               // 透明文字（描边字等）跳过
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // 描边字用 -webkit-text-stroke 绘制，不是 fill，跳过对比度判断
    if (cs.webkitTextStrokeWidth && cs.webkitTextStrokeWidth !== '0px') continue;

    const size = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    const cr = ratio(fg, effBg(el));
    if (cr < need) {
      out.contrast.push({ sel: sel(el), text: el.textContent.trim().slice(0, 28), ratio: +cr.toFixed(2), need, size: Math.round(size), color: cs.color });
    }
  }

  // 2. 图片 alt
  //    注意排除 Chrome 自己注入的元素：headless 模式会往页面里塞
  //    #offline-resources-1x / -2x 两个 <img>（离线页图标），它们不属于我们的 DOM，
  //    报出来是误报。这类元素没有 alt 也无法修，只能跳过。
  for (const img of document.querySelectorAll('img')) {
    const id = img.id || '';
    if (id.startsWith('offline-resources')) continue;
    if (img.closest('[aria-hidden="true"]')) continue;
    if (!img.hasAttribute('alt')) out.noAlt.push(img.getAttribute('src') || '(no src)');
  }

  // 3. 可点击元素的无障碍名称
  for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (!label(el)) out.namelessBtn.push(sel(el));
  }

  // 4. 表单控件标签
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (el.type === 'hidden') continue;
    const id = el.id;
    const hasLabel = (id && document.querySelector('label[for="' + id + '"]'))
      || el.closest('label')
      || el.getAttribute('aria-label')
      || el.getAttribute('aria-labelledby')
      || el.getAttribute('title')
      || el.getAttribute('placeholder');
    if (!hasLabel) out.unlabeledInput.push(sel(el));
  }

  // 5. 标题层级跳跃
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => +h.tagName[1]);
  for (let i = 1; i < hs.length; i++) {
    if (hs[i] - hs[i - 1] > 1) out.headingJump.push('h' + hs[i - 1] + ' → h' + hs[i]);
  }
  out.counts.h1 = document.querySelectorAll('h1').length;

  // 6. 重复 id
  const seen = {};
  for (const el of document.querySelectorAll('[id]')) {
    seen[el.id] = (seen[el.id] || 0) + 1;
  }
  out.dupId = Object.entries(seen).filter(([, n]) => n > 1).map(([id, n]) => id + '×' + n);

  // 7. 触摸目标过小（只查独立可点元素）
  //    WCAG 2.5.8 明确豁免「句子中的行内文字链接」，以及被整块热区覆盖的元素，
  //    所以这里要排除：display:inline 且同辈里有其他文本的链接。
  const isInlineInSentence = (el) => {
    if (getComputedStyle(el).display !== 'inline') return false;
    const p = el.parentElement;
    if (!p) return false;
    const others = [...p.childNodes].filter((n) => n !== el && n.textContent.trim().length > 1);
    return others.length > 0;
  };
  for (const el of document.querySelectorAll('button, a[href], [role="button"], input[type="checkbox"], input[type="radio"]')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') continue;
    if (el.closest('dialog:not([open])')) continue;  // 控件在未打开的对话框里，量不到真实尺寸
    if (isInlineInSentence(el)) continue;           // 句内文字链接豁免
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width < 24 || r.height < 24) {
      out.smallTarget.push({ sel: sel(el), w: Math.round(r.width), h: Math.round(r.height), text: (label(el) || '').slice(0, 20) });
    }
  }

  return JSON.stringify(out);
})()`;

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

  if (!CHROME) { console.error('  未找到 Chrome/Edge'); process.exit(1); }
  try { await get(`http://127.0.0.1:${PORT}/json/version`); }
  catch {
    spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu', '--no-first-run',
      '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'ealoong-a11y'), 'about:blank'],
      { detached: true, stdio: 'ignore' }).unref();
  }
  for (let i = 0; i < 40; i++) { try { await get(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(250); } }

  const list = JSON.parse(await get(`http://127.0.0.1:${PORT}/json/list`));
  const page = list.find((t) => t.type === 'page') || JSON.parse(await get(`http://127.0.0.1:${PORT}/json/new?about:blank`));
  const c = await cdp(page.webSocketDebuggerUrl);
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  const evaluate = async (expr) => {
    const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval error');
    return r.result.value;
  };

  const only = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
  // The site is dark only; --theme=light stays available for a future light theme.
  const themes = process.argv.includes('--theme=light') ? ['light'] : ['dark'];
  const pages = only ? [only] : PAGES;

  const totals = { contrast: 0, namelessBtn: 0, unlabeledInput: 0, noAlt: 0, headingJump: 0, dupId: 0, smallTarget: 0, noLang: 0 };
  const seen = new Set();
  const details = [];

  console.log('');
  console.log('  无障碍审计  ' + SERVE);
  console.log('  ' + '─'.repeat(64));

  for (const theme of themes) {
    console.log(`\n  [${theme === 'dark' ? '深色' : '浅色'}主题]`);
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });

    for (const p of pages) {
      const url = SERVE + p + (p.includes('?') ? '&' : '?') + 'theme=' + theme;
      await c.send('Page.navigate', { url });
      await sleep(700);
      let d;
      try { d = JSON.parse(await evaluate(AUDIT)); }
      catch (e) { console.log(`  ✗ ${p}  求值失败：${e.message.slice(0, 60)}`); continue; }

      const flags = [];
      const add = (key, n, label) => { if (n) { totals[key] += 0; flags.push(`${label} ${n}`); } };
      add('contrast', d.contrast.length, '对比度不足');
      add('namelessBtn', d.namelessBtn.length, '无可访问名称');
      add('unlabeledInput', d.unlabeledInput.length, '控件缺标签');
      add('noAlt', d.noAlt.length, '图片缺 alt');
      add('headingJump', d.headingJump.length, '标题跳级');
      add('dupId', d.dupId.length, '重复 id');
      add('smallTarget', d.smallTarget.length, '目标过小');
      if (d.noLang) flags.push('缺少 lang');
      if (d.counts.h1 !== 1) flags.push(`h1 ${d.counts.h1} 个`);

      // 去重累计（同一问题在不同主题/页面重复出现只算一类）
      const bump = (key, arr, sig) => {
        arr.forEach((x) => {
          const k = sig(x);
          if (!seen.has(k)) { seen.add(k); totals[key]++; }
        });
      };
      bump('contrast', d.contrast, (x) => `c:${x.sel}:${x.ratio}`);
      bump('namelessBtn', d.namelessBtn, (x) => `n:${x}`);
      bump('unlabeledInput', d.unlabeledInput, (x) => `i:${x}`);
      bump('noAlt', d.noAlt, (x) => `a:${x}`);
      bump('headingJump', d.headingJump, (x) => `h:${x}`);
      bump('dupId', d.dupId, (x) => `d:${x}`);
      bump('smallTarget', d.smallTarget, (x) => `s:${x.sel}:${x.w}x${x.h}`);
      totals.noLang += d.noLang;

      if (flags.length) {
        console.log(`  ✗ ${p}  →  ${flags.join(' / ')}`);
        if (d.contrast.length) {
          d.contrast.slice(0, 3).forEach((x) => console.log(`       对比度 ${x.ratio}:1（需 ${x.need}）${x.size}px  ${x.sel}  「${x.text}」`));
          if (d.contrast.length > 3) console.log(`       … 另有 ${d.contrast.length - 3} 处`);
        }
        if (d.namelessBtn.length) console.log(`       无可访问名称：${d.namelessBtn.slice(0, 4).join(', ')}`);
        if (d.unlabeledInput.length) console.log(`       控件缺标签：${d.unlabeledInput.slice(0, 4).join(', ')}`);
        if (d.dupId.length) console.log(`       重复 id：${d.dupId.slice(0, 4).join(', ')}`);
        if (d.headingJump.length) console.log(`       标题跳级：${[...new Set(d.headingJump)].slice(0, 4).join(', ')}`);
        if (d.smallTarget.length) console.log(`       目标过小：${d.smallTarget.slice(0, 4).map((x) => `${x.sel}(${x.w}×${x.h})`).join(', ')}`);
      } else {
        console.log(`  ✓ ${p}`);
      }
      details.push({ theme, p, d });
    }
  }

  c.close();

  const total = Object.values(totals).reduce((a, b) => a + b, 0);
  console.log('\n  ' + '─'.repeat(64));
  console.log(`  去重后问题合计：${total}`);
  Object.entries(totals).forEach(([k, v]) => { if (v) console.log(`    ${k}: ${v}`); });
  console.log('');
  process.exit(total > 0 ? 1 : 0);
}

main().catch((e) => { console.error('  审计失败：', e.message); process.exit(1); });
