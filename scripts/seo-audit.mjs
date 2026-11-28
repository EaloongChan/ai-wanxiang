/**
 * Page-level SEO audit.
 *
 *   node scripts/seo-audit.mjs                 audit dist/ (no network)
 *   node scripts/seo-audit.mjs --live           audit the deployed site
 *
 * Every rule here exists because a real page broke it at least once: a share image pointing
 * at a file that was never generated, JSON-LD without a language, a canonical that disagrees
 * with the file it sits in. Reading the HTML is the only way to catch that; the templates can
 * look right and still emit the wrong href.
 *
 * Exit code 1 when any page fails, so this can gate a deploy.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.config.json'), 'utf8'));
const BASE = (site.baseUrl || '').replace(/\/$/, '');
const LIVE = process.argv.includes('--live');

const problems = [];
const pageRows = [];
const titles = new Map();
let checked = 0;

const fail = (page, msg) => { problems.push(`${page}: ${msg}`); };

const textBetween = (html, re) => { const m = html.match(re); return m ? m[1].trim() : ''; };
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const relOf = (file) => '/' + file.slice(DIST.length + 1).replace(/\\/g, '/').replace(/index\.html$/, '');
const existsInDist = (url) => {
  const rel = url.replace(BASE, '').replace(/^\/+/, '').split('#')[0].split('?')[0];
  const direct = path.join(DIST, rel);
  if (rel === '' || rel.endsWith('/')) return fs.existsSync(path.join(direct, 'index.html'));
  return fs.existsSync(direct);
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'portal') walk(f, out); }
    else if (e.name.endsWith('.html')) out.push(f);
  }
  return out;
}

/* ---------- live mode: enumerate from the deployed sitemap ---------- */

/**
 * One retry on a dropped connection. This machine's route to the edge occasionally drops a
 * request; that is not a verdict on the page, and a single timeout must not fail the audit.
 */
async function fetchRetry(url, opts = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetch(url, { ...opts, signal: AbortSignal.timeout(opts.timeout || 25000) });
    } catch (e) {
      if (attempt === 1) throw e;
      await new Promise((r) => setTimeout(r, 900));
    }
  }
  return null;
}

async function livePages() {
  const res = await fetchRetry(`${BASE}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap ${res.status}`);
  const xml = await res.text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const out = [];
  for (const url of urls) {
    const r = await fetchRetry(url);
    out.push({ file: url, url, html: await r.text(), status: r.status });
    await new Promise((r2) => setTimeout(r2, 120));   // let the edge breathe between pages
  }
  return out;
}

/**
 * Share images are verified against the build, not over the network. A live run already
 * fetches every page; adding one HEAD per image doubled the request count and this
 * connection drops requests under that load. The local run gates the deploy, so a wrong
 * image path is caught before it ships.
 */
async function imageOk(url) {
  if (!/^https?:/.test(url) && !url.startsWith('/')) return false;
  const abs = url.startsWith('/') ? BASE + url : url;
  return existsInDist(abs);
}

/* ---------- one page ---------- */
async function auditPage({ label, html, url }) {
  const isZh = label.startsWith('zh/') || label.startsWith('/zh/');
  const canonical = decode(textBetween(html, /<link rel="canonical" href="([^"]+)"/) || '');
  const title = decode(textBetween(html, /<title>([\s\S]*?)<\/title>/) || '');
  const desc = decode(textBetween(html, /<meta name="description" content="([^"]*)"/) || '');
  const h1s = [...html.matchAll(/<h1[\s>]/g)].length;
  const before = problems.length;

  if (!title) fail(label, 'no <title>');
  else if (title.length < 15 || title.length > 65) fail(label, `title length ${title.length} (want 15-65)`);
  if (!desc) fail(label, 'no meta description');
  else if (desc.length < 50 || desc.length > 160) fail(label, `description length ${desc.length} (want 50-160)`);
  if (h1s !== 1) fail(label, `${h1s} h1 elements (want 1)`);

  // canonical: must be this page's own absolute URL
  const expected = BASE + (isZh ? '/zh' : '') + (label.replace(/^(zh\/|\/zh\/)/, '').replace(/index\.html$/, '').replace(/^([^/])/, '/$1'));
  const wantCanonical = url || (BASE + (isZh ? '/zh/' : '/') + label.replace(/^(zh\/|\/zh\/)/, '').replace(/index\.html$/, ''));
  if (!canonical) fail(label, 'no canonical');
  else if (!canonical.startsWith(BASE)) fail(label, `canonical is not on the site domain: ${canonical}`);
  else if (url && canonical !== url) fail(label, `canonical ${canonical} != page url ${url}`);
  else if (!url) {
    const derived = BASE + relOf(path.join(DIST, label));
    if (canonical.replace(/\/$/, '') !== derived.replace(/\/$/, '') && canonical !== derived) {
      // index.html at dist root: relOf gives '/', which is fine
      if (!(label === 'index.html' && canonical === BASE + '/')) fail(label, `canonical ${canonical} != ${derived}`);
    }
  }
  void expected;

  // hreflang: three links, pointing at real pages, x-default = English
  const alts = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]);
  const alt = Object.fromEntries(alts);
  if (label !== '404.html') {
    for (const k of ['en', 'zh-CN', 'x-default']) if (!alt[k]) fail(label, `missing hreflang ${k}`);
    if (alt['x-default'] && alt['en'] && alt['x-default'] !== alt['en']) fail(label, 'x-default does not point at the English page');
    for (const [k, href] of alts) {
      if (!href.startsWith(BASE)) fail(label, `hreflang ${k} is not absolute: ${href}`);
      else if (!LIVE && !existsInDist(href)) fail(label, `hreflang ${k} points at a page that does not exist: ${href}`);
    }
    if (canonical && alt[isZh ? 'zh-CN' : 'en'] && canonical !== alt[isZh ? 'zh-CN' : 'en']) fail(label, 'hreflang for this language disagrees with canonical');
  }

  // Open Graph
  const og = Object.fromEntries([...html.matchAll(/<meta property="og:(?:\w+:)?([\w]+)" content="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
  for (const k of ['title', 'description', 'url', 'image']) if (!og[k]) fail(label, `missing og:${k}`);
  if (og.url && canonical && og.url !== canonical) fail(label, 'og:url != canonical');
  if (og.image) {
    const img = og.image.replace(BASE, '') || og.image;
    if (!(await imageOk(img))) fail(label, `og:image 404: ${img}`);
  }
  if (!/<meta property="og:locale" content="[^"]+"/.test(html)) fail(label, 'missing og:locale');
  if (!/<meta property="og:locale:alternate" content="[^"]+"/.test(html)) fail(label, 'missing og:locale:alternate');

  // JSON-LD: parses, has context, and every content type names its language.
  // A noindex page is exempt: structured data on a page nobody should index is decoration.
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!blocks.length && !noindex) fail(label, 'no JSON-LD');
  for (const raw of blocks) {
    let data;
    try { data = JSON.parse(raw); } catch { fail(label, 'JSON-LD does not parse'); continue; }
    const list = Array.isArray(data) ? data : [data];
    for (const d of list) {
      if (!d['@context']) fail(label, 'JSON-LD without @context');
      const type = d['@type'];
      if (['VideoGame', 'WebApplication', 'WebSite', 'CollectionPage', 'WebPage', 'ItemList', 'FAQPage'].includes(type) && !d.inLanguage) {
        fail(label, `JSON-LD ${type} has no inLanguage`);
      }
      if (type === 'VideoGame' && d.image) {
        const img = String(d.image).replace(BASE, '');
        if (!(await imageOk(img))) fail(label, `VideoGame.image 404: ${img}`);
      }
    }
  }

  // duplicate titles across the site are a smell, not always a bug: report once
  if (title) {
    const key = title.toLowerCase();
    if (titles.has(key)) titles.get(key).push(label);
    else titles.set(key, [label]);
  }

  pageRows.push({ label, failed: problems.length - before });
  checked++;
}

/* ---------- run ---------- */
const report = [];
report.push('');
report.push(`  Page-level SEO audit  ${LIVE ? BASE : 'dist/'}`);
report.push('  ' + '─'.repeat(66));

try {
  if (LIVE) {
    const pages = await livePages();
    for (const p of pages) {
      if (p.status !== 200) { fail(new URL(p.url).pathname, `HTTP ${p.status}`); continue; }
      const label = new URL(p.url).pathname.replace(/^\//, '') || 'index.html';
      await auditPage({ label, html: p.html, url: p.url });
    }
  } else {
    if (!fs.existsSync(DIST)) {
      console.error('  dist/ missing — build first');
      process.exit(1);
    }
    for (const file of walk(DIST).filter((f) => !/zhabout|zhgames|zhtools|zhprivacy|zhcontact|zhindex|zh404/i.test(f))) {
      await auditPage({ label: file.slice(DIST.length + 1).replace(/\\/g, '/'), html: fs.readFileSync(file, 'utf8') });
    }
  }
} catch (e) {
  console.error(`  ✗ ${e.message}`);
  process.exit(1);
}

for (const [title, pages] of titles) {
  if (pages.length > 2) fail('site', `title shared by ${pages.length} pages: «${title}» (${pages.slice(0, 3).join(', ')})`);
}

for (const row of pageRows) report.push(`  ${row.failed ? '✗' : '✓'} ${row.label.padEnd(52)} ${row.failed ? row.failed + ' issue(s)' : ''}`);
console.log(report.join('\n'));

if (problems.length) {
  console.log('');
  for (const p of problems) console.log(`  ✗ ${p}`);
}
console.log('');
console.log('  ' + '─'.repeat(66));
console.log(`  Pages ${checked} · problems ${problems.length}`);
console.log('');
process.exit(problems.length ? 1 : 0);
