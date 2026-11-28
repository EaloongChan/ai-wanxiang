# Turning analytics on (two dashboard steps + one deploy)

The code is already in place and switched off. Nothing about a visitor is collected until
both flags below are true, and the privacy page says exactly that.

## 1. Page views: Cloudflare Web Analytics

1. Cloudflare dashboard → your account → **Web Analytics** → **Add a site**.
2. Hostname `www.ealoongchan.top`, "Automatic setup" (the zone is already proxied, so no
   snippet is needed).
3. Copy the token shown. It goes into `data/site.config.json` as `verify.cfAnalytics` so the
   value is documented in the repo (the injection itself is done at the edge).

No cookies, no fingerprinting, no cross-site tracking — which is what the privacy page claims.

## 2. Events: deploy the Worker

```bash
npx wrangler login                      # one browser round-trip
npm run worker:deploy                   # deploys workers/beacon
```

The Worker lives at `https://ealoong-beacon.<account>.workers.dev`. Events should arrive at
`/api/e` on the site's own domain instead, so add a route:

1. Workers & Pages → `ealoong-beacon` → **Settings → Triggers → Add route**.
2. Route: `www.ealoongchan.top/api/e/*`, zone `ealoongchan.top`.
3. Save. (No DNS record is needed; the route is evaluated by the edge.)

Check it:

```bash
curl -i -X POST https://www.ealoongchan.top/api/e \
  -H 'content-type: application/json' \
  -H 'origin: https://www.ealoongchan.top' \
  --data '{"v":1,"page":"/test/","lang":"en","t":0,"e":[{"n":"tool_use","p":{"tool":"test"}}]}'
# expect: HTTP/2 204
```

Then open Workers → Analytics Engine → dataset `ealoong_events` and confirm a row appears.

## 3. Switch the site on

Two edits in `data/site.config.json`, then `npm run build`:

```json
"flags": { "analytics": true },
"beacon": { "enabled": true, "endpoint": "/api/e" }
```

`flags.analytics` also unhides the privacy page's analytics section. **Change both in the
same commit** — the privacy page must never describe analytics the site does not run, or run
analytics the page does not describe.

## What is collected

| Field | Example | Purpose |
|---|---|---|
| `page` | `/games/lumber-tycoon/` | which page produced the event |
| `lang` | `en` / `zh` | language split |
| event name | `game_start`, `first_upgrade`, `first_zone`, `first_rewind`, `tool_use`, `tool_error`, `js_error` | funnel steps and breakage |
| up to 6 scalar props | `tool=sens-converter`, `code=err.sensPositive` | which tool, which error |
| error message | first 300 characters | only for `js_error` |

Not collected: IP in any stored form, user agent, cookies, referrer text, anything typed into
a tool, save contents, account identifiers of any kind. The Worker rejects unknown event
names, payloads over 8 KB, and more than 40 events per request.

## Reading the numbers

```bash
# page views and sources: Cloudflare → Web Analytics
# funnel and errors: Workers → Analytics Engine → SQL API, e.g.
#   SELECT blob1 AS lang, blob2 AS events, count() FROM ealoong_events GROUP BY lang, events
```

Write findings into `docs/decisions.md` when they change a decision, not into chat.
