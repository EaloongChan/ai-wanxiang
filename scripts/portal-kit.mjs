/**
 * Build the submission kit for a game portal.
 *
 *   node scripts/portal-kit.mjs            every game
 *   node scripts/portal-kit.mjs <id>       one game
 *
 * Reads the self-contained package from build/portal/ and writes, per game:
 *
 *   build/portal-kit/<id>/description-en.txt   paste-ready short description
 *   build/portal-kit/<id>/tags.txt             comma-separated tags
 *   build/portal-kit/<id>/screenshots/1280x720/01-start.png … 03-upgrades.png
 *   build/portal-kit/<id>/screenshots/800x600/…
 *   build/portal-kit/<id>/manifest.json        what was generated, from which source
 *
 * Screenshots are taken in the real package, not from the site, so what a reviewer sees is
 * exactly what they will run. Zero dependencies: a local Chrome plus the DevTools protocol.
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG_DIR = path.join(ROOT, 'build', 'portal');
const KIT_DIR = path.join(ROOT, 'build', 'portal-kit');
const ONKY = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (url) => new Promise((res, rej) => http.get(url, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d)); }).on('error', rej));

function freePort(start) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(freePort(start + 1)));
    srv.once('listening', () => srv.close(() => resolve(start)));
    srv.listen(start, '127.0.0.1');
  });
}

/** Minimal CDP client: enough to drive one page. */
function cdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        const mine = ++id;
        return new Promise((res, rej) => { pending.set(mine, { res, rej }); ws.send(JSON.stringify({ id: mine, method, params })); });
      },
      close: () => ws.close(),
    }));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    });
  });
}

/** Click the canvas the way a player would: real pointer events at a point on the tree. */
const SWING = `(function(n){const cv=document.getElementById('stage');const b=cv.getBoundingClientRect();
  for(let i=0;i<n;i++){cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:b.left+b.width*0.45+Math.random()*70,clientY:b.top+b.height*0.5+Math.random()*70,button:0,pointerId:1,bubbles:true,cancelable:true}));}
  return n;})`;

const TAGS = {
  'lumber-tycoon': ['idle', 'incremental', 'clicker', 'tycoon', 'lumber', 'steampunk', 'upgrades', 'prestige', 'one-player', 'browser'],
};

/**
 * Most portals cap the short description at 300 characters and cut the rest without warning,
 * so the sentences are ordered by importance and the tail is dropped rather than truncated
 * mid-word.
 */
function describe(game, config) {
  const parts = [
    `${game.name} is an idle lumber tycoon in a forest of brass and clockwork trees.`,
    `Chop with a hand axe, hire clockwork choppers that keep working while you are away, and unlock ${config.zones.length} districts of rarer wood.`,
    'Rare trees drop gears for the strongest upgrades; rewind the Great Clock for permanent bonuses.',
    'No download, no account. Mouse, keyboard or touch.',
  ];
  while (parts.join(' ').length > 300 && parts.length > 1) parts.pop();
  return parts.join(' ');
}

async function shoot(c, { width, height, outDir, prefix }) {
  const shot = async (file) => {
    // Capture an explicit clip: the emulated viewport is what the portal will see, so the
    // file must be exactly the size the portal asked for, whatever the OS scaling is.
    const { data } = await c.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      clip: { x: 0, y: 0, width, height, scale: 1 },
    });
    fs.writeFileSync(path.join(outDir, `${prefix}${file}.png`), Buffer.from(data, 'base64'));
  };
  await shot('01-start');
  await c.eval(`${SWING}(70)`);
  await sleep(260);
  await shot('02-play');
  await c.eval(`document.getElementById('drawerToggle').click(); 1`);
  await sleep(700);
  await shot('03-upgrades');
  await c.eval(`document.getElementById('drawerToggle').click(); 1`);
}

async function main() {
  if (!fs.existsSync(PKG_DIR)) {
    console.error('  build/portal is missing — run: node scripts/build.mjs');
    process.exit(1);
  }
  if (!CHROME) {
    console.error('  No Chrome/Edge found. Install one, or take the screenshots by hand.');
    process.exit(1);
  }

  const games = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'games.json'), 'utf8'))
    .filter((g) => !ONKY || g.id === ONKY);
  const port = await freePort(9231);
  const profile = path.join(process.env.TEMP || '/tmp', 'ealoong-portal-kit');
  fs.rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--window-size=1280,720', 'about:blank',
  ], { stdio: 'ignore' });

  let c;
  try {
    for (let i = 0; i < 40; i++) {
      try { await get(`http://127.0.0.1:${port}/json/list`); break; } catch { await sleep(150); }
    }
    const list = JSON.parse(await get(`http://127.0.0.1:${port}/json/list`));
    c = await cdp(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await c.send('Runtime.enable');
    await c.send('Page.enable');
    c.eval = async (expr) => {
      const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'evaluate failed');
      return r.result.value;
    };

    console.log('');
    console.log('  Portal submission kit');
    console.log('  ' + '─'.repeat(64));

    for (const g of games) {
      const pkg = path.join(PKG_DIR, g.id);
      const index = path.join(pkg, 'index.html');
      if (!fs.existsSync(index)) { console.log(`  ! ${g.id}: no package (build first)`); continue; }
      const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'games', g.id, 'config.json'), 'utf8'));
      const out = path.join(KIT_DIR, g.id);
      fs.rmSync(out, { recursive: true, force: true });

      const description = describe(g, config);
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, 'description-en.txt'), `${description}\n`);
      fs.writeFileSync(path.join(out, 'tags.txt'), `${(TAGS[g.id] || ['idle', 'browser']).join(', ')}\n`);

      for (const [w, h] of [[1280, 720], [800, 600]]) {
        const dir = path.join(out, 'screenshots', `${w}x${h}`);
        fs.mkdirSync(dir, { recursive: true });
        // Emulation first, navigation second: the layout has to be built at the target size,
        // otherwise the canvas is sized for the old viewport and the tree sits off-centre.
        await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
        await c.send('Page.navigate', { url: pathToFileURL(index).href });
        await sleep(900);
        await shoot(c, { width: w, height: h, outDir: dir, prefix: '' });
      }

      const files = [];
      const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
        const f = path.join(d, e.name);
        if (e.isDirectory()) walk(f); else files.push(path.relative(out, f).replace(/\\/g, '/'));
      });
      walk(out);
      fs.writeFileSync(path.join(out, 'manifest.json'), `${JSON.stringify({
        game: g.id,
        name: g.name,
        package: `../portal/${g.id}.zip`,
        packageBytes: fs.statSync(path.join(PKG_DIR, `${g.id}.zip`)).size,
        descriptionChars: description.length,
        files,
      }, null, 2)}\n`);

      console.log(`  ${g.id.padEnd(16)} ${String(files.length).padStart(2)} files · description ${description.length} chars · zip ${(fs.statSync(path.join(PKG_DIR, `${g.id}.zip`)).size / 1024).toFixed(0)} KB`);
    }
    console.log(`  Output        build/portal-kit/  (not deployed)`);
    console.log('');
  } finally {
    if (c) c.close();
    chrome.kill();
  }
}

main().catch((e) => { console.error(`  ${e.message}`); process.exit(1); });
