import { esc, jsonEmbed, metaExcerpt } from './utils.mjs';
import { icon, iconSprite } from './icons.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* 每页专属分享图：public/og/<slug>.png（由 scripts/og-images.mjs 生成）。
   约定是「路径里的 / 换成 -」，例如 /playbooks/pb-ai-video/ → playbooks-pb-ai-video.png。
   找不到就回落到全站那张 /og.png —— 分享图缺失不该让页面出错。
   为什么在这里 stat 而不是让每个页面自己传：新增页面时没人会记得传，
   而这一层兜底能让「以后新增的页面」自动享受同样的待遇。 */
const OG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'og');
const perPageOg = (p) => {
  const slug = String(p || '/').replace(/^\/+|\/+$/g, '').replace(/\//g, '-') || 'home';
  return fs.existsSync(path.join(OG_DIR, slug + '.png')) ? `/og/${slug}.png` : '';
};

/** og:locale 要写成 zh_CN / en_US 这种带地区的格式，光写 en 不规范 */
const ogLocale = (lang) => ({ 'zh-CN': 'zh_CN', zh: 'zh_CN', en: 'en_US', 'en-US': 'en_US' }[lang] || lang);

/**
 * 页面外壳
 *
 * 注意顺序：icon() 会把用到的图标名登记到 icons.mjs 的 used 集合里，
 * 而 sprite 必须在任何 <use> 之前出现。所以这里先把 header / footer 的
 * HTML 拼出来（顺便登记它们的图标），最后再插 sprite 到 <body> 开头。
 *
 * @param {object} o
 * @param {object} o.site      站点配置
 * @param {string} o.title     页面标题
 * @param {string} o.description
 * @param {string} o.path      当前路径，如 /tools/
 * @param {string} o.body      body 内部 HTML
 * @param {string} [o.head]    额外 <head> 内容
 * @param {string} [o.scripts] 额外脚本
 * @param {object} [o.jsonld]  结构化数据（对象或数组）
 * @param {object} [o.pageType] og:type
 * @param {string} [o.ogImage] 社交分享图
 * @param {string} [o.lang]    页面语言，默认取站点 locale
 */
export function layout(o) {
  const {
    site, title, description = '', path = '/', body = '',
    head = '', scripts = '', jsonld = null, pageType = 'website', ogImage = '',
    lang = '',
    navItems = null,
    footerLinks = null,
    altPath = '',
    altLang = '',
    altLabel = '',
    searchHref = '/search/',
    searchLabel = '全站搜索',
    searchText = '搜索',
    hideSearch = false,
    themeLabel = '切换深浅主题',
    menuLabel = '打开菜单',
    brandHref = '/',
    brandDesc = '',
    brandName = '',
    brandSlogan = '',
    robots = '',
    navLabel = '主导航',
    skipLabel = '跳到主要内容',
    footerNavTitle = '站内导航',
    footerCopyright = '',
    footerLicense = '',
    footerMore = [{ label: 'AI 术语表', href: '/glossary/' }, { label: 'RSS 订阅', href: '/feed.xml' }],
    footerData = [
      { label: '全站数据', href: '/api/index.json' },
      { label: '工具数据', href: '/api/tools.json' },
      { label: '提示词数据', href: '/api/prompts.json' },
      { label: '搜索索引', href: '/api/search.json' },
    ],
    crumbLabel = '面包屑',
  } = o;

  const bName = brandName || site.brand.name;
  const fullTitle = title ? `${title} · ${bName}` : `${bName} · ${brandSlogan || site.brand.slogan}`;
  /* 搜索结果大约只显示 160 字符，写再长也会被截断 —— 不如自己截在句子边界上，
     至少读出来是完整的一句。放在这里兜底，是为了让「以后新增的页面」也自动遵守，
     而不是每个页面各自记得调一次。 */
  const desc = metaExcerpt(description || site.brand.description, 160);
  const base = (site.baseUrl || '').replace(/\/$/, '');
  const canonical = base ? base + path : path;
  const theme = site.theme?.default || 'light';
  const own = ogImage || perPageOg(path);
  const og = own
    ? (/^https?:/.test(own) ? own : base + own)
    : (base ? `${base}/og.png` : '/og.png');
  const pageLang = lang || site.locale || 'zh-CN';
  /* altLang 默认按当前页语言反推，而不是留空。
     踩过的坑（2026-09-21）：中文页加了 altPath 但忘了传 altLang，结果输出
     `hreflang=""` —— 属性是空的，Google 直接忽略，而且语言切换按钮的
     hreflang/lang 也是空的。这类「少传一个参数就静默产出无效标签」的写法
     不该靠调用者自觉，所以在源头给默认值。显式传入的仍然优先。 */
  const resolvedAltLang = altLang || (pageLang.startsWith('en') ? 'zh-CN' : 'en');
  // 带内容哈希的资源名（由 build.mjs 算好挂在 site 上）。缺省值保证单独调用 layout 时也不炸。
  const a = site.asset || { css: 'main.css', print: 'print.css', js: 'app.js' };
  const canonicalFor = (p) => (base ? base + p : p);

  const navList = navItems || site.nav || [];
  const nav = navList
    .map((n) => {
      const active = path === n.href || (n.href !== '/' && path.startsWith(n.href));
      return `<a href="${esc(n.href)}"${active ? ' class="active"' : ''}${active ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`;
    })
    .join('');

  const footLinks = footerLinks || site.footer?.links || [];
  const footHtml = footLinks
    .map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
    .join('');

  const ldArray = jsonld ? (Array.isArray(jsonld) ? jsonld : [jsonld]) : [];
  const structured = ldArray
    .map((d) => `<script type="application/ld+json">${jsonEmbed(d)}</script>`)
    .join('\n');

  // --- 先拼 header / footer（这一步会登记它们的图标） ---
  const logoMark = `<span class="logo-mark" aria-hidden="true">${esc(site.brand.logoText || '象')}</span>`;
  const logoText = site.brand.forceText === false ? ''
    : `<span class="logo-text"><span>${esc(site.brand.name)}</span><small>${esc(site.brand.nameEn || '')}</small></span>`;

  const header = `<header class="header">
  <div class="container header-inner">
    <a class="logo" href="${esc(brandHref)}" aria-label="${esc(site.brand.name)}">
      ${logoMark}${logoText}
    </a>
    <nav class="nav" id="nav" aria-label="${esc(navLabel)}">${nav}</nav>
    <div class="header-actions">
      ${hideSearch ? '' : `<a class="quick-search" href="${esc(searchHref)}" aria-label="${esc(searchLabel)}">
        ${icon('search', 14)}<span>${esc(searchText)}</span><kbd>/</kbd>
      </a>`}
      ${altPath ? `<a class="icon-btn lang-btn" href="${esc(altPath)}" hreflang="${esc(resolvedAltLang)}" lang="${esc(resolvedAltLang)}" aria-label="${esc(altLabel || 'Switch language')}" title="${esc(altLabel || 'Switch language')}">${icon('globe', 16)}</a>` : ''}
      <button class="icon-btn" id="themeBtn" aria-label="${esc(themeLabel)}" title="${esc(themeLabel)}">
        <span class="ic-sun">${icon('sun', 16)}</span>
        <span class="ic-moon" style="display:none">${icon('moon', 16)}</span>
      </button>
      <button class="icon-btn menu-btn" id="menuBtn" aria-label="${esc(menuLabel)}" aria-expanded="false" aria-controls="nav">${icon('menu', 18)}</button>
    </div>
  </div>
</header>`;

  const footer = `<footer class="footer">
  <div class="container">
    <div class="footer-inner">
      <div class="footer-brand">
        <a class="logo" href="${esc(brandHref)}">${logoMark}${logoText}</a>
        <p>${esc(brandDesc || site.brand.description)}</p>
      </div>
      <h2 class="sr-only">${esc(site.footer?.navTitle || footerNavTitle)}</h2>
      <div class="footer-links">
        <div class="footer-col">
          <h3>${esc(site.footer?.browseTitle || '')}</h3>
          ${navList.map((n) => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join('')}
        </div>
        <div class="footer-col">
          <h3>${esc(site.footer?.moreTitle || '')}</h3>
          ${footHtml}
          ${footerMore.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}
        </div>
        <div class="footer-col">
          <h3>${esc(site.footer?.dataTitle || '')}</h3>
          ${footerData.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>${esc(footerCopyright || site.footer?.copyright || '')}</span>
      <span>${site.footer?.icp ? esc(site.footer.icp) + ' · ' : ''}${esc(footerLicense || site.footer?.note || '数据以 JSON 开放，可自由取用')}</span>
    </div>
  </div>
</footer>`;

  // 到这里本页所有图标都已登记，可以安全生成 sprite
  const sprite = iconSprite();

  /* hreflang 三件套，顺序与语义都不能错：
       · 自身语言   → 指向本页 canonical
       · 另一语言   → 指向对应版本
       · x-default → 指向默认版本（我们把中文当默认）
     踩过的坑：第二行原本写的是「另一个语言」而不是「自身语言」，导致中文页输出两条
     hreflang="en"（一条对、一条指向自己），且完全没有 zh-CN，524 个页面受影响。
     注意：注释必须写在模板字符串外面。写在里面就变成页面上能看见的文本了（已踩过一次）。
     links.mjs 里有断言守卫，改这里务必跑一遍。 */
  return `<!DOCTYPE html>
<html lang="${esc(pageLang)}" data-theme="${esc(theme)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#f3f1ea" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0d0d0b" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
${robots ? `<meta name="robots" content="${esc(robots)}">` : ''}
${/* 搜索引擎验证。token 存在 site.config.json 的 verify 段里，留空就不输出。 */''}
${site.verify && site.verify.google ? `<meta name="google-site-verification" content="${esc(site.verify.google)}">` : ''}
${site.verify && site.verify.bing ? `<meta name="msvalidate.01" content="${esc(site.verify.bing)}">` : ''}
${site.verify && site.verify.baidu ? `<meta name="baidu-site-verification" content="${esc(site.verify.baidu)}">` : ''}
${site.verify && site.verify.file ? `<meta name="google-site-verification" content="${esc(site.verify.file)}">` : ''}
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ''}
<link rel="alternate" type="application/rss+xml" title="${esc(site.brand.name)}" href="/feed.xml">
${altPath ? `<link rel="alternate" hreflang="${esc(pageLang)}" href="${esc(canonical)}">
<link rel="alternate" hreflang="${esc(resolvedAltLang)}" href="${esc(canonicalFor(altPath))}">
<link rel="alternate" hreflang="x-default" href="${esc(pageLang.startsWith('en') ? canonicalFor(altPath) : canonical)}">` : ''}
<meta property="og:type" content="${esc(pageType)}">
<meta property="og:site_name" content="${esc(site.brand.name)}">
<meta property="og:locale" content="${esc(ogLocale(pageLang))}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">` : ''}
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(fullTitle)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(og)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/ibm-plex-sans-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/ibm-plex-mono-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/${esc(a.css)}">
<link rel="stylesheet" href="/assets/${esc(a.print)}" media="print">
<script>
(function(){try{
var q=new URLSearchParams(location.search).get('theme');
var t=(q==='dark'||q==='light')?q:localStorage.getItem('aiwx-theme');
if(t!=="dark"&&t!=="light"){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches)?'light':${JSON.stringify(theme)}}
document.documentElement.setAttribute('data-theme',t);
if(q==='dark'||q==='light'){try{localStorage.setItem('aiwx-theme',t)}catch(e){}}
}catch(e){}})();
</script>
${head}
${structured}
</head>
<body>

${sprite}

<a href="#main" class="skip-link">${esc(site.skipLabel || skipLabel)}</a>

${header}

<main class="main" id="main">
${body}
</main>

${footer}

<script src="/assets/${esc(a.js)}" defer></script>
${scripts}
</body>
</html>`;
}
