/**
 * Headless pacing replay for Clockwork Grove (zero dependencies).
 *
 *   node scripts/sim.mjs                          one normal player, default seed
 *   node scripts/sim.mjs --runs=200               percentiles over 200 seeds
 *   node scripts/sim.mjs --players=fast,normal,slow   all three player models
 *   node scripts/sim.mjs --trace                  print the first run step by step
 *   node scripts/sim.mjs --minutes=60             stop after N minutes of play
 *
 * Replays a player through the pure logic layer and prints when each milestone lands.
 * It is a design aid, not a test: tune numbers in data/games/lumber-tycoon/config.json
 * until the timeline feels right. The broad bounds that must hold afterwards live in
 * logic.test.js, which imports replay().
 *
 * Player models differ only in how hard they click and when they stop:
 *   fast    6 swings per second, keeps clicking
 *   normal  4 swings per second for 15 minutes, then 1
 *   slow    2 swings per second for 15 minutes, then none (choppers only)
 *
 * Buying: unlock the next district as soon as it is affordable, otherwise the cheapest
 * affordable upgrade, never spending more than half of the wallet or 5% of the next
 * district's price on it. Gear upgrades are bought whenever affordable.
 * Rewind once the next gain would be at least as large as the last one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAction, advance, createState, derived, prestigeGain, upgradeState } from '../src/game/lumber-tycoon/logic.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME_DIR = path.join(ROOT, 'data', 'games', 'lumber-tycoon');
const CONFIG_PATH = path.join(GAME_DIR, 'config.json');

/** Config plus the achievement list, which the build merges into the same object. */
export const loadConfig = (file = CONFIG_PATH) => {
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ach = path.join(GAME_DIR, 'achievements.json');
  if (fs.existsSync(ach)) config.achievements = JSON.parse(fs.readFileSync(ach, 'utf8'));
  return config;
};

export const PROFILES = {
  fast: { activeRate: 6, idleRate: 3, idleAfter: 900 },
  normal: { activeRate: 4, idleRate: 1, idleAfter: 900 },
  slow: { activeRate: 2, idleRate: 0, idleAfter: 900 },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Play one full session and return the milestones.
 * Each mark: { label, t, dt, income } — when it happened, how long since the previous
 * one, and the income per second measured over the preceding ~10 s.
 */
export function replay(seed, { minutes = 120, config = loadConfig(), trace = false, onMark = null, profile = PROFILES.normal } = {}) {
  const rng = mulberry32(seed);
  const s = createState(config, rng);
  const dt = config.tickMs / 1000;
  const marks = [];
  let t = 0;
  let acc = 0;
  let runStart = 0;
  let lastMarkT = 0;
  let earned = 0;
  let lastGain = 0;

  const log = (label) => {
    const m = { label, t, dt: t - Math.max(lastMarkT, runStart), income: earned / 10 };
    marks.push(m);
    lastMarkT = t;
    if (onMark) onMark(m);
    if (trace) console.log(`    ${mm(m.t).padStart(7)}  +${mm(m.dt).padStart(6)}  ${label.padEnd(26)} income ${n(m.income).padStart(7)}/s`);
  };

  while (t < minutes * 60) {
    const rate = t - runStart < profile.idleAfter ? profile.activeRate : profile.idleRate;
    acc += rate * dt;
    while (acc >= 1) {
      acc -= 1;
      for (const e of applyAction(s, 'chop', config, rng)) earned += e.amount || 0;
    }
    for (const e of advance(s, dt, config, rng)) earned += e.amount || 0;
    t += dt;
    earned *= 0.985;   // exponential fade ≈ a 10 s window, per 100 ms step
    if (Math.abs(t * 10 - Math.round(t * 10)) > 1e-6) continue;   // buy once per simulated second
    if (Math.round(t * 10) % 10 !== 0) continue;

    const next = config.zones.find((z) => !s.zones.includes(z.id));
    if (next && s.timber >= next.unlockCost) {
      applyAction(s, { t: 'zone', id: next.id }, config, rng);
      if (s.prestiges === 0) log(`zone ${next.id}`);
      continue;
    }
    const budget = next ? Math.max(s.timber * 0.5, next.unlockCost * 0.05) : Infinity;
    let best = null;
    for (const u of config.upgrades) {
      const us = upgradeState(s, u.id, config);
      if (!us.affordable) continue;
      if (us.currency === 'timber' && us.cost > budget) continue;
      const score = us.cost / (us.currency === 'gears' ? 40 : 1);
      if (!best || score < best.score) best = { id: u.id, score };
    }
    if (best) {
      applyAction(s, { t: 'buy', id: best.id }, config, rng);
      if (s.prestiges === 0 && !marks.length) log('first upgrade');
      continue;
    }
    const gain = prestigeGain(s, config);
    if (gain >= 1 && gain >= lastGain) {
      applyAction(s, 'prestige', config, rng);
      log(`rewind ${s.prestiges} (+${gain})`);
      lastGain = gain;
      runStart = t;
      lastMarkT = t;
    }
  }
  return { marks, state: s };
}

const mm = (t) => `${Math.floor(t / 60)}m${String(Math.floor(t % 60)).padStart(2, '0')}s`;
const n = (v) => (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v.toFixed(0));

/** Nearest-rank percentile of a sorted numeric array. */
export const percentile = (sorted, q) => {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)));
  return sorted[i];
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];
  const runs = Number(arg('runs')) || 20;
  const minutes = Number(arg('minutes')) || 120;
  const players = (arg('players') || 'normal').split(',').map((p) => p.trim()).filter((p) => PROFILES[p]);
  const config = loadConfig();

  console.log('');
  console.log('  Clockwork Grove · pacing replay');
  console.log('  ' + '─'.repeat(66));

  if (process.argv.includes('--trace')) {
    replay(1000, { minutes, config, trace: true, profile: PROFILES.normal });
    console.log('');
    process.exit(0);
  }

  for (const player of players) {
    const sessions = [];
    for (let i = 0; i < runs; i++) sessions.push(replay(1000 + i * 7919, { minutes, config, profile: PROFILES[player] }));
    const labels = [...new Set(sessions[0].marks.map((m) => m.label))];
    console.log('');
    console.log(`  ${player} · ${runs} runs · ${minutes} min cap`);
    console.log(`  ${'milestone'.padEnd(24)}${'P10'.padStart(9)}${'P50'.padStart(9)}${'P90'.padStart(9)}`);
    for (const label of labels) {
      const times = sessions.map((r) => (r.marks.find((x) => x.label === label) || {}).t).filter((v) => v !== undefined).sort((a, b) => a - b);
      console.log(`  ${label.padEnd(24)}${mm(percentile(times, 0.1)).padStart(9)}${mm(percentile(times, 0.5)).padStart(9)}${mm(percentile(times, 0.9)).padStart(9)}${times.length < runs ? `   (${times.length}/${runs})` : ''}`);
    }
    const last = sessions[sessions.length - 1].state;
    console.log(`  end: mainsprings ${Math.round(last.mainsprings)} (×${(1 + config.prestige.bonusPerPoint * last.mainsprings).toFixed(2)}) · prestiges ${last.prestiges} · lifetime ${last.lifetime.toExponential(2)}`);
  }
  console.log('');
}
