/**
 * 内链可达性审计（孤儿页检测，零依赖，直接扫 dist/）。
 *
 *   node scripts/orphans.mjs
 *
 * links.mjs 查的是「链出去的地址存不存在」（断链）；这里查的是反过来：
 * **有没有任何页面的正文链到它**（孤儿）。孤儿页能通过 sitemap 被发现，但拿不到内链权重，
 * 而且新页面上线时最容易漏挂入口。
 *
 * 判定口径：
 *   · 只看 <a href> 的站内链接，不数 sitemap
 *   · 导航和页脚几乎每页都有，只靠它们进来的页面单独标出来（等于没有正文内链）
 *   · noindex 页面不需要排名，单独标注
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const BASE = (process.env.SITE_BASE || 'https://www.ealoongchan.top').replace(/\/$/, '');

if (!fs.existsSync(DIST)) {
  console.error('  dist/ 不存在，请先构建');
  process.exit(1);
}

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) walk(f, out);
    else if (e.name.endsWith('.html') && !f.includes('/portal/')) out.push(f);
  }
  return out;
}

const siteUrl = (f) => '/' + f.slice(DIST.length + 1).replace(/index\.html$/, '');

const files = walk(DIST);
const pages = new Map();
for (const f of files) {
  // 导航与页脚是全站链接：去掉后再看，才知道正文里到底链没链。
  let html = fs.readFileSync(f, 'utf8').replace(/<header class="header">[\s\S]*?<\/header>/, '').replace(/<footer class="footer">[\s\S]*?<\/footer>/, '');
  const url = siteUrl(f);
  const hrefs = [...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map((m) => m[1]);
  const internal = hrefs
    .filter((h) => h.startsWith('/') || h.startsWith(BASE))
    .map((h) => (h.startsWith(BASE) ? h.slice(BASE.length) || '/' : h))
    .map((h) => h.split('#')[0].split('?')[0])
    .filter((h) => h && !/\.(png|jpg|svg|ico|css|js|json|xml|txt|webp|woff2?)$/i.test(h));
  pages.set(url, { file: f, hrefs: internal, noindex: /<meta name="robots" content="[^"]*noindex/.test(html) });
}

const COUNT = pages.size;
const inbound = new Map();
for (const [from, p] of pages) {
  for (const h of new Set(p.hrefs)) {
    if (!inbound.has(h)) inbound.set(h, new Set());
    inbound.get(h).add(from);
  }
}

const orphans = [];
const weak = [];
for (const [url, p] of pages) {
  if (url === '/404.html' || url === '/404/') continue;
  const from = inbound.get(url);
  const n = from ? from.size : 0;
  if (n === 0) orphans.push({ url, noindex: p.noindex });
  else if (n <= 1) weak.push({ url, n, noindex: p.noindex });
}
orphans.sort((a, b) => a.url.localeCompare(b.url));
weak.sort((a, b) => a.n - b.n || a.url.localeCompare(b.url));

console.log('');
console.log('  内链可达性');
console.log(`  页面总数      ${COUNT}`);
console.log(`  有正文内链    ${COUNT - orphans.length}`);
console.log('');

if (orphans.length) {
  const real = orphans.filter((x) => !x.noindex);
  console.log(`✗ 孤儿页（没有任何正文链接指向）${orphans.length} 个，其中需要排名的 ${real.length} 个：`);
  orphans.forEach((x) => console.log(`    ${x.url}${x.noindex ? '  [noindex]' : ''}`));
} else {
  console.log('✓ 没有孤儿页');
}
if (weak.length) {
  console.log('');
  console.log(`! 正文内链只有 1 个来源的页面 ${weak.length} 个：`);
  weak.forEach((x) => console.log(`    ${x.url}${x.noindex ? '  [noindex]' : ''}`));
}
console.log('');

if (orphans.filter((x) => !x.noindex).length) process.exit(1);
