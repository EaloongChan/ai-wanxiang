/**
 * Ealoong Arcade — static site generator (zero dependencies)
 *
 *   node scripts/build.mjs                  build the site into dist/
 *   node scripts/build.mjs --watch          rebuild when data/ or src/ changes
 *   node scripts/build.mjs --target=portal  build the standalone game packages into build/portal/
 *
 * Everything on the site comes from data/. The build never contains content of its own.
 * It must run on a machine with no network and no browser: image generation lives in
 * scripts/assets.mjs and scripts/og-images.mjs and is run separately.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

import {
  homePage, gamesIndexPage, gamePage, toolsIndexPage, toolPage, docPage, notFoundPage, gameShell, GAME_RUNTIME_ICONS,
} from '../src/lib/pages.mjs';
import { iconSprite, reserveIcons, resetIcons } from '../src/lib/icons.mjs';
import { stringsFor } from '../src/lib/strings.mjs';
import { LANGS, LANG_ATTR, loc, pick } from '../src/lib/i18n.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const DIST = path.join(ROOT, 'dist');
const PORTAL_OUT = path.join(ROOT, 'build', 'portal');
const SRC = path.join(ROOT, 'src');

const readJSON = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const readSrc = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
const hash7 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

/** Latest of a list of ISO dates, for sitemap lastmod. */
const latest = (...dates) => dates.filter(Boolean).sort().pop() || today();

/* ---------- output helpers ----------
   Files are overwritten in place and only leftovers are deleted at the end.
   Deleting a whole tree on Windows costs more than the build itself. */
const written = new Set();

function write(rel, content) {
  const out = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, content);
  written.add(path.resolve(out));
  return out;
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) n += copyDir(s, d);
    else {
      fs.copyFileSync(s, d);
      written.add(path.resolve(d));
      n++;
    }
  }
  return n;
}

function pruneStale() {
  const removed = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
      } else if (!written.has(path.resolve(full))) {
        fs.unlinkSync(full);
        removed.push(path.relative(DIST, full).replace(/\\/g, '/'));
      }
    }
  };
  if (fs.existsSync(DIST)) walk(DIST);
  return removed;
}

/* ---------- bundler ----------
   The site has no build toolchain, so modules are concatenated by hand into one classic
   script per page. That keeps `file://` double-click previews working (module scripts
   are blocked there) and gives each page a single request.
   Rules for bundled modules: named exports only, relative imports only, no default
   exports, no top-level `await`, no duplicate top-level names. The rules are enforced
   here, at build time, by throwing. */
const DECL = /^(?:export\s+)?(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*['"](\.{1,2}\/[^'"]+)['"];?/gm;

export function bundle(modules) {
  const seen = new Map();       // top-level name → module it came from
  const parts = [];
  for (const file of modules) {
    let code = readSrc(file);
    if (/^\s*export\s+default/m.test(code)) throw new Error(`${file}: default exports cannot be bundled`);
    if (/^\s*export\s+\{/m.test(code)) throw new Error(`${file}: re-exports cannot be bundled`);
    if (/^\s*import\s+[^\{]/m.test(code)) throw new Error(`${file}: only named imports from ./ are supported`);
    for (const [, names, rel] of code.matchAll(IMPORT)) {
      if (!modules.includes(path.posix.join(path.posix.dirname(file), rel))) {
        throw new Error(`${file}: imports ./${rel}, which is not part of this bundle`);
      }
      void names;
    }
    code = code.replace(IMPORT, '').replace(/^export\s+(?=(?:async\s+)?(?:function\*?|const|let|class)\b)/gm, '');
    for (const [, name] of code.matchAll(DECL)) {
      if (seen.has(name)) throw new Error(`duplicate top-level name "${name}" in ${file} and ${seen.get(name)}`);
      seen.set(name, file);
    }
    parts.push(`/* ---- ${file} ---- */\n${code.trim()}\n`);
  }
  return parts.join('\n');
}

function classicScript(code, prelude = '') {
  const out = `(function () {\n'use strict';\n${prelude}\n${code}\n})();\n`;
  new vm.Script(out, { filename: 'bundle.js' });     // syntax errors must fail the build
  return out;
}

/* ---------- site ---------- */

export function build({ quiet = false } = {}) {
  const t0 = Date.now();
  written.clear();
  fs.mkdirSync(DIST, { recursive: true });

  const site = readJSON('site.config.json');
  const games = readJSON('games.json');
  const tools = readJSON('tools.json');
  const docs = readJSON('pages.json');
  const prompts = readJSON('legacy/prompts.json');
  const updatedAt = today();

  /* ---- assets with content-hashed names.
     /assets/* is cached for a year, so a name that never changes would freeze an old
     version in returning browsers. The name is the content. */
  const mainCss = readSrc('styles/main.css');
  const printCss = readSrc('styles/print.css');
  const gameCss = readSrc('styles/game.css');
  const appJs = readSrc('scripts/app.js');
  const beaconJs = readSrc('scripts/beacon.js');

  const ASSET = {
    css: `main.${hash7(mainCss)}.css`,
    print: `print.${hash7(printCss)}.css`,
    gameCss: `game.${hash7(gameCss)}.css`,
    js: `app.${hash7(appJs)}.js`,
    beacon: `beacon.${hash7(beaconJs)}.js`,
  };
  site.asset = ASSET;

  write('assets/' + ASSET.css, mainCss);
  write('assets/' + ASSET.print, printCss);
  write('assets/' + ASSET.gameCss, gameCss);
  write('assets/' + ASSET.js, appJs);
  // Shipped always, loaded only when analytics is switched on (see src/lib/beacon.mjs):
  // an asset that is never requested costs nothing.
  write('assets/' + ASSET.beacon, beaconJs);

  /* ---- games: one script per game per language = config + strings + logic + view + main ----
     A separate bundle per language keeps each one lean and removes any chance of the
     script drawing the wrong language after someone switches. The portal package uses
     the English bundle. */
  for (const g of games) {
    g.config = readJSON(`games/${g.id}/config.json`);
    // Achievements are content, not code: the rules read them from the config they already get.
    const achFile = path.join(DATA, 'games', g.id, 'achievements.json');
    if (fs.existsSync(achFile)) g.config.achievements = JSON.parse(fs.readFileSync(achFile, 'utf8'));
    g.scripts = {};
    const code = bundle([`game/${g.id}/logic.js`, `game/${g.id}/view.js`, `game/${g.id}/main.js`]);
    for (const lang of LANGS) {
      // Each bundle carries one language's text only: the other language's names would be dead weight.
      const config = JSON.parse(JSON.stringify(g.config, (key, value) => (key === 'zh' && lang !== 'zh' ? undefined : value)));
      const prelude = `const LANG = ${JSON.stringify(lang)};\nconst CONFIG = ${JSON.stringify(config)};\nconst SAVE_KEY = ${JSON.stringify(`${site.saveKeyPrefix || 'ealoong'}.${g.id}.save`)};\nconst L10N = ${JSON.stringify(stringsFor(lang, ['gr.']))};`;
      const name = `game-${g.id}${lang === 'en' ? '' : '-' + lang}.${hash7(code + prelude)}.js`;
      write('assets/' + name, classicScript(code, prelude));
      g.scripts[lang] = '/assets/' + name;
    }
  }

  /* ---- tools: one script per tool per language = data + strings + core + ui ---- */
  for (const t of tools) {
    t.scripts = {};
    const files = [`tools/${t.id}/core.js`, 'tools/shared-ui.js', `tools/${t.id}/ui.js`];
    const code = bundle(files);
    for (const lang of LANGS) {
      // The tool's own id travels with the data so the page can report which tool was used.
      let prelude = `const TOOL = ${JSON.stringify({ id: t.id, ...(t.client || {}) })};\nconst STR = ${JSON.stringify(stringsFor(lang, ['tu.', 'err.', 'copy.']))};\n`;
      if (t.id === 'prompt-template-builder') {
        // 86 full prompts weigh 33 KB gzipped, which would delay the first paint of this page for
        // data most visitors never scroll through. The script gets the index only and fetches
        // the texts right after the page is interactive.
        // Left in dataset order: it starts with general writing prompts, which is where most people begin.
        // The legacy dataset keeps Chinese at the top level and English inside `en`.
        const source = (p) => (lang === 'zh' ? p : p.en);
        const list = prompts
          .filter((p) => source(p) && source(p).prompt)
          .map((p) => ({ id: p.id, title: source(p).title, desc: source(p).desc || '', prompt: source(p).prompt, vars: source(p).vars || [] }));
        const json = JSON.stringify(list);
        const name = `prompts-${lang}.${hash7(json)}.json`;
        write('assets/' + name, json);
        prelude += `const PROMPTS_URL = ${JSON.stringify('/assets/' + name)};\nconst PROMPT_INDEX = ${JSON.stringify(list.map((p) => ({ id: p.id, title: p.title })))};\n`;
      }
      const name = `tool-${t.id}${lang === 'en' ? '' : '-' + lang}.${hash7(code + prelude)}.js`;
      write('assets/' + name, classicScript(code, prelude));
      t.scripts[lang] = '/assets/' + name;
    }
  }

  /* ---- pages: English at the root, Chinese under /zh ----
     Each page is emitted twice with the same unlocalized path recorded in the manifest,
     which is what the sitemap uses to pair the two versions. */
  const ctx = { site, games, tools, docs, updatedAt };
  const manifest = [];
  const emit = (path_, lang, render, meta = {}) => {
    // Every caller passes a directory path ("/games/"): without the trailing slash the
    // pieces would glue together into "gamesindex.html" and nobody would notice until 404s.
    if (!path_.endsWith('/')) throw new Error(`page path must end with a slash: ${path_}`);
    resetIcons();
    const rel = (lang === 'zh' ? 'zh/' : '') + path_.replace(/^\//, '') + 'index.html';
    write(rel, render());
    manifest.push({ path: path_, lang, title: meta.title || site.brand.name, type: meta.type || 'page', lastmod: meta.lastmod || updatedAt });
  };
  const titleOf = (m, lang) => (lang === 'zh' && m.zh && m.zh.metaTitle ? m.zh.metaTitle : m.metaTitle || pick(m, 'name', lang));

  for (const lang of LANGS) {
    emit('/', lang, () => homePage(ctx, lang), { title: site.brand.name, type: 'home', lastmod: updatedAt });
    emit('/games/', lang, () => gamesIndexPage(ctx, lang), { title: 'Games', type: 'index', lastmod: updatedAt });
    emit('/tools/', lang, () => toolsIndexPage(ctx, lang), { title: 'Tools', type: 'index', lastmod: updatedAt });
    for (const g of games) emit(g.path, lang, () => gamePage(ctx, g, lang), { title: titleOf(g, lang), type: 'game', lastmod: latest(g.updated, updatedAt) });
    for (const t of tools) emit(t.path, lang, () => toolPage(ctx, t, lang), { title: titleOf(t, lang), type: 'tool', lastmod: latest(t.updated, updatedAt) });
    // Keys starting with "$" are notes for people editing the data, not pages.
    for (const [slug, p] of Object.entries(docs)) {
      if (slug.startsWith('$')) continue;
      emit(`/${slug}/`, lang, () => docPage(ctx, slug, p, lang), { title: (lang === 'zh' && p.zh && p.zh.title) || p.title, type: 'doc', lastmod: latest(p.updated, updatedAt) });
    }
  }
  // One 404 for the whole site: the host serves this file for every missing address.
  resetIcons();
  write('404.html', notFoundPage(ctx));

  copyDir(path.join(ROOT, 'public'), DIST);

  /* ---- legacy dataset: kept available at /api/legacy for existing users ---- */
  const legacyDir = path.join(DATA, 'legacy');
  const legacyFiles = fs.readdirSync(legacyDir).filter((f) => f.endsWith('.json')).sort();
  const datasets = {};
  for (const f of legacyFiles) {
    const json = fs.readFileSync(path.join(legacyDir, f), 'utf8');
    write(`api/legacy/${f}`, json);
    let count = '';
    try { const j = JSON.parse(json); count = Array.isArray(j) ? j.length : (j.items ? j.items.length : ''); } catch { /* leave blank */ }
    datasets[f.replace(/\.json$/, '')] = count;
  }
  write('api/legacy/index.json', JSON.stringify({
    site: 'Ealoong Arcade',
    note: 'The open dataset of the previous site, AI Wanxiang, frozen as it was when the site was retired. Code: MIT. Content: CC BY 4.0.',
    license: 'CC BY 4.0',
    datasets,
  }, null, 2) + '\n');

  /* ---- SEO: one entry per language, each naming its counterpart ---- */
  const base = (site.baseUrl || 'https://example.com').replace(/\/$/, '');
  const byPath = new Map();
  for (const m of manifest) {
    if (!byPath.has(m.path)) byPath.set(m.path, {});
    byPath.get(m.path)[m.lang] = m;
  }
  const urlEntry = (m) => {
    const versions = byPath.get(m.path);
    const alts = LANGS.filter((l) => versions[l])
      .map((l) => `    <xhtml:link rel="alternate" hreflang="${LANG_ATTR[l]}" href="${base}${loc(m.path, l)}"/>`)
      .join('\n');
    return `  <url>\n    <loc>${base}${loc(m.path, m.lang)}</loc>\n${alts}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${base}${loc(m.path, 'en')}"/>\n    <lastmod>${m.lastmod}</lastmod>\n  </url>`;
  };
  const urls = [...byPath.values()].flatMap((versions) => LANGS.filter((l) => versions[l]).map((l) => urlEntry(versions[l]))).join('\n');
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`);

  write('_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/api/legacy/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=86400
`);
  // vercel.json at the repo root is the one Vercel reads. The copy in dist is only there so
  // that handing dist/ to another host still shows the intended redirects and headers.
  const rootVercel = path.join(ROOT, 'vercel.json');
  if (fs.existsSync(rootVercel)) write('vercel.json', fs.readFileSync(rootVercel, 'utf8'));

  const stale = pruneStale();
  const ms = Date.now() - t0;
  if (!quiet) {
    console.log('');
    console.log('  Ealoong Arcade · build');
    console.log('  ' + '─'.repeat(52));
    console.log(`  Pages         ${manifest.length + 1} (${LANGS.map((l) => `${l}:${manifest.filter((m) => m.lang === l).length}`).join(', ')} + 404)`);
    console.log(`  Games         ${games.map((g) => g.id).join(', ')}`);
    console.log(`  Tools         ${tools.map((t) => t.id).join(', ')}`);
    console.log(`  Legacy API    ${legacyFiles.length} files`);
    console.log(`  Output        dist/  (${written.size} files)`);
    console.log(`  Removed       ${stale.length} stale file(s)`);
    console.log(`  Time          ${ms}ms`);
    console.log('');
  }
  return { manifest, games, tools, ms, stale };
}

/* ---------- portal packages ----------
   A single self-contained index.html per game: no external requests, no links back to
   this site, no ads. Game portals review exactly this file. */
function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Minimal ZIP writer (stored, no compression): one entry per file. */
function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of files) {
    const bytes = Buffer.from(data);
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);      // version needed
    header.writeUInt16LE(0, 6);       // flags
    header.writeUInt16LE(0, 8);       // method: stored
    header.writeUInt16LE(0, 10);      // time
    header.writeUInt16LE(0x21, 12);   // date (1980-01-01)
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(nameBuf.length, 26);
    header.writeUInt16LE(0, 28);
    local.push(header, nameBuf, bytes);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(bytes.length, 20); ch.writeUInt32LE(bytes.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);
    offset += 30 + nameBuf.length + bytes.length;
  }
  const localBuf = Buffer.concat(local);
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(localBuf.length, 16);
  return Buffer.concat([localBuf, centralBuf, end]);
}

export function buildPortal({ quiet = false } = {}) {
  const t0 = Date.now();
  const site = readJSON('site.config.json');
  const games = readJSON('games.json');
  const gameCss = readSrc('styles/game.css');
  const portalCss = readSrc('styles/portal.css');
  const out = [];

  for (const g of games) {
    const config = readJSON(`games/${g.id}/config.json`);
    const code = bundle([`game/${g.id}/logic.js`, `game/${g.id}/view.js`, `game/${g.id}/main.js`]);
    // Portals are English-only, so this package carries the English strings.
    const prelude = `const LANG = "en";\nconst CONFIG = ${JSON.stringify(config)};\nconst SAVE_KEY = ${JSON.stringify(`${site.saveKeyPrefix || 'ealoong'}.${g.id}.save`)};\nconst STANDALONE = true;\nconst L10N = ${JSON.stringify(stringsFor('en', ['gr.']))};`;
    // Escaping here is about correctness, not trust: a quote in a game name or a "</script>"
    // inside the bundle would produce a broken file that still looks fine in an editor.
    const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const script = classicScript(code, prelude).replace(/<\//g, '<\\/');
    // The standalone page has no site shell, so the sprite the game's icons point at must travel with it.
    resetIcons();
    const shell = gameShell(g, { standalone: true, lang: 'en' });
    reserveIcons(GAME_RUNTIME_ICONS);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>${escHtml(g.name)}</title>
<meta name="description" content="${escHtml(g.tagline)}">
<meta name="theme-color" content="#0b0e17">
<style>${gameCss}\n${portalCss}</style>
</head>
<body class="standalone">
${iconSprite()}
${shell}
<script>${script}</script>
</body>
</html>
`;
    // Deliberately outside dist/: these files are for portal submission, not for visitors.
    // Deploying them would put a playable copy on our own domain (a real problem for any
    // portal with web-exclusivity terms) and would need a looser CSP just for them.
    fs.mkdirSync(path.join(PORTAL_OUT, g.id), { recursive: true });
    fs.writeFileSync(path.join(PORTAL_OUT, g.id, 'index.html'), html);
    const archive = zip([['index.html', html]]);
    fs.writeFileSync(path.join(PORTAL_OUT, `${g.id}.zip`), archive);
    out.push({ id: g.id, html: html.length, zip: archive.length, gzip: zlib.gzipSync(Buffer.from(html)).length });
  }

  if (!quiet) {
    console.log('');
    console.log('  Portal packages (one self-contained file per game)');
    console.log('  ' + '─'.repeat(52));
    for (const o of out) {
      console.log(`  ${o.id.padEnd(18)} index.html ${(o.html / 1024).toFixed(0)} KB  ·  zip ${(o.zip / 1024).toFixed(0)} KB  ·  gzip ${(o.gzip / 1024).toFixed(1)} KB`);
    }
    console.log(`  Output        build/portal/  (not deployed)`);
    console.log('');
  }
  return out;
}

/* ---------- entry ---------- */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--target=portal')) {
    buildPortal();
  } else {
    // A default build always refreshes the portal packages too: build() deletes whatever
    // it did not write, so a site-only run would silently remove them.
    build();
    buildPortal();
    if (process.argv.includes('--watch')) {
      let timer = null;
      const rebuild = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          try { build({ quiet: true }); console.log(`  [${new Date().toLocaleTimeString()}] rebuilt`); }
          catch (e) { console.error('  build failed:', e.message); }
        }, 120);
      };
      for (const dir of [DATA, SRC]) fs.watch(dir, { recursive: true }, rebuild);
      console.log('  watching data/ and src/ — Ctrl+C to stop');
    }
  }
}
