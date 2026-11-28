/**
 * Clockwork Grove — input, main loop, HUD, saving, sound, platform.
 *
 * This is the only file that touches the DOM. It holds a state object from logic.js,
 * feeds it player input and fixed time steps, and pushes what happened to view.js and
 * the HUD. All rules live in logic.js; all drawing lives in view.js.
 *
 * The game talks to the outside world through exactly one object, the platform. The
 * site build uses browser storage; a portal build swaps the bodies for its SDK calls.
 */
import { createStage } from './view.js';
import {
  advance, applyAction, collectOffline, comboMult, configIndex, createState, derived, deserialize, formatNumber,
  formatSeconds, incomePerSecond, offlineGain, prestigeGain, serialize, upgradeState,
} from './logic.js';

const el = (id) => document.getElementById(id);
const ico = (name, size = 16) => `<svg class="ic" width="${size}" height="${size}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
const setText = (node, text) => { if (node && node.textContent !== text) node.textContent = text; };
const MUTE_KEY = () => `${SAVE_KEY}.muted`;

/* LANG and L10N come from the bundle prelude: each language gets its own bundle, so the
   game never has to decide at runtime which language to draw. */
const T_ = (key, vars) => {
  const text = L10N[key] !== undefined ? L10N[key] : key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
};
/** A name, description or blurb from the game config, in this bundle's language. */
const pickN = (obj, key) => (LANG === 'zh' && obj.zh && obj.zh[key] !== undefined ? obj.zh[key] : obj[key]);
/** Tier names are English keys in the data; the config carries the Chinese for them. */
const tierOf = (tier) => (LANG === 'zh' && CONFIG.tiers && CONFIG.tiers[tier] ? CONFIG.tiers[tier] : tier);

function createPlatform() {
  return {
    save(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
    load(key) { try { return localStorage.getItem(key); } catch { return null; } },
    gameplayStart() {},
    gameplayStop() {},
  };
}

/* ---------- sound: synthesised, no audio files to download ---------- */

function createSound() {
  let ac = null;
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY()) === '1'; } catch { /* storage unavailable: sound stays on */ }
  let lastChop = 0;

  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ac = new AC();
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }

  function tone(freq, endFreq, dur, type, peak, delay = 0) {
    const c = ctx();
    if (!c || muted) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function thud(dur, cutoff, peak) {
    const c = ctx();
    if (!c || muted) return;
    const len = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = c.createGain();
    gain.gain.value = peak;
    src.connect(filter).connect(gain).connect(c.destination);
    src.start();
  }

  return {
    unlock() { ctx(); },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      try { localStorage.setItem(MUTE_KEY(), muted ? '1' : '0'); } catch { /* preference just will not persist */ }
      return muted;
    },
    chop(crit, soft) {
      const now = performance.now();
      if (now - lastChop < 45) return;         // a late-game crew lands dozens of swings a second
      lastChop = now;
      thud(0.05, crit ? 2600 : 1800, soft ? 0.05 : 0.16);
      tone(crit ? 220 : 150, 80, 0.07, 'triangle', soft ? 0.03 : 0.08);
    },
    fell() {
      thud(0.22, 900, 0.22);
      tone(95, 42, 0.28, 'sine', 0.16);
    },
    buy() {
      tone(660, 660, 0.07, 'triangle', 0.07);
      tone(990, 990, 0.1, 'triangle', 0.07, 0.07);
    },
    zone() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.07, i * 0.07));
    },
    rewind() {
      [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.5, 'sine', 0.06, i * 0.05));
    },
    denied() {
      tone(180, 130, 0.09, 'square', 0.03);
    },
  };
}

/* ---------- the game ---------- */

function startGame(root) {
  const canvas = el('stage');
  if (!canvas || !canvas.getContext) return;
  const idx = configIndex(CONFIG);
  const stage = createStage(canvas);
  const platform = createPlatform();
  const sound = createSound();
  const STEP = CONFIG.tickMs / 1000;

  /* ----- load ----- */
  let state = null;
  let away = null;                  // offline earnings waiting for the player to collect
  const stored = platform.load(SAVE_KEY);
  if (stored) {
    const loaded = deserialize(stored, CONFIG);
    if (loaded) {
      state = loaded;
      const seconds = (Date.now() - loaded.lastSeen) / 1000;
      const gain = seconds > 60 ? offlineGain(state, seconds, CONFIG) : null;
      if (gain && gain.amount >= 1) away = gain;
    }
  }
  if (!state) state = createState(CONFIG);

  const save = () => { state.lastSeen = Date.now(); platform.save(SAVE_KEY, serialize(state)); };

  /* ----- dialogs ----- */
  function ask(title, text, yesLabel) {
    return new Promise((resolve) => {
      const dlg = el('confirmDialog');
      setText(el('confirmTitle'), title);
      setText(el('confirmText'), text);
      setText(el('confirmYes'), yesLabel);
      const done = (ok) => {
        dlg.removeEventListener('cancel', onCancel);
        el('confirmYes').onclick = null;
        el('confirmNo').onclick = null;
        if (dlg.open) dlg.close();
        resolve(ok);
      };
      const onCancel = (e) => { e.preventDefault(); done(false); };
      el('confirmYes').onclick = () => done(true);
      el('confirmNo').onclick = () => done(false);
      dlg.addEventListener('cancel', onCancel);
      dlg.showModal();
    });
  }

  function showAway() {
    const d = derived(state, CONFIG);
    setText(el('offlineAmount'), T_('gr.amountRow', { n: formatNumber(away.amount) }));
    setText(el('offlineDetail'), T_('gr.awayDetail', { n: formatNumber(d.choppers), time: formatSeconds(away.seconds), eff: `${Math.round(d.offlineEff * 100)}%` }));
    el('offlineDialog').showModal();
  }

  el('offlineCollect').addEventListener('click', () => {
    if (away) { collectOffline(state, away); away = null; }
    el('offlineDialog').close();
  });

  /* ----- drawing ----- */
  const fallingDir = () => (Math.random() < 0.5 ? -1 : 1);

  function onFell(e) {
    const def = idx.tree.get(e.tree);
    const c = stage.canopy();
    stage.fell(def, fallingDir());
    stage.burst(c.x, c.y, def.glow, 24, 1.5);
    stage.floatText(c.x, c.y - c.r * 0.4, `+${formatNumber(e.amount)}`, def.glow, 24, 1.3);
    if (e.gears) stage.floatText(c.x + 34, c.y + 26, `+${e.gears} ${T_('gr.gears')}`, '#ffc855', 18, 1.1);
    sound.fell();
    el('gameHint').hidden = true;
  }

  function onAuto(events) {
    let sum = 0;
    let hits = 0;
    let crit = false;
    let felled = null;
    let respawned = false;
    for (const e of events) {
      if (e.k === 'hit') { sum += e.amount; hits++; crit = crit || e.crit; }
      else if (e.k === 'fell') felled = e;
      else if (e.k === 'spawn') respawned = true;
    }
    const c = stage.canopy();
    if (hits) {
      stage.hit(crit ? 0.8 : 0.45);
      stage.burst(c.x + (Math.random() - 0.5) * c.r * 1.4, c.y + (Math.random() - 0.5) * c.r, '#d9c089', crit ? 10 : 6, 0.8);
      stage.floatText(c.x + (Math.random() - 0.5) * 90, c.y - c.r * 0.7, `+${formatNumber(sum)}`, crit ? '#ffd27a' : '#b4bdd0', crit ? 17 : 15);
      sound.chop(crit, true);
    }
    if (felled) onFell(felled);
    else if (respawned && state.tree) stage.setTree(idx.tree.get(state.tree.type), 1);
  }

  function swing(x, y) {
    sound.unlock();
    const before = state.tree ? idx.tree.get(state.tree.type) : null;
    const events = applyAction(state, 'chop', CONFIG);
    if (!events.length) return;                       // the stump: nothing to hit
    let sum = 0;
    let crit = false;
    let felled = null;
    for (const e of events) {
      if (e.k === 'hit') { sum += e.amount; crit = crit || e.crit; }
      else if (e.k === 'fell') felled = e;
    }
    stage.hit(crit ? 1.3 : 0.85);
    stage.burst(x, y, before.leaf, crit ? 16 : 9, crit ? 1.4 : 1);
    stage.floatText(x, y - 12, `+${formatNumber(sum)}`, crit ? '#ffd27a' : '#eef1f7', crit ? 22 : 17, crit ? 1.25 : 1);
    if (felled) onFell(felled);
    sound.chop(crit, false);
  }

  /* ----- HUD ----- */
  let lastPaint = 0;

  function paintHud() {
    const d = derived(state, CONFIG);
    setText(el('hudTimber'), formatNumber(state.timber));
    setText(el('hudRate'), `${formatNumber(incomePerSecond(state, CONFIG))}/s`);
    setText(el('hudGears'), formatNumber(state.gears));
    setText(el('hudMainsprings'), formatNumber(state.mainsprings));
    el('hudGearsWrap').hidden = !(state.gears > 0 || state.zones.length > 1);
    el('hudMsWrap').hidden = !(state.mainsprings > 0 || state.prestiges > 0);

    const combo = el('combo');
    const showCombo = state.combo >= 3;
    combo.hidden = !showCombo;
    if (showCombo) {
      setText(el('comboN'), String(state.combo));
      setText(el('comboX'), (comboMult(state, CONFIG, d)).toFixed(1));
    }

    if (state.tree) {
      const def = idx.tree.get(state.tree.type);
      setText(el('treeName'), pickN(def, 'name'));
      setText(el('treeTier'), tierOf(def.tier));
      const ratio = Math.max(0, state.tree.hp / state.tree.maxHp);
      const bar = el('hpBar');
      bar.style.width = `${(ratio * 100).toFixed(1)}%`;
      bar.parentElement.style.setProperty('--hp', def.leaf);
      bar.parentElement.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    } else {
      setText(el('treeTier'), '');
    }

    let affordable = 0;
    for (const u of CONFIG.upgrades) if (upgradeState(state, u.id, CONFIG).affordable) affordable++;
    const next = CONFIG.zones.find((z) => !state.zones.includes(z.id));
    const canUnlock = !!(next && state.timber >= next.unlockCost);
    const n = affordable + (canUnlock ? 1 : 0);
    const hint = el('drawerHint');
    hint.hidden = n === 0;
    setText(hint, String(n));
    setText(el('rwGain'), `+${formatNumber(prestigeGain(state, CONFIG))}`);
    setText(el('rwBonus'), T_('gr.holdBonus', { n: formatNumber(state.mainsprings), pct: `${Math.round(d.yieldMult * 100 - 100)}%` }));
  }

  function paintPanels() {
    const gearWorld = state.zones.length > 1;
    const row = (u) => {
      const s = upgradeState(state, u.id, CONFIG);
      const cls = s.maxed ? 'maxed' : s.affordable ? 'can' : '';
      const cost = s.maxed ? T_('gr.maxLevel') : `${formatNumber(s.cost)}${u.currency === 'gears' ? ' ' + T_('gr.gears') : ''}`;
      const costCls = u.currency === 'gears' ? 'up-cost gear' : 'up-cost';
      const off = s.affordable ? '' : ' aria-disabled="true"';
      return `<button class="up-row ${cls}" type="button" data-buy="${u.id}"${off}><span class="up-name">${pickN(u, 'name')}</span><span class="up-lv">Lv ${s.level}/${u.max}</span><span class="up-desc">${pickN(u, 'desc')}</span><span class="${costCls}">${ico(u.currency === 'gears' ? 'gear' : 'tree', 14)}${cost}</span></button>`;
    };
    el('upgradeList').innerHTML =
      `<p class="drawer-hint">${T_('gr.boughtWith')}</p>` +
      CONFIG.upgrades.filter((u) => u.currency === 'timber').map(row).join('') +
      `<p class="group-title">${ico('gear', 13)} ${T_('gr.gearGroup')}</p>` +
      `<p class="drawer-hint">${gearWorld ? T_('gr.gearHint') : T_('gr.gearHintZone', { zone: pickN(CONFIG.zones[1], 'name') })}</p>` +
      CONFIG.upgrades.filter((u) => u.currency === 'gears').map(row).join('');

    const nextIdx = state.zones.length;
    el('zoneList').innerHTML = CONFIG.zones.map((z, i) => {
      const owned = i < nextIdx;
      const isNext = i === nextIdx;
      const cls = owned ? (state.zone === z.id ? 'current' : 'owned') : state.timber >= z.unlockCost ? 'can' : 'locked';
      const cost = owned ? (state.zone === z.id ? T_('gr.choppingHere') : T_('gr.goBack')) : `${formatNumber(z.unlockCost)} ${T_('gr.sparkwood')}`;
      const off = owned ? '' : ' aria-disabled="true"';
      return `<button class="zone-row ${cls}" type="button" data-zone="${z.id}"${off}><span class="z-name">${pickN(z, 'name')}</span><span class="z-cost">${cost}</span><span class="z-blurb">${pickN(z, 'blurb')}</span></button>`;
    }).join('');

    const open = state.zones.includes(CONFIG.prestige.requiresZone);
    const bonus = `${Math.round(CONFIG.prestige.bonusPerPoint * 100)}%`;
    el('rewindPanel').innerHTML = open
      ? `<div class="rewind-panel">
           <p class="g-note">${T_('gr.rewindNote', { bonus })}</p>
           <div class="rewind-stat"><span>${T_('gr.rewindStat1')}</span><b id="rwGain"></b></div>
           <div class="rewind-stat"><span>${T_('gr.rewindStat2')}</span><b id="rwBonus"></b></div>
           <button class="g-btn" type="button" id="rewindBtn">${ico('refresh', 16)} ${T_('gr.rewindBtn')}</button>
         </div>`
      : `<div class="rewind-panel"><p class="g-note">${T_('gr.rewindLocked', { zone: pickN(idx.zone.get(CONFIG.prestige.requiresZone), 'name') })}</p></div>`;
  }

  const nextCost = () => { const z = CONFIG.zones[state.zones.length]; return z ? z.unlockCost : Infinity; };
  function panelsSignature() {
    return CONFIG.upgrades.map((u) => { const s = upgradeState(state, u.id, CONFIG); return `${s.level}${s.affordable ? 'a' : s.maxed ? 'm' : ''}`; }).join(',')
      + `|${state.zones.length}|${state.zone}|${state.prestiges}|${state.timber >= nextCost() ? 'z' : ''}`;
  }

  let panelsSeen = '';
  function refreshPanels() {
    const sig = panelsSignature();
    if (sig === panelsSeen) return;
    panelsSeen = sig;
    paintPanels();
    paintHud();
  }

  /* ----- input ----- */
  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    closeDrawer();
    const p = local(e);
    swing(p.x, p.y);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (e.repeat) return;                 //holding a key is not a skill; each swing is one press
    const c = stage.canopy();
    swing(c.x + (Math.random() - 0.5) * 40, c.y);
  });

  /* ----- drawer and tabs ----- */
  const drawer = el('drawer');
  const toggle = el('drawerToggle');
  function closeDrawer() {
    if (!drawer.classList.contains('open')) return;
    drawer.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', () => {
    const open = !drawer.classList.contains('open');
    drawer.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  const tabs = [...drawer.querySelectorAll('[data-tab]')];
  function selectTab(name) {
    for (const t of tabs) {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    }
    for (const p of drawer.querySelectorAll('[data-panel]')) p.hidden = p.dataset.panel !== name;
  }
  for (const t of tabs) {
    t.addEventListener('click', () => selectTab(t.dataset.tab));
    t.addEventListener('keydown', (e) => {
      const i = tabs.indexOf(t);
      const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      const target = tabs[(i + dir + tabs.length) % tabs.length];
      selectTab(target.dataset.tab);
      target.focus();
    });
  }

  drawer.addEventListener('click', async (e) => {
    const buy = e.target.closest('[data-buy]');
    if (buy) {
      const events = applyAction(state, { t: 'buy', id: buy.dataset.buy }, CONFIG);
      if (events.length) sound.buy(); else sound.denied();
      return;
    }
    const zone = e.target.closest('[data-zone]');
    if (zone) {
      const id = zone.dataset.zone;
      const owned = state.zones.includes(id);
      const events = applyAction(state, { t: owned ? 'select' : 'zone', id }, CONFIG);
      if (events.length) {
        if (owned) { sound.buy(); closeDrawer(); } else sound.zone();
        stage.setTree(idx.tree.get(state.tree.type), 1);
      } else sound.denied();
      return;
    }
    if (e.target.closest('#rewindBtn')) {
      const gain = prestigeGain(state, CONFIG);
      const ok = await ask(T_('gr.rewindTitle'), T_('gr.rewindText', { n: formatNumber(gain) }), T_('gr.rewindYes', { n: formatNumber(gain) }));
      if (!ok) return;
      const events = applyAction(state, 'prestige', CONFIG);
      if (events.length) {
        stage.setTree(idx.tree.get(state.tree.type), 1);
        const c = stage.canopy();
        stage.burst(c.x, c.y, '#ffc855', 60, 2);
        sound.rewind();
        save();
      }
    }
  });

  /* ----- settings ----- */
  const soundBtn = el('soundBtn');
  const paintSound = () => setText(el('soundLabel'), T_(sound.muted ? 'gr.soundOff' : 'gr.soundOn'));
  soundBtn.addEventListener('click', () => { sound.toggle(); paintSound(); });

  el('exportBtn').addEventListener('click', () => {
    const box = el('importCode');
    box.value = serialize(state);
    box.focus();
    box.select();
    try { navigator.clipboard.writeText(box.value); } catch { /* the text is selected; Ctrl+C still works */ }
    note(T_('gr.exported'));
  });

  el('importBtn').addEventListener('click', async () => {
    const raw = el('importCode').value.trim();
    if (!raw) { note(T_('gr.importEmpty')); return; }
    const next = deserialize(raw, CONFIG);
    if (!next) { note(T_('gr.importBad')); return; }
    const ok = await ask(T_('gr.importTitle'), T_('gr.importText'), T_('gr.importYes'));
    if (!ok) return;
    state = next;
    away = null;
    stage.setTree(idx.tree.get(state.tree.type), 1);
    save();
    el('settingsDialog').close();
  });

  el('resetBtn').addEventListener('click', async () => {
    const ok = await ask(T_('gr.resetTitle'), T_('gr.resetText'), T_('gr.resetYes'));
    if (!ok) return;
    state = createState(CONFIG);
    away = null;
    stage.setTree(idx.tree.get(state.tree.type), 1);
    save();
    el('settingsDialog').close();
  });

  function note(text) {
    const node = el('importMsg');
    node.textContent = text;
    node.hidden = false;
  }
  el('settingsBtn').addEventListener('click', () => {
    note('');
    el('importMsg').hidden = true;
    el('importCode').value = '';
    paintSound();
    el('settingsDialog').showModal();
  });
  paintSound();

  /* ----- main loop: fixed logic steps, free-running render ----- */
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    const real = Math.min(0.25, (now - last) / 1000);
    last = now;
    acc += real;
    for (let n = 0; acc >= STEP && n < 12; n++) {
      acc -= STEP;
      onAuto(advance(state, STEP, CONFIG));
    }
    if (acc >= STEP) acc = 0;                           // the tab was starved: drop the backlog
    if (state.tree) stage.setTree(idx.tree.get(state.tree.type), state.tree.hp / state.tree.maxHp);
    stage.tick(real);
    stage.render();
    if (now - lastPaint > 100) { lastPaint = now; paintHud(); refreshPanels(); }
    requestAnimationFrame(frame);
  }

  new ResizeObserver(() => stage.resize()).observe(canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      save();
      platform.gameplayStop();
      return;
    }
    platform.gameplayStart();
    last = performance.now();
    acc = 0;
  });
  window.addEventListener('pagehide', save);
  setInterval(() => { if (!document.hidden) save(); }, 5000);

  /* ----- go ----- */
  platform.gameplayStart();
  paintHud();
  paintPanels();
  panelsSeen = panelsSignature();
  el('gameHint').hidden = state.felled > 0;
  if (away) showAway();
  requestAnimationFrame(frame);
}

/* MUTE_KEY and CONFIG come from the bundle prelude (see scripts/build.mjs). */
if (typeof document !== 'undefined') {
  const root = el('game');
  if (root) startGame(root);
}
