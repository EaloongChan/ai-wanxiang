import test from 'node:test';
import assert from 'node:assert/strict';
import { hToV, resolveFov, vToH } from './core.js';

const r43 = { id: '4:3', w: 4, h: 3 };
const r169 = { id: '16:9', w: 16, h: 9 };
const r219 = { id: '21:9', w: 21, h: 9 };
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("Counter-Strike's 90 horizontal at 4:3 is 106.26 horizontal at 16:9", () => {
  const r = resolveFov({ fov: 90, type: 'h', from: r43, to: r169 });
  assert.equal(r.ok, true);
  near(r.v, 73.74);
  near(r.hFrom, 90);
  near(r.hTo, 106.26);
});

test("Overwatch's 103 horizontal at 16:9 is about 70.5 vertical", () => {
  const r = resolveFov({ fov: 103, type: 'h', from: r169, to: r219 });
  near(r.v, 70.53);
  near(r.hTo, 117.57, 0.05);
});

test("Apex's 90, like Counter-Strike's, is horizontal at 4:3 and about 73.7 vertical", () => {
  near(hToV(90, 4 / 3), 73.74);
  near(vToH(73.74, 16 / 9), 106.26, 0.05);
});

test('horizontal and vertical are inverses for any aspect ratio', () => {
  for (const aspect of [4 / 3, 16 / 10, 16 / 9, 21 / 9, 32 / 9]) {
    near(hToV(vToH(75, aspect), aspect), 75, 1e-9);
  }
});

test('a wider display shows a wider horizontal view and needs a higher sensitivity multiplier', () => {
  const wider = resolveFov({ fov: 103, type: 'h', from: r169, to: r219 });
  const narrower = resolveFov({ fov: 103, type: 'h', from: r169, to: r43 });
  assert.ok(wider.hTo > wider.hFrom);
  assert.ok(wider.sensMult > 1);
  assert.ok(narrower.hTo < narrower.hFrom);
  assert.ok(narrower.sensMult < 1);
  assert.ok(Math.abs(wider.sensMult - Math.tan((wider.hTo * Math.PI) / 360) / Math.tan((wider.hFrom * Math.PI) / 360)) < 1e-12);
});

test('the 16:9 column is the same whatever the source display', () => {
  const a = resolveFov({ fov: 90, type: 'h', from: r43, to: r169 });
  const b = resolveFov({ fov: 73.74, type: 'v', from: r169, to: r219 });
  near(a.h169, b.h169, 0.05);
});

test('out-of-range and missing input is refused', () => {
  const bad = (fov) => resolveFov({ fov, type: 'h', from: r169, to: r219 });
  assert.equal(bad(NaN).ok, false);
  assert.equal(bad(0).ok, false);
  assert.equal(bad(180).ok, false);
  assert.equal(bad(-90).ok, false);
  assert.equal(resolveFov({ fov: 90, type: 'h', from: undefined, to: r219 }).ok, false);
});
