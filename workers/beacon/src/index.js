/**
 * Event sink for ealoongchan.top.
 *
 * Receives small batches from /assets/beacon.*.js, keeps only known event names with a few
 * scalar properties, and writes one Analytics Engine data point per request. Everything else
 * is dropped: the endpoint is public, so it has to assume the payload is hostile.
 *
 * Deploy: see docs/analytics-setup.md. This file is not part of the site bundle and adds no
 * dependency to the repository.
 */

const EVENTS = new Set([
  'game_start',
  'first_upgrade',
  'first_zone',
  'first_rewind',
  'tool_use',
  'tool_error',
  'js_error',
]);

const MAX_BYTES = 8192;
const MAX_EVENTS = 40;
const MAX_PROP_KEYS = 6;
const MAX_PROP_LEN = 120;

const json = (status, text, extra = {}) => new Response(text, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...extra } });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request, env) });
    if (request.method !== 'POST') return json(405, 'method not allowed', cors(request, env));

    const origin = request.headers.get('origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || 'https://www.ealoongchan.top').split(',').map((s) => s.trim()).filter(Boolean);
    if (origin && !allowed.includes(origin)) return json(403, 'origin not allowed', cors(request, env));

    const raw = await request.text();
    if (raw.length > MAX_BYTES) return json(413, 'payload too large', cors(request, env));

    let body;
    try { body = JSON.parse(raw); } catch { return json(400, 'bad json', cors(request, env)); }
    if (!body || body.v !== 1 || !Array.isArray(body.e)) return json(400, 'bad shape', cors(request, env));

    const lang = body.lang === 'zh' ? 'zh' : 'en';
    const page = String(body.page || '/').slice(0, 80);
    const ts = Math.floor((Number(body.t) || Date.now()) / 1000);
    const events = body.e.slice(0, MAX_EVENTS);

    const names = [];
    const details = [];
    for (const ev of events) {
      const name = ev && ev.n;
      if (typeof name !== 'string' || !EVENTS.has(name)) continue;
      const props = ev.p && typeof ev.p === 'object' ? ev.p : {};
      const parts = [];
      for (const key of Object.keys(props).slice(0, MAX_PROP_KEYS)) {
        const value = props[key];
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') continue;
        parts.push(`${key.slice(0, 20)}=${String(value).slice(0, MAX_PROP_LEN)}`);
      }
      names.push(name);
      details.push(parts.join(' '));
    }

    if (names.length && env.EVENTS) {
      // Three blobs and two doubles stay well inside the Analytics Engine limits:
      // blobs are the dimensions, doubles are countable values.
      env.EVENTS.writeDataPoint({
        indexes: [page],
        blobs: [lang, names.join(',').slice(0, 800), details.join(' | ').slice(0, 6000)],
        doubles: [names.length, ts],
      });
    }

    return new Response(null, { status: 204, headers: cors(request, env) });
  },
};

function cors(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || 'https://www.ealoongchan.top').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    'access-control-allow-origin': allowed.includes(origin) ? origin : allowed[0] || '',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'cache-control': 'no-store',
  };
}
