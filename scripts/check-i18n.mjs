/**
 * Chinese/English parity check.
 *
 *   node scripts/check-i18n.mjs
 *
 * Structural problems fail the run: a page without its counterpart, a language attribute
 * that disagrees with the folder, hreflang links that do not point at each other.
 * English text left inside a Chinese page is reported as a warning, because proper nouns
 * (game titles, product names) are legitimate and a hard rule would cry wolf.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const BASE = (JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.config.json'), 'utf8')).baseUrl || '').replace(/\/$/, '');

if (!fs.existsSync(DIST)) {
  console.error('  dist/ missing — build first');
  process.exit(1);
}

const STRUCT = [];
const WARN = [];
const fail = (m) => STRUCT.push(m);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'portal') walk(f, out); }
    else if (e.name.endsWith('.html')) out.push(f);
  }
  return out;
}

const fileOf = (url) => {
  const rel = url.replace(BASE, '').replace(/^\/+/, '');
  return path.join(DIST, rel.endsWith('/') ? path.join(rel, 'index.html') : rel);
};
const relOf = (file) => '/' + file.slice(DIST.length + 1).replace(/\\/g, '/').replace(/index\.html$/, '');

/** Words that are allowed to appear in Chinese pages: product, game and standard names. */
const ALLOW = new Set([
  'Ealoong', 'Arcade', 'Clockwork', 'Grove', 'Sparkwood', 'Mainspring', 'Steam', 'Discord', 'Valorant', 'Apex',
  'Legends', 'Overwatch', 'Counter', 'Strike', 'Rainbow', 'Six', 'Siege', 'Fortnite', 'Roblox', 'Battlefield',
  'Destiny', 'Team', 'Fortress', 'Call', 'Duty', 'Warzone', 'Dota', 'Cloudflare', 'Web', 'Analytics', 'GitHub',
  'MIT', 'CC', 'BY', 'JSON', 'API', 'GUID', 'DPI', 'FOV', 'FPS', 'eDPI', 'cm', 'yaw', 'UTC', 'AI', 'GPT',
  'URL', 'HTML', 'CSS', 'JS', 'Linux', 'Windows', 'Chrome', 'Edge', 'Safari', 'Firefox', 'iOS', 'Android',
  'SteamID', 'SteamID3', 'SteamID64', 'Microsoft', 'OpenAI', 'Anthropic', 'Google', 'Bing', 'Baidu',
  'Cookie', 'Cookies', 'Markdown', 'WebMCP', 'Beta', 'Pro', 'Tmpl', 'TODO', 'Lv',
]);

function englishLeftovers(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ');
  const runs = text.match(/[A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*){2,}/g) || [];
  const bad = new Set();
  for (const run of runs) {
    const words = run.trim().split(/\s+/);
    if (words.every((w) => ALLOW.has(w.replace(/[.,:;!?)]$/, '')))) continue;
    // ignore runs that are mostly allowed words (e.g. "Steam ID Converter")
    const allowed = words.filter((w) => ALLOW.has(w.replace(/[.,:;!?)]$/, ''))).length;
    if (allowed >= words.length - 1) continue;
    bad.add(run.trim());
    if (bad.size >= 4) break;
  }
  return [...bad];
}

const files = walk(DIST).filter((f) => !/404\.html$/.test(f));
const rels = new Set(files.map(relOf));

let pairs = 0;
for (const file of files) {
  const rel = relOf(file);
  const isZh = rel.startsWith('/zh/');
  const html = fs.readFileSync(file, 'utf8');
  const label = rel;

  // language attribute agrees with the folder
  const lang = (html.match(/<html lang="([^"]+)"/) || [])[1];
  const want = isZh ? 'zh-CN' : 'en';
  if (lang !== want) fail(`${label}: <html lang="${lang || ''}"> should be "${want}"`);

  // counterpart exists
  const other = isZh ? rel.replace(/^\/zh/, '') : (rel === '/' ? '/zh/' : `/zh${rel}`);
  if (!rels.has(other)) fail(`${label}: no counterpart at ${other}`);

  // hreflang links point at the counterparts
  const alt = Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2].replace(BASE, '') || '/']));
  if (alt.en !== (isZh ? other : rel)) fail(`${label}: hreflang en is "${alt.en}", expected "${isZh ? other : rel}"`);
  if (alt['zh-CN'] !== (isZh ? rel : other)) fail(`${label}: hreflang zh-CN is "${alt['zh-CN']}", expected "${isZh ? rel : other}"`);
  if (alt['x-default'] !== (isZh ? other : rel)) fail(`${label}: x-default is "${alt['x-default']}", expected "${isZh ? other : rel}"`);
  pairs++;

  if (isZh) {
    const left = englishLeftovers(html);
    if (left.length) WARN.push(`${label}: English text left in Chinese page — ${left.map((s) => `«${s}»`).join(' ')}`);
  }
}

console.log('');
console.log('  Chinese / English parity');
console.log('  ' + '─'.repeat(60));
console.log(`  Pages ${files.length} · pairs checked ${pairs}`);
if (STRUCT.length) {
  console.log('');
  STRUCT.forEach((m) => console.log(`  ✗ ${m}`));
}
if (WARN.length) {
  console.log('');
  WARN.slice(0, 12).forEach((m) => console.log(`  ! ${m}`));
  if (WARN.length > 12) console.log(`  ! … and ${WARN.length - 12} more`);
}
console.log('  ' + '─'.repeat(60));
console.log(STRUCT.length ? `  ${STRUCT.length} structural problem(s)` : '  structure OK');
if (WARN.length) console.log(`  ${WARN.length} warning(s) — proper nouns are fine, sentences are not`);
console.log('');
process.exit(STRUCT.length ? 1 : 0);
