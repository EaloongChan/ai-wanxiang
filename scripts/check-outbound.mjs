/**
 * 外链健康检查（零依赖）
 *
 *   node scripts/check-outbound.mjs            检查并写入 data/outbound-health.json
 *   node scripts/check-outbound.mjs --dry      只检查不写文件
 *   node scripts/check-outbound.mjs --only tools
 *   node scripts/check-outbound.mjs --limit 30 只查前 N 个（快速冒烟）
 *   node scripts/check-outbound.mjs --self-test 不联网，只验证能正常启动（check.mjs 会跑）
 *
 * 为什么需要它：目录站最容易腐烂的地方就是外链。工具改域名、停售、被收购是常态，
 * 而我们全站有 1000+ 个外链，人工点不过来。
 *
 * 纪律（避免误杀）：
 *   · 连续两次失败才标记「待核验」，一次失败可能只是网络抖动
 *   · 不自动删除任何条目 —— 只报告，人工决定
 *   · 每周跑一次，不是每次构建都跑（省时间也省对方的服务器）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, 'data', 'outbound-health.json');
const DRY = process.argv.includes('--dry');
const onlyArg = process.argv.indexOf('--only');
const ONLY = onlyArg !== -1 ? process.argv[onlyArg + 1] : '';
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : 0;

/* 必须用正常浏览器的 UA，不能用自报家门的 bot UA。
   踩过一次：用 AIWanxiangLinkCheck/1.0 去问，百度系站点（文心一言、文心一格）
   一律回 404，于是报告里「明确失效 5 个」里有 2 个是活得好好的——
   只是人家不想给爬虫好脸色。目录站误报成本极高（会让用户以为某某产品挂了），
   所以用浏览器 UA，换来的代价是站点可能对我们不设防，这不冲突。 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const TIMEOUT = Number(process.env.LINK_TIMEOUT || 6000);
const DELAY = 120; // 对目标站点客气一点

/* 熔断一：连续这么多次「网络层失败」就认为本机网络不可用，直接停下。
   踩过一次：网络很差时每个链接都要等满超时，300 个链接跑了 15 分钟还没完，
   而且结论毫无价值（全是超时）。检查开始前先判断前置条件是否成立。 */
const BREAKER = Number(process.env.LINK_BREAKER || 12);

/* 熔断二：总时间预算。网络半通不通时（部分成功会重置上面的连续计数），
   上面那个熔断不会触发，还是会一路磨下去。所以再加一道硬天花板：
   超时就停下，把已经查到的部分如实报告为「部分结果」。 */
const MAX_MS = Number(process.env.LINK_MAX_MS || 240000); // 默认 4 分钟

/* 不联网的启动自测：只跑「读 JSON → 收集条目 → 打印表头」就退出。
   为什么需要它：2026-09-26 发现表头里引用了后面才 `let` 声明的 kept，于是脚本
   每次运行都在第一行 console.log 抛 "Cannot access 'kept' before initialization"
   —— 整套外链检查其实一次都没跑成过，而 `node --check` 只查语法，查不出 TDZ。
   熔断保护又让它「安静地失败」，所以这个 bug 藏了很久。check.mjs 监听自测输出，
   把「启动即崩」变成能被守卫抓到的问题。 */
const SELFTEST = process.argv.includes('--self-test');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));

/** 网络层失败（不是对方返回 4xx，而是根本没连上） */
const isNetworkError = (r) => !!r.error && !/^HTTP /.test(r.error);

/* ---------- 收集要检查的 URL ---------- */
function collect() {
  const groups = [];

  const tools = read('tools.json');
  groups.push({
    name: '工具官网',
    items: tools.map((t) => ({ id: t.id, name: t.name, url: t.url, kind: 'tool' })),
  });

  const learn = read('learn.json');
  groups.push({
    name: '学习资源',
    items: learn.map((l) => ({ id: l.id, name: l.title, url: l.url, kind: 'learn' })),
  });

  const news = read('news.json');
  groups.push({
    name: '资讯信息源',
    items: (news.sources || []).map((s, i) => ({ id: `news-${i}`, name: s.name, url: s.url, kind: 'news-source' })),
  });

  const feeds = read('feeds.json');
  groups.push({
    name: '实时动态源',
    items: (feeds.sources || []).filter((s) => s.enabled !== false).map((s) => ({ id: s.id, name: s.name, url: s.url, kind: 'feed' })),
  });

  /* --only 支持三种写法：组名关键字（工具/学习/资讯/实时）、kind 值（tool/learn/...）、
     以及它们的英文别名。踩过一次：原先只做 kind 全等匹配，传 `--only tools`
     （复数、英文名）会匹配空集合，脚本静默报告「共 0 个链接」——
     看起来像跑成功、实际什么都没查。 */
  if (!ONLY) return groups;
  const ALIAS = {
    tools: 'tool', tool: 'tool',
    learn: 'learn',
    news: 'news-source', source: 'news-source', sources: 'news-source',
    feed: 'feed', feeds: 'feed',
  };
  const want = ALIAS[ONLY.toLowerCase()] || ONLY.toLowerCase();
  const hit = groups.filter((g) => g.name.includes(ONLY) || g.items.some((i) => i.kind === want));
  if (!hit.length) {
    console.log(`  ✗ --only ${ONLY} 没有匹配到任何分组。`);
    console.log('    可选：' + groups.map((g) => `${g.name}(${g.items[0]?.kind || '—'})`).join(' / '));
    process.exit(2);
  }
  return hit;
}

/* ---------- 检查单个 URL ---------- */
async function probe(url) {
  /** HEAD 优先，很多站点不支持就用 GET 兜底 */
  const attempt = async (method) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
        signal: ctl.signal,
      });
      /* 这些状态码要用 GET 重验，不能拿 HEAD 的结果当结论。
         405/403/501 → 站点不支持 HEAD（原本就有这条）
         404/410     → 后来补的：百度系站点（文心一言 yiyan.baidu.com）对 HEAD 一律回 404，
                        GET 才是 302 跳到新域名。直接采信 HEAD 的结果是灾难性的：
                        我们会把「产品换了域名」报道成「产品已经挂了」，
                        而目录站最不能错的就是这个。只有 GET 也 404 才允许判 dead。 */
      if (method === 'HEAD' && [404, 410, 405, 403, 501].includes(res.status)) return null;
      return { status: res.status, finalUrl: res.url || url };
    } catch (e) {
      return { error: e.name === 'AbortError' ? '超时' : e.message };
    } finally {
      clearTimeout(timer);
    }
  };

  let r = await attempt('HEAD');
  if (r === null) r = await attempt('GET');
  if (!r || (r.error && r.error !== '超时')) {
    // HEAD 直接抛错的话，再用 GET 试一次
    const g = await attempt('GET');
    if (g && !g.error) r = g;
  }
  return r || { error: '未知失败' };
}

/* ---------- 主流程 ---------- */
async function main() {
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { checkedAt: '', items: {} };
  const prev = state.items || {};

  const groups = collect();
  let all = groups.flatMap((g) => g.items);
  if (LIMIT) all = all.slice(0, LIMIT);

  const next = {};
  /* 局部检查（--only / --limit）必须保留没被选中的旧记录。
     踩过一次：`next` 一律从空对象开始，一次 `--only tools` 就把 learn / 资讯源
     / RSS 的检查结果整批抹掉，而周报会照着这份残缺数据说话 —— 看起来像"其他链接都健康"。
     全量跑时 selected 覆盖全部条目，自然没有任何旧数据被留下（下线的内容会被清理）。 */
  const selected = new Set(all.map((x) => x.id));
  /* kept 必须在下面的表头打印之前算好：这里曾把 `let kept = 0` 放在表头之后，
     于是每次(含无参全量跑)都在第一行 console.log 处抛
     "Cannot access 'kept' before initialization"，整套外链检查直接不执行。 */
  let kept = 0;
  if (ONLY || LIMIT) {
    for (const [id, v] of Object.entries(prev)) {
      if (!selected.has(id)) { next[id] = v; kept++; }
    }
  }

  console.log('');
  console.log('  外链健康检查');
  console.log('  ' + '─'.repeat(60));
  console.log(`  共 ${all.length} 个链接${ONLY ? `（限定 ${ONLY}）` : ''}${kept ? `，另有 ${kept} 条沿用上次结果（本轮未重查）` : ''}`);
  if (state.checkedAt) console.log(`  上次检查 ${String(state.checkedAt).slice(0, 16).replace('T', ' ')}`);
  console.log('');

  if (SELFTEST) {
    console.log(`  自测通过：收集到 ${all.length} 个链接，未发起任何网络请求。`);
    console.log('');
    return;
  }

  const okList = [];
  const softFail = [];   // 第一次失败
  const hardFail = [];   // 连续两次失败 → 待核验
  const moved = [];      // 有效但有跳转
  let netErrors = 0;     // 连续网络层失败计数，用于熔断
  const t0 = Date.now();
  let timedOut = false;

  for (let i = 0; i < all.length; i++) {
    // ---- 熔断二：总时间预算 ----
    if (Date.now() - t0 > MAX_MS) {
      timedOut = true;
      console.log('');
      console.log(`  ! 已用满 ${Math.round(MAX_MS / 1000)} 秒时间预算，停在 ${i} / ${all.length}。`);
      console.log('    下面是**部分结果**。要完整的就放到 GitHub Actions 上跑（那边网络通畅），');
      console.log('    或本地用 --limit N 只抽查一部分。');
      break;
    }

    const it = all[i];
    const r = await probe(it.url);
    const ok = r.status && r.status >= 200 && r.status < 400;
    const movedUrl = ok && r.finalUrl && r.finalUrl !== it.url && r.finalUrl.replace(/\/$/, '') !== it.url.replace(/\/$/, '');

    /* 结论分三档，不能只有「正常/坏了」两档：
       目录站最怕误杀。403/429/401 往往是反爬、地区限制或鉴权，不是链接失效；
       超时/连不上更只能算「没验证成」。只有 404/410 这种明确信号才叫 dead。
       在国内网络下跑，这一栏的区别决定了页面上是写「官网可能已失效」还是「未能验证」。 */
    const verdict = ok ? (movedUrl ? 'moved' : 'ok')
      : r.status === 404 || r.status === 410 ? 'dead'
      : 'unknown';

    // ---- 熔断判断 ----
    if (isNetworkError(r)) {
      netErrors++;
      if (netErrors >= BREAKER) {
        console.log('');
        console.log('  ' + '─'.repeat(60));
        console.log(`  ✗ 连续 ${BREAKER} 个链接都是网络层失败（不是对方返回错误，是根本连不上）。`);
        console.log('    本机网络当前访问外网不可用，继续跑下去只会耗时间而且结论没有意义。');
        console.log(`    已检查 ${i + 1} / ${all.length}，结果未写入（避免用错误数据覆盖上次的好结果）。`);
        console.log('');
        console.log('    这个检查本来就设计成在 GitHub Actions 上跑（那边网络通畅，结果才可信）：');
        console.log('    https://github.com/EaloongChan/listingboost-ai/actions');
        console.log('');
        process.exit(2);
      }
    } else {
      netErrors = 0; // 只要有一个请求成功过（哪怕对方 404），就重置计数
    }

    next[it.id] = {
      name: it.name,
      url: it.url,
      status: ok ? r.status : (r.status || 0),
      finalUrl: r.finalUrl || it.url,
      error: r.error || '',
      verdict,
      checkedAt: new Date().toISOString(),
      failCount: ok ? 0 : (prev[it.id]?.failCount || 0) + 1,
    };

    if (ok) {
      okList.push(it);
      if (movedUrl) moved.push({ ...it, to: r.finalUrl });
    } else if (verdict === 'dead' || next[it.id].failCount >= 2) {
      hardFail.push({ ...it, err: r.error || `HTTP ${r.status}` });
    } else {
      softFail.push({ ...it, err: r.error || `HTTP ${r.status}` });
    }

    if ((i + 1) % 25 === 0) process.stdout.write(`    …已检查 ${i + 1}/${all.length}\n`);
    await sleep(DELAY);
  }

  /* ---------- 报告 ---------- */
  console.log('');
  console.log('  ' + '─'.repeat(60));
  console.log(`  正常            ${okList.length}`);
  console.log(`  明确失效        ${hardFail.filter((x) => next[x.id]?.verdict === 'dead').length}（404/410，页面应提示用户）`);
  console.log(`  首次失败        ${softFail.length}${softFail.length ? '（可能只是抖动，下次复查）' : ''}`);
  console.log(`  连续失败待核验   ${hardFail.length}${hardFail.length ? '  ← 需要人工确认' : ''}`);
  console.log(`  无法判定        ${Object.values(next).filter((x) => x.verdict === 'unknown').length}（403/429/超时——是反爬或网络问题，不是链接坏了）`);
  console.log(`  跳到别处        ${moved.length}${moved.length ? '（建议更新数据里的 URL）' : ''}`);

  if (hardFail.length) {
    console.log('');
    console.log('  连续两次失败，建议人工确认：');
    hardFail.slice(0, 30).forEach((x) => console.log(`    ${x.name.padEnd(22)} ${x.err.padEnd(12)} ${x.url}`));
    if (hardFail.length > 30) console.log(`    … 还有 ${hardFail.length - 30} 个`);
  }
  if (moved.length) {
    console.log('');
    console.log('  有跳转（可能已改域名）：');
    moved.slice(0, 20).forEach((x) => console.log(`    ${x.name.padEnd(22)} → ${x.to}`));
    if (moved.length > 20) console.log(`    … 还有 ${moved.length - 20} 个`);
  }

  if (DRY || timedOut) {
    console.log('');
    console.log(DRY ? '  --dry：未写入 data/outbound-health.json' : '  部分结果未写盘（不覆盖上次的完整结果）');
    console.log('');
    return;
  }

  fs.writeFileSync(STATE, JSON.stringify({ checkedAt: new Date().toISOString(), items: next }, null, 2) + '\n', 'utf8');
  console.log('');
  console.log('  已写入 data/outbound-health.json');
  console.log('');
}

main().catch((e) => {
  console.error('  检查失败：', e.message);
  process.exit(1);
});
