/**
 * GitHub 热榜取数（零依赖，只读，不写任何文件）
 *
 *   node scripts/trending.mjs                 周榜 + AI 相关过滤（默认）
 *   node scripts/trending.mjs --since daily   日榜
 *   node scripts/trending.mjs --since monthly 月榜
 *   node scripts/trending.mjs --all           不过滤 AI，全部列出
 *   node scripts/trending.mjs --json          输出 JSON（给自动化/其它脚本用）
 *
 * 为什么要有这个脚本：周榜巡检如果每次让 AI 现抓 HTML 现写解析，既慢又每次都可能解析错。
 * 脚本负责「取数 + 去重 + 初筛」，AI 只负责「判断哪几条值得收录、写解读」——
 * 和项目里其它脚本一样的分工（判定逻辑在脚本里，调度层只搬运）。
 *
 * 数据来源是 github.com/trending 的页面（无官方 API）。
 * **解析锚点依赖页面结构，所以做了强校验**：解析出的条目少于 5 条就直接报错退出，
 * 而不是安静地返回空列表 —— 那样会被当成「这周没有热门项目」。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argOf = (n, d) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : d; };
const SINCE = argOf('--since', 'weekly');
const ALL = process.argv.includes('--all');
const JSON_OUT = process.argv.includes('--json');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/* AI 相关初筛关键词。宁可宽一点：漏掉比误报更麻烦（误报由后续人工/AI 判断剔除）。 */
const AI_WORDS = [
  'ai', 'llm', 'gpt', 'claude', 'gemini', 'llama', 'qwen', 'deepseek', 'mistral',
  'agent', 'agentic', 'rag', 'mcp', 'prompt', 'embedding', 'inference', 'diffusion',
  'transformer', 'neural', 'machine-learning', 'deep-learning', 'ml', 'nlp', 'vision',
  'multimodal', 'whisper', 'tts', 'speech', 'voice', 'ocr', 'copilot', 'chatbot',
  'fine-tune', 'finetune', 'quantization', 'vllm', 'ollama', 'langchain', 'vector',
  'openai', 'anthropic', 'huggingface', 'pytorch', 'tensorflow', 'cuda', 'gpu',
];

/* 站内已收录的 url 集合，用来去重。比较时统一成 github.com/owner/repo 形式。 */
function loadKnown() {
  const known = new Map();
  const put = (url, what, label) => {
    if (!url) return;
    const m = String(url).match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (m) known.set(`${m[1]}/${m[2]}`.toLowerCase(), `${what}:${label}`);
  };
  const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8')); } catch { return null; } };
  const tools = read('tools.json') || [];
  for (const t of tools) put(t.url, '工具', t.name);
  const learn = read('learn.json') || [];
  for (const l of learn) put(l.url, '学习', l.title);
  const news = read('news.json');
  for (const n of (news && news.items) || []) put(n.url, '资讯', n.title);
  const feeds = read('feeds.json');
  for (const s of (feeds && feeds.sources) || []) put(s.url, '资讯源', s.name);
  return known;
}

function parse(html) {
  const decode = (s) => String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  const out = [];
  const blocks = html.split('<article class="Box-row">').slice(1);
  for (const b of blocks) {
    const body = b.slice(0, b.indexOf('</article>'));
    /* 先在 <h2> 区块内部取 href，别用「<h2> 后面紧跟 <a href」那种写法：
       GitHub 的 <a> 前面还挂着 300 多字符的 data-hydro-click，紧跟匹配永远不中。
       踩过一次：正则不中 → 解析结果为空 → 被守卫拦下（守卫救了这一次）。 */
    const h2s = body.indexOf('<h2');
    const h2e = body.indexOf('</h2>');
    const h2 = h2s !== -1 && h2e > h2s ? body.slice(h2s, h2e) : '';
    const name = (h2.match(/href="\/([^"]+)"/) || [])[1];
    if (!name) continue;
    const desc = decode(((body.match(/<p class="col-9[^"]*">([\s\S]*?)<\/p>/) || [])[1] || '')
      .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    const lang = (body.match(/itemprop="programmingLanguage">([^<]+)</) || [])[1] || '—';
    const total = (body.match(/stargazers"[^>]*>[\s\S]*?([\d,]+)\s*<\/a>/) || [])[1] || '';
    const week = (body.match(/([\d,]+)\s*stars (this week|today|this month)/) || [])[1] || '';
    const num = (s) => (s ? Number(String(s).replace(/,/g, '')) : 0);
    out.push({ fullName: name, url: `https://github.com/${name}`, desc, lang, stars: num(total), gained: num(week) });
  }
  return out;
}

const res = await fetch(`https://github.com/trending?since=${SINCE}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } });
if (!res.ok) {
  console.error(`  ✗ 抓取失败：HTTP ${res.status}`);
  process.exit(1);
}
const html = await res.text();
const repos = parse(html);

/* 强校验：页面结构一变，解析就会静默返回空数组，而那看起来像「这周没热门项目」。 */
if (repos.length < 5) {
  console.error(`  ✗ 只解析到 ${repos.length} 个仓库（正常应 ≥ 20）。`);
  console.error('    GitHub 的页面结构可能变了，或返回的是登录/验证页。请更新本脚本的解析锚点。');
  process.exit(1);
}

const known = loadKnown();
const hitAI = (r) => {
  const hay = `${r.fullName} ${r.desc}`.toLowerCase();
  return AI_WORDS.some((w) => new RegExp(`(^|[^a-z])${w}([^a-z]|$)`).test(hay));
};

const rows = repos.map((r) => ({
  ...r,
  ai: hitAI(r),
  known: known.get(r.fullName.toLowerCase()) || '',
})).filter((r) => ALL || r.ai)
  .sort((a, b) => b.gained - a.gained);

if (JSON_OUT) {
  console.log(JSON.stringify({ since: SINCE, fetchedAt: new Date().toISOString(), count: rows.length, repos: rows }, null, 2));
  process.exit(0);
}

const label = { daily: '日榜', weekly: '周榜', monthly: '月榜' }[SINCE] || SINCE;
console.log('');
console.log(`  GitHub ${label} · AI 相关${ALL ? '（未过滤）' : ''}`);
console.log('  ' + '─'.repeat(66));
console.log(`  数据源  https://github.com/trending?since=${SINCE}`);
console.log(`  解析到  ${repos.length} 个仓库，其中 AI 相关 ${rows.length} 个`);
console.log('');
const NEW = rows.filter((r) => !r.known);
const HAS = rows.filter((r) => r.known);
const line = (r, i) => {
  console.log(`  ${String(i + 1).padStart(2)}. ${r.fullName}${r.known ? '   ← 已收录(' + r.known + ')' : ''}`);
  console.log(`      +${r.gained} 星/周 · 共 ${r.stars} · ${r.lang}`);
  if (r.desc) console.log(`      ${r.desc.slice(0, 92)}`);
};
console.log(`  【尚未收录 ${NEW.length} 个】`);
if (!NEW.length) console.log('    （无）');
NEW.forEach(line);
if (HAS.length) {
  console.log('');
  console.log(`  【站内已有 ${HAS.length} 个】`);
  HAS.forEach(line);
}
console.log('');
console.log(`  JSON：node scripts/trending.mjs --json`);
console.log('');
