/**
 * 国际化基础层（零依赖）
 *
 * 语言与 URL 的约定：
 *   · 英文是默认语言，地址就是原路径          /tools/sens-converter/
 *   · 中文加 /zh 前缀                          /zh/tools/sens-converter/
 *   这样英文站不受影响（海外流量和搜索结果都指向根路径），中文只是并列的一套。
 *
 * 内容组织约定：
 *   · data/*.json 里的每条记录，英文写在顶层字段，中文写在同级的 zh 对象里
 *   · 缺中文时回落英文，不会出现空页面（check.mjs 会同时检查完整性，缺了会报出来）
 */

export const LANGS = ['en', 'zh'];
export const DEFAULT_LANG = 'en';

/** <html lang> 与 hreflang 用的取值。 */
export const LANG_ATTR = { en: 'en', zh: 'zh-CN' };

/** 在界面里显示的语言名，始终是「另一种语言」的名字。 */
export const LANG_LABEL = { en: 'English', zh: '中文' };

/** 给某个路径加上语言前缀。 */
export function loc(path, lang) {
  if (lang === 'en') return path;
  return path === '/' ? '/zh/' : `/zh${path}`;
}

/** 从路径里取语言，并返回去掉前缀后的规范路径。 */
export function parsePath(pathname) {
  if (pathname === '/zh' || pathname === '/zh/') return { lang: 'zh', path: '/' };
  if (pathname.startsWith('/zh/')) return { lang: 'zh', path: pathname.slice(3) };
  return { lang: 'en', path: pathname };
}

/** 同一条内容在另一种语言里的地址，用于语言切换按钮与 hreflang。 */
export function counterpart(path, lang) {
  return loc(parsePath(path).path, lang);
}

/** 取一条记录里的某个字段：中文优先取 zh，缺了回落英文。 */
export function pick(record, key, lang) {
  if (!record) return undefined;
  if (lang === 'zh' && record.zh && record.zh[key] !== undefined) return record.zh[key];
  return record[key];
}

/** 把 {name} 这类占位符替换成实际值；未知占位符原样保留，方便一眼看出漏填。 */
export function fill(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/**
 * 正文里的站内链接在中文页要指向中文版。
 * 作者只写一次 /contact/，中文渲染时自动变成 /zh/contact/；
 * 外链、/api/、/assets/、/fonts/ 这些与语言无关的路径保持原样。
 */
export function localizeLinks(html, lang) {
  if (lang !== 'zh') return html;
  return String(html).replace(/href="\/(?!zh\/|api\/|assets\/|fonts\/)/g, 'href="/zh/');
}
