import test from 'node:test';
import assert from 'node:assert/strict';
import { counterpart, fill, loc, localizeLinks, parsePath, pick } from './i18n.mjs';

test('English keeps the bare path, Chinese gets /zh', () => {
  assert.equal(loc('/', 'en'), '/');
  assert.equal(loc('/', 'zh'), '/zh/');
  assert.equal(loc('/games/', 'en'), '/games/');
  assert.equal(loc('/games/lumber-tycoon/', 'zh'), '/zh/games/lumber-tycoon/');
});

test('a path is split into language and canonical path, and put back together', () => {
  assert.deepEqual(parsePath('/'), { lang: 'en', path: '/' });
  assert.deepEqual(parsePath('/zh/'), { lang: 'zh', path: '/' });
  assert.deepEqual(parsePath('/zh'), { lang: 'zh', path: '/' });
  assert.deepEqual(parsePath('/tools/x/'), { lang: 'en', path: '/tools/x/' });
  assert.deepEqual(parsePath('/zh/tools/x/'), { lang: 'zh', path: '/tools/x/' });
  assert.equal(counterpart('/tools/x/', 'zh'), '/zh/tools/x/');
  assert.equal(counterpart('/zh/tools/x/', 'en'), '/tools/x/');
  // Round trip through both languages lands where it started.
  for (const p of ['/', '/games/', '/tools/sens-converter/', '/about/']) {
    assert.equal(counterpart(counterpart(p, 'zh'), 'en'), p);
  }
});

test('a missing translation falls back to English rather than to nothing', () => {
  const record = { name: 'Clockwork Grove', zh: { name: '发条森林' } };
  assert.equal(pick(record, 'name', 'en'), 'Clockwork Grove');
  assert.equal(pick(record, 'name', 'zh'), '发条森林');
  assert.equal(pick(record, 'tagline', 'zh'), undefined);          // not translated at all
  assert.equal(pick({ name: 'Only English' }, 'name', 'zh'), 'Only English');
  assert.equal(pick(null, 'name', 'zh'), undefined);
});

test('placeholders are replaced, unknown ones are left visible', () => {
  assert.equal(fill('Play {game} now', { game: '发条森林' }), 'Play 发条森林 now');
  assert.equal(fill('{a} and {b}', { a: 1 }), '1 and {b}');
  assert.equal(fill('no placeholders', { a: 1 }), 'no placeholders');
  assert.equal(fill('plus + {n}', { n: '+12' }), 'plus + +12');
});

test('internal links are rewritten for Chinese, everything else is left alone', () => {
  const html = '<a href="/contact/">c</a> <a href="/api/legacy/index.json">api</a> <a href="https://example.com/about/">x</a> <a href="/zh/about/">already</a>';
  const zh = localizeLinks(html, 'zh');
  assert.match(zh, /href="\/zh\/contact\/"/);
  assert.match(zh, /href="\/api\/legacy\/index\.json"/);            // language-neutral
  assert.match(zh, /href="https:\/\/example\.com\/about\/"/);       // external
  assert.match(zh, /href="\/zh\/about\/"/);                        // not doubled
  assert.doesNotMatch(zh, /\/zh\/zh\//);
  assert.equal(localizeLinks(html, 'en'), html);                    // English untouched
});
