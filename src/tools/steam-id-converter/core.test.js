import test from 'node:test';
import assert from 'node:assert/strict';
import { convert, parseId64, toId2, toId3, toId64 } from './core.js';

// One real account in every form; the three lines below are the same account.
const ID64 = '76561197960287930';
const ID3 = '[U:1:22202]';
const ID2 = 'STEAM_0:0:11101';

const expectAccount = (r) => {
  assert.equal(r.ok, true);
  assert.equal(r.accountId, '22202');
  assert.equal(r.id64, ID64);
  assert.equal(r.id3, ID3);
  assert.equal(r.id2, ID2);
  assert.equal(r.url, `https://steamcommunity.com/profiles/${ID64}/`);
};

test('every accepted format resolves to the same account', () => {
  for (const [text, via] of [[ID64, 'SteamID64'], [ID3, 'SteamID3'], [ID2, 'SteamID'], [' steam_0:0:11101 ', 'SteamID'], ['[u:1:22202]', 'SteamID3'], [`https://steamcommunity.com/profiles/${ID64}/`, 'SteamID64']]) {
    const r = convert(text);
    expectAccount(r);
    assert.equal(r.via, via);
  }
});

test('the 64-bit form is exact, not a float rounded at the 16th digit', () => {
  const high = '76561198300000000';
  const r = parseId64(high);
  assert.equal(r.ok, true);
  assert.equal(r.id64, high);
  assert.equal(r.accountId, String(76561198300000000n - 76561197960265728n));
  assert.notEqual(Number(high), Number(ID64));
});

test('the Y in STEAM_0:Y:Z is the low bit of the account ID', () => {
  assert.equal(toId2(22202), 'STEAM_0:0:11101');
  assert.equal(toId2(22203), 'STEAM_0:1:11101');
  assert.equal(toId2(0), 'STEAM_0:0:0');
  assert.equal(toId3(0), '[U:1:0]');
  assert.equal(toId64(0), '76561197960265728');
});

test('round-tripping each writer through the parser loses nothing', () => {
  for (const id of [0, 1, 22202, 4294967295]) {
    expectAccountId(convert(toId64(id)), id);
    expectAccountId(convert(toId3(id)), id);
    expectAccountId(convert(toId2(id)), id);
  }
});

function expectAccountId(r, id) {
  assert.equal(r.ok, true);
  assert.equal(r.accountId, String(id));
}

test('input that is not an individual account is refused with a named reason', () => {
  assert.equal(convert('https://steamcommunity.com/id/wolverine/').code, 'err.steamVanity');
  assert.equal(convert('[g:1:123]').code, 'err.steamGroup');
  assert.equal(convert('76561197960265727').code, 'err.steam64Type');
  assert.equal(convert('[U:2:22202]').code, 'err.steamUniverse');
  assert.equal(convert('STEAM_1:0:11101').code, 'err.steamUniverse');
  assert.equal(convert('[U:1:99999999999]').code, 'err.steamRange');
  assert.equal(parseId64('0').code, 'err.steam64Type');
});

test('empty and nonsense input is not mistaken for an ID', () => {
  assert.equal(convert('').ok, false);
  assert.equal(convert('   ').ok, false);
  assert.equal(convert('hello').code, 'err.steamNotId');
  assert.equal(convert('12345').code, 'err.steamNotId');
  assert.equal(convert('7656119796028793O').code, 'err.steamNotId');
  // Empty input is not an error worth showing: the box just has nothing in it yet.
  assert.equal(convert('').code, '');
});
