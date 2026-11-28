/**
 * Redirects for the previous site. Rewrites the `redirects` block of vercel.json.
 *
 *   node scripts/redirects.mjs            regenerate vercel.json
 *   node scripts/redirects.mjs --check    verify only; change nothing
 *
 * The previous site (AI Wanxiang) had 373 indexed addresses. This script:
 *   1. reads that list from data/legacy-sitemap.xml, a snapshot taken before the rebuild;
 *   2. checks that every one of them is covered by a rule below;
 *   3. checks that no address of the new site is caught by the same rules. The old
 *      /tools/<category>/<tool>/ pages and the new /tools/<tool>/ pages share a prefix,
 *      so a careless rule would send every new tool page to the home page.
 *   4. writes the rules into vercel.json and leaves every other key alone.
 *
 * Only path-to-regexp v1 constructs are used in `source` (what Vercel accepts):
 * :name, :name?, (a|b) and (.*).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

/** Old tool category ids. The new tool ids must never collide with them (check.mjs enforces that). */
const oldCategories = () => readJSON('data/legacy/categories.json').toolCategories.map((c) => c.id);

/**
 * Where each old family of addresses goes. Order is the order Vercel tries them.
 * `target` is a function so the category list is read at call time, not at import time.
 */
export function buildRules() {
  const cats = oldCategories().join('|');
  const legacyDataset = ['tools', 'prompts', 'glossary', 'playbooks', 'models', 'learn', 'news', 'categories', 'tags-en', 'i18n', 'feeds'];
  return [
    // The previous English site. There is no /en/ on the new site: it is English everywhere.
    { source: '/en', destination: '/', permanent: true },
    { source: '/en/(.*)', destination: '/', permanent: true },
    // Old category pages (/tools/coding/). Named explicitly so /tools/<new tool>/ is untouched.
    { source: `/tools/(${cats})`, destination: '/', permanent: true },
    // Old detail pages (/tools/coding/cursor/).
    { source: '/tools/:cat/:id', destination: '/', permanent: true },
    // The old prompt library maps onto the tool that took its place.
    { source: '/prompts/(.*)', destination: '/tools/prompt-template-builder/', permanent: true },
    // Sections that have no counterpart.
    { source: '/playbooks/(.*)', destination: '/', permanent: true },
    { source: '/models/(.*)', destination: '/', permanent: true },
    { source: '/news/(.*)', destination: '/', permanent: true },
    { source: '/learn/(.*)', destination: '/', permanent: true },
    { source: '/glossary/(.*)', destination: '/', permanent: true },
    { source: '/prompts', destination: '/tools/prompt-template-builder/', permanent: true },
    { source: '/(compare|saved|search|open-data|changelog)', destination: '/', permanent: true },
    { source: '/(feed|rss).xml', destination: '/', permanent: true },
    // The open dataset stays where its users can find it.
    { source: `/api/(${legacyDataset.join('|')}).json`, destination: '/api/legacy/$1.json', permanent: true },
    { source: '/api/(search|search-en|query-map|feed|index).json', destination: '/api/legacy/index.json', permanent: true },
  ];
}

const toRegExp = (source) => new RegExp(`^${rebuild(source)}/?$`);

/** Turn a `source` pattern into a regex body with the same meaning Vercel gives it. */
function rebuild(source) {
  let out = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === ':') {
      const m = /^:([A-Za-z_]+)(\?)?/.exec(source.slice(i));
      out += `([^/]+)${m[2] ? '?' : ''}`;
      i += m[0].length;
    } else if (ch === '(') {
      const end = source.indexOf(')', i);
      out += source.slice(i, end + 1);            // (a|b) and (.*) pass through unchanged
      i = end + 1;
    } else if ('.+*?^${}|[]\\'.includes(ch)) {
      out += '\\' + ch;
      i++;
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** The redirect that fires for a path, or null when no rule matches. Tolerates a missing trailing slash. */
export function matchLegacy(pathname) {
  const candidates = [pathname, pathname.replace(/\/+$/, '') || '/'];
  const rule = buildRules().find((r) => candidates.some((p) => toRegExp(r.source).test(p)));
  if (!rule) return null;
  const m = candidates.map((p) => p.match(toRegExp(rule.source))).find(Boolean);
  return { rule, redirect: rule.destination.replace(/\$(\d+)/g, (_, n) => m[n] || '') };
}

export function verify() {
  const problems = [];
  const pathsOf = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);

  const newSitemap = path.join(ROOT, 'dist', 'sitemap.xml');
  if (!fs.existsSync(newSitemap)) {
    return { problems: ['dist/sitemap.xml is missing: build first, so the new addresses can be checked'], oldCount: 0 };
  }
  const fresh = pathsOf(fs.readFileSync(newSitemap, 'utf8'));
  for (const p of fresh) if (matchLegacy(p)) problems.push(`new address would be redirected away: ${p}`);

  const oldUrls = pathsOf(fs.readFileSync(path.join(ROOT, 'data', 'legacy-sitemap.xml'), 'utf8'));
  // An address that exists on both sites (the home page, /about/) is served, not redirected.
  for (const p of oldUrls) {
    if (!matchLegacy(p) && !fresh.includes(p)) problems.push(`old address has neither a redirect nor a page: ${p}`);
  }

  const cats = new Set(oldCategories());
  for (const t of readJSON('data/tools.json')) {
    if (cats.has(t.id)) problems.push(`tool id "${t.id}" collides with an old /tools/ category of the same name`);
  }
  return { problems, oldCount: oldUrls.length };
}

export function writeRedirects() {
  const file = path.join(ROOT, 'vercel.json');
  const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const hostRule = (config.redirects || []).filter((r) => r.has && r.has.some((h) => h.type === 'host'));
  config.redirects = [...hostRule, ...buildRules()];
  // Key order that reads well in diffs; unknown keys are kept.
  const order = ['$schema', 'framework', 'buildCommand', 'outputDirectory', 'trailingSlash', 'redirects', 'headers'];
  const sorted = {};
  for (const k of order) if (k in config) sorted[k] = config[k];
  for (const k of Object.keys(config)) if (!(k in sorted)) sorted[k] = config[k];
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
  return config.redirects.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { problems, oldCount } = verify();
  console.log('');
  console.log('  Redirects for the previous site');
  console.log('  ' + '─'.repeat(52));
  if (problems.length) {
    for (const p of problems) console.log(`  ✗ ${p}`);
    console.log('');
    process.exit(1);
  }
  const rules = buildRules();
  console.log(`  Old addresses    ${oldCount}, all covered`);
  console.log(`  Rules            ${rules.length}`);
  for (const r of rules) console.log(`    ${r.source.padEnd(58)} → ${r.destination}`);
  if (process.argv.includes('--check')) {
    console.log('  --check: vercel.json not touched');
  } else {
    const total = writeRedirects();
    console.log(`  ✓ vercel.json rewritten (${total} redirects)`);
  }
  console.log('');
}
