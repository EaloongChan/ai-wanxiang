# Ealoong Arcade

免费网页游戏站，附带几个玩家向的小工具。**默认英文，中文在 `/zh/` 下**。线上地址：<https://www.ealoongchan.top>。

- **游戏**：Clockwork Grove / 发条森林（放置类伐木经营）。点树、买升级、解锁区域、传承重开。
- **工具**：灵敏度换算、视野角换算、Steam ID 转换、Discord 时间戳、提示词模板。
- **零第三方依赖**：`package.json` 没有 dependencies，全部用 Node 内置模块和原生 HTML/CSS/JS。
- **先渲染再部署**：构建产出纯静态文件到 `dist/`，部署到 Vercel。

## 目录

```
data/                 内容与数值，全部在这里改
  site.config.json      站点名、域名、导航、搜索引擎验证 token
  games.json            游戏清单与文案
  games/<id>/config.json  游戏的全部数值
  tools.json            工具清单、文案、客户端数据
  pages.json           关于 / 联系 / 隐私
  legacy/              旧站（AI 万象）的开放数据集，仍输出到 /api/legacy/
  legacy-sitemap.xml   重建前线上旧地址的快照，用来生成跳转
src/
  lib/                 页面模板（layout / pages / components / icons / utils）
  lib/i18n.mjs         语言与路径约定、取值回落、给正文里的站内链接加 /zh
  lib/strings.mjs      全站固定文案（导航、按钮、表头、提示、报错），每条都是 {en, zh}
  styles/              main.css（站点）· game.css（游戏，自包含）· portal.css · print.css
  scripts/app.js       全站脚本（只有手机端菜单）
  game/<id>/           logic.js（纯规则）· view.js（Canvas）· main.js（主循环与界面）
  tools/<id>/          core.js（纯计算）· ui.js（界面）· core.test.js
scripts/
  build.mjs            构建：页面、打包、sitemap、门户包（--target=portal 只出门户包）
  redirects.mjs        由旧 sitemap 生成 vercel.json 的跳转规则，并校验
  check.mjs            数据与配置校验
  selftest.mjs         真实浏览器交互测试（需要先启动 serve）
  audit / a11y / perf / links / orphans   页面审计、无障碍、体积、内链、孤儿页
  sim.mjs              无头重放一个典型玩家，看各区解锁与传承的时间点
  og-images.mjs / assets.mjs               分享图与图标（需要本机 Chrome）
  indexnow.mjs / verify-live.mjs / deploy-push.mjs   推送搜索 / 线上验证 / 推送
public/               字体、图标、封面、分享图（og/）
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm run preview` | 构建并启动本地预览 <http://127.0.0.1:4173> |
| `npm run verify` | 上线前的全量校验：数据 → 单元测试 → 构建 → 内链 → 孤儿页 → 体积 |
| `npm run verify:browser` | 浏览器检查：交互测试 → 页面审计 → 无障碍（需先启动预览） |
| `npm run sim` | 重放节奏，看第一个升级、各区解锁、传承分别在第几分钟 |
| `npm run seo` / `npm run i18n` | 页面级 SEO 断言 / 中英互指与残留英文检查 |
| `npm run portal:kit` | 生成门户提交材料：描述、标签、两种尺寸截图（输出到 `build/portal-kit/`） |
| `npm run verify:live` | 部署后验证线上：页面、跳转、安全头、SEO 字段 |
| `npm run push` | 推送上线。推送前会自动跑一遍全量校验，不过就不推 |

也可以直接双击根目录的三个 `.bat`：`打开网站.bat`（构建并预览）、`重新构建.bat`（构建并校验）、`推送到线上.bat`。

## 多语言

- **地址**：英文是默认，就在根路径；中文一律加 `/zh` 前缀（`/tools/x/` 与 `/zh/tools/x/`）。每个页面都带 `hreflang` 三向标注（en、zh-CN、x-default→英文），`sitemap.xml` 里也写了同样的标注。
- **内容**：`data/*.json` 每条记录的英文写在顶层，中文写在同级的 `zh` 对象里（`{"name": "Clockwork Grove", "zh": {"name": "发条森林"}}`）。缺中文会回落英文，不会出现空白；`npm run check` 会逐条比对结构，漏翻译直接报错。
- **固定文案**：`src/lib/strings.mjs`，扁平键名，每条 `{en, zh}`。模板里用 `T(lang, 'nav.games')`。
- **游戏与工具脚本**：构建时为每种语言各打一份，只带这一种语言用到的文案前缀（游戏 `gr.`，工具 `tu.` `err.` `copy.`），并把另一种语言的名字从配置里剔掉。
- **语言按钮**：页头的胶囊链接指向同一页面的另一种语言，不写 cookie、不做自动跳转 —— 自动跳转会让搜索引擎和误入的读者都落到错的语言上。要记住读者的选择，可以之后再加，但要接受这个代价。
- **加第三种语言**：在 `src/lib/i18n.mjs` 的 `LANGS` / `LANG_ATTR` / `LANG_LABEL` 各加一项，`strings.mjs` 每条补一个键，`data/` 每条记录加一个同名字段（例如 `ja`），`pick()` 的回落顺序改成按语言取值，最后跑 `npm run og` 生成分享图。

## 改东西从哪里下手

- **改文案**：只改 `data/` 下的 JSON，构建时会填进页面。游戏说明里的 `{{comboStep}}` 这类占位符会从游戏配置里取值，避免文案和数值对不上；中英文各写一份。
- **调游戏数值**：改 `data/games/lumber-tycoon/config.json`，然后跑 `npm run sim` 看节奏，再跑 `npm run unit`。节奏测试的上下限在 `logic.test.js` 里，是有意改节奏时连同它一起改。
- **加一个工具**：在 `tools.json` 加一条，在 `src/tools/<id>/` 写 `core.js`、`ui.js`、`core.test.js`，在 `components.mjs` 的 `SHELLS` 里加表单，并把新页面加进 `audit.mjs` 与 `a11y.mjs` 的清单。
- **加一个游戏**：在 `games.json` 加一条，在 `src/game/<id>/` 按 logic / view / main 三层写，门户包会随构建自动生成到 `build/portal/`（不部署，供提交门户）。

## 文档

- `docs/self-audit.md` —— 本轮自检发现的问题清单（按流量 / 留存 / 稳定性分类）
- `docs/decisions.md` —— 扩张阈值与已做的决定，到期按数据说话
- `docs/analytics-setup.md` —— 打开统计的两个后台步骤与 Worker 部署
- `docs/search-setup.md` —— Google / Bing / 百度的提交清单
- `docs/portal-notes.md` —— 门户提交材料与提交前必须复核的条款

## 约束

- **不引入第三方依赖。** `check.mjs` 会在出现 dependencies 时报错。
- **Windows 批处理必须纯 ASCII、无 BOM、CRLF**，否则双击会乱码报错。`check.mjs` 会检查。
- **`/assets/` 下的文件名带内容哈希**并缓存一年，所以改了内容文件名必须变；构建会自动处理，不要手写固定文件名。
- **规则写在 `logic.js` / `core.js`**，不碰 DOM，可以在 Node 里测试。界面层只做展示和输入。
- **推送前必须过全量校验**，`deploy-push.mjs` 会强制执行。

## 旧站

这个地址原来是 AI 万象（AI 工具导航）。旧数据集保留在 `data/legacy/`，以 `/api/legacy/` 对外提供，内容遵循 CC BY 4.0。旧地址的跳转规则由 `scripts/redirects.mjs` 生成。

## 许可

代码 MIT。`data/legacy/` 下的内容 CC BY 4.0。
