/**
 * Steam ID conversion. Pure functions.
 *
 * All three formats describe one account ID. The 64-bit form packs a fixed prefix and
 * the account ID into one number, so the maths needs BigInt: a SteamID64 is larger than
 * 2^53 and would silently lose digits as a regular Number.
 */
const INDIVIDUAL_PREFIX = 76561197960265728n;   // universe 1 (public), type 1 (individual), instance 1 (desktop)
const ACCOUNT_MAX = 4294967296n;                 // 2^32

const digits = (s) => /^\d+$/.test(s);

export function toId64(accountId) {
  return (INDIVIDUAL_PREFIX + BigInt(accountId)).toString();
}

export function toId3(accountId) {
  return `[U:1:${BigInt(accountId).toString()}]`;
}

export function toId2(accountId) {
  const id = BigInt(accountId);
  return `STEAM_0:${(id & 1n).toString()}:${(id >> 1n).toString()}`;
}

export function profileUrl(accountId) {
  return `https://steamcommunity.com/profiles/${toId64(accountId)}/`;
}

/** Messages live in src/lib/strings.mjs; these functions only name the problem. */
function fromAccountId(accountId, via) {
  const id = BigInt(accountId);
  if (id < 0n || id >= ACCOUNT_MAX) return { ok: false, code: 'err.steamRange' };
  return { ok: true, via, accountId: id.toString(), id64: toId64(id), id3: toId3(id), id2: toId2(id), url: profileUrl(id) };
}

/** Accepts a SteamID64, a SteamID3 such as [U:1:22202], a SteamID such as STEAM_0:0:11101, or a profile URL. */
export function convert(input) {
  const text = String(input || '').trim();
  if (!text) return { ok: false, code: '' };

  const profile = text.match(/steamcommunity\.com\/profiles\/(\d+)/i);
  if (profile) return parseId64(profile[1]);
  if (/steamcommunity\.com\/id\//i.test(text)) return { ok: false, code: 'err.steamVanity' };
  if (/^\[[gGcC]:/.test(text)) return { ok: false, code: 'err.steamGroup' };
  if (/^\[U:\d:\d+\]$/i.test(text)) {
    const m = text.match(/^\[U:(\d):(\d+)\]$/i);
    if (m[1] !== '1') return { ok: false, code: 'err.steamUniverse' };
    return fromAccountId(m[2], 'SteamID3');
  }
  if (/^STEAM_\d:\d:\d+$/i.test(text)) {
    const m = text.match(/^STEAM_(\d):(\d):(\d+)$/i);
    if (m[1] !== '0') return { ok: false, code: 'err.steamUniverse' };
    return fromAccountId(BigInt(m[3]) * 2n + BigInt(m[2]), 'SteamID');
  }
  if (digits(text) && text.length >= 16) return parseId64(text);
  return { ok: false, code: 'err.steamNotId' };
}

export function parseId64(text) {
  const account = BigInt(text) - INDIVIDUAL_PREFIX;
  if (account < 0n || account >= ACCOUNT_MAX) return { ok: false, code: 'err.steam64Type' };
  return fromAccountId(account, 'SteamID64');
}
