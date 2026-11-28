/**
 * Clockwork Grove — game logic.
 *
 * Pure: no DOM, no timers, no globals. The same file runs in the browser and under `node --test`.
 * Every tunable number comes from config.json; nothing is hard-coded here.
 *
 *   createState(config)                     new run
 *   applyAction(state, action, config, rng) player input; returns events
 *   advance(state, dt, config, rng)          move time forward by dt seconds; returns events
 *   offlineGain(state, awaySeconds, config)  what the choppers earned while away
 *   serialize / deserialize                   save and load
 */

// v2 added achievements, the daily box and district rewards. Version 1 saves still load:
// migrate() fills the new fields with defaults, so nobody loses progress to an update.
export const SAVE_VERSION = 2;

const IDX = new WeakMap();

export function configIndex(config) {
  let idx = IDX.get(config);
  if (!idx) {
    idx = {
      tree: new Map(config.trees.map((t) => [t.id, t])),
      zone: new Map(config.zones.map((z) => [z.id, z])),
      up: new Map(config.upgrades.map((u) => [u.id, u])),
    };
    IDX.set(config, idx);
  }
  return idx;
}

const lvl = (state, id) => state.up[id] || 0;

/* ---- derived values: everything the rules depend on, in one place ---- */

export function derived(state, config) {
  const acc = { click: 0, crit: 0, comboWindow: 0, comboMax: 0, chopper: 0, interval: 0, autoPower: 0,
    value: 0, overdrive: 0, offline: 0, offlineCap: 0 };
  for (const [id, n] of Object.entries(state.up)) {
    const up = configIndex(config).up.get(id);
    if (!up || !n) continue;
    for (const [stat, per] of Object.entries(up.effect)) acc[stat] += per * n;
  }
  let upgradeLevels = 0;
  for (const n of Object.values(state.up)) upgradeLevels += n;
  return {
    click: config.baseClick + acc.click,
    crit: Math.min(0.8, acc.crit),
    comboWindow: config.combo.baseWindow + acc.comboWindow,
    comboMaxSteps: config.combo.maxSteps + acc.comboMax,
    choppers: acc.chopper,
    interval: Math.max(config.auto.minInterval, config.auto.baseInterval - acc.interval),
    autoPower: config.auto.basePower + acc.autoPower,
    yieldMult: (1 + acc.value) * (1 + acc.overdrive) * (1 + config.prestige.bonusPerPoint * state.mainsprings),
    offlineEff: Math.min(1, config.offline.baseEfficiency + acc.offline),
    offlineCap: config.offline.baseCapSeconds + acc.offlineCap,
    upgradeLevels,
  };
}

/* ---- achievements ----
   Targets live in data/games/<id>/achievements.json and are merged into the config by the
   build. Checking them costs one pass over twenty numbers, so it runs after every action
   and every tick instead of on a timer. */

const METRIC = {
  felled: (s) => s.felled,
  clicks: (s) => s.clicks,
  total: (s) => s.total,
  lifetime: (s) => s.lifetime,
  zones: (s) => s.zones.length,
  prestiges: (s) => s.prestiges,
  playTime: (s) => s.playTime,
  upgradeLevels: (s, _c, st) => st.upgradeLevels,
};

function checkAchievements(state, config, st, events) {
  const defs = config.achievements;
  if (!defs || !defs.length) return;
  const have = new Set(state.achievements);
  for (const a of defs) {
    if (have.has(a.id)) continue;
    const read = METRIC[a.metric];
    if (!read) continue;
    if (read(state, config, st) >= a.target) {
      state.achievements.push(a.id);
      have.add(a.id);
      events.push({ k: 'achieved', id: a.id, group: a.group });
    }
  }
}

/* ---- what to do next ----
   Shown in the HUD. Without it the only visible goal for fifteen minutes is "buy the next
   thing in the list", which is the main reason a first session ends early. */
export function nextGoal(state, config) {
  const next = config.zones.find((z) => !state.zones.includes(z.id));
  if (next) return { kind: 'zone', id: next.id, target: next.unlockCost, progress: Math.min(state.timber, next.unlockCost) };
  const gain = prestigeGain(state, config);
  return { kind: 'rewind', id: config.prestige.requiresZone, target: 1, progress: gain >= 1 ? 1 : 0, gain };
}

/* ---- daily box ----
   One box per UTC day, deliberately simple: no streak bookkeeping that can drift across
   timezones. The value is half an hour of chopper income with a floor, so an early player
   who has no choppers yet still gets something worth opening the tab for. */
export const dayIndex = (ms) => Math.floor(ms / 86400000);

export function dailyStatus(state, nowMs, config) {
  const cfg = config.daily || {};
  const today = dayIndex(nowMs);
  const income = incomePerSecond(state, config);
  const amount = Math.max(cfg.minAmount || 0, income * (cfg.amountSeconds || 1800));
  return { available: state.lastDailyDay !== today, amount, today, claimedDays: state.dailyCount || 0 };
}

export function claimDaily(state, nowMs, config) {
  const status = dailyStatus(state, nowMs, config);
  if (!status.available) return { ok: false, amount: 0, count: state.dailyCount || 0 };
  state.lastDailyDay = status.today;
  state.dailyCount = (state.dailyCount || 0) + 1;
  state.timber += status.amount;
  state.total += status.amount;
  state.lifetime += status.amount;
  return { ok: true, amount: status.amount, count: state.dailyCount };
}

/** Multiplier from the current combo: +bonusPerStep for every full `step` clicks, up to maxSteps. */
export function comboMult(state, config, st = derived(state, config)) {
  const steps = Math.min(st.comboMaxSteps, Math.floor(state.combo / config.combo.step));
  return 1 + steps * config.combo.bonusPerStep;
}

export function upgradeCost(up, level) {
  return Math.ceil(up.baseCost * Math.pow(up.growth, level));
}

export function upgradeState(state, id, config) {
  const up = configIndex(config).up.get(id);
  if (!up) return null;
  const level = lvl(state, id);
  const cost = upgradeCost(up, level);
  const maxed = level >= up.max;
  return { up, level, cost, currency: up.currency, maxed, affordable: !maxed && state[up.currency] >= cost };
}

/** Expected Sparkwood per point of damage in a district, given its mix of trees. */
export function zoneYieldRate(zoneId, config) {
  const idx = configIndex(config);
  const zone = idx.zone.get(zoneId) || config.zones[0];
  let rate = 0;
  let weight = 0;
  for (const [tid, w] of Object.entries(zone.pool)) {
    const t = idx.tree.get(tid);
    rate += (t.yield / t.hp) * w;
    weight += w;
  }
  return rate / weight;
}

/** Damage per second dealt by the choppers alone. */
export function autoRate(state, config, st = derived(state, config)) {
  return st.choppers > 0 ? (st.choppers * st.autoPower) / st.interval : 0;
}

/** Sparkwood per second the choppers are worth right now. */
export function incomePerSecond(state, config) {
  return autoRate(state, config) * zoneYieldRate(state.zone, config) * derived(state, config).yieldMult;
}

export function prestigeGain(state, config) {
  if (!state.zones.includes(config.prestige.requiresZone)) return 0;
  return Math.floor(Math.pow(state.total / config.prestige.divisor, config.prestige.exponent));
}

/* ---- state ---- */

export function createState(config, rng = Math.random) {
  const s = {
    v: SAVE_VERSION,
    timber: 0,
    total: 0,
    lifetime: 0,
    gears: 0,
    mainsprings: 0,
    prestiges: 0,
    up: {},
    zones: [config.zones[0].id],
    zone: config.zones[0].id,
    tree: null,
    gap: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    autoAcc: 0,
    clicks: 0,
    felled: 0,
    playTime: 0,
    lastSeen: 0,
    achievements: [],
    zoneRewards: [],
    lastDailyDay: -1,
    dailyCount: 0,
  };
  spawnTree(s, config, rng);
  return s;
}

function pickTree(zone, rng) {
  const entries = Object.entries(zone.pool);
  let sum = 0;
  for (const [, w] of entries) sum += w;
  let r = rng() * sum;
  for (const [id, w] of entries) {
    r -= w;
    if (r < 0) return id;
  }
  return entries[entries.length - 1][0];
}

function spawnTree(state, config, rng) {
  const idx = configIndex(config);
  const zone = idx.zone.get(state.zone) || config.zones[0];
  const def = idx.tree.get(pickTree(zone, rng));
  state.tree = { type: def.id, hp: def.hp, maxHp: def.hp, age: 0 };
  state.gap = 0;
}

/* ---- one swing: player or chopper ---- */

function hit(state, dmg, crit, config, events) {
  const idx = configIndex(config);
  const def = idx.tree.get(state.tree.type);
  const st = derived(state, config);
  // Overkill counts. Sparkwood is paid per point of damage, not per tree, so a stronger
  // axe always earns more even after it can fell a pine in one swing.
  const dealt = dmg * (crit ? config.critMult : 1);
  const gain = (dealt / def.hp) * def.yield * st.yieldMult;
  state.timber += gain;
  state.total += gain;
  state.lifetime += gain;
  state.tree.hp -= dealt;
  events.push({ k: 'hit', amount: gain, crit, dealt });

  if (state.tree.hp <= 1e-9) {
    const bonus = def.yield * st.yieldMult * config.fellBonus;
    state.timber += bonus;
    state.total += bonus;
    state.lifetime += bonus;
    state.gears += def.gears;
    state.felled += 1;
    state.tree = null;
    state.gap = config.treeGapSeconds;
    state.autoAcc = 0;
    events.push({ k: 'fell', amount: bonus, gears: def.gears, tree: def.id });
  }
}

/* ---- input ---- */

/**
 * action: 'chop' | { t: 'buy', id } | { t: 'zone', id } | { t: 'select', id } | 'prestige'
 * Invalid actions are ignored silently (no state change, no events).
 */
export function applyAction(state, action, config, rng = Math.random) {
  const idx = configIndex(config);
  const events = [];
  const t = typeof action === 'string' ? action : action && action.t;
  // Every successful action ends here: achievements are evaluated once, against the state
  // the action produced, so a purchase can never be reported in the wrong order.
  const done = () => {
    checkAchievements(state, config, derived(state, config), events);
    return events;
  };

  if (t === 'chop') {
    if (!state.tree) return events;             // stump: the swing lands on nothing, combo is not broken
    const st = derived(state, config);
    state.combo += 1;
    state.comboTimer = st.comboWindow;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    state.clicks += 1;
    hit(state, st.click * comboMult(state, config, st), rng() < st.crit, config, events);
    return done();
  }

  if (t === 'buy') {
    const u = upgradeState(state, action.id, config);
    if (!u || !u.affordable) return events;
    state[u.currency] -= u.cost;
    state.up[action.id] = u.level + 1;
    events.push({ k: 'buy', id: action.id, level: u.level + 1 });
    return done();
  }

  if (t === 'zone') {
    const zone = idx.zone.get(action.id);
    if (!zone || state.zones.includes(zone.id) || state.timber < zone.unlockCost) return events;
    state.timber -= zone.unlockCost;
    state.zones.push(zone.id);
    state.zone = zone.id;
    // Unlocking a district pays a one-off gear reward: gears are otherwise gated behind
    // rare trees, which left the first gear upgrade sixteen minutes away.
    const gears = (zone.reward && zone.reward.gears) || 0;
    if (gears) {
      state.gears += gears;
      state.zoneRewards.push(zone.id);
    }
    state.tree = null;
    state.gap = 0;
    spawnTree(state, config, rng);
    events.push({ k: 'zone', id: zone.id, gears });
    return done();
  }

  if (t === 'select') {
    const zone = idx.zone.get(action.id);
    if (!zone || !state.zones.includes(zone.id) || state.zone === zone.id) return events;
    state.zone = zone.id;
    state.tree = null;
    state.gap = 0;
    spawnTree(state, config, rng);
    events.push({ k: 'select', id: zone.id });
    return events;
  }

  if (t === 'prestige') {
    const gain = prestigeGain(state, config);
    if (gain < 1) return events;
    state.mainsprings += gain;
    state.prestiges += 1;
    state.timber = 0;
    state.total = 0;
    state.gears = 0;
    state.up = {};
    state.zones = [config.zones[0].id];
    state.zone = config.zones[0].id;
    state.combo = 0;
    state.comboTimer = 0;
    state.autoAcc = 0;
    // District rewards and achievements already earned stay earned; the per-run list of
    // paid districts resets with the run.
    state.zoneRewards = [];
    spawnTree(state, config, rng);
    events.push({ k: 'prestige', gain });
    return done();
  }

  return events;
}

/* ---- time ---- */

export function advance(state, dt, config, rng = Math.random) {
  const events = [];
  if (!(dt > 0)) return events;
  const st = derived(state, config);

  if (state.combo > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.combo = 0;
      state.comboTimer = 0;
      events.push({ k: 'comboend' });
    }
  }

  if (!state.tree) {
    state.gap -= dt;
    if (state.gap <= 0) {
      spawnTree(state, config, rng);
      events.push({ k: 'spawn', tree: state.tree.type });
    }
  } else if (st.choppers > 0) {
    // Choppers are treated as one pooled clock; one unit on that clock is one swing.
    state.autoAcc += (dt * st.choppers) / st.interval;
    for (let n = 0; state.autoAcc >= 1 && n < 60; n++) {
      state.autoAcc -= 1;
      hit(state, st.autoPower, rng() < st.crit, config, events);
      if (!state.tree) break;
    }
  }

  state.tree && (state.tree.age += dt);
  state.playTime += dt;
  checkAchievements(state, config, derived(state, config), events);
  return events;
}

/* ---- offline ---- */

export function offlineGain(state, awaySeconds, config) {
  const st = derived(state, config);
  const seconds = Math.min(Math.max(0, awaySeconds || 0), st.offlineCap);
  return { seconds, amount: incomePerSecond(state, config) * st.offlineEff * seconds };
}

export function collectOffline(state, gain) {
  if (!(gain.amount > 0)) return;
  state.timber += gain.amount;
  state.total += gain.amount;
  state.lifetime += gain.amount;
}

/* ---- save / load ---- */

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

function migrate(data) {
  if (!data || !data.v || data.v > SAVE_VERSION) return null;
  if (data.v === 1) {
    // v1 had no achievements, no daily box and no district rewards. The fields are added
    // empty rather than guessed, so an old save keeps exactly the progress it had.
    data.achievements = [];
    data.zoneRewards = [];
    data.lastDailyDay = -1;
    data.dailyCount = 0;
    data.v = 2;
  }
  return data;
}

export function serialize(state) {
  const { tree, gap, autoAcc, comboTimer, ...rest } = state;
  return JSON.stringify({ ...rest, combo: 0 });
}

export function deserialize(json, config, rng = Math.random) {
  let data;
  try {
    data = migrate(JSON.parse(json));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || typeof data.up !== 'object' || data.up === null) return null;

  const idx = configIndex(config);
  const up = {};
  for (const [id, n] of Object.entries(data.up)) {
    const def = idx.up.get(id);
    if (!def) continue;
    const level = Math.min(def.max, Math.floor(num(n)));
    if (level > 0) up[id] = level;
  }
  // Districts are always a prefix of the configured order: a save that claims to own
  // the last district but not the ones before it is treated as owning none of the extras.
  const owned = Array.isArray(data.zones) ? data.zones : [];
  const zones = [];
  for (const z of config.zones) {
    if (!owned.includes(z.id)) break;
    zones.push(z.id);
  }
  // A save whose district list matches nothing would leave the player owning zero districts
  // and every district in the UI locked. Owning the first one is an invariant, not a bonus.
  if (!zones.length) zones.push(config.zones[0].id);

  const s = createState(config, rng);
  Object.assign(s, {
    timber: num(data.timber),
    total: num(data.total),
    lifetime: num(data.lifetime),
    gears: num(data.gears),
    mainsprings: Math.floor(num(data.mainsprings)),
    prestiges: Math.floor(num(data.prestiges)),
    up,
    zones,
    zone: zones.includes(data.zone) ? data.zone : zones[zones.length - 1],
    bestCombo: Math.floor(num(data.bestCombo)),
    clicks: Math.floor(num(data.clicks)),
    felled: Math.floor(num(data.felled)),
    playTime: num(data.playTime),
    lastSeen: num(data.lastSeen),
    // Unknown ids are dropped rather than carried: a stale save must not unlock achievements
    // that no longer exist, and it must not create districts the config has never heard of.
    achievements: Array.isArray(data.achievements)
      ? data.achievements.filter((id) => (config.achievements || []).some((a) => a.id === id))
      : [],
    zoneRewards: Array.isArray(data.zoneRewards) ? data.zoneRewards.filter((id) => idx.zone.has(id)) : [],
    lastDailyDay: Number.isFinite(data.lastDailyDay) ? Math.floor(data.lastDailyDay) : -1,
    dailyCount: Math.floor(num(data.dailyCount)),
  });
  return s;
}

/* ---- display ---- */

const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  if (value < 0) return '-' + formatNumber(-value);
  if (value < 100) return Number.isInteger(value) ? String(value) : value.toFixed(1);
  let tier = Math.floor(Math.log10(value) / 3);
  tier = Math.min(tier, SUFFIX.length - 1);
  const scaled = value / Math.pow(1000, tier);
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return scaled.toFixed(digits) + SUFFIX[tier];
}

export function formatSeconds(seconds) {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
