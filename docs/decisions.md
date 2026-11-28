# Decisions and thresholds

Expansion is decided by numbers, not by mood. Each entry records what was decided, when, and
which data would justify revisiting it. Numbers come from Cloudflare Web Analytics (page views,
sources) and the `ealoong_events` dataset (funnel and errors); both are described in
`docs/analytics-setup.md`.

## Standing rules

1. **No new content until the current content has data.** Tools or games added before the
   existing ones are measured make the funnel unreadable.
2. **Measure for four full weeks** before judging anything. A week is noise: portal traffic
   arrives in bursts and search indexing lags by days.
3. **A decision is written here before the work starts**, with the number it was based on.

## Thresholds (decide on 2026-12-26, four weeks after the analytics switch-on)

| Question | Threshold to expand | If missed |
|---|---|---|
| Widen the tool set? | Organic-search sessions ≥ 300 total over four weeks **and** tool-page bounce < 75% | Keep the five tools; improve the two with the most impressions in Search Console |
| Build a second game? | `game_start` → `first_rewind` conversion ≥ 8% **and** portals deliver ≥ 500 plays | Deepen the existing game (more districts or upgrades) before adding another |
| Push harder on distribution? | Any single portal delivering ≥ 100 plays in a week | Fix the submission materials first: screenshots, description, first-minute experience |
| Invest in Chinese content? | `/zh/` sessions ≥ 10% of total | Keep Chinese as a courtesy translation, not a priority |

All four can be missed at once without the project being a failure: the site is static, costs
nothing to run, and the game keeps working. The response to missing a threshold is a local
improvement to the same batch, never "add more content".

## Log

### 2026-11-28 — analytics shipped switched off

The beacon and Worker are in the repository; both flags in `data/site.config.json` stay false
until the Worker is deployed and Web Analytics is switched on (steps in
`docs/analytics-setup.md`). Reason: the privacy page must never describe measurement that is
not running, and measurement must never run unannounced.

### 2026-11-28 — portal packages moved out of `dist/`

The self-contained game packages now build into `build/portal/`, which is gitignored and not
deployed. Two reasons: a page with inline `<style>` and inline `<script>` cannot live under the
site's strict CSP without a special case, and a playable copy on our own domain could conflict
with web-exclusivity terms at portals we may apply to later.

### 2026-11-28 — no automatic language redirect

`/` is English, `/zh/` is Chinese, and the header pill links to the counterpart page. No cookie,
no `Accept-Language` sniffing, no redirect. Reason: automatic redirects put crawlers and readers
on the wrong page and split link equity; the pill costs one click and never guesses wrong.

### 2026-11-28 — AI crawlers left blocked at the edge

`robots.txt` no longer blocks anything (Bot Preference Sync is off), but Cloudflare's AI Crawl
Control still answers 403 to GPTBot, ClaudeBot and friends. Keeping it: AI referral is under
0.4% of traffic today, the bandwidth saving is real, and the decision is cheap to reverse.
Revisit if AI assistants start sending measurable sessions.
