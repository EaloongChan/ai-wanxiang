# Self-audit baseline — 2026-11-28

The state of the repo before the optimisation pass, with every finding tied to a file and line.
Findings are grouped by what they cost: traffic, retention, or stability. Items are tracked to
the batch that fixes them.

## Baseline that already passes

- 25 pages (12 en + 12 zh + one site-wide 404); 60 unit tests; 27 browser interaction tests; 0 accessibility issues; 3 viewports clean.
- First screen gzip 8.6 KB. Game script 16.9 KB en / 18.3 KB zh gzip. Portal package 82 KB, self-contained.
- Live: 42/42 checks, 373 legacy addresses redirected, IndexNow submitted.

## 1. Dead code and redundancy — stability, minor

| Where | What |
|---|---|
| `src/lib/utils.mjs:13` | `jsonEmbed()` never called; `layout.mjs:96` re-implements it inline. |
| `src/lib/utils.mjs:39,49,54` | `fmtDuration` / `hostOf` / `fmtPct` unused; `pct0` is redefined in `pages.mjs:21`. |
| `src/lib/components.mjs:248` | `stat()` unused; `prose({start})` never passed. |
| `src/lib/strings.mjs:29-30` | `lang.other` / `lang.attr` are leftovers; `layout.mjs:62` uses `LANG_LABEL` / `LANG_ATTR`. |
| `data/site.config.json` | `locale` unread; no `flags` key, so the privacy page's flag-gated section can never render. |
| `scripts/build.mjs:110` | `void names;` — an unused regex group. |
| `src/game/lumber-tycoon/logic.js:221,232` | Duplicate `state.tree = null; state.gap = 0;` before `spawnTree()`. |

## 2. Game logic coverage — retention / stability

Covered well: combo decay, offline cap, buying past max level, prestige maths and mainspring keep.
Gaps:

- `logic.js:348-365` `deserialize` with a missing/empty/all-invalid `zones` array yields `zones: []` and `zone: undefined`, breaking the "always owns the first district" invariant; every district then renders locked (`main.js:309`).
- `logic.js:268` combo-end event and timer reset are untested (only `combo === 0` is asserted).
- `logic.js:286` the auto-hit loop stops at 60 per tick; large `dt` (offline catch-up, background tab) silently drops the remainder — untested.
- `logic.js:52,302` `offlineEff` cap and negative/NaN/Infinity `awaySeconds` clamping untested.
- `logic.js:45,49` crit cap (0.8) and interval floor untested.
- `logic.js:240` "last district unlocked but total is 0 → prestige gain 0" untested.
- `logic.js:193,258` invalid actions return `[]` with no test.
- `logic.js:79,87` unknown zone id falls back silently; a zero-weight pool gives `0/0 = NaN`.
- `logic.js:143` `pickTree` fallback when rng returns exactly 1.
- `logic.js:383-387` `formatNumber` at ≥1e30, `formatSeconds` with negative input.

## 3. Tool input boundaries — stability

- `src/tools/prompt-template-builder/ui.js:21` **DOM injection**: blank names come from pasted templates and reach `innerHTML` unescaped (`id="v-${name}"`, `data-var`, label).
- `src/tools/prompt-template-builder/core.js:10-44` no length limit; a huge template builds one input per blank and dumps everything into `<pre>`.
- `src/tools/discord-timestamp/core.js:54` accepts any finite number; `ui.js:37` accepts 20-digit codes → invalid `Date` → `Intl.format` throws `RangeError`, and the input handler has no try/catch.
- `core.js:34` `relativeParts(NaN)` returns `{n: NaN}` → "in NaN years".
- `core.js:70` `localToEpoch` validates shape only; `2024-02-31` behaviour depends on the engine.
- `src/tools/sens-converter/core.js:9-24` exported helpers have no divide-by-zero or non-finite guards (`roundSens(NaN)` → NaN).
- `sens-converter/ui.js:24` result rows built with `innerHTML` from data; `shared-ui.js:92` formats non-finite values as empty strings, hiding the problem.
- `src/tools/fov-calculator/core.js:18,38` `aspectOf` does not validate `w/h`; unknown `type` is treated as vertical; bad aspect → `sensMult = NaN`.
- `src/tools/steam-id-converter/core.js:13-24,60` exported writers call `BigInt(text)` directly and throw on non-numeric input; `:56` treats any 16-digit number as a SteamID64.

## 4. Page-level SEO — traffic

- `pages.mjs:122,212` list pages point `og:image` at `/og/games.png` and `/og/tools.png` (plus `zh-` variants): **four 404 share images**.
- `pages.mjs:170` `VideoGame.image` rewrites `cover.svg` → `cover.png`, which does not exist.
- `pages.mjs:281` doc pages emit `og:type=article` with only a BreadcrumbList: no `WebPage`, no `inLanguage`.
- `pages.mjs:136,225` list pages have no `CollectionPage`/`ItemList` and no `inLanguage`.
- `pages.mjs:63,242` `ItemList` and `FAQPage` lack `inLanguage`.
- `layout.mjs:119` no `og:locale:alternate`.
- `build.mjs:38,226-231` `lastmod` is always "today" (`updatedAt`), diluting the signal; future-dated `updated` values in data make it worse.

Clean: canonical and the three hreflang links are correct on every page type; 404 correctly `noindex` + no alternates.

## 5. i18n — traffic / retention

- `pages.mjs:33` `offlineCap` hardcodes the English unit → Chinese prose reads "最多 8 hours".
- `components.mjs:52` the HUD combo label "combo ×" is hardcoded English.
- `pages.mjs:314` the 404 page hardcodes a Chinese label next to English text.
- `pages.mjs:161` offline prose picks the unit with an inline `lang === 'zh'` check instead of `T()`.
- `data/tools.json:58` sens-converter game names are English-only, so the Chinese page lists English game names (acceptable for proper nouns, but unchecked).

Structure itself is aligned: `zh` blocks match the English in section ids, table rows, FAQ and list counts — enforced by `check.mjs:188-222`.

## 6. Build and artefacts — stability

- `build.mjs:295` `pruneStale()` runs inside `build()`; `dist/portal/**` is only written by `buildPortal()` and never registered, so `--watch` (and any script that calls `build()`) deletes the portal packages.
- `build.mjs:216` a page path without a trailing slash would emit `...index.html` glued to the slug; no guard.
- `build.mjs:384-403` portal HTML interpolates `g.name`/`g.tagline` unescaped and does not escape `</script>` in the inlined script.
- `build.mjs:173` the `zh` key stripper removes **any** key named `zh`, not just the localisation block.
- `build.mjs:238` `copyDir(public → dist)` runs after pages are written; a future same-named file in `public/` would silently overwrite generated output.
- `build.mjs:70` `--target=portal` prunes everything `build()` did not write, including `dist/_headers`, `dist/vercel.json` and other tool artefacts.

## Top five, in fix order

1. Four list-page share images are 404 (`pages.mjs:122,212` + `og-images.mjs`) — cheapest traffic loss.
2. `prompt-template-builder` injects user text into `innerHTML` — the only real injection path.
3. `offlineCap` leaks an English unit into Chinese copy (`pages.mjs:33`).
4. `deserialize` can produce `zones: []`, locking every district (`logic.js:348`).
5. `--watch` deletes `dist/portal/` (`build.mjs:295`), which silently breaks portal submissions.
