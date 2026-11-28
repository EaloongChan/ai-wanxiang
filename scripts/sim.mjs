/**
 * Headless pacing replay for Clockwork Grove (zero dependencies).
 *
 *   node scripts/sim.mjs                 one player profile, default seed
 *   node scripts/sim.mjs --runs 20       average over 20 seeds
 *   node scripts/sim.mjs --trace         print the first run step by step
 *   node scripts/sim.mjs --minutes=60    stop after N minutes of play
 *
 * Replays a "typical" player through the pure logic layer and prints when each
 * milestone lands. It is a design aid, not a test: tune numbers in
 * data/games/lumber-tycoon/config.json until the timeline feels right. The wide
 * bounds that must hold afterwards live in logic.test.js, which imports replay().
 *
 * Player model:
 *   minute 0-15   active      4 swings per second
 *   minute 15+    semi-idle   1 swing per second (choppers do the rest)
 * Buying: unlock the next district as soon as it is affordable, otherwise the
 * cheapest affordable upgrade, never spending more than half of the wallet or 5% of
 * the next district's price on it. Gear upgrades are bought whenever affordable.
 * Rewind once the next gain would be at least as large as the last one.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyAction, advance, createState, derived, prestigeGain, upgradeState } from '../src/game/lumber-tycoon/logic.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_PATH = path.join(ROOT, 'data', 'games', 'lumber-tycoon', 'config.json');

export const loadConfig = (file = CONFIG_PATH) => JSON.parse(fs.readFileSync(file, 'utf8'));

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
export function replay(seed, { minutes = 120, config = loadConfig(), trace = false, onMark = null } = {}) {
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
    const rate = t - runStart < 900 ? 4 : 1;
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=')[1];
  const runs = Number(arg('runs')) || 1;
  const minutes = Number(arg('minutes')) || 120;
  const config = loadConfig();

  console.log('');
  console.log('  Clockwork Grove · pacing replay');
  console.log('  ' + '─'.repeat(60));

  if (process.argv.includes('--trace')) {
    replay(1000, { minutes, config, trace: true });
    console.log('');
    process.exit(0);
  }

  const sessions = [];
  for (let i = 0; i < runs; i++) sessions.push(replay(1000 + i * 7919, { minutes, config }));

  for (const m of sessions[0].marks) {
    const vals = sessions.map((r) => r.marks.find((x) => x.label === m.label)).filter(Boolean);
    const avgT = vals.reduce((a, x) => a + x.t, 0) / vals.length;
    const avgDt = vals.reduce((a, x) => a + x.dt, 0) / vals.length;
    console.log(`  ${m.label.padEnd(28)} at ${mm(avgT).padStart(7)}   took ${mm(avgDt).padStart(6)}   income ${n(m.income).padStart(8)}/s${vals.length < runs ? `   (${vals.length}/${runs} runs)` : ''}`);
  }

  const last = sessions[sessions.length - 1].state;
  console.log('');
  console.log(`  end of replay         mainsprings ${Math.round(last.mainsprings)} (×${(1 + config.prestige.bonusPerPoint * last.mainsprings).toFixed(2)} yield) · prestiges ${last.prestiges} · lifetime ${last.lifetime.toExponential(2)}`);
  console.log('');
}
