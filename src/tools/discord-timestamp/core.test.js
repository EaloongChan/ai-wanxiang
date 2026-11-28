import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCodes, localToEpoch, parseCode, presets, preview, relativeParts, toInputs } from './core.js';

const NOW = 1795872000;   // 2026-11-28 04:00:00 UTC

/** A plain English sentence, standing in for what the page does with its own strings. */
const rel = (p) => (p.zero ? 'now' : `${p.past ? '' : 'in '}${p.n} ${p.unit}`);

test('a moment produces all seven styles with the right letters', () => {
  const codes = buildCodes(NOW, NOW, 'en-US', rel);
  assert.deepEqual(codes.map((c) => c.code), ['t', 'T', 'd', 'D', 'f', 'F', 'R']);
  assert.equal(codes[6].syntax, `<t:${NOW}:R>`);
  assert.match(codes[3].preview, /^November 28, 2026$|^November 27, 2026$/);     // the day depends on this machine's zone
  assert.match(codes[2].preview, /^11\/2[78]\/26$/);
  assert.equal(codes[6].preview, 'now');
});

test('codes round-trip through the reader', () => {
  for (const c of buildCodes(NOW, NOW)) {
    assert.equal(parseCode(c.syntax), NOW);
    assert.equal(parseCode(`See you then! ${c.syntax} please come`), NOW);
  }
  assert.equal(parseCode('<t:1700000000>'), 1700000000);
  assert.equal(parseCode('2026-11-28 8pm'), null);
  assert.equal(parseCode(''), null);
});

test('the distance from now is split into parts a sentence can use', () => {
  const p = (offset) => relativeParts(NOW + offset, NOW);
  assert.deepEqual(p(0), { zero: true });
  assert.deepEqual(p(9), { zero: true });
  assert.deepEqual(p(10), { n: 10, unit: 's', past: false });
  assert.deepEqual(p(45), { n: 45, unit: 's', past: false });
  assert.deepEqual(p(-60), { n: 1, unit: 'm', past: true });
  assert.deepEqual(p(3600 * 5), { n: 5, unit: 'h', past: false });
  assert.deepEqual(p(-86400 * 3), { n: 3, unit: 'd', past: true });
  assert.deepEqual(p(86400 * 40), { n: 1, unit: 'mo', past: false });
  assert.deepEqual(p(31557600 * 2), { n: 2, unit: 'y', past: false });
});

test('the relative preview uses the caller formatter', () => {
  assert.equal(preview('R', NOW + 7200, NOW, 'en-US', rel), 'in 2 h');
  assert.equal(preview('R', NOW - 60, NOW, 'en-US', rel), '1 m');
  // Without a formatter it still returns something printable rather than throwing.
  assert.equal(typeof preview('R', NOW + 7200, NOW), 'string');
});

test('local date and time convert to epoch and back', () => {
  const epoch = localToEpoch('2026-11-28', '20:30');
  assert.equal(typeof epoch, 'number');
  assert.deepEqual(toInputs(epoch), { date: '2026-11-28', time: '20:30' });
  assert.equal(localToEpoch('2026-11-28', ''), localToEpoch('2026-11-28', '00:00'));
  assert.equal(localToEpoch('2026-13-45', '10:00'), null);
  assert.equal(localToEpoch('', '10:00'), null);
  assert.equal(localToEpoch('26-11-28', '10:00'), null);
  assert.equal(localToEpoch('2026-11-28', '99:99'), null);
});

test('quick picks land on sensible moments', () => {
  const at = (y, m, d, h) => new Date(y, m - 1, d, h).getTime();
  const mondayEvening = at(2026, 11, 23, 19);       // a Monday, before 8 PM
  const p = presets(mondayEvening);
  assert.equal(p.now, Math.floor(mondayEvening / 1000));
  assert.equal(p['15m'] - p.now, 900);
  assert.equal(p['1h'] - p.now, 3600);
  assert.deepEqual(toInputs(p['8pm']), { date: '2026-11-23', time: '20:00' });
  assert.deepEqual(toInputs(p.tomorrow), { date: '2026-11-24', time: '20:00' });
  assert.deepEqual(toInputs(p.friday), { date: '2026-11-27', time: '20:00' });

  const late = presets(at(2026, 11, 23, 21));       // 8 PM today is already over
  assert.deepEqual(toInputs(late['8pm']), { date: '2026-11-24', time: '20:00' });

  const onFriday = presets(at(2026, 11, 27, 10));   // "next Friday" never means today
  assert.deepEqual(toInputs(onFriday.friday), { date: '2026-12-04', time: '20:00' });
});

test('an invalid moment produces no codes', () => {
  assert.deepEqual(buildCodes(NaN, NOW), []);
});
