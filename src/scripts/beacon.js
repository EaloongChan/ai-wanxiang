/**
 * Anonymous event counter.
 *
 * Loaded only when the site config turns analytics on (see layout.mjs). It sends a small
 * batch of event names with a few scalar properties, and nothing else: no identifiers, no
 * input values, no cookies. The receiving Worker drops anything it does not recognise.
 *
 * Why not a third-party script: this file is ~1.5 KB, needs no network on load, and cannot
 * change what the page does. The trade-off is that aggregation happens server-side, which
 * is exactly where it should happen.
 */
(function () {
  'use strict';
  var tag = document.getElementById('beacon');
  if (!tag) return;

  var endpoint = tag.getAttribute('data-endpoint') || '/api/e';
  var page = tag.getAttribute('data-page') || location.pathname;
  var lang = tag.getAttribute('data-lang') || 'en';
  var queue = [];
  var MAX_QUEUE = 40;
  var MAX_BATCH = 10;
  var lastFlush = 0;

  function scalar(value) {
    if (typeof value === 'number') return isFinite(value) ? Math.round(value * 100) / 100 : 0;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return String(value == null ? '' : value).slice(0, 80);
  }

  function track(name, props) {
    if (typeof name !== 'string' || !name) return;
    if (queue.length >= MAX_QUEUE) return;
    var event = { n: name.slice(0, 40), p: {} };
    if (props) {
      var keys = Object.keys(props).slice(0, 6);
      for (var i = 0; i < keys.length; i++) event.p[keys[i].slice(0, 20)] = scalar(props[keys[i]]);
    }
    queue.push(event);
    if (queue.length >= MAX_BATCH) flush();
  }

  function flush() {
    if (!queue.length) return;
    var now = Date.now();
    if (now - lastFlush < 200) return;          // bursts (a hundred clicks) become one request
    lastFlush = now;
    var body = JSON.stringify({ v: 1, page: page, lang: lang, t: now, e: queue.splice(0, queue.length) });
    try {
      if (navigator.sendBeacon) {
        if (navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))) return;
      }
    } catch (err) { /* fall through to fetch */ }
    try {
      fetch(endpoint, { method: 'POST', body: body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(function () {});
    } catch (err) { /* offline: the batch is dropped on purpose */ }
  }

  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
  window.addEventListener('pagehide', flush);

  // Errors are the one thing worth sending immediately: they explain a broken visit that
  // would otherwise look like a bounce.
  window.addEventListener('error', function (ev) {
    var message = (ev && (ev.message || (ev.error && ev.error.message))) || 'unknown error';
    track('js_error', { message: String(message).slice(0, 300), source: (ev && ev.filename) || '', line: (ev && ev.lineno) || 0 });
    flush();
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var reason = ev && ev.reason;
    var message = (reason && (reason.message || reason)) || 'unhandled rejection';
    track('js_error', { message: String(message).slice(0, 300), source: 'promise' });
    flush();
  });

  window.__track = track;
  window.__trackFlush = flush;
})();
