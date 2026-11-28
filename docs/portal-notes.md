# Portal submission notes

What to send, where it lives, and what has to be re-checked before sending.

## Ready to submit

```bash
npm run build          # refreshes build/portal/ (the package) and build/portal-kit/ is made by:
npm run portal:kit     # description, tags, screenshots at 1280×720 and 800×600
```

| File | Purpose |
|---|---|
| `build/portal/lumber-tycoon.zip` | the package itself: one `index.html`, no external requests |
| `build/portal-kit/lumber-tycoon/description-en.txt` | 300-character short description, paste-ready |
| `build/portal-kit/lumber-tycoon/tags.txt` | comma-separated tags |
| `build/portal-kit/lumber-tycoon/screenshots/1280x720/*.png` | start, mid-play, upgrades panel |
| `build/portal-kit/lumber-tycoon/screenshots/800x600/*.png` | same three, for portals that ask for smaller |

Neither directory is deployed: `dist/` is the site, `build/` is submission material. That is
deliberate — a playable copy on our own domain can conflict with web-exclusivity terms, and it
would need a looser CSP just for itself.

## Before each submission: verify, do not assume

Portal requirements change without notice and the numbers below came from secondary sources.
Check the official page for the portal you are about to use and record the date checked here.

- [ ] Package size limit and whether they unzip or take a single HTML file
- [ ] Required SDK (CrazyGames SDK, GameDistribution SDK) and whether it is mandatory for launch
- [ ] Cover and screenshot dimensions, and whether text is allowed on the cover
- [ ] Exclusivity terms: may the same game be playable on our own domain?
- [ ] Ad rules: pre-roll, mid-roll, minimum session length, ad blocking
- [ ] Payment threshold and revenue share
- [ ] Whether a second "full launch" review is required after a basic launch

## Targets, in order

1. **CrazyGames** — largest reach after Poki; accepts non-exclusive; a basic launch is reviewed
   before monetisation is switched on.
2. **itch.io** — instant, no review, no exclusivity, useful as a public link for pitching.
3. **GameDistribution** — non-exclusive, ad-based, needs their SDK.
4. **Poki** — not yet. It is curated and reportedly asks for web exclusivity; whether the game
   may stay playable on our own site is unconfirmed. Do not submit before confirming.

## State

`data/portal-status.json` records what was sent, when, and what came back. Update it at
submission time rather than trusting memory.
