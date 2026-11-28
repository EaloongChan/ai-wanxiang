/**
 * Discord timestamp codes. Pure functions.
 *
 * A code is a moment in time written as seconds since 1 January 1970, with an optional
 * letter naming the format: <t:1700000000:R>. Each Discord client shows the moment in
 * the reader's own timezone, so the previews below use this device's settings too.
 *
 * The relative wording ("in 3 hours") is language-specific, so this module returns the
 * *parts* and the caller formats the sentence with its own strings.
 */
export const STYLES = [
  { code: 't' },
  { code: 'T' },
  { code: 'd' },
  { code: 'D' },
  { code: 'f' },
  { code: 'F' },
  { code: 'R' },
];

const INTL = {
  t: { hour: 'numeric', minute: '2-digit' },
  T: { hour: 'numeric', minute: '2-digit', second: '2-digit' },
  d: { month: 'numeric', day: 'numeric', year: '2-digit' },
  D: { month: 'long', day: 'numeric', year: 'numeric' },
  f: { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' },
  F: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' },
};

/**
 * Distance from now, split into the pieces a sentence needs.
 * { zero: true } | { n, unit: 's'|'m'|'h'|'d'|'mo'|'y', past: boolean }
 */
export function relativeParts(seconds, now) {
  const diff = seconds - now;
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < 10) return { zero: true };
  if (abs < 60) return { n: Math.round(abs), unit: 's', past };
  if (abs < 3500) return { n: Math.max(1, Math.round(abs / 60)), unit: 'm', past };
  if (abs < 79200) return { n: Math.max(1, Math.round(abs / 3600)), unit: 'h', past };
  if (abs < 26 * 86400) return { n: Math.max(1, Math.round(abs / 86400)), unit: 'd', past };
  if (abs < 11 * 2629800) return { n: Math.max(1, Math.round(abs / 2629800)), unit: 'mo', past };
  return { n: Math.max(1, Math.round(abs / 31557600)), unit: 'y', past };
}

export function preview(code, seconds, now, locale = 'en-US', rel = null) {
  if (code === 'R') return rel ? rel(relativeParts(seconds, now)) : String(relativeParts(seconds, now).n || 0);
  return new Intl.DateTimeFormat(locale, INTL[code]).format(new Date(seconds * 1000));
}

/** `rel(parts)` turns the relative parts into a sentence in the caller's language. */
export function buildCodes(seconds, now = Date.now() / 1000, locale = 'en-US', rel = null) {
  if (!Number.isFinite(seconds)) return [];
  return STYLES.map((s) => ({
    code: s.code,
    syntax: `<t:${Math.floor(seconds)}:${s.code}>`,
    preview: preview(s.code, seconds, now, locale, rel),
  }));
}

/** The moment inside a code someone else posted, or null if there is no code in the text. */
export function parseCode(text) {
  const m = String(text || '').match(/<t:(-?\d+)(?::[tTdDfFR])?>/);
  return m ? Number(m[1]) : null;
}

/** date is YYYY-MM-DD and time HH:MM, both in local time. Returns epoch seconds or null. */
export function localToEpoch(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const clock = /^\d{2}:\d{2}$/.test(time || '') ? time : '00:00';
  const ms = new Date(`${date}T${clock}:00`).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

const pad = (n) => String(n).padStart(2, '0');

export function toInputs(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

function atEightPm(d) {
  const copy = new Date(d);
  copy.setHours(20, 0, 0, 0);
  return Math.floor(copy.getTime() / 1000);
}

/** Quick picks, all in local time. nowMs is a millisecond timestamp. */
export function presets(nowMs = Date.now()) {
  const nowS = nowMs / 1000;
  const today = new Date(nowMs);
  const tomorrow = new Date(nowMs);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const friday = new Date(nowMs);
  friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7 || 7));
  return {
    now: Math.floor(nowS),
    '15m': Math.floor(nowS) + 15 * 60,
    '1h': Math.floor(nowS) + 3600,
    '8pm': atEightPm(today) > nowS ? atEightPm(today) : atEightPm(tomorrow),
    tomorrow: atEightPm(tomorrow),
    friday: atEightPm(friday),
  };
}
