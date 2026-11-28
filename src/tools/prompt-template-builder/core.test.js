import test from 'node:test';
import assert from 'node:assert/strict';
import { blankLabel, extractVars, fillVars, splitTemplate } from './core.js';

test('blanks are found in order, trimmed and not repeated', () => {
  assert.deepEqual(extractVars('Write about {{ topic }} for {{ reader }} in a {{tone}} tone. Again {{topic}}.'), ['topic', 'reader', 'tone']);
  assert.deepEqual(extractVars('No blanks here {{not a blank'), []);
  assert.deepEqual(extractVars(''), []);
});

test('every blank is filled and unfilled ones are reported', () => {
  const r = fillVars('Write about {{topic}} for {{reader}}.', { topic: ' otters ', reader: 'kids' });
  assert.equal(r.text, 'Write about otters for kids.');
  assert.deepEqual(r.missing, []);

  const partial = fillVars('{{a}} and {{b}} and {{c}}', { a: 'A', b: '   ' });
  assert.equal(partial.text, 'A and {{b}} and {{c}}');
  assert.deepEqual(partial.missing, ['b', 'c']);

  assert.equal(fillVars('{{a}}', { a: 0 }).text, '0');
  assert.equal(fillVars('{{a}}', { a: null }).text, '{{a}}');
});

test('the template is cut into text and blank pieces', () => {
  const pieces = splitTemplate('Hello {{name}}, you are {{role}}!');
  assert.deepEqual(pieces, [
    { type: 'text', value: 'Hello ' },
    { type: 'var', value: 'name' },
    { type: 'text', value: ', you are ' },
    { type: 'var', value: 'role' },
    { type: 'text', value: '!' },
  ]);
  assert.deepEqual(splitTemplate('plain'), [{ type: 'text', value: 'plain' }]);
  assert.deepEqual(splitTemplate(''), []);
});

test('blank names become readable field labels', () => {
  assert.equal(blankLabel('targetAudience'), 'target audience');
  assert.equal(blankLabel('max_words'), 'max words');
  assert.equal(blankLabel('Tone'), 'tone');
  assert.equal(blankLabel('API-Key'), 'api key');
  assert.equal(blankLabel('a'), 'a');
});
