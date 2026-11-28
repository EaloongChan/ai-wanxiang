/**
 * 交互自测（CDP 驱动真实浏览器点击）
 *
 *   node scripts/selftest.mjs            全部用例
 *   node scripts/selftest.mjs game        只跑名字里含 "game" 的用例
 *   node scripts/selftest.mjs tool       只跑工具用例
 *
 * 前置：dist/ 已构建，且 node scripts/serve.mjs 已在 4173 端口启动。
 *
 * 单元测试验证的是规则；这里验证的是「规则接上了界面」：点击画布能砍到树、买按钮扣钱、
 * 刷新页面读得回档、离开再回来有收益。每个用例都从干净的本地存储开始。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.AUDIT_PORT || 9223);
const SERVE = process.env.AUDIT_URL || 'http://127.0.0.1:4173';
const ONLY = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '';

const GAME_CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'games', 'lumber-tycoon', 'config.json'), 'utf8'));
const TOOL_IDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'tools.json'), 'utf8')).map((t) => t.id);
// The portal package is not deployed any more, so its test opens the built file directly.
const PORTAL_URL = pathToFileURL(path.join(ROOT, 'build', 'portal', 'lumber-tycoon', 'index.html')).href;

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));

const get = (u) => new Promise((res, rej) => http.get(u, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d)); }).on('error', rej));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const events = [];
    ws.addEventListener('open', () => resolve({ send, close: () => ws.close(), events }));
    ws.addEventListener('error', reject);
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      } else if (m.method) {
        events.push(m);
      }
    });
    function send(method, params = {}) {
      const my = ++id;
      return new Promise((res, rej) => { pending.set(my, { res, rej }); ws.send(JSON.stringify({ id: my, method, params })); });
    }
  });
}

/** Uncaught exceptions and console errors seen since the caller last emptied the list. */
function pageErrors(c) {
  return c.events.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error'));
}
const firstErrorText = (errors) => (errors[0].params.exception ? errors[0].params.exception.exception?.description || errors[0].params.exception.text : errors[0].params.entry?.text);

const tests = [];
const test = (name, path_, fn) => tests.push({ name, path: path_, fn });

const text = (c, sel) => c.eval(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent||''`);
const shown = (c, sel) => c.eval(`{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return r.width>0&&r.height>0;}`);

/** Let the HUD catch up: it repaints at most ten times a second. */
const settle = () => sleep(220);

/**
 * Wait until check() returns something truthy. Animations and dialogs end on their own
 * clock; a fixed sleep is either too short on a slow machine or needlessly long on a fast one.
 */
async function until(check, timeout = 4000, step = 60) {
  const start = Date.now();
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() - start > timeout) return null;
    await sleep(step);
  }
}

/**
 * Put a save in local storage as if it had been written before this page ever loaded.
 * Setting it from the live page does not work: the page saves its own state as it unloads
 * and overwrites whatever the test wrote.
 */
async function seedSave(c, save) {
  const { identifier } = await c.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try { localStorage.setItem('ealoong.lumber-tycoon.save', ${JSON.stringify(typeof save === 'string' ? save : JSON.stringify(save))}); } catch (e) {}`,
  });
  await c.send('Page.navigate', { url: SERVE + '/games/lumber-tycoon/' });
  await sleep(800);
  await c.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
}

/** Swing at the canvas n times, waiting gapMs between swings so trees get time to regrow. */
async function swing(c, n, gapMs = 70) {
  for (let i = 0; i < n; i++) {
    await c.eval(`(function(){const cv=document.getElementById('stage');const r=cv.getBoundingClientRect();cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+r.width/2,clientY:r.top+r.height/2,button:0,pointerId:1,bubbles:true,cancelable:true}));return 1})()`);
    await sleep(gapMs);
  }
}

/* ================= game ================= */

test('game: page loads with a canvas, a tree and the full upgrade list', '/games/lumber-tycoon/', async (c) => {
  const r = await c.eval(`(()=>{const cv=document.getElementById('stage');return {w:cv.width,h:cv.height,rows:document.querySelectorAll('#upgradeList .up-row').length,zones:document.querySelectorAll('#zoneList .zone-row').length,tree:document.getElementById('treeName').textContent}})()`);
  const ok = r.w > 0 && r.h > 0 && r.rows === GAME_CONFIG.upgrades.length && r.zones === GAME_CONFIG.zones.length && GAME_CONFIG.trees.some((t) => t.name === r.tree);
  return { ok, detail: `canvas ${r.w}×${r.h} · ${r.rows} upgrades · ${r.zones} districts · tree "${r.tree}"` };
});

test('game: clicking the canvas earns Sparkwood and the tree falls', '/games/lumber-tycoon/', async (c) => {
  const before = Number(await text(c, '#hudTimber'));
  // The first tree is drawn at random (70% pine, 30% birch): enough swings to fell either one.
  const firstPool = GAME_CONFIG.zones[0].pool;
  const toughest = Math.max(...Object.keys(firstPool).map((id) => GAME_CONFIG.trees.find((t) => t.id === id).hp));
  await swing(c, toughest + 3);
  await settle();
  const after = Number(await text(c, '#hudTimber'));
  // Guidance is two steps now: after the first tree the hint switches to "buy a chopper"
  // instead of disappearing.
  const hint = (await text(c, '#hintText')).trim();
  return { ok: after > before && /chopper/i.test(hint), detail: `Sparkwood ${before} → ${after}, hint "${hint}"` };
});

test('game: keyboard swings work (Space on the focused canvas)', '/games/lumber-tycoon/', async (c) => {
  await c.eval(`document.getElementById('stage').focus()`);
  const before = Number(await text(c, '#hudTimber'));
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await sleep(150);
  const after = Number(await text(c, '#hudTimber'));
  return { ok: after > before, detail: `Sparkwood ${before} → ${after}` };
});

test('game: buying an upgrade takes Sparkwood and raises its level', '/games/lumber-tycoon/', async (c) => {
  const axe = GAME_CONFIG.upgrades.find((u) => u.id === 'axe');
  await swing(c, 120, 60);                               // well past the first axe
  await settle();
  const before = Number(await text(c, '#hudTimber'));
  const wasEnabled = await c.eval(`!document.querySelector('.up-row[data-buy="axe"]').getAttribute('aria-disabled')`);
  await c.eval(`document.querySelector('.up-row[data-buy="axe"]').click()`);
  await sleep(250);
  await settle();
  const lv = await text(c, '.up-row[data-buy="axe"] .up-lv');
  const after = Number(await text(c, '#hudTimber'));
  return { ok: wasEnabled && lv.includes('1/') && after < before, detail: `costs ${axe.baseCost} · Sparkwood ${before} → ${after} · ${lv.trim()}` };
});

test('game: an unaffordable upgrade does nothing', '/games/lumber-tycoon/', async (c) => {
  const chopper = await c.eval(`(()=>{const b=document.querySelector('.up-row[data-buy="choppers"]');return {disabled:b.getAttribute('aria-disabled')==='true',lv:b.querySelector('.up-lv').textContent.trim()}})()`);
  await c.eval(`document.querySelector('.up-row[data-buy="choppers"]').click()`);
  await sleep(120);
  const lvAfter = await text(c, '.up-row[data-buy="choppers"] .up-lv');
  return { ok: chopper.disabled && lvAfter.trim() === chopper.lv, detail: `disabled ${chopper.disabled} · level stays ${chopper.lv}` };
});

test('game: progress survives a reload', '/games/lumber-tycoon/', async (c) => {
  await swing(c, 140, 60);
  await c.eval(`document.querySelector('.up-row[data-buy="axe"]').click()`);
  await settle();
  const before = await text(c, '#hudTimber');
  const saved = await c.eval(`!!localStorage.getItem('ealoong.lumber-tycoon.save')`);
  await c.send('Page.navigate', { url: SERVE + '/games/lumber-tycoon/' });
  await sleep(900);
  const after = await text(c, '#hudTimber');
  const lv = await text(c, '.up-row[data-buy="axe"] .up-lv');
  return { ok: saved && before === after && lv.includes('1/'), detail: `save present ${saved} · Sparkwood ${before} → ${after} · ${lv.trim()}` };
});

test('game: choppers keep earning while away, and the earnings can be collected', '/games/lumber-tycoon/', async (c) => {
  // A save with five choppers, last seen two hours ago.
  await seedSave(c, { v: 1, timber: 0, total: 0, lifetime: 0, gears: 0, mainsprings: 0, prestiges: 0, up: { choppers: 5 }, zones: ['thicket'], zone: 'thicket', felled: 9, clicks: 99, playTime: 10, lastSeen: Date.now() - 2 * 3600 * 1000 });
  const open = await c.eval(`document.getElementById('offlineDialog').open`);
  const amount = await text(c, '#offlineAmount');
  await c.eval(`document.getElementById('offlineCollect').click()`);
  await sleep(200);
  await settle();
  const closed = await c.eval(`!document.getElementById('offlineDialog').open`);
  // The HUD shows abbreviated numbers: 5 choppers × 5 damage / 2.5 s × 2 h at 50% is about 40.6K.
  const timber = (await text(c, '#hudTimber')).trim();
  return { ok: open && closed && /^40\.\d+K$/.test(timber) && amount.trim() === `+${timber} Sparkwood`, detail: `dialog ${open ? 'shown' : 'missing'} · "${amount.trim()}" · HUD after collect ${timber}` };
});

test('game: with no choppers there is nothing to collect on return', '/games/lumber-tycoon/', async (c) => {
  await seedSave(c, { v: 1, timber: 50, total: 0, lifetime: 0, gears: 0, mainsprings: 0, prestiges: 0, up: {}, zones: ['thicket'], zone: 'thicket', lastSeen: Date.now() - 8 * 3600 * 1000 });
  const open = await c.eval(`document.getElementById('offlineDialog').open`);
  const timber = Number(await text(c, '#hudTimber'));
  return { ok: !open && timber === 50, detail: `dialog ${open ? 'should not open' : 'stays closed'} · Sparkwood ${timber}` };
});

test('game: a broken save is refused without breaking the game', '/games/lumber-tycoon/', async (c) => {
  await seedSave(c, '{not json');
  await swing(c, 12);
  await settle();
  const timber = Number(await text(c, '#hudTimber'));
  const lv = await text(c, '.up-row[data-buy="axe"] .up-lv');
  return { ok: timber > 0 && lv.includes('0/'), detail: `fresh run started, Sparkwood ${timber}, axe ${lv.trim()}` };
});

test('game: settings export gives a code, and a bad import is rejected with a message', '/games/lumber-tycoon/', async (c) => {
  await swing(c, 30);
  await c.eval(`document.getElementById('settingsBtn').click()`);
  await sleep(150);
  await c.eval(`document.getElementById('exportBtn').click()`);
  await sleep(150);
  const code = await c.eval(`document.getElementById('importCode').value`);
  const parsed = JSON.parse(code);
  await c.eval(`(function(){const b=document.getElementById('importCode');b.value='not a save';document.getElementById('importBtn').click();return 1})()`);
  await sleep(200);
  const msg = await text(c, '#importMsg');
  const dialogStill = await c.eval(`document.getElementById('confirmDialog').open`);
  return { ok: parsed.v === 2 && typeof parsed.timber === 'number' && /not a valid save code/.test(msg) && !dialogStill, detail: `code ${code.length} chars, v${parsed.v} · message "${msg.trim()}"` };
});

test('game: reset asks for confirmation and Cancel leaves progress alone', '/games/lumber-tycoon/', async (c) => {
  await swing(c, 40);
  await settle();                       // the HUD repaints ten times a second; read after it has caught up
  const before = await text(c, '#hudTimber');
  await c.eval(`document.getElementById('settingsBtn').click()`);
  await sleep(150);
  await c.eval(`document.getElementById('resetBtn').click()`);
  const asked = await until(() => c.eval(`document.getElementById('confirmDialog').open`));
  await c.eval(`document.getElementById('confirmNo').click()`);
  await settle();
  const after = await text(c, '#hudTimber');
  return { ok: !!asked && before === after, detail: `confirmation ${asked ? 'shown' : 'missing'} · Sparkwood before "${before}" after "${after}"` };
});

test('game: the tabs switch between Upgrades, Districts and Rewind', '/games/lumber-tycoon/', async (c) => {
  await c.eval(`document.getElementById('tab-zones').click()`);
  await sleep(100);
  const zones = await c.eval(`({selected:document.getElementById('tab-zones').getAttribute('aria-selected'),up:!document.getElementById('panel-up').hidden,zones:!document.getElementById('panel-zones').hidden})`);
  await c.eval(`document.getElementById('tab-rewind').click()`);
  await sleep(100);
  const rewind = await c.eval(`!document.getElementById('panel-rewind').hidden && /Heart of the Grove/.test(document.getElementById('rewindPanel').textContent)`);
  return { ok: zones.selected === 'true' && !zones.up && zones.zones && rewind, detail: `districts tab ${JSON.stringify(zones)} · rewind panel locked until the last district: ${rewind}` };
});

test('game: on a phone the drawer opens from the toggle and is actually on screen', '/games/lumber-tycoon/', async (c) => {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await c.send('Page.navigate', { url: SERVE + '/games/lumber-tycoon/' });
  await sleep(900);
  // Where the drawer really is, not just which classes it carries: it once slid open off-screen.
  const rect = `(()=>{const d=document.getElementById('drawer');const r=d.getBoundingClientRect();const g=document.getElementById('game').getBoundingClientRect();return {cls:d.className,exp:document.getElementById('drawerToggle').getAttribute('aria-expanded'),l:Math.round(r.left),t:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),bottom:Math.round(r.bottom),gameBottom:Math.round(g.bottom)}})()`;
  const before = await c.eval(rect);
  const firstRowVisible = () => c.eval(`(()=>{const r=document.querySelector('#panel-up .up-row').getBoundingClientRect();return r.top>=0&&r.bottom<=844})()`);
  await c.eval(`document.getElementById('drawerToggle').click()`);
  // The sheet slides up over 260 ms: wait until it has arrived and its first row is on screen.
  const open = await until(async () => {
    const r = await c.eval(rect);
    return r.l === 0 && r.w === 390 && r.h > 150 && Math.abs(r.bottom - r.gameBottom) < 2 && (await firstRowVisible()) ? r : null;
  });
  await swing(c, 2);
  // Closed: the sheet has slid back down, out of the game area.
  const closed = await until(async () => { const r = await c.eval(rect); return r.exp === 'false' && r.t >= r.gameBottom - 1 ? r : null; });
  return { ok: before.exp === 'false' && !!open && open.cls.includes('open') && open.exp === 'true' && !!closed, detail: open ? `open: left ${open.l}, ${open.w}×${open.h}, bottom ${open.bottom}/${open.gameBottom}, first row on screen · closes on swing ${!!closed}` : 'drawer never arrived on screen' };
});

test('game: no console errors during a play session', '/games/lumber-tycoon/', async (c) => {
  c.events.length = 0;
  await swing(c, 150, 60);
  await c.eval(`document.querySelector('.up-row.can') && document.querySelector('.up-row.can').click()`);
  await c.eval(`document.getElementById('tab-zones').click()`);
  await c.eval(`document.getElementById('settingsBtn').click()`);
  await sleep(400);
  const errors = pageErrors(c);
  return { ok: errors.length === 0, detail: errors.length ? String(firstErrorText(errors)).slice(0, 120) : 'clean' };
});

/* ================= tools ================= */

test('tool: sensitivity converter matches the known Valorant → CS2 ratio and updates live', `/tools/sens-converter/`, async (c) => {
  const set = (id, value, event = 'input') => c.eval(`(function(){const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}));return 1})()`);
  await set('fromGame', 'valorant', 'change');
  await set('toGame', 'cs2', 'change');
  await set('sens', '0.4');
  await set('dpi', '800');
  await sleep(80);
  const val = (await text(c, '#resSens')).trim();
  const cm = (await text(c, '#resCm')).trim();
  const rows = await c.eval(`document.querySelectorAll('#resTable tr').length`);
  // 0.4 in Valorant is the widely quoted 1.27 in CS2 and about 41 cm per turn at 800 DPI.
  return { ok: val === '1.2727' && cm.includes('40.82') && rows >= 11, detail: `Valorant 0.4 @800 → CS2 ${val} · ${cm}` };
});

test('tool: sensitivity converter refuses zero and empty input', `/tools/sens-converter/`, async (c) => {
  await c.eval(`(function(){const i=document.getElementById('sens');i.value='0';i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  await sleep(80);
  const err = await text(c, '#toolError');
  const hidden = await c.eval(`document.getElementById('toolResult').hidden`);
  await c.eval(`(function(){const i=document.getElementById('sens');i.value='';i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  await sleep(80);
  const err2 = await text(c, '#toolError');
  return { ok: hidden && err.length > 5 && err2.length > 5, detail: `"${err.trim()}" / "${err2.trim()}"` };
});

test('tool: FOV calculator reproduces Counter-Strike 90 at 4:3 → 106.26 at 16:9', `/tools/fov-calculator/`, async (c) => {
  await c.eval(`(function(){for(const [id,v] of [['fov','90'],['fromAspect','4:3'],['toAspect','16:9']]){const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}return 1})()`);
  await sleep(80);
  const v = await text(c, '#resV');
  const hTo = await text(c, '#resHTo');
  // The multiplier moved into the explanation sentence when the note became a full sentence.
  const note = await text(c, '#fovNote');
  return { ok: hTo.includes('106.26') && v.includes('73.74') && /1\.3333/.test(note), detail: `vertical ${v} · 16:9 ${hTo} · note "${note.trim().slice(-60)}"` };
});

test('tool: Steam ID converter accepts every format and rejects a vanity name', `/tools/steam-id-converter/`, async (c) => {
  const type = async (value) => {
    await c.eval(`(function(){const i=document.getElementById('steamInput');i.value=${JSON.stringify(value)};i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
    await sleep(60);
    return text(c, '#resId2');
  };
  const a = await type('76561197960287930');
  const b = await type('[U:1:22202]');
  const d = await type('https://steamcommunity.com/id/wolverine/');
  const hidden = await c.eval(`document.getElementById('toolResult').hidden`);
  const err = await text(c, '#toolError');
  return { ok: a.trim() === 'STEAM_0:0:11101' && b.trim() === a.trim() && hidden && /custom profile name/.test(err), detail: `64-bit → ${a.trim()} · SteamID3 → ${b.trim()} · vanity → "${err.trim().slice(0, 40)}…"` };
});

test('tool: Discord timestamps list all seven formats and decode a code', `/tools/discord-timestamp/`, async (c) => {
  const rows = await c.eval(`document.querySelectorAll('#tsList .copy-row').length`);
  const sample = await c.eval(`document.querySelector('#tsList .copy-row code').textContent`);
  await c.eval(`(function(){const i=document.getElementById('tsDecode');i.value='See you <t:1700000000:R>';i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  await sleep(80);
  const decoded = await text(c, '#tsDecoded');
  return { ok: rows === 7 && sample.length > 0 && decoded.includes('in your timezone'), detail: `${rows} formats · preview "${sample}" · "${decoded.trim().slice(0, 60)}…"` };
});

test('tool: prompt template builder fills blanks and reports the empty ones', `/tools/prompt-template-builder/`, async (c) => {
  // The prompt texts are fetched after load: wait for them to arrive instead of guessing a delay.
  for (let i = 0; i < 30 && !(await c.eval(`document.getElementById('ptCustom').value.length`)); i++) await sleep(100);
  const options = await c.eval(`document.getElementById('ptPick').options.length`);
  const inputs = await c.eval(`document.querySelectorAll('#ptVars input').length`);
  const before = await c.eval(`document.getElementById('ptOut').textContent`);
  await c.eval(`(function(){const i=document.querySelector('#ptVars input');i.value='otters';i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  await sleep(80);
  const after = await c.eval(`document.getElementById('ptOut').textContent`);
  const err = await text(c, '#toolError');
  return { ok: options === 86 && inputs > 0 && after.includes('otters') && before !== after && /blank/.test(err), detail: `${options} templates · ${inputs} blanks · one filled, message "${err.trim()}"` };
});

/* ================= portal package ================= */

test('portal: the standalone package plays with no request beyond the file itself', PORTAL_URL, async (c) => {
  await c.eval(`document.getElementById('stage').focus()`);
  await swing(c, 24, 70);
  await settle();
  const timber = Number(await text(c, '#hudTimber'));
  const external = await c.eval(`performance.getEntriesByType('resource').filter((e) => e.name.includes('/assets/') || e.name.includes('/fonts/')).map((e) => e.name)`);
  const linksOut = await c.eval(`[...document.querySelectorAll('a[href]')].map((a) => a.href)`);
  const icons = await c.eval(`document.querySelectorAll('symbol[id^="i-"]').length`);
  return { ok: timber > 0 && external.length === 0 && linksOut.length === 0 && icons > 0, detail: `Sparkwood ${timber} · external assets ${external.length} · outgoing links ${linksOut.length} · ${icons} icons inlined` };
});

/* ================= retention ================= */

test('retention: a brand new visitor is not greeted by a modal', '/games/lumber-tycoon/', async (c) => {
  const daily = await c.eval(`document.getElementById('dailyDialog').open`);
  const away = await c.eval(`document.getElementById('offlineDialog').open`);
  const hint = (await text(c, '#hintText')).trim();
  return { ok: !daily && !away && /chop/i.test(hint), detail: `daily ${daily} · offline ${away} · first hint "${hint}"` };
});

test('retention: the daily box opens once a day and pays its amount', '/games/lumber-tycoon/', async (c) => {
  // The box is a reason to return, so it only appears to someone who has played before.
  await seedSave(c, { v: 2, timber: 0, total: 0, lifetime: 0, gears: 0, mainsprings: 0, prestiges: 0, up: {}, zones: ['thicket'], zone: 'thicket', felled: 12, clicks: 40, playTime: 90, lastSeen: Date.now() - 60_000, achievements: [], zoneRewards: [], lastDailyDay: -1, dailyCount: 0 });
  const open = await c.eval(`document.getElementById('dailyDialog').open`);
  const amount = (await text(c, '#dailyAmount')).trim();
  await c.eval(`document.getElementById('dailyClaim').click()`);
  await settle();
  const closed = await c.eval(`!document.getElementById('dailyDialog').open`);
  const timber = Number(await text(c, '#hudTimber'));
  await c.eval(`document.getElementById('dailyClaim').click()`);
  const staysClosed = await c.eval(`!document.getElementById('dailyDialog').open`);
  return {
    ok: open && /^\+\d/.test(amount) && closed && timber > 0 && staysClosed,
    detail: `首次打开 ${open} · 金额「${amount}」· 领取后关闭 ${closed} · 星火木 ${timber} · 当天不能再领 ${staysClosed}`,
  };
});

test('retention: the HUD names the next district and its cost', '/games/lumber-tycoon/', async (c) => {
  const goal = await c.eval(`(()=>{const g=document.getElementById('gameGoal');return {hidden:g.hidden,text:g.textContent.trim()}})()`);
  return { ok: !goal.hidden && /Next:/.test(goal.text) && /\d/.test(goal.text), detail: `目标行「${goal.text}」` };
});

test('retention: swinging enough times unlocks an achievement and the list shows it', '/games/lumber-tycoon/', async (c) => {
  await c.eval(`(()=>{const d=document.getElementById('dailyDialog'); if(d.open) d.close(); return 1})()`);
  // Swings during the 0.2 s regrow gap are dropped, so the count that matters is the
  // clicks counter, not the dispatch count. The toast hides itself after 3.2 s, so it has
  // to be caught in the middle of the run rather than after it.
  const readToast = () => c.eval(`(()=>{const el=document.getElementById('achToast');return el.hidden?null:{text:el.textContent.trim()}})()`);
  await swing(c, 130, 55);
  await sleep(120);
  let toast = await readToast();
  if (!toast) {
    await swing(c, 80, 55);
    await sleep(120);
    toast = await readToast();
  }
  await c.eval(`document.getElementById('settingsBtn').click()`);
  await sleep(250);
  const info = await c.eval(`(()=>({count:document.getElementById('achCount').textContent.trim(),items:document.querySelectorAll('#achList li').length,done:document.querySelectorAll('#achList li.done').length,first:(document.querySelector('#achList li')||{textContent:''}).textContent.trim()}))()`);
  return {
    ok: !!toast && /Achievement/.test(toast.text) && toast.text.length > 'Achievement'.length && info.items === 20 && info.done >= 1 && /^[1-9]/.test(info.count),
    detail: `提示条「${toast ? toast.text : '未出现'}」· ${info.count} · 列表 ${info.items} 条其中 ${info.done} 条已完成 · 首条「${info.first}」`,
  };
});

test('retention: guidance moves from "chop" to "buy a chopper", then disappears', '/games/lumber-tycoon/', async (c) => {
  await c.eval(`(()=>{const d=document.getElementById('dailyDialog'); if(d.open) d.close(); return 1})()`);
  const first = (await text(c, '#hintText')).trim();
  await swing(c, 24, 60);                       // fell the first tree
  await settle();
  const second = (await text(c, '#hintText')).trim();
  const visible = await c.eval(`!document.getElementById('gameHint').hidden`);
  // Then buy the cheapest upgrade and expect the hint to go away for good.
  await swing(c, 70, 45);
  await settle();
  await c.eval(`document.querySelector('.up-row[data-buy="axe"]').click()`);
  await settle();
  const hidden = await c.eval(`document.getElementById('gameHint').hidden`);
  return {
    ok: /chop/i.test(first) && /chopper/i.test(second) && visible && hidden,
    detail: `第一步「${first}」→ 第二步「${second}」→ 买过之后隐藏 ${hidden}`,
  };
});

/* ================= analytics ================= */

test('analytics: no beacon by default, and the module batches correctly when present', '/', async (c) => {
  const present = await c.eval(`!!document.getElementById('beacon')`);
  const code = fs.readFileSync(path.join(ROOT, 'src', 'scripts', 'beacon.js'), 'utf8');
  await c.eval(`(() => {
    const tag = document.createElement('div');
    tag.id = 'beacon';
    tag.dataset.endpoint = '/api/e';
    tag.dataset.page = '/selftest/';
    tag.dataset.lang = 'en';
    document.body.appendChild(tag);
    window.__sent = [];
    Object.defineProperty(navigator, 'sendBeacon', {
      configurable: true,
      value: function (url, blob) { window.__sent.push([url, blob]); return true; },
    });
    return 1;
  })()`);
  await c.eval(code);
  await c.eval(`window.__track('tool_use', { tool: 'selftest', long: 'x'.repeat(400) }); window.__trackFlush(); 1`);
  const sent = await c.eval(`(async () => {
    if (!window.__sent.length) return { n: 0 };
    const body = JSON.parse(await window.__sent[0][1].text());
    return { n: window.__sent.length, url: window.__sent[0][0], body };
  })()`);
  const ev = sent.body && sent.body.e && sent.body.e[0];
  return {
    ok: !present && sent.n === 1 && sent.url === '/api/e' && ev.n === 'tool_use' && ev.p.tool === 'selftest' && String(ev.p.long).length === 80 && sent.body.lang === 'en',
    detail: `默认无 beacon ${!present} · 批次 ${sent.n} 条 → ${sent.url} · 事件 ${ev ? ev.n : '—'} · 超长属性截断到 ${ev && ev.p.long ? ev.p.long.length : 0} 字`,
  };
});

/* ================= 中文站 ================= */

test('i18n: the Chinese game page is Chinese and still playable', '/zh/games/lumber-tycoon/', async (c) => {
  const lang = await c.eval(`document.documentElement.lang`);
  const tab = (await text(c, '#tab-up')).trim();
  const upName = (await text(c, '.up-row[data-buy="axe"] .up-name')).trim();
  const tier = (await text(c, '#treeTier')).trim();
  const before = Number(await text(c, '#hudTimber'));
  await swing(c, 16);
  await settle();
  const after = Number(await text(c, '#hudTimber'));
  return {
    ok: lang === 'zh-CN' && tab.includes('升级') && upName === '更锋利的斧头' && ['常见'].includes(tier) && after > before,
    detail: `lang ${lang} · 页签「${tab}」· 升级「${upName}」· 稀有度「${tier}」· 星火木 ${before} → ${after}`,
  };
});

test('i18n: the Chinese tool page speaks Chinese, errors included', '/zh/tools/sens-converter/', async (c) => {
  const label = (await text(c, 'label[for="fromGame"]')).trim();
  await c.eval(`(function(){const i=document.getElementById('sens');i.value='0';i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  await sleep(90);
  const err = (await text(c, '#toolError')).trim();
  await c.eval(`(function(){const i=document.getElementById('sens');i.value='1.5';i.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
  await sleep(90);
  const val = (await text(c, '#resSens')).trim();
  return {
    ok: label === '从哪个游戏' && err.includes('请输入大于 0') && val === '0.4714',
    detail: `标签「${label}」· 报错「${err}」· 结果 ${val}`,
  };
});

test('i18n: the language switch points at the same page in the other language', '/tools/sens-converter/', async (c) => {
  const link = await c.eval(`(()=>{const a=document.querySelector('.nav-lang');return {href:a.getAttribute('href'),hreflang:a.getAttribute('hreflang'),text:a.textContent.trim()}})()`);
  const alts = await c.eval(`[...document.querySelectorAll('link[rel="alternate"]')].map((l) => l.getAttribute('hreflang') + ' ' + l.getAttribute('href'))`);
  const ok = link.href === '/zh/tools/sens-converter/' && link.hreflang === 'zh-CN' && link.text === '中文'
    && alts.some((a) => a.startsWith('zh-CN ') && a.includes('/zh/tools/sens-converter/'))
    && alts.some((a) => a.startsWith('en ') && a.endsWith('/tools/sens-converter/'))
    && alts.some((a) => a.startsWith('x-default '));
  return { ok, detail: `按钮「${link.text}」→ ${link.href} · hreflang ${alts.length} 条` };
});

test('i18n: switching back from Chinese reaches the English page', '/zh/tools/discord-timestamp/', async (c) => {
  const link = await c.eval(`(()=>{const a=document.querySelector('.nav-lang');return {href:a.getAttribute('href'),hreflang:a.getAttribute('hreflang'),text:a.textContent.trim()}})()`);
  const copyLabel = (await c.eval(`document.querySelector('#tsList .copy-btn span').textContent`)).trim();
  const rel = (await c.eval(`[...document.querySelectorAll('#tsList .copy-row code')].pop().textContent`)).trim();
  const heading = (await text(c, 'h1')).trim();
  return {
    // "现在" when the minute has not ticked over yet, otherwise "59 秒前" style wording.
    ok: link.href === '/tools/discord-timestamp/' && link.hreflang === 'en' && link.text === 'English' && copyLabel === '复制' && /现在|前|后/.test(rel) && heading === 'Discord 时间戳生成器',
    detail: `按钮「${link.text}」→ ${link.href} · 复制「${copyLabel}」· 相对时间「${rel}」· H1「${heading}」`,
  };
});

/* ================= security ================= */

test('security: the pages that run scripts raise no CSP violation', '/games/lumber-tycoon/', async (c) => {
  const { identifier } = await c.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__csp = []; document.addEventListener('securityPolicyViolation', function (e) { window.__csp.push(e.violatedDirective + ' ' + e.blockedURI); }, true);`,
  });
  const pages = ['/games/lumber-tycoon/', '/tools/sens-converter/', '/tools/prompt-template-builder/'];
  const seen = [];
  for (const p of pages) {
    await c.send('Page.navigate', { url: SERVE + p });
    await sleep(900);
    if (p.startsWith('/games')) {
      await swing(c, 6, 70);
      await c.eval(`document.getElementById('drawerToggle').click()`);
    } else if (p.includes('prompt')) {
      await c.eval(`(function(){const t=document.getElementById('ptCustom');t.value='Write about {{topic}}.';t.dispatchEvent(new Event('input',{bubbles:true}));return 1})()`);
    }
    await sleep(300);
    const violations = await c.eval(`window.__csp`);
    seen.push({ p, violations });
  }
  await c.send('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  const header = await fetch(SERVE + '/').then((r) => r.headers.get('content-security-policy') || '');
  const bad = seen.flatMap((s) => s.violations.map((v) => `${s.p} ${v}`));
  return {
    ok: /script-src 'self'/.test(header) && bad.length === 0,
    detail: bad.length ? bad.slice(0, 2).join(' | ') : `header present · 0 violations across ${pages.length} scripted pages`,
  };
});

/* ================= site ================= */

test('site: the phone menu opens, closes, and reports its state', '/', async (c) => {
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await c.send('Page.navigate', { url: SERVE + '/' });
  await sleep(700);
  await c.eval(`document.getElementById('menuBtn').click()`);
  await sleep(150);
  const open = await c.eval(`({open:document.getElementById('nav').classList.contains('open'),exp:document.getElementById('menuBtn').getAttribute('aria-expanded'),label:document.getElementById('menuBtn').getAttribute('aria-label')})`);
  await c.eval(`document.body.click()`);
  await sleep(150);
  const closed = await c.eval(`!document.getElementById('nav').classList.contains('open')`);
  return { ok: open.open && open.exp === 'true' && open.label === 'Close menu' && closed, detail: `open ${JSON.stringify(open)} · closes on outside click ${closed}` };
});

test('site: every page starts without console errors', '/', async (c) => {
  const pages = ['/', '/games/', '/tools/', '/about/', '/contact/', '/privacy/', ...TOOL_IDS.map((id) => `/tools/${id}/`),
    '/zh/', '/zh/games/', '/zh/games/lumber-tycoon/', '/zh/tools/', ...TOOL_IDS.map((id) => `/zh/tools/${id}/`), '/zh/about/', '/zh/contact/', '/zh/privacy/'];
  const bad = [];
  for (const p of pages) {
    c.events.length = 0;
    await c.send('Page.navigate', { url: SERVE + p });
    await sleep(650);
    const errors = pageErrors(c);
    if (errors.length) bad.push(`${p} ×${errors.length}: ${String(firstErrorText(errors)).slice(0, 80)}`);
  }
  return { ok: bad.length === 0, detail: bad.length ? bad.join(', ') : `${pages.length} pages clean` };
});

/* ================= runner ================= */

async function assertServeUp() {
  const hint = '    先启动本地服务：node scripts/serve.mjs';
  try {
    const res = await fetch(SERVE, { signal: AbortSignal.timeout(8000) });
    const html = await res.text();
    if (res.status !== 200 || !/Ealoong Arcade/.test(html)) {
      console.error('\n  ✗ ' + SERVE + ' 返回的不是本站页面\n' + hint + '\n');
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
      '--user-data-dir=' + path.join(process.env.TEMP || '/tmp', 'ealoong-selftest'), 'about:blank'],
      { detached: true, stdio: 'ignore' }).unref();
  }
  for (let i = 0; i < 40; i++) { try { await get(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(250); } }

  const list = JSON.parse(await get(`http://127.0.0.1:${PORT}/json/list`));
  const page = list.find((t) => t.type === 'page') || JSON.parse(await get(`http://127.0.0.1:${PORT}/json/new?about:blank`));
  const c = await cdp(page.webSocketDebuggerUrl);
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  await c.send('Log.enable');
  c.eval = async (expr) => {
    const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text || 'eval error');
    return r.result.value;
  };

  const selected = tests.filter((t) => !ONLY || t.name.startsWith(ONLY));
  let pass = 0;
  let fail = 0;
  console.log('');
  console.log('  交互自测  ' + SERVE);
  console.log('  ' + '─'.repeat(64));
  for (const t of selected) {
    const directly = /^file:/.test(t.path);
    const target = directly ? t.path : SERVE + t.path;
    await c.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await c.send('Page.navigate', { url: target });
    await sleep(150);
    if (!directly) {
      // Every test starts with an empty slate: no saved progress and no remembered settings.
      // Clear from a same-origin page that carries no game script: a game page saves its own
      // state while it unloads, which would undo the clearing.
      await c.send('Page.navigate', { url: SERVE + '/robots.txt' });
      await sleep(120);
      await c.eval(`localStorage.clear(); 1`);
      await c.send('Page.navigate', { url: target });
      await sleep(750);
    }
    try {
      const r = await t.fn(c);
      if (r.ok) { pass++; console.log(`  ✓ ${t.name}  —  ${r.detail}`); }
      else { fail++; console.log(`  ✗ ${t.name}  —  ${r.detail}`); }
    } catch (e) {
      fail++;
      console.log(`  ✗ ${t.name}  —  异常：${String(e.message).slice(0, 160)}`);
    }
  }
  c.close();
  console.log('  ' + '─'.repeat(64));
  console.log(`  通过 ${pass} / ${pass + fail}`);
  console.log('');
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('  自测失败：', e.message); process.exit(1); });
