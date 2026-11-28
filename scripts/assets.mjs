/**
 * Site icons and the default share image, rendered by the local copy of Chrome.
 *
 *   node scripts/assets.mjs
 *
 *   public/og.png                 1200×630  share image for pages without their own
 *   public/apple-touch-icon.png   180×180    home-screen icon
 *   public/favicon.ico            48×48      browsers ask for this even when an SVG is declared
 *
 * (favicon.svg is hand-written.) Run after changing the brand name or logo text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { shoot } from './og-images.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.config.json'), 'utf8'));

const FONTS = fs.readdirSync(path.join(PUB, 'fonts'))
  .filter((f) => f.endsWith('.woff2'))
  .map((f) => {
    const m = f.match(/^ibm-plex-(\w+)-latin-(\d+)-normal/);
    if (!m) return '';
    const family = m[1][0].toUpperCase() + m[1].slice(1);
    return `@font-face{font-family:'Plex ${family}';src:url('data:font/woff2;base64,${fs.readFileSync(path.join(PUB, 'fonts', f)).toString('base64')}') format('woff2');font-weight:${m[2]};}`;
  })
  .join('\n');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* 1200×630 default share image */
const ogHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#0b0e17;color:#eef1f7;font-family:'Plex Sans',system-ui,sans-serif}
.frame{position:absolute;inset:34px;border-radius:28px;background:#111624;border:1px solid #2a3450;box-shadow:0 24px 60px rgba(0,0,0,.5);display:flex;flex-direction:column;padding:44px 48px;overflow:hidden}
.frame::before{content:'';position:absolute;width:560px;height:560px;right:-180px;top:-220px;border-radius:50%;background:radial-gradient(circle,rgba(255,176,32,.24),transparent 65%)}
.frame::after{content:'';position:absolute;width:480px;height:480px;left:-200px;bottom:-240px;border-radius:50%;background:radial-gradient(circle,rgba(63,214,197,.18),transparent 65%)}
.top{display:flex;align-items:center;gap:14px;position:relative}
.mark{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#ffb020,#ff7a1a);display:grid;place-items:center;color:#1a1200;font-family:'Plex Mono',monospace;font-size:20px;font-weight:600;letter-spacing:-.04em}
.brand{font-size:26px;font-weight:700;letter-spacing:-.02em}
h1{margin-top:auto;font-size:84px;font-weight:700;letter-spacing:-.04em;line-height:1.02;position:relative}
h1 em{font-style:normal;color:#ffc855}
.sub{margin-top:20px;font-size:23px;color:#b4bdd0;max-width:900px;line-height:1.45;position:relative}
.bottom{margin-top:auto;border-top:1px solid #2a3450;padding-top:20px;display:flex;justify-content:space-between;font-family:'Plex Mono',monospace;font-size:14px;color:#8d97ae;position:relative}
</style></head><body>
<div class="frame">
  <div class="top"><span class="mark">${esc(site.brand.logoText)}</span><span class="brand">${esc(site.brand.name)}</span></div>
  <h1>Play a game in the <em>next ten seconds</em></h1>
  <p class="sub">${esc(site.brand.tagline)}. No download, no sign-up, nothing uploaded.</p>
  <div class="bottom"><span>Free browser games · Gamer tools</span><span>${esc((site.baseUrl || '').replace(/^https?:\/\//, ''))}</span></div>
</div>
</body></html>`;

/* Icon: the logo mark at any size. */
const iconHtml = (size) => `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${size}px;height:${size}px;overflow:hidden;background:#ffb020}
.wrap{width:${size}px;height:${size}px;background:linear-gradient(135deg,#ffb020,#ff7a1a);display:grid;place-items:center}
.t{font-family:'Plex Mono',monospace;font-weight:600;color:#1a1200;font-size:${Math.round(size * 0.4)}px;line-height:1;letter-spacing:-.06em}
</style></head><body><div class="wrap"><span class="t">${esc(site.brand.logoText)}</span></div></body></html>`;

try {
  console.log('');
  console.log('  站点图标与默认分享图');
  console.log('  ' + '─'.repeat(48));
  const [og, touch, fav] = await shoot([
    { out: path.join(PUB, 'og.png'), html: ogHtml, width: 1200, height: 630 },
    { out: path.join(PUB, 'apple-touch-icon.png'), html: iconHtml(180), width: 180, height: 180 },
    { html: iconHtml(48), width: 48, height: 48 },
  ]);
  console.log('');
  // ICO container: 6-byte header + 16-byte directory entry + PNG data. Simple enough to write by hand.
  const png = fav.png;
  const dir = Buffer.alloc(16);
  dir[0] = 48; dir[1] = 48; dir[2] = 0; dir[3] = 0; dir[4] = 1; dir[5] = 0; dir[6] = 32; dir[7] = 0;
  dir.writeUInt32LE(png.length, 8);
  dir.writeUInt32LE(22, 12);
  const ico = Buffer.concat([Buffer.from([0, 0, 1, 0, 1, 0]), dir, png]);
  fs.writeFileSync(path.join(PUB, 'favicon.ico'), ico);

  const kb = (b) => `${(b.length / 1024).toFixed(1)} KB`;
  console.log(`  ✓ public/og.png                 ${kb(og.png)}`);
  console.log(`  ✓ public/apple-touch-icon.png   ${kb(touch.png)}`);
  console.log(`  ✓ public/favicon.ico            ${kb(ico)}`);
  console.log('');
} catch (e) {
  console.error(`  ✗ ${e.message}`);
  process.exit(1);
}
