import test from 'node:test';
import assert from 'node:assert/strict';
import { cmPer360, convert, convertAll, countsPer360, edpi, roundSens } from './core.js';

const games = [
  { id: 'cs2', name: 'CS2', yaw: 0.022 },
  { id: 'valorant', name: 'Valorant', yaw: 0.07 },
  { id: 'ow2', name: 'Overwatch 2', yaw: 0.0066 },
];
const cs2 = games[0];
const valorant = games[1];

test('Valorant to CS2 is the published ×3.18 ratio', () => {
  // 0.4 at 800 DPI in Valorant is the commonly quoted 1.27 in CS2.
  assert.ok(Math.abs(convert(0.4, valorant.yaw, cs2.yaw, 800) - 1.2727) < 0.001);
  assert.ok(Math.abs(convert(1, valorant.yaw, cs2.yaw, 800) / 3.1818 - 1) < 0.001);
  assert.ok(Math.abs(convert(1, cs2.yaw, valorant.yaw, 800) - 0.3143) < 0.001);
});

test('a converted setting turns the same physical distance', () => {
  const cmBefore = cmPer360(0.4, 800, valorant.yaw);
  const after = convert(0.4, valorant.yaw, cs2.yaw, 800);
  assert.ok(Math.abs(cmPer360(after, 800, cs2.yaw) - cmBefore) < 1e-9);
  assert.ok(Math.abs(cmBefore - 40.82) < 0.05, `0.4 @ 800 in Valorant is about 40.8 cm/360, got ${cmBefore.toFixed(2)}`);
});

test('changing DPI scales the setting so the distance stays the same', () => {
  const doubled = convert(2, cs2.yaw, cs2.yaw, 800, 1600);
  assert.equal(doubled, 1);
  assert.ok(Math.abs(cmPer360(doubled, 1600, cs2.yaw) - cmPer360(2, 800, cs2.yaw)) < 1e-9);
});

test('counts and eDPI are plain arithmetic', () => {
  assert.ok(Math.abs(countsPer360(2, 0.022) - 8181.818) < 0.01);
  assert.equal(edpi(1.5, 800), 1200);
  assert.ok(Math.abs(cmPer360(1, 400, 0.022) - 103.91) < 0.02);
});

test('rounding keeps four decimals and never returns zero', () => {
  assert.equal(roundSens(1.27272727), 1.2727);
  assert.equal(roundSens(2), 2);
  assert.equal(roundSens(0.00001), 0.0001);
});

test('convertAll fills every game and validates its input', () => {
  const ok = convertAll({ sens: 0.4, dpi: 800, dpiTo: '', from: valorant, to: cs2, games });
  assert.equal(ok.ok, true);
  assert.equal(ok.toSens, 1.2727);
  assert.equal(ok.rows.length, 3);
  assert.equal(ok.rows.find((r) => r.id === 'valorant').sens, 0.4);
  assert.equal(ok.rows.find((r) => r.id === 'ow2').sens, 4.2424);

  assert.equal(convertAll({ sens: 0, dpi: 800, dpiTo: '', from: valorant, to: cs2, games }).ok, false);
  assert.equal(convertAll({ sens: 1, dpi: NaN, dpiTo: '', from: valorant, to: cs2, games }).ok, false);
  assert.equal(convertAll({ sens: 1, dpi: 800, dpiTo: -5, from: valorant, to: cs2, games }).ok, false);
  assert.equal(convertAll({ sens: 1, dpi: 800, dpiTo: '', from: undefined, to: cs2, games }).ok, false);

  const higher = convertAll({ sens: 1, dpi: 800, dpiTo: 1600, from: cs2, to: cs2, games });
  assert.equal(higher.toSens, 0.5);
});
