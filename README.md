# AI 万象 · AI WANXIANG

**线上站点：<https://www.ealoongchan.top>**

一个长期维护的 AI 收录站：工具 / 提示词 / 术语 / 学习资源 / 资讯解读。
**零依赖**静态站生成器，产出纯静态文件，可部署到任意静态托管。

## 你可以直接拿走的

`data/` 目录是一份**可以直接用的开源数据集**，每条都带中英双语字段：

| 目录 | 数量 | 内容 |
|---|---|---|
| `tools.json` | 246 | AI 工具，含价格档位、是否国内可直连、**「什么时候别用它」的编辑点评** |
| `prompts.json` | 86 | 提示词，含变量定义、适用模型、使用要点 |
| `glossary.json` | 92 | AI 术语，含英文名、缩写、相关术语 |
| `playbooks.json` | 43 | 场景手册，按「想做的事」组织的流程 + 工具 + 提示词 + 避坑 |
| `models.json` | 78 | 模型家族，只比稳定维度（擅长什么、什么坑、是否开源、国内能否用） |

内容与代码是分离的 —— 改 `data/*.json` 就能重塑整个站，不用碰模板。
也可以把整个仓库当成一个**静态站生成器**用：换成自己的数据、跑 `node scripts/build.mjs`。

---

## 怎么打开（最常用）

**双击项目根目录的 `打开网站.bat`** —— 它会自动构建、启动本地服务、打开浏览器。

> 为什么不直接双击 `dist/index.html`？
> 因为站点用的是根路径引用（`/assets/main.css`）以适配正式部署。用 `file://` 打开时这些路径会解析失败，
> 页面会变成没有样式的纯文本，站内链接（`/tools/`）也点不动。必须走本地服务器。
> 首页文件本身是 `dist/index.html`，但它需要服务器环境。

如果 `.bat` 因为环境原因跑不起来，手动两步也一样：

```bat
cd /d D:\05ai\25ai网站
node scripts\build.mjs && node scripts\serve.mjs
```
然后浏览器打开 <http://127.0.0.1:4173/>。

其他入口：

| 文件 | 作用 |
|---|---|
| `打开网站.bat` | 构建 + 启动预览 + 开浏览器（日常用这个） |
| `重新构建.bat` | 只构建一遍，顺带跑数据自检 |

命令行等价物：

```bash
node scripts/build.mjs      # 构建到 dist/
node scripts/serve.mjs      # 本地预览 http://127.0.0.1:4173
```

### ⚠️ 改 `.bat` 时必须遵守三条

`cmd.exe` 用**系统 OEM 代码页**（简中 Windows 是 GBK）解析批处理文件，所以：

1. **内容必须是纯 ASCII** —— 任何中文/全角字符都会被解析成乱码，乱码又会被当成命令执行，
   报一堆"不是内部或外部命令"。想输出中文请交给 `node`，不要写在 `.bat` 里。
2. **不能有 UTF-8 BOM** —— 有 BOM 时首行会变成 `\xEF\xBB\xBF@echo off`，直接报错。
3. **换行必须是 CRLF** —— 纯 LF 会让 `goto :LABEL` 跳转失效。

`node scripts/check.mjs` 会检查这三条，改坏了会直接报错。

> 文件名本身可以是中文（NTFS 是 Unicode 的，资源管理器双击没问题），
> 出问题的从来是**文件内容**，不是文件名。

---

## 设计体系

风格定位：**编辑网格的骨架 × 柔和圆润的表层**。
2026-10-06 改过一次版：原来是新粗野主义（硬黑描边 + 实心偏移投影 + 近乎直角 + 栅格纸底纹），
现在是 Google / Apple 那一类柔和语言（圆角 + 层叠软影 + 发丝线，去掉栅格底纹）。
**骨架没变** —— 信息密度、等宽标签层、单一强调色都保留，变的只是表层几何。

- **圆角分五档**：`xs 8px`（头像方块、图标按钮）/ `sm 12px`（按钮、输入框）/
  `r 16px`（卡片）/ `lg 24px`（浮动条、大面板）/ `pill 999px`（徽章、标签、导航项）。
  **只在 `main.css` 的「31. 圆角体系」一节集中赋值**，改弧度只动 `:root` 里那五个值，别散着写。
- **层叠软影三层**（`--sh-1/2/3`）：近处一层压边 + 远处一层扩散，悬停升一档；
  浮动元素用 `--sh-3`。通栏元素（header / toolbar / footer）不加圆角，否则两侧会出现缺口。
- **发丝线代替黑描边**：边框统一 `1px`、颜色是浅中性色。需要"强调边框"的地方（如导航悬停）
  改用 `--fg-3` —— `--line` 已经很淡，拿它做强调会看不出来。
- **等宽字体承担标签层**：分类名、徽章、日期、编号、按钮用 IBM Plex Mono 大写字母，形成"技术档案"的质感
- **单一强调色**：朱红 `#FF3B00`，只用于强调与交互，不做装饰
- **衬线体只用在数字**：统计数字用 IBM Plex Serif，和展示型的粗黑标题形成对比
- **分类色取自柔版印刷（risograph）平面色盘**：12 个统一饱和度/明度的平面色，避免"五彩斑斓的 AI 配色"
- **头像一律用图标**：分类数据里本来就有 `icon` 字段，改版前一半卡片用文字首字母、一半用图标
  （不一致），现在统一成图标 + 同色淡底（`color-mix` 11% / 深色 20%）。

字体**全部自托管**（`public/fonts/`，共 9 个 woff2 约 180KB，IBM Plex Sans / Serif / Mono，SIL OFL 许可），
不依赖 Google Fonts —— 国内可直连，也不受第三方 CDN 影响。

> ### ⚠️ 改视觉之后必须跑 `node scripts/a11y.mjs`
>
> 有一条隐蔽的耦合：`accentTextStyle()` 里的「最不利表面色」是**写死的常量**
> （浅 `#eae7de` / 深 `#1f1f1a`），而分类色当文字用的 `--t-l` / `--t-d` 正是按这两个值算的。
> **改 `--surface-2` 会让所有分类色文字悄悄掉到 4.5:1 以下** ——
> 实测：深色 `--surface-2` 从 `#1f1f1a` 调到 `#232320` 后，a11y 立刻报出 20 处压线
> （表格 `th` 与 `span.tag`）。要改就把那两个常量一起改。
>
> 另外改版时踩到过：`.stats` 是 `minmax(150px, 1fr)` + `max-width: 820px`，
> 只能排 5 列，而首页有 6 个统计项 → 第 6 个换行、下面留一大片空白。
> 加上圆角轮廓后这个不平衡特别显眼，已改成 `120px` 排满一行。

---

## 目录结构

```
data/                  ← 内容全部在这里，改这个目录就够了
  site.config.json     站点名 / 导航 / 页脚 / 默认主题 / baseUrl
  categories.json      工具分类、提示词分类、资讯主题、学习路径（含各自的 accent 色与 guide 选型提示）
  playbooks.json       场景手册（按「想做的事」组织的流程 + 工具 + 提示词 + 避坑）
  tools.json           AI 工具收录
  prompts.json         提示词库
  models.json          模型家族对比
  news.json            资讯（sources 信息源 / items 解读 / milestones 里程碑）
  learn.json           学习资源
  i18n.json            英文版界面文案
  tags-en.json         标签的中英对照字典
  glossary.json        术语表
  feeds.json           RSS 源配置（实时动态抓哪些源）
  feed.json            抓取结果 ← 由 scripts/fetch-news.mjs 生成，不是手写的

src/
  lib/
    icons.mjs            内联 SVG 图标（stroke 风格）
    utils.mjs            转义、日期、对比色计算、变量高亮
    layout.mjs           页面外壳（header/footer/SEO/主题脚本/字体预载）
    components.mjs       卡片、标签、时间线、变量填充器等组件
    pages.mjs            各页面组装（含结构化数据）
  styles/
    main.css             设计系统（令牌 / 组件 / 响应式）
    print.css            打印样式（把网页变成可读的纸质资料）
  scripts/app.js         前端交互（主题/筛选/排序/变量填充/搜索/快捷键）

scripts/
  build.mjs            静态站生成 + sitemap/robots/feed/api/部署配置
  fetch-news.mjs       抓取 RSS 源 → data/feed.json（零依赖解析 RSS/Atom）
  serve.mjs            本地静态服务器
  assets.mjs           用本机 Chrome 渲染 og.png 与 apple-touch-icon.png
  check.mjs            数据自检（重复 id、未知分类、缺字段、交叉引用、分类撞车、feed 数据）
  links.mjs            内部链接与锚点检查（直接扫 dist，不需要服务器）
  audit.mjs            页面审计（横向溢出、控制台报错、SEO 元信息），--shot 出截图
  selftest.mjs         交互自测（真实浏览器点击，107 个用例）
  new.mjs              新增条目脚手架

public/                原样拷贝到 dist/（fonts / favicon / og.png 等）
dist/                  产物（构建时清空重建）
```

---

## 加内容

```bash
node scripts/new.mjs tool   "工具名"
node scripts/new.mjs prompt "标题"
node scripts/new.mjs news   "标题"
node scripts/new.mjs learn  "标题"
node scripts/new.mjs gloss  "术语"
```

也可以直接编辑 `data/*.json`。改完必跑：

```bash
node scripts/check.mjs && node scripts/build.mjs
```

### 各模块必填字段

| 模块 | 必填 |
|---|---|
| tools | `id` `name` `url` `cat` `desc` `pricing` |
| prompts | `id` `title` `cat` `desc` `prompt` |
| models | `id` `name` `vendor` `kind` `tier` `strengths` `useFor` `url` |
| playbooks.items | `id` `title` `group` `problem` `time` `steps[]` |
| news.items | `id` `title` `topic` `date` `summary` `body[]` |
| learn | `id` `title` `track` `url` `desc` `type` |
| glossary | `term` `cat` `def` |

- `pricing` ∈ `free | freemium | paid | open`
- `cat` / `topic` / `track` / `group` / `kind` 必须在对应的配置里存在，否则 `check` 报错
- `tools[].added` 决定「最新收录」排序与 `NEW` 徽章（最近收录的前 8 个）
- `prompts[].prompt` 里的 `{{变量}}` 会自动变成可填充输入框；`vars[]` 是变量清单
- **`playbooks[].tools` / `.prompts` 以及每步里的引用会被交叉校验**，引用不存在的 id 会直接报错

---

## 内容模块的设计取向

### 场景手册（playbooks）
普通工具导航的根本问题是：用户想的是「我要做某件事」，不是「我要找一个叫 XX 的工具」。
所以场景手册按任务组织，每篇包含：流程步骤 → 每步用什么工具 / 配哪条提示词 → 避坑清单。
**避坑部分是刻意写的**，而且包含「这里不该用 AI」的判断。

### 模型库（models）
**刻意不写版本号、上下文长度、价格这类参数**——它们几个月就会过期，写下来反而误导人。
只对比相对稳定的维度：谁最擅长什么、有什么坑、适合什么场景、是否开源、国内能否直连。
需要精确参数时，每一项都链到官方文档。

### 工具详情页
每个工具一个独立页面，但**刻意不做「复制官网简介」那种薄内容**。页面由四块构成：

1. **该分类的选型要点**（来自 `categories.json` 的 `guide` 字段，15 个分类各一段）
2. **同分类横向对比表** —— 真实可比较的维度，并高亮当前工具
3. **它出现在哪些场景手册里** —— 从 playbooks 反查，把「工具有什么用」变成「什么情况下这么用」
4. **基本信息 + 同分类其他工具**

### ⚠️ 两套分类体系不能合并映射

工具分类与提示词分类**共用同一批 id 命名空间**，其中 `coding` / `writing` / `design` / `data` / `marketing`
五个 id 两套都有，且 `writing`（写作办公 vs 写作文案）与 `marketing`（配色不同）内容并不一致。

所以 `build.mjs` 里必须用**两个独立的映射**：

```js
const toolCatMap  = Object.fromEntries(categories.toolCategories.map((c) => [c.id, c]));
const promptCatMap = Object.fromEntries(categories.promptCategories.map((c) => [c.id, c]));
```

合并成一个 map 会导致提示词分类覆盖工具分类，症状是：工具卡显示错误分类名、分类配色被换、
工具详情页的选型提示变空白。`check.mjs` 有守卫提醒，`selftest.mjs` 有回归用例。

---

## 交互功能：收藏与对比

两者都**纯前端 + localStorage**，没有账号、没有服务端存储。

### 工具对比 `/compare/`
- 最多同时比 4 个工具，差异维度自动高亮、相同维度淡化（**这是对比功能的灵魂**——不用自己一行行找不同）
- 支持分享链接：`/compare/?t=chatgpt,claude,deepseek`，打开带参数的链接会并入当前选择
- 「复制为表格」输出制表符分隔的纯文本，可直接粘进文档
- 数据来自构建时内嵌的精简工具索引（`window.__AIWX_TOOLS__`），不请求接口

### 我的收藏 `/saved/`
- 工具、提示词、场景、模型、学习资源都能收藏，共用一个 `type:id` 命名空间
- 页面复用搜索索引（`window.__AIWX_INDEX__`）按 id 反查，不额外内嵌数据
- **收藏的条目被下架时会自动忽略并如实告知**（「另有 1 项已下架，已自动忽略」），而不是显示一张打不开的卡片

### 实现要点（改这块前必看）
1. **`initPrompts()` 的点击处理器必须优先放行 `[data-save]` / `[data-cmp]`**。
   收藏按钮位于 `.prompt-head[data-accordion]` 内部，不拦一下会导致「点收藏顺带展开卡片」。
2. **`<a>` 卡片里的按钮是非法嵌套**。场景卡原本整体是 `<a>`，为了放按钮改成了
   `<div>` + 覆盖整卡的 `.card-hit` 热区。改结构时别把属性留在标签外面（见 `links.mjs` 的游离属性检查）。
3. **两条浮动条要错开**（`positionBars()`）。收藏条与对比条同时出现时会重叠。

---

## 实时动态（RSS 聚合）

### 抓取与构建是解耦的 —— 这是刻意的

```bash
node scripts/fetch-news.mjs        # 抓取 → data/feed.json
node scripts/build.mjs             # 构建（读 data/feed.json，没有就跳过该区块）
```

**构建永远不依赖网络。** 没跑抓取、网络挂了、feed.json 损坏，站点照常构建，
只是不显示实时动态区块（`/news/live/` 也不会生成，陈旧的那份会被自动清理）。
这一点很重要——不能因为第三方源不可用就发不了版。

### 抓取配置

源列表在 `data/feeds.json`。加源就是在数组里加一条，然后跑 `--only <id>` 单独验证：

```bash
node scripts/fetch-news.mjs --only arxiv-ai,openai
node scripts/fetch-news.mjs --dry          # 只抓不写文件
```

源失效的处理约定：**不要删配置**，改成 `"enabled": false` 并加 `"note"` 写明实测失效时间与现象，
方便将来恢复。当前已标注的失效源：机器之心、36 氪（RSS 已下线，返回 HTML）、
arXiv cs.AI（返回空 channel）、Hugging Face（国内网络不可达）。

### 解析器的坑（改 fetch-news.mjs 前先看）

`toText()` 里**必须先解码 HTML 实体、再剥标签，而且要循环两轮**。
反例：有些源把 HTML 转义成 `&lt;p&gt;` 塞进 XML，如果先剥标签（此时还没解码，剥不到）再解码，
就会还原出真标签留在摘要里。这个 bug 实际发生过（IT 之家的 35 条摘要全是 `<p data-vmark=...>`）。

### 为什么时间用绝对时间 + 前端换算

服务端渲染的是 `MM-DD HH:mm` 绝对时间，由 `app.js` 的 `initRelTime()` 在浏览器里换算成
「3 小时前」。**不能在构建时算相对时间**——静态页面一旦变旧，「今天」就会说谎。

### 自动化

已配置每日 9:00 自动抓取并重建。源失效时会自动标注原因并尝试找替代源。

---

## 部署（Vercel + 自有域名）

线上：**https://www.ealoongchan.top**（裸域 307 跳到 www，所以 canonical 用 www 版本）

### 形态

Vercel 只做两件事：跑 `node scripts/build.mjs`，然后把 `dist/` 当静态站发出去。
根目录 `vercel.json` 里写死了全部配置，**不依赖 Vercel 后台的任何设置**：

```json
{ "framework": null, "buildCommand": "node scripts/build.mjs", "outputDirectory": "dist" }
```

`framework: null` 是关键——不写的话 Vercel 会按仓库里的框架特征去构建。

`dist/` 不进 git（看 `.gitignore`）。735 个产物文件每次构建都变，提交进去会让仓库历史迅速膨胀。

### 推送

双击根目录 **`推送到线上.bat`**，或者 `node scripts/deploy-push.mjs`。

**走 SSH，不走 HTTPS。** 实测国内 SSH 22 端口直连可用；HTTPS 必须走代理，而代理经常 502。

> 代理切成 fake-IP/TUN 模式后，22 端口会被接管（连上就被切断）。脚本检测到这种情况会
> **自动改走 GitHub 的 443 备用通道**，不用动你的 `~/.ssh/config`。

首次要加一次公钥（一次性，之后永久免密）。不知道公钥是哪个就直接跑脚本，
它会检测到未授权并把**要复制的那一整行**打出来：

```
https://github.com/settings/ssh/new   ← 粘贴进去，Save
```

加完之后，所有推送（包括每日自动化）都不再需要任何人工操作。

参数：

| 参数 | 作用 |
|---|---|
| 无 | 推送（远端领先时会中止，不会覆盖） |
| `--dry` | 只做检查，不动远端 |
| `--force` | 明确要求覆盖远端 main（会丢掉远端独有的提交） |
| `--backup` | 覆盖前先把远端 main 存成归档分支 `archive/ai-wanxiang-v1` |

默认**不做归档**。真正的回滚安全网是 Vercel 自己——它保留每一次部署记录，
面板上一键就能回到旧版本，比 git 分支好用。

### 顺手清掉 Vercel 送的第二个域名

Vercel 默认会给项目一个 `xxx.vercel.app` 地址，它和正式域名**跑的是同一个站**。
不清掉的话搜索引擎会当成两个站，权重被劈成两半（百度和 Google 都会）。

`vercel.json` 里加了按 host 匹配的 301 跳转：命中 `.vercel.app` 的请求全部跳到正式域名。

> ⚠️ 如果改动 Vercel 项目的 `.vercel.app` 名字（Settings → Domains），
> **这里必须同步改**，否则跳转失效、重复内容问题会回来。

### 为什么不在 Vercel 上抓 RSS

`data/feed.json` 跟着仓库走，构建只读不抓。这样**构建永远不依赖网络**——
第三方源挂了照样能发版。想更新实时动态，本地跑 `node scripts/fetch-news.mjs`
再推送即可（已有每日 9:00 的自动化在跑这条链）。

### 首次部署要留意

Vercel 项目原来绑的是 Next.js，换成静态站之后第一次构建，去 Deployments 页面确认它
读到了 `vercel.json` 的配置（构建日志里应该是 `node scripts/build.mjs`）。
如果它还在跑 `next build`，在项目 Settings → Build & Development Settings 里把
Framework Preset 改成 **Other**，Build/Output 留空（让 `vercel.json` 生效）。

---

## 质量校验

```bash
node scripts/check.mjs            # 数据层（含场景/模型的交叉引用校验、分类 id 撞车守卫）
node scripts/links.mjs            # 内部链接、锚点与游离属性（不需要服务器）
node scripts/audit.mjs            # 页面层：三档视口 × 27 页面
node scripts/audit.mjs --shot     # 顺带把截图存到 .audit/
node scripts/a11y.mjs             # 无障碍审计：对比度/可访问名称/标题层级/点击区域
node scripts/perf.mjs             # 体积预算：关键资源与最大页面的 gzip 上限
node scripts/selftest.mjs         # 交互层：107 个真实点击用例
node scripts/verify                # check + build + links + audit 一把过
```

`audit` 与 `selftest` 需要本机有 Chrome 或 Edge，且 `serve.mjs` 已在 4173 端口运行。
`check` 与 `links` 不需要服务器，可直接跑。两者都用 CDP 直连，**不需要安装 puppeteer / playwright**。

---

## 性能注意

构建时**不要**用 `fs.rmSync` 整树删除 `dist/`。在 Windows 上删 300+ 个文件要 15 秒以上，
占整个构建时间的一大半（实测 24.6s → 7.9s 就是这一处的差别）。

`build.mjs` 的做法是「覆盖写入 + 收尾时只清理这一轮没写出的文件」（`pruneStale()`），
删除量通常只有个位数。改动 `write()` / `copyDir()` 时记得保持 `written` 集合的登记。

---

## 部署

`dist/` 是纯静态目录，直接丢给任意静态托管：Vercel / Netlify / Cloudflare Pages / GitHub Pages / 自己的服务器。

上线前改两处：

1. `data/site.config.json` 的 `baseUrl`（生成 canonical、sitemap、RSS、OG 图地址用）
2. 同文件的 `footer.icp`（如需备案号）

构建时已自动附带：

- `_headers`（Netlify / Cloudflare Pages 缓存与安全头）
- `vercel.json`（Vercel 同等配置）
- `_redirects`（留给未来改 URL 结构时加 301）
- `sitemap.xml` / `robots.txt` / `feed.xml`

---

## 许可

代码与内容分开授权，因为它们的性质不一样：

| 部分 | 许可 | 你可以 |
|---|---|---|
| 代码（`scripts/`、`src/`） | **MIT**（见 [LICENSE](LICENSE)） | 随便用、改、商用，保留版权声明即可 |
| 内容与数据（`data/`） | **CC BY 4.0** | 随便用、改、商用，**署名并链回站点**即可 |

`data/` 里也含第三方内容：工具名称与官网链接归各自所有者；
学习资源、资讯条目来自第三方，我们只做整理与点评，并在 `source` 字段标注出处。

---

## 设计约束（改代码时请遵守）

- **零运行时依赖**。不要在 `package.json` 里加 dependencies，构建脚本用 Node 内置模块。
- **内容与代码分离**。新增内容一律进 `data/`，不要写进模板。
- **颜色走 CSS 变量**。定义在 `main.css` 的 `:root` / `[data-theme]` 里；模板中禁止硬编码主题色
  （分类色例外，它由数据里的 `accent` 字段驱动，且必须经 `accentStyle()` 计算文字对比色）。
- **深浅主题都必须可用**。新组件要在两套主题下都检查对比度。
- **标签层一律用等宽 + 大写**。这是整套视觉的识别特征，不要退回普通无衬线。
- **圆角与投影只走令牌**：弧度用 `--r-xs/sm/r/lg/pill`，阴影用 `--sh-1/2/3`，
  不要在组件里写死像素值 —— 否则要整体调弧度时会满文件改。
- **仍然不要引入渐变光晕 / 玻璃拟态 / 大圆角卡片堆叠**：改版是柔和圆润，不是什么都圆。
  通栏元素不加圆角，圆角最大到 24px（胶囊除外）。
- **SEO 元信息不可省略**。每页独立 `title` 与 `description`，且只有一个 `h1`。
