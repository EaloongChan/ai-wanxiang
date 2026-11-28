/**
 * Rules and pacing tests for Clockwork Grove.   Run: node --test src/
 *
 * The rule tests pin behaviour. The pacing test replays a typical player and keeps
 * the first run inside broad time bounds, so a number change that breaks the curve
 * (a district that takes an hour, a first upgrade that takes ten minutes) fails here
 * instead of reaching players.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { replay, loadConfig, PROFILES } from '../../../scripts/sim.mjs';
import {
  SAVE_VERSION, advance, applyAction, claimDaily, collectOffline, comboMult, createState, dailyStatus, dayIndex, derived,
  deserialize, formatNumber, formatSeconds, incomePerSecond, nextGoal, offlineGain, prestigeGain, serialize, upgradeCost,
  upgradeState, zoneYieldRate,
} from './logic.js';

const config = loadConfig();
const tree = (id) => config.trees.find((t) => t.id === id);
const flat = () => 0.5;                 // never crits, always picks the first tree in a pool
const noCrit = (v) => () => v;          // fixed value above any crit chance

test('config: ids are unique and every reference resolves', () => {
  const unique = (list, label) => assert.equal(new Set(list).size, list.length, `${label} ids must be unique`);
  unique(config.trees.map((t) => t.id), 'tree');
  unique(config.zones.map((z) => z.id), 'zone');
  unique(config.upgrades.map((u) => u.id), 'upgrade');
  for (const z of config.zones) {
    for (const id of Object.keys(z.pool)) assert.ok(tree(id), `zone ${z.id} references unknown tree ${id}`);
    assert.ok(Object.values(z.pool).every((w) => w > 0), `zone ${z.id} has a non-positive weight`);
  }
  assert.equal(config.zones[0].unlockCost, 0, 'the first district must be free');
  assert.ok(config.prestige.requiresZone, 'prestige needs a gate district');
});

test('config: a new state is clean and standing', () => {
  const s = createState(config, flat);
  assert.equal(s.timber, 0);
  assert.equal(s.gears, 0);
  assert.equal(s.zones.length, 1);
  assert.equal(s.zone, config.zones[0].id);
  assert.equal(s.tree.type, 'copper-pine');
  assert.equal(s.tree.hp, tree('copper-pine').hp);
  assert.equal(s.v, SAVE_VERSION);
});

test('a swing pays per point of damage and the tree pays a bonus when it falls', () => {
  const s = createState(config, flat);
  const pine = tree('copper-pine');
  let expected = pine.yield * config.fellBonus;
  let events = [];
  for (let i = 1; i <= pine.hp; i++) {
    events = applyAction(s, 'chop', config, noCrit(0.99));
    // the combo counter rises before the swing lands, so the Nth swing already carries N swings of combo
    expected += (1 + Math.floor(i / config.combo.step) * config.combo.bonusPerStep) * (pine.yield / pine.hp);
  }
  assert.equal(s.tree, null, 'the pine should have fallen');
  assert.ok(Math.abs(s.timber - expected) < 1e-9, `${s.timber} vs ${expected}`);
  assert.equal(events.at(-1).k, 'fell');
  assert.equal(events.filter((e) => e.k === 'hit').length, 1, 'the last swing lands exactly one hit');
});

test('overkill counts: a stronger axe earns more on the same tree', () => {
  const weak = createState(config, flat);
  const strong = createState(config, flat);
  strong.up.axe = 20;
  applyAction(weak, 'chop', config, noCrit(0.99));
  applyAction(strong, 'chop', config, noCrit(0.99));
  assert.ok(strong.timber > weak.timber * 10);
  assert.equal(strong.tree, null);
});

test('a swing during the regrow gap earns nothing and does not break the combo', () => {
  const s = createState(config, flat);
  s.up.axe = 50;
  applyAction(s, 'chop', config, noCrit(0.99));
  assert.equal(s.tree, null);
  const before = s.timber;
  const combo = s.combo;
  assert.deepEqual(applyAction(s, 'chop', config, noCrit(0.99)), []);
  assert.equal(s.timber, before);
  assert.equal(s.combo, combo);
});

test('combo raises damage every step and resets when the window runs out', () => {
  const s = createState(config, flat);
  const st = derived(s, config);
  assert.equal(comboMult(s, config, st), 1);
  s.combo = config.combo.step;
  s.comboTimer = st.comboWindow;
  assert.ok(Math.abs(comboMult(s, config, st) - (1 + config.combo.bonusPerStep)) < 1e-12);
  s.combo = config.combo.step * 1000;
  assert.ok(Math.abs(comboMult(s, config, st) - (1 + config.combo.bonusPerStep * st.comboMaxSteps)) < 1e-12, 'combo is capped');
  s.combo = 7;
  advance(s, st.comboWindow + 0.1, config, flat);
  assert.equal(s.combo, 0);
});

test('buying takes the cost and refuses when unaffordable or maxed', () => {
  const s = createState(config, flat);
  const up = config.upgrades.find((u) => u.id === 'axe');
  s.timber = up.baseCost;
  assert.equal(upgradeState(s, 'axe', config).affordable, true);
  applyAction(s, { t: 'buy', id: 'axe' }, config, flat);
  assert.equal(s.up.axe, 1);
  assert.equal(s.timber, 0);
  assert.deepEqual(applyAction(s, { t: 'buy', id: 'axe' }, config, flat), [], 'cannot buy without Sparkwood');
  assert.equal(s.up.axe, 1);
  s.timber = 1e15;
  s.up.axe = up.max;
  assert.equal(upgradeState(s, 'axe', config).maxed, true);
  applyAction(s, { t: 'buy', id: 'axe' }, config, flat);
  assert.equal(s.up.axe, up.max, 'cannot exceed max level');
  assert.deepEqual(applyAction(s, { t: 'buy', id: 'no-such-upgrade' }, config, flat), []);
});

test('gear upgrades are paid with gears, not Sparkwood', () => {
  const s = createState(config, flat);
  const up = config.upgrades.find((u) => u.currency === 'gears');
  s.timber = 1e12;
  assert.equal(upgradeState(s, up.id, config).affordable, false, 'Sparkwood must not buy gear upgrades');
  s.gears = up.baseCost;
  applyAction(s, { t: 'buy', id: up.id }, config, flat);
  assert.equal(s.gears, 0);
  assert.equal(s.up[up.id], 1);
});

test('costs grow geometrically', () => {
  const up = config.upgrades.find((u) => u.id === 'axe');
  assert.equal(upgradeCost(up, 0), up.baseCost);
  assert.ok(upgradeCost(up, 1) > upgradeCost(up, 0));
  assert.ok(upgradeCost(up, 10) > upgradeCost(up, 5));
});

test('districts unlock in order, cost Sparkwood and become the current district', () => {
  const s = createState(config, flat);
  const second = config.zones[1];
  s.timber = second.unlockCost;
  applyAction(s, { t: 'zone', id: second.id }, config, flat);
  assert.deepEqual(s.zones, [config.zones[0].id, second.id]);
  assert.equal(s.zone, second.id);
  assert.equal(s.timber, 0);
  assert.deepEqual(applyAction(s, { t: 'zone', id: second.id }, config, flat), [], 'cannot unlock twice');
  assert.deepEqual(applyAction(s, { t: 'zone', id: config.zones[2].id }, config, flat), [], 'cannot afford the next one');
});

test('a locked district cannot be selected; an unlocked one can', () => {
  const s = createState(config, flat);
  assert.deepEqual(applyAction(s, { t: 'select', id: config.zones[3].id }, config, flat), []);
  s.zones.push(config.zones[3].id);
  const ev = applyAction(s, { t: 'select', id: config.zones[3].id }, config, flat);
  assert.equal(ev[0].k, 'select');
  assert.equal(s.zone, config.zones[3].id);
});

test('choppers swing on their own while time advances', () => {
  const s = createState(config, flat);
  advance(s, 60, config, noCrit(0.99));
  assert.equal(s.timber, 0, 'no choppers, no income');
  s.up.choppers = 2;
  s.up.sawblade = 4;
  const st = derived(s, config);
  advance(s, st.interval, config, noCrit(0.99));
  assert.ok(s.timber > 0, 'choppers earned Sparkwood');
  assert.ok(s.felled >= 1, 'they felled at least one tree');
});

test('the next tree grows after the gap', () => {
  const s = createState(config, flat);
  s.up.axe = 50;
  applyAction(s, 'chop', config, noCrit(0.99));
  assert.equal(s.tree, null);
  const ev = advance(s, config.treeGapSeconds / 2, config, flat);
  assert.equal(s.tree, null);
  assert.ok(!ev.some((e) => e.k === 'spawn'));
  const ev2 = advance(s, config.treeGapSeconds, config, flat);
  assert.ok(s.tree && s.tree.hp === tree(s.tree.type).hp);
  assert.equal(ev2.filter((e) => e.k === 'spawn').length, 1);
});

test('negative and zero time steps are ignored', () => {
  const s = createState(config, flat);
  const before = serialize(s);
  assert.deepEqual(advance(s, 0, config, flat), []);
  assert.deepEqual(advance(s, -5, config, flat), []);
  assert.equal(serialize(s), before);
});

test('rare trees drop gears when they fall', () => {
  const s = createState(config, flat);
  s.zones.push('foundry');
  s.zone = 'foundry';
  s.up.axe = 1000;
  let gears = 0;
  for (let i = 0; i < 200; i++) {
    for (const e of applyAction(s, 'chop', config, noCrit(0.99))) gears += e.gears || 0;
    advance(s, config.treeGapSeconds + 0.01, config, flat);
  }
  assert.ok(gears > 0, 'felling in the foundry should yield gears');
  assert.equal(s.gears, gears);
});

test('rewind needs the final district and resets the run but keeps mainsprings', () => {
  const s = createState(config, flat);
  s.timber = 1e12;
  s.total = 1e12;
  s.lifetime = 1e12;
  assert.deepEqual(applyAction(s, 'prestige', config, flat), [], 'locked before the final district');
  for (const z of config.zones) if (!s.zones.includes(z.id)) s.zones.push(z.id);
  const expected = Math.floor(Math.pow(s.total / config.prestige.divisor, config.prestige.exponent));
  assert.equal(prestigeGain(s, config), expected);
  assert.ok(expected >= 1);

  const incomeBefore = derived(s, config).yieldMult;
  const ev = applyAction(s, 'prestige', config, flat);
  assert.equal(ev[0].k, 'prestige');
  assert.equal(ev[0].gain, expected);
  assert.equal(s.mainsprings, expected);
  assert.equal(s.prestiges, 1);
  assert.equal(s.timber, 0);
  assert.equal(s.total, 0);
  assert.deepEqual(s.up, {});
  assert.deepEqual(s.zones, [config.zones[0].id]);
  assert.equal(s.lifetime, 1e12, 'lifetime total survives the reset');
  assert.ok(derived(s, config).yieldMult > incomeBefore, 'mainsprings raise the yield');
  assert.ok(s.tree, 'a fresh tree stands after the rewind');
});

test('offline earnings follow the choppers, the efficiency and the cap', () => {
  const s = createState(config, flat);
  assert.equal(offlineGain(s, 3600, config).amount, 0, 'no choppers, nothing to collect');
  s.up.choppers = 10;
  const st = derived(s, config);
  const hour = offlineGain(s, 3600, config);
  assert.ok(Math.abs(hour.amount - incomePerSecond(s, config) * st.offlineEff * 3600) < 1e-6);
  const capped = offlineGain(s, st.offlineCap * 4, config);
  assert.equal(capped.seconds, st.offlineCap);
  const before = s.timber;
  collectOffline(s, capped);
  assert.ok(s.timber > before);
  assert.equal(s.total, s.timber - before, 'offline earnings count towards the run');
});

test('districts with rarer trees pay more per point of damage', () => {
  const rates = config.zones.map((z) => zoneYieldRate(z.id, config));
  for (let i = 1; i < rates.length; i++) assert.ok(rates[i] > rates[i - 1], `${config.zones[i].id} should pay more than ${config.zones[i - 1].id}`);
});

test('save and load round-trip the run', () => {
  const s = createState(config, flat);
  s.timber = 1234.5; s.total = 9999; s.lifetime = 12345; s.gears = 7; s.mainsprings = 3; s.prestiges = 2;
  s.up.axe = 4; s.up.choppers = 2; s.zones = config.zones.slice(0, 3).map((z) => z.id); s.zone = 'foundry';
  s.felled = 42; s.clicks = 100; s.playTime = 77; s.lastSeen = 1700000000000;
  const back = deserialize(serialize(s), config, flat);
  for (const k of ['timber', 'total', 'lifetime', 'gears', 'mainsprings', 'prestiges', 'zones', 'zone', 'felled', 'clicks', 'playTime', 'lastSeen']) {
    assert.deepEqual(back[k], s[k], k);
  }
  assert.deepEqual(back.up, { axe: 4, choppers: 2 });
  assert.equal(back.combo, 0, 'combo does not survive a reload');
  assert.ok(back.tree, 'a fresh tree is standing after load');
});

test('a damaged or tampered save cannot crash the game', () => {
  assert.equal(deserialize('not json', config, flat), null);
  assert.equal(deserialize('null', config, flat), null);
  assert.equal(deserialize('[]', config, flat), null);
  assert.equal(deserialize('{"v":999,"up":{}}', config, flat), null, 'a newer save version is refused');
  assert.equal(deserialize('{"up":{}}', config, flat), null, 'a save without a version is refused');
  const s = deserialize(JSON.stringify({ v: SAVE_VERSION, up: { axe: 9999, ghost: 3 }, timber: -5, gears: 'x', zones: ['nowhere', 'thicket'], zone: 'heart', mainsprings: 2.7 }), config, flat);
  assert.ok(s, 'a partially valid save still loads');
  assert.equal(s.up.axe, config.upgrades.find((u) => u.id === 'axe').max, 'levels are clamped to max');
  assert.equal(s.up.ghost, undefined, 'unknown upgrades are dropped');
  assert.equal(s.timber, 0);
  assert.equal(s.gears, 0);
  assert.deepEqual(s.zones, [config.zones[0].id], 'only the leading run of valid districts is kept');
  assert.equal(s.zone, config.zones[0].id, 'the current district falls back to one that is owned');
  assert.equal(s.mainsprings, 2);
});

test('a save that skips a district is trimmed to the contiguous prefix', () => {
  const s = deserialize(JSON.stringify({ v: SAVE_VERSION, up: {}, zones: ['thicket', 'heart'] }), config, flat);
  assert.deepEqual(s.zones, [config.zones[0].id]);
  const t = deserialize(JSON.stringify({ v: SAVE_VERSION, up: {}, zones: ['thicket', 'quarry', 'foundry'] }), config, flat);
  assert.deepEqual(t.zones, config.zones.slice(0, 3).map((z) => z.id));
});

test('numbers are formatted for people', () => {
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(7), '7');
  assert.equal(formatNumber(12.5), '12.5');
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(1234), '1.23K');
  assert.equal(formatNumber(1500000), '1.50M');
  assert.equal(formatNumber(-5), '-5');
  assert.equal(formatNumber(NaN), '0');
  assert.equal(formatSeconds(45), '45s');
  assert.equal(formatSeconds(125), '2m 5s');
  assert.equal(formatSeconds(7260), '2h 1m');
});

/* ---- pacing ----
 * Bounds are deliberately wide. They exist to catch a broken curve, not to freeze it.
 * If a design change moves a milestone on purpose, move the bound with it. */
test('pacing: a typical player reaches each district inside the intended window', () => {
  const { marks } = replay(1000, { minutes: 40, config });
  const at = (label) => { const m = marks.find((x) => x.label === label); assert.ok(m, `never reached: ${label}`); return m.t; };
  const window = (label, min, max) => {
    const t = at(label);
    assert.ok(t >= min && t <= max, `${label} at ${Math.round(t)}s, expected ${min}-${max}s`);
  };
  window('first upgrade', 5, 40);
  window('zone quarry', 90, 300);
  window('zone foundry', 180, 480);
  window('zone frost', 300, 660);
  window('zone storm', 480, 900);
  window('zone heart', 720, 1320);
});

test('pacing: the first rewind pays off and the second run is faster', () => {
  const first = replay(1000, { minutes: 45, config });
  const rewind = first.marks.find((m) => m.label.startsWith('rewind 1'));
  assert.ok(rewind, 'a first rewind should happen inside 45 minutes');
  const gain = Number(/\+(\d+)\)/.exec(rewind.label)[1]);
  assert.ok(gain >= 8 && gain <= 30, `first rewind gave ${gain} mainsprings, expected 8-30`);

  const second = first.marks.find((m) => m.label.startsWith('rewind 2'));
  assert.ok(second, 'a second rewind should happen inside 45 minutes');
  assert.ok(second.t - rewind.t < rewind.t, `second run (${Math.round(second.t - rewind.t)}s) should be shorter than the first (${Math.round(rewind.t)}s)`);
});

test('pacing: numbers stay sane over a long session', () => {
  const { state } = replay(1000, { minutes: 180, config });
  assert.ok(Number.isFinite(state.mainsprings));
  assert.ok(state.mainsprings > 0);
  assert.ok(state.mainsprings < 1e6, `mainsprings ran away to ${state.mainsprings}`);
  assert.ok(Number.isFinite(state.lifetime) && state.lifetime > 0);
});

/* ---- retention features ---- */

test('achievements: unlocked once, reported once, never revoked', () => {
  const s = createState(config, flat);
  s.clicks = 99;
  let events = applyAction(s, 'chop', config, flat);
  assert.ok(s.achievements.includes('clicks-100'), 'the 100th swing unlocks the achievement');
  assert.equal(events.filter((e) => e.k === 'achieved').length, 1);

  events = applyAction(s, 'chop', config, flat);
  assert.equal(events.filter((e) => e.k === 'achieved').length, 0, 'no second award');

  s.clicks = 0;
  applyAction(s, 'chop', config, flat);
  assert.ok(s.achievements.includes('clicks-100'), 'progress going backwards must not revoke it');
});

test('achievements: a save cannot smuggle in ids that do not exist', () => {
  const s = createState(config, flat);
  s.achievements = ['clicks-100', 'made-up-id'];
  const loaded = deserialize(serialize(s), config, flat);
  assert.deepEqual(loaded.achievements, ['clicks-100']);
});

test('daily: one box per day, with a floor for players who own no choppers', () => {
  const s = createState(config, flat);
  const now = 1_800_000_000_000;             // an arbitrary fixed moment
  const first = dailyStatus(s, now, config);
  assert.equal(first.available, true);
  assert.ok(first.amount >= config.daily.minAmount, 'a new player still gets something');

  const claim = claimDaily(s, now, config);
  assert.equal(claim.ok, true);
  assert.equal(s.timber, claim.amount);
  assert.equal(s.lastDailyDay, dayIndex(now));

  assert.equal(dailyStatus(s, now + 3600_000, config).available, false, 'same day: nothing more');
  assert.equal(claimDaily(s, now + 3600_000, config).ok, false);

  const tomorrow = now + 86_400_000;
  assert.equal(dailyStatus(s, tomorrow, config).available, true);
  assert.equal(claimDaily(s, tomorrow, config).ok, true);
  assert.equal(s.dailyCount, 2);
});

test('districts pay their gear reward exactly once, on unlock', () => {
  const s = createState(config, flat);
  const quarry = config.zones.find((z) => z.id === 'quarry');
  s.timber = quarry.unlockCost;
  const events = applyAction(s, { t: 'zone', id: 'quarry' }, config, flat);
  const unlock = events.find((e) => e.k === 'zone');
  assert.equal(unlock.gears, quarry.reward.gears);
  assert.equal(s.gears, quarry.reward.gears);
  assert.ok(s.zoneRewards.includes('quarry'));

  // Selecting the district again must not pay twice.
  const again = applyAction(s, { t: 'zone', id: 'quarry' }, config, flat);
  assert.equal(again.length, 0);
  assert.equal(s.gears, quarry.reward.gears);
});

test('next goal: the next district, then the rewind', () => {
  const s = createState(config, flat);
  s.timber = 100;
  let goal = nextGoal(s, config);
  assert.equal(goal.kind, 'zone');
  assert.equal(goal.id, 'quarry');
  assert.equal(goal.progress, 100);

  s.zones = config.zones.map((z) => z.id);
  s.zone = config.zones[config.zones.length - 1].id;
  goal = nextGoal(s, config);
  assert.equal(goal.kind, 'rewind');
});

test('save: v1 migrates, and a broken district list still owns the first district', () => {
  const s = createState(config, flat);
  s.timber = 500;
  s.up = { axe: 2 };
  const raw = JSON.parse(serialize(s));

  // A v1 save has none of the v2 fields.
  const v1 = { ...raw, v: 1 };
  delete v1.achievements;
  delete v1.zoneRewards;
  delete v1.lastDailyDay;
  delete v1.dailyCount;
  const migrated = deserialize(JSON.stringify(v1), config, flat);
  assert.equal(migrated.v, 2);
  assert.deepEqual(migrated.achievements, []);
  assert.equal(migrated.lastDailyDay, -1);
  assert.equal(migrated.timber, 500);
  assert.equal(migrated.up.axe, 2);

  // A save whose districts match nothing used to leave every district locked.
  const broken = deserialize(JSON.stringify({ ...raw, zones: ['not-a-district'], zone: 'not-a-district' }), config, flat);
  assert.deepEqual(broken.zones, [config.zones[0].id]);
  assert.equal(broken.zone, config.zones[0].id);

  const empty = deserialize(JSON.stringify({ ...raw, zones: [] }), config, flat);
  assert.deepEqual(empty.zones, [config.zones[0].id]);
});

test('combo end is reported once and clears the timer', () => {
  const s = createState(config, flat);
  applyAction(s, 'chop', config, flat);
  assert.ok(s.combo > 0 && s.comboTimer > 0);
  const events = advance(s, config.combo.baseWindow + 0.5, config, flat);
  assert.ok(events.some((e) => e.k === 'comboend'));
  assert.equal(s.combo, 0);
  assert.equal(s.comboTimer, 0);
});

test('offline: negative, NaN and infinite gaps are clamped', () => {
  const s = createState(config, flat);
  s.up = { choppers: 5 };
  assert.deepEqual(offlineGain(s, -10, config), { seconds: 0, amount: 0 });
  assert.deepEqual(offlineGain(s, NaN, config), { seconds: 0, amount: 0 });
  const capped = offlineGain(s, Infinity, config);
  assert.equal(capped.seconds, derived(s, config).offlineCap);
});

test('prestige: nothing banked means nothing happens', () => {
  const s = createState(config, flat);
  s.zones = config.zones.map((z) => z.id);
  s.total = 0;
  assert.equal(prestigeGain(s, config), 0);
  assert.deepEqual(applyAction(s, 'prestige', config, flat), []);
  assert.equal(s.prestiges, 0);
});

test('invalid actions change nothing', () => {
  const s = createState(config, flat);
  const before = serialize(s);
  for (const bad of [null, undefined, 'nonsense', { t: 'nope' }, { t: 'buy', id: 'no-such-upgrade' }, { t: 'zone', id: 'no-such-zone' }]) {
    assert.deepEqual(applyAction(s, bad, config, flat), []);
  }
  assert.equal(serialize(s), before);
});

test('display: extreme numbers never come back as NaN', () => {
  assert.equal(formatNumber(NaN), '0');
  assert.equal(formatNumber(-5), '-5');
  assert.ok(formatNumber(1e30).endsWith('Oc'), formatNumber(1e30));
  assert.equal(formatSeconds(59), '59s');
  assert.equal(formatSeconds(3599), '59m 59s');
  assert.equal(formatSeconds(86400), '24h 0m');
  assert.equal(formatSeconds(-5), '-5s');
});

test('pacing guards: every player model lands inside the same broad bounds', () => {
  for (const [name, profile] of Object.entries(PROFILES)) {
    const { marks } = replay(4242, { minutes: 40, config, profile });
    const at = (prefix) => {
      const mark = marks.find((m) => m.label.startsWith(prefix));
      assert.ok(mark, `${name}: ${prefix} never happened`);
      return mark.t;
    };
    const first = at('first upgrade');
    assert.ok(first >= 5 && first <= 45, `${name}: first upgrade at ${Math.round(first)}s, expected 5-45s`);
    const district = at('zone quarry');
    assert.ok(district >= 60 && district <= 420, `${name}: first district at ${Math.round(district)}s, expected 60-420s`);
    const rewind = at('rewind 1');
    assert.ok(rewind >= 480 && rewind <= 2400, `${name}: first rewind at ${Math.round(rewind)}s, expected 8-40 min`);
  }
});
