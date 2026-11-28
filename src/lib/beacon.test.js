import test from 'node:test';
import assert from 'node:assert/strict';
import { beaconTag } from './beacon.mjs';

const on = {
  asset: { beacon: 'beacon.abc1234.js' },
  flags: { analytics: true },
  beacon: { enabled: true, endpoint: '/api/e' },
};

test('nothing is emitted unless both switches are on', () => {
  assert.equal(beaconTag({ ...on, flags: { analytics: false } }, 'en', '/'), '');
  assert.equal(beaconTag({ ...on, beacon: { enabled: false } }, 'en', '/'), '');
  assert.equal(beaconTag({ ...on, asset: {} }, 'en', '/'), '');
  assert.equal(beaconTag({ ...on, beacon: undefined }, 'zh', '/'), '');
});

test('the tag carries the endpoint, the localized page and the language', () => {
  const en = beaconTag(on, 'en', '/games/lumber-tycoon/');
  assert.match(en, /src="\/assets\/beacon\.abc1234\.js"/);
  assert.match(en, /id="beacon"/);
  assert.match(en, /data-endpoint="\/api\/e"/);
  assert.match(en, /data-page="\/games\/lumber-tycoon\/"/);
  assert.match(en, /data-lang="en"/);
  assert.match(en, /defer/);

  const zh = beaconTag(on, 'zh', '/tools/sens-converter/');
  assert.match(zh, /data-page="\/zh\/tools\/sens-converter\/"/);
  assert.match(zh, /data-lang="zh"/);
});

test('no inline script and no unsafe hint, so a strict CSP still works', () => {
  const tag = beaconTag(on, 'en', '/');
  assert.doesNotMatch(tag, /<script>[\s\S]/);
  assert.doesNotMatch(tag, /unsafe/i);
  assert.equal((tag.match(/<script/g) || []).length, 1);
});
