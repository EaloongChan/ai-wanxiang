/**
 * 全站界面文案。每条都是 { en, zh }，键名用点分命名。
 *
 * 别把内容数据写进来：工具说明、游戏数值、隐私政策正文都在 data/ 里，
 * 这里只放「同一句话、两种语言」的固定文案（导航、按钮、表头、提示、报错）。
 * 这样加一个工具时不需要动这个文件，改一句按钮文案也不用碰数据。
 */

export const S = {
  /* ---------------- 通用 ---------------- */
  'skip.link': { en: 'Skip to content', zh: '跳到正文' },
  'toc.label': { en: 'On this page', zh: '本页目录' },
  'faq.heading': { en: 'FAQ', zh: '常见问题' },
  'crumb.home': { en: 'Home', zh: '首页' },
  'crumb.games': { en: 'Games', zh: '游戏' },
  'crumb.tools': { en: 'Tools', zh: '工具' },
  'updated': { en: 'Updated {date}', zh: '更新于 {date}' },
  'copy.button': { en: 'Copy', zh: '复制' },
  'copy.done': { en: 'Copied', zh: '已复制' },
  'copy.fail': { en: 'Press Ctrl+C', zh: '请按 Ctrl+C' },
  'nav.games': { en: 'Games', zh: '游戏' },
  'nav.tools': { en: 'Tools', zh: '工具' },
  'nav.main': { en: 'Main', zh: '主导航' },
  'nav.footer': { en: 'Footer', zh: '页脚' },
  'menu.open': { en: 'Open menu', zh: '打开菜单' },
  'menu.close': { en: 'Close menu', zh: '关闭菜单' },
  'logo.aria': { en: '{brand} home', zh: '{brand} 首页' },
  'lang.switch': { en: 'Switch to Chinese', zh: '切换到英文' },
  'lang.other': { en: '中文', zh: 'English' },
  'lang.attr': { en: 'zh-CN', zh: 'en' },
  'footer.source': { en: 'Source on GitHub', zh: '在 GitHub 上查看源码' },
  'footer.opensNew': { en: 'opens in a new tab', zh: '在新标签页打开' },

  /* ---------------- 首页 ---------------- */
  'home.eyebrow': { en: 'Free browser games', zh: '免费网页游戏' },
  'home.h1': { en: 'Play a game in the next ten seconds', zh: '十秒之内，开始一局' },
  'home.play': { en: 'Play {game}', zh: '开始玩《{game}》' },
  'home.allGames': { en: 'All games', zh: '全部游戏' },
  'home.pointDownload': { en: 'No download', zh: '无需下载' },
  'home.pointSignup': { en: 'No sign-up', zh: '无需注册' },
  'home.pointSaves': { en: 'Saves in your browser', zh: '进度存在浏览器里' },
  'home.gamesH2': { en: 'Games', zh: '游戏' },
  'home.gamesNoteOne': { en: '1 game, more on the way', zh: '目前 1 款，还在增加' },
  'home.gamesNoteMany': { en: '{n} games, more on the way', zh: '目前 {n} 款，还在增加' },
  'home.toolsH2': { en: 'Gamer tools', zh: '玩家工具' },
  'home.allTools': { en: 'All tools', zh: '全部工具' },
  'home.toolsLead': { en: 'One small job each, done in your browser. Nothing you type is uploaded.', zh: '每个工具只做一件小事，全部在你的浏览器里算完，输入不上传。' },
  'home.aboutH2': { en: 'What is {brand}?', zh: '{brand} 是什么？' },
  'home.aboutP1': {
    en: '{brand} is a small site of browser games and quick utilities for gamers. The games are built to start instantly and to keep going while you are away, and they save your progress on your own device. The tools exist because the same handful of questions come up whenever you change games: what sensitivity matches, how the field of view converts, which Steam ID format a tool wants.',
    zh: '{brand} 是一个小站，只有网页游戏和几个玩家常用的小工具。游戏点开就能玩，关掉后仍会替你攒进度，存档放在你自己的设备上。工具来自换游戏时反复出现的几个问题：灵敏度怎么对上、视野角怎么换算、某个工具要哪种 Steam ID 格式。',
  },
  'home.aboutP2': {
    en: 'Everything here is free and runs without an account. {about}, {contact}, or see the {privacy} for exactly what is and is not stored.',
    zh: '这里的全部内容免费，也不需要账号。{about}，{contact}，或者看看{privacy}，里面写清了什么会被保存、什么不会。',
  },
  'home.aboutLink': { en: 'Read more about the site', zh: '了解更多' },
  'home.contactLink': { en: 'send feedback', zh: '反馈问题' },
  'home.privacyLink': { en: 'privacy policy', zh: '隐私政策' },

  /* ---------------- 卡片 ---------------- */
  'card.gameChip': { en: 'Game', zh: '游戏' },
  'card.play': { en: 'Play now', zh: '立即开玩' },

  /* ---------------- 游戏列表 ---------------- */
  'games.eyebrow': { en: 'Games', zh: '游戏' },
  'games.h1': { en: 'Free browser games', zh: '免费网页游戏' },
  'games.lead': { en: 'Each game starts in one click, plays with touch or mouse and keyboard, and saves progress in your browser.', zh: '每款游戏点开就能玩，触屏和键鼠都支持，进度保存在你的浏览器里。' },
  'games.metaDescription': {
    en: 'Free browser games that start in one click. Touch and keyboard both work, progress is saved in your browser, and your crew keeps working while the tab is closed.',
    zh: '免费网页游戏，点开即玩。触屏和键鼠都支持，进度自动保存在你的浏览器里，关掉标签页后队伍还会继续干活。',
  },
  'games.notesH2': { en: 'Good to know', zh: '几点说明' },
  'games.note1': { en: 'Progress is saved on your device only. Clearing site data for this domain removes it, so use the export option in each game\'s settings before you do.', zh: '进度只存在你的设备上。清除本站的站点数据会一并删掉，动手前请先用游戏设置里的导出功能留一份存档码。' },
  'games.note2': { en: 'The games keep earning for a while after you close the tab. Come back later and collect what your crew made.', zh: '关掉标签页之后，游戏里的队伍还会继续干一阵子。过段时间回来收一下就好。' },
  'games.note3': { en: 'Looking for the utilities? {link}.', zh: '在找工具？{link}。' },
  'games.note3Link': { en: 'They are all here', zh: '都在这里' },

  /* ---------------- 工具列表 ---------------- */
  'tools.eyebrow': { en: 'Tools', zh: '工具' },
  'tools.h1': { en: 'Gamer tools', zh: '玩家工具' },
  'tools.lead': { en: 'Small utilities that answer one question each. They run in your browser, so nothing you enter leaves your device.', zh: '每个工具只回答一个问题。它们在浏览器里运行，你输入的内容不会离开你的设备。' },
  'tools.metaDescription': {
    en: 'Free gamer tools: mouse sensitivity converter, FOV calculator, Steam ID converter, Discord timestamps and a prompt template builder. All computed in your browser.',
    zh: '免费的玩家工具：鼠标灵敏度换算、视野角换算、Steam ID 转换、Discord 时间戳与提示词模板。全部在你的浏览器里算完，输入不上传。',
  },
  'tools.notesH2': { en: 'How these work', zh: '这些工具是怎么运行的' },
  'tools.note1': { en: 'Each tool is a short program that runs on the page. There is no server to send your numbers to and no account to sign in to. You can use them offline once the page has loaded.', zh: '每个工具就是嵌在页面里的一小段程序。没有服务器接收你的数字，也不用登录。页面加载完之后，断网也能用。' },
  'tools.note2': { en: 'If a result looks wrong, {link}. Corrections are made quickly.', zh: '如果结果看着不对，{link}。改起来很快。' },
  'tools.note2Link': { en: 'tell us the inputs and what you expected', zh: '把输入和期望结果告诉我们' },

  /* ---------------- 游戏页 ---------------- */
  'game.eyebrow': { en: 'Game · Idle', zh: '游戏 · 放置' },
  'game.tocHowTo': { en: 'How to play', zh: '怎么玩' },
  'game.tocWorld': { en: 'The grove', zh: '这片林子' },
  'game.tocDistricts': { en: 'Districts', zh: '区域' },
  'game.tocUpgrades': { en: 'Upgrades', zh: '升级' },
  'game.tocOffline': { en: 'Progress and offline', zh: '存档与离线' },
  'game.tocTips': { en: 'Tips', zh: '技巧' },
  'game.tableTree': { en: 'Tree', zh: '树' },
  'game.tableTier': { en: 'Tier', zh: '稀有度' },
  'game.tableHealth': { en: 'Health', zh: '耐久' },
  'game.tableSparkwood': { en: 'Sparkwood', zh: '星火木' },
  'game.tableGears': { en: 'Gears', zh: '齿轮' },
  'game.tableDistrict': { en: 'District', zh: '区域' },
  'game.tableUnlock': { en: 'Unlock cost', zh: '解锁成本' },
  'game.tableTrees': { en: 'Trees', zh: '树木' },
  'game.tableUpgrade': { en: 'Upgrade', zh: '升级' },
  'game.tableEffect': { en: 'Effect per level', zh: '每级效果' },
  'game.tableFirstCost': { en: 'First cost', zh: '首次成本' },
  'game.tableMaxLevel': { en: 'Max level', zh: '最高等级' },
  'game.free': { en: 'Free', zh: '免费' },
  'game.upgradesNote': {
    en: 'Sparkwood buys the main upgrades. Gears, dropped by uncommon trees and rarer, buy the three at the end. Each purchase costs more than the last.',
    zh: '星火木用来买主要升级。齿轮由罕见及以上的树掉落，用来买最后三项。每买一次都比上一次贵。',
  },
  'game.offlineP1': {
    en: 'Progress is saved in this browser automatically. Choppers keep working while the tab is closed, at {eff} efficiency for up to {cap} hours; the Wind-up Reserve and Long Spring upgrades raise both limits.',
    zh: '进度会自动保存在这个浏览器里。关掉标签页后，砍伐机仍会以 {eff} 的效率工作，最长 {cap} 小时；「发条储备」和「长发条」两项升级可以提高这两个上限。',
  },
  'game.offlineP2': {
    en: 'Once the last district is unlocked, the Rewind tab lets you restart for mainsprings. Each one adds {bonus} to all Sparkwood, permanently.',
    zh: '解锁最后一个区域后，「传承」标签可以让你重开一局换取主发条。每枚主发条永久提高 {bonus} 的星火木产出。',
  },

  /* ---------------- 工具页 ---------------- */
  'tool.eyebrow': { en: 'Tool', zh: '工具' },

  /* ---------------- 404 ---------------- */
  'nf.h1': { en: 'That page is not here', zh: '这个页面不在这里' },
  'nf.lead': { en: 'The address may be mistyped, or the page has moved. {brand} was rebuilt, and most old addresses now lead to the home page.', zh: '可能是地址打错了，或者页面已经搬走。{brand} 重建过，多数旧地址现在会导向首页。' },
  'nf.play': { en: 'Play {game}', zh: '开始玩《{game}》' },
  'nf.tools': { en: 'Browse the tools', zh: '看看工具' },
  'nf.home': { en: 'Home', zh: '回首页' },
  // The 404 page is English-only, so this label stays Chinese in both variants: it exists
  // for the reader who cannot read the rest of the page.
  'nf.zhHome': { en: '中文首页', zh: '中文版首页' },
  'nf.zhLine': { en: '找不到这个页面？', zh: 'Looks like this page is missing.' },

  /* ---------------- 游戏运行时 ---------------- */
  'gr.hint': { en: 'Tap the tree to chop', zh: '点击树开始砍' },
  'gr.canvasAria': { en: 'Chop the tree. Press Space or Enter to swing.', zh: '点击砍树。按空格或回车挥砍。' },
  'gr.canvasNoSupport': { en: 'Your browser does not support canvas, which this game needs to draw.', zh: '你的浏览器不支持画布，这个游戏需要它来绘制画面。' },
  'gr.hpAria': { en: 'Tree health', zh: '树木耐久' },
  'gr.settings': { en: 'Settings', zh: '设置' },
  'gr.drawerAria': { en: 'Upgrades, districts and rewind', zh: '升级、区域与传承' },
  'gr.tabsAria': { en: 'Game menu', zh: '游戏菜单' },
  'gr.soundOn': { en: 'Sound: on', zh: '声音：开' },
  'gr.soundOff': { en: 'Sound: off', zh: '声音：关' },
  'gr.export': { en: 'Export save code', zh: '导出存档码' },
  'gr.saveCode': { en: 'Save code', zh: '存档码' },
  'gr.saveCodePlaceholder': { en: 'Paste a save code here, or press Export save code', zh: '在这里粘贴存档码，或先点上面的导出' },
  'gr.import': { en: 'Load pasted code', zh: '载入粘贴的存档码' },
  'gr.saveNote': { en: 'Progress is saved in this browser only. A save code lets you move it to another device.', zh: '进度只保存在这个浏览器里。想换设备，用存档码搬过去。' },
  'gr.reset': { en: 'Reset all progress', zh: '重置全部进度' },
  'gr.close': { en: 'Close', zh: '关闭' },
  'gr.exported': { en: 'Your save code is in the box below and copied to the clipboard.', zh: '存档码已填入下面的框里，也复制到了剪贴板。' },
  'gr.importEmpty': { en: 'Paste a save code into the box first.', zh: '请先在框里粘贴存档码。' },
  'gr.importBad': { en: 'That text is not a valid save code. Nothing was changed.', zh: '这段文字不是有效的存档码，没有做任何改动。' },
  'gr.rewindTitle': { en: 'Rewind the Great Clock?', zh: '要让大钟倒转吗？' },
  'gr.rewindText': { en: 'You will gain {n} mainsprings and start over. Sparkwood, upgrades and districts are reset.', zh: '你会得到 {n} 枚主发条并从头开始。星火木、升级和区域都会重置。' },
  'gr.rewindYes': { en: 'Rewind for {n}', zh: '倒转，拿 {n} 枚' },
  'gr.importTitle': { en: 'Load this save?', zh: '载入这个存档？' },
  'gr.importText': { en: 'Your current progress in this browser will be replaced.', zh: '这个浏览器里当前的进度会被替换。' },
  'gr.importYes': { en: 'Load save', zh: '载入' },
  'gr.resetTitle': { en: 'Reset all progress?', zh: '重置全部进度？' },
  'gr.resetText': { en: 'This deletes the save in this browser, including mainsprings. Export a save code first if you want to keep it.', zh: '这会删掉这个浏览器里的存档，包括主发条。想留一份的话，先导出存档码。' },
  'gr.resetYes': { en: 'Reset', zh: '重置' },
  'gr.cancel': { en: 'Cancel', zh: '取消' },
  'gr.confirm': { en: 'Confirm', zh: '确定' },
  'gr.awayTitle': { en: 'While you were away', zh: '你离开的这段时间' },
  'gr.awayDetail': { en: '{n} chopper(s) kept working for {time} at {eff} efficiency.', zh: '{n} 台砍伐机以 {eff} 的效率工作了 {time}。' },
  'gr.collect': { en: 'Collect', zh: '收取' },
  'gr.amountRow': { en: '+{n} Sparkwood', zh: '+{n} 星火木' },
  'gr.combo': { en: 'combo', zh: '连击' },
  'gr.goalZone': { en: 'Next: {zone} · {progress}/{target}', zh: '下一个目标：{zone} · {progress}/{target}' },
  'gr.goalRewind': { en: 'Rewind ready: {n} mainsprings', zh: '可以传承了：{n} 枚主发条' },
  'gr.goalMax': { en: 'Every district unlocked', zh: '全部区域已解锁' },
  'gr.achievement': { en: 'Achievement', zh: '成就' },
  'gr.achTitle': { en: 'Achievements', zh: '成就' },
  'gr.achCount': { en: '{n}/{total} unlocked', zh: '已解锁 {n}/{total}' },
  'gr.dailyTitle': { en: "Today's box", zh: '今天的发条箱' },
  'gr.dailyBody': { en: '+{n} Sparkwood. Come back tomorrow for another.', zh: '+{n} 星火木。明天再来还有一份。' },
  'gr.claim': { en: 'Open it', zh: '打开' },
  'gr.hintUpgrade': { en: 'Buy your first chopper — the Upgrades panel is below', zh: '先买一台砍伐机——升级面板在下面' },
  'gr.upgrades': { en: 'Upgrades', zh: '升级' },
  'gr.districts': { en: 'Districts', zh: '区域' },
  'gr.rewind': { en: 'Rewind', zh: '传承' },
  'gr.boughtWith': { en: 'Bought with Sparkwood.', zh: '用星火木购买。' },
  'gr.gearGroup': { en: 'Gear upgrades', zh: '齿轮升级' },
  'gr.gearHint': { en: 'Rare trees drop gears when they fall.', zh: '稀有树倒下时会掉落齿轮。' },
  'gr.gearHintZone': { en: 'Uncommon trees in the {zone} drop gears.', zh: '{zone} 里的罕见树会掉落齿轮。' },
  'gr.choppingHere': { en: 'Chopping here', zh: '正在这里砍' },
  'gr.goBack': { en: 'Go back', zh: '回到这里' },
  'gr.maxLevel': { en: 'Max level', zh: '已满级' },
  'gr.sparkwood': { en: 'Sparkwood', zh: '星火木' },
  'gr.gears': { en: 'gears', zh: '齿轮' },
  'gr.rewindNote': { en: 'Rewinding restarts this run. You lose Sparkwood, upgrades and districts, and keep every mainspring. Each mainspring adds {bonus} to all Sparkwood, for good.', zh: '传承会重开这一局：星火木、升级和区域清空，主发条全部保留。每枚主发条永久提高 {bonus} 的星火木产出。' },
  'gr.rewindStat1': { en: 'Mainsprings on rewind', zh: '这次能拿主发条' },
  'gr.rewindStat2': { en: 'You hold', zh: '当前持有' },
  'gr.rewindBtn': { en: 'Rewind the Great Clock', zh: '让大钟倒转' },
  'gr.rewindLocked': { en: 'The Great Clock can be rewound once you reach the {zone}. Restart there for mainsprings, which make every later run faster.', zh: '到达{zone}之后，大钟才能倒转。在那里重开可以换到主发条，之后的每一局都会更快。' },
  'gr.level': { en: 'Lv {n}/{max}', zh: 'Lv {n}/{max}' },
  'gr.holdBonus': { en: '{n} (+{pct} Sparkwood)', zh: '{n}（星火木 +{pct}）' },

  /* ---------------- 工具运行时：通用 ---------------- */
  'tu.tz': { en: 'Times use your timezone: {tz}.', zh: '时间按你的时区显示：{tz}。' },

  /* 灵敏度换算 */
  'tu.sens.from': { en: 'From game', zh: '从哪个游戏' },
  'tu.sens.to': { en: 'To game', zh: '换到哪个游戏' },
  'tu.sens.sens': { en: 'Your sensitivity', zh: '当前灵敏度' },
  'tu.sens.dpi': { en: 'Mouse DPI', zh: '鼠标 DPI' },
  'tu.sens.dpiTo': { en: 'Target DPI (optional)', zh: '目标 DPI（可选）' },
  'tu.sens.dpiHint': { en: 'Leave empty to keep the same DPI.', zh: '留空表示 DPI 不变。' },
  'tu.sens.resultIn': { en: 'Sensitivity in {game}', zh: '{game} 中的灵敏度' },
  'tu.sens.cm': { en: 'cm / 360°', zh: '厘米 / 360°' },
  'tu.sens.inch': { en: 'inches / 360°', zh: '英寸 / 360°' },
  'tu.sens.edpi': { en: 'eDPI', zh: 'eDPI' },
  'tu.sens.counts': { en: 'Counts / 360°', zh: '每 360° 计数' },
  'tu.sens.sameFeel': { en: 'Same feel in every game', zh: '各游戏对应灵敏度' },
  'tu.sens.colGame': { en: 'Game', zh: '游戏' },
  'tu.sens.colSens': { en: 'Sensitivity', zh: '灵敏度' },
  'tu.sens.colYaw': { en: 'Yaw', zh: 'yaw' },

  /* 视野角换算 */
  'tu.fov.fov': { en: 'Field of view', zh: '视野角' },
  'tu.fov.type': { en: 'This angle is', zh: '这个角度是' },
  'tu.fov.h': { en: 'Horizontal (most games show this)', zh: '水平角（多数游戏显示这个）' },
  'tu.fov.v': { en: 'Vertical', zh: '垂直角' },
  'tu.fov.from': { en: 'Your display', zh: '你的屏幕' },
  'tu.fov.to': { en: 'Convert to', zh: '换算到' },
  'tu.fov.resV': { en: 'Vertical FOV', zh: '垂直视野角' },
  'tu.fov.resH': { en: 'Horizontal FOV, {aspect}', zh: '水平视野角，{aspect}' },
  'tu.fov.resH169': { en: 'Horizontal FOV, 16:9', zh: '水平视野角，16:9' },
  'tu.fov.mult': { en: 'Keeping the same aim feel', zh: '保持同样的手感' },
  'tu.fov.multNote': {
    en: 'If the game changes your horizontal FOV from {from} to {to}, multiply your sensitivity by {mult} so the crosshair moves the same distance per centimetre of mouse travel.',
    zh: '当游戏把水平视野角从 {from} 改到 {to} 时，把灵敏度乘以 {mult}，准星每移动一厘米鼠标的位移就保持不变。',
  },

  /* Steam ID */
  'tu.steam.input': { en: 'Steam ID in any format', zh: '任意格式的 Steam ID' },
  'tu.steam.placeholder': { en: '76561197960287930 · [U:1:22202] · STEAM_0:0:11101 · profile URL', zh: '76561197960287930 · [U:1:22202] · STEAM_0:0:11101 · 主页链接' },
  'tu.steam.hint': { en: 'Works offline. Vanity names in profile links need a network lookup, so they are not supported.', zh: '离线也能用。主页链接里的自定义名字需要联网查询，所以不支持。' },
  'tu.steam.resultAccount': { en: 'Account ID', zh: '账号 ID' },
  'tu.steam.row64': { en: 'SteamID64', zh: 'SteamID64' },
  'tu.steam.row3': { en: 'SteamID3', zh: 'SteamID3' },
  'tu.steam.row2': { en: 'SteamID (Steam2)', zh: 'SteamID（Steam2）' },
  'tu.steam.rowUrl': { en: 'Profile URL', zh: '个人主页链接' },
  'tu.steam.meta': { en: 'Converted from the {via} you pasted. All four lines are the same account.', zh: '依据你粘贴的 {via} 换算，四行指的是同一个账号。' },

  /* Discord 时间戳 */
  'tu.ts.date': { en: 'Date', zh: '日期' },
  'tu.ts.time': { en: 'Time', zh: '时间' },
  'tu.ts.presetNow': { en: 'Now', zh: '现在' },
  'tu.ts.preset15m': { en: 'In 15 minutes', zh: '15 分钟后' },
  'tu.ts.preset1h': { en: 'In 1 hour', zh: '1 小时后' },
  'tu.ts.preset8pm': { en: 'Today at 8 PM', zh: '今天 20:00' },
  'tu.ts.presetTomorrow': { en: 'Tomorrow at 8 PM', zh: '明天 20:00' },
  'tu.ts.presetFriday': { en: 'Next Friday at 8 PM', zh: '下周五 20:00' },
  'tu.ts.presets': { en: 'Quick picks', zh: '快捷选择' },
  'tu.ts.decode': { en: 'Read a timestamp someone else posted', zh: '解读别人发的时间戳' },
  'tu.ts.decodeLabel': { en: 'Paste a code like &lt;t:1700000000:R&gt;', zh: '粘贴形如 &lt;t:1700000000:R&gt; 的代码' },
  'tu.ts.decoded': { en: 'That is {when} in your timezone, {rel}.', zh: '换算到你的时区是 {when}，{rel}。' },
  'tu.ts.noCode': { en: 'There is no timestamp code in that text.', zh: '这段文字里没有时间戳代码。' },
  'tu.ts.now': { en: 'now', zh: '现在' },
  'tu.ts.relIn': { en: 'in {n} {unit}', zh: '{n} {unit}后' },
  'tu.ts.relAgo': { en: '{n} {unit} ago', zh: '{n} {unit}前' },
  'tu.ts.u.s': { en: 'second', zh: '秒' },
  'tu.ts.u.m': { en: 'minute', zh: '分钟' },
  'tu.ts.u.h': { en: 'hour', zh: '小时' },
  'tu.ts.u.d': { en: 'day', zh: '天' },
  'tu.ts.u.mo': { en: 'month', zh: '个月' },
  'tu.ts.u.y': { en: 'year', zh: '年' },
  'tu.ts.style.t': { en: 'Short time', zh: '短时间' },
  'tu.ts.style.T': { en: 'Long time', zh: '长时间' },
  'tu.ts.style.d': { en: 'Short date', zh: '短日期' },
  'tu.ts.style.D': { en: 'Long date', zh: '长日期' },
  'tu.ts.style.f': { en: 'Short date and time', zh: '短日期与时间' },
  'tu.ts.style.F': { en: 'Long date and time', zh: '长日期与时间' },
  'tu.ts.style.R': { en: 'Relative', zh: '相对时间' },

  /* 提示词模板 */
  'tu.pt.template': { en: 'Template', zh: '模板' },
  'tu.pt.custom': { en: 'Or paste your own template', zh: '或者粘贴你自己的模板' },
  'tu.pt.customHint': { en: 'Use {{name}} for each blank.', zh: '用 {{name}} 表示每个空位。' },
  'tu.pt.customPlaceholder': { en: 'Write an outline for {{topic}} in {{tone}} tone', zh: '写一个关于 {{topic}} 的提纲，语气是 {{tone}}' },
  'tu.pt.vars': { en: 'Fill in the blanks', zh: '填写空位' },
  'tu.pt.noBlanks': { en: 'This template has no blanks.', zh: '这个模板没有空位。' },
  'tu.pt.out': { en: 'Your prompt', zh: '生成的提示词' },
  'tu.pt.copy': { en: 'Copy prompt', zh: '复制提示词' },
  'tu.pt.loading': { en: 'Loading…', zh: '加载中…' },
  'tu.pt.tooLong': { en: 'That template is over 20,000 characters. Trim it and try again.', zh: '模板超过 2 万个字符了，删短一些再试。' },
  'tu.pt.tooManyBlanks': { en: 'That template has more than 40 blanks. Only the first 40 are shown.', zh: '这个模板的空位超过 40 个，只显示前 40 个。' },
  'tu.pt.missingOne': { en: '1 blank is still empty above.', zh: '上面还有 1 个空没填。' },
  'tu.pt.missingMany': { en: '{n} blanks are still empty above.', zh: '上面还有 {n} 个空没填。' },

  /* ---------------- 报错（计算层只给错误码，这里给文案） ---------------- */
  'err.sensPositive': { en: 'Enter a sensitivity above zero.', zh: '请输入大于 0 的灵敏度。' },
  'err.dpiPositive': { en: 'Enter a mouse DPI above zero.', zh: '请输入大于 0 的鼠标 DPI。' },
  'err.dpiTarget': { en: 'Target DPI must be above zero, or left empty.', zh: '目标 DPI 要大于 0，或者留空。' },
  'err.pickGames': { en: 'Pick both games.', zh: '两个游戏都要选。' },
  'err.fovNumber': { en: 'Enter a field of view.', zh: '请输入一个视野角。' },
  'err.fovRange': { en: 'Field of view must be between 1 and 179 degrees.', zh: '视野角需要在 1 到 179 度之间。' },
  'err.pickDisplays': { en: 'Pick both displays.', zh: '两种屏幕比例都要选。' },
  'err.pickDate': { en: 'Pick a date.', zh: '请选择一个日期。' },
  'err.badDate': { en: 'That date and time cannot be read.', zh: '这个日期和时间读不出来。' },
  'err.steamVanity': { en: 'That is a custom profile name. It can only be resolved by Steam, so paste the /profiles/ link with the long number instead.', zh: '这是自定义的主页名字，只有 Steam 服务器才能解析，请改贴带长数字的 /profiles/ 链接。' },
  'err.steamGroup': { en: 'That is a group or chat ID, not an individual account.', zh: '这是群组或聊天的 ID，不是个人账号。' },
  'err.steamUniverse': { en: 'Only public individual accounts can be converted.', zh: '只能换算公开的个人账号。' },
  'err.steamRange': { en: 'That account ID is out of range.', zh: '这个账号 ID 超出了范围。' },
  'err.steamNotId': { en: 'That does not look like a Steam ID. Paste a 64-bit ID, a [U:1:x] ID, a STEAM_X:Y:Z ID or a profile URL.', zh: '这不像 Steam ID。可以粘贴 64 位 ID、[U:1:x]、STEAM_X:Y:Z 或主页链接。' },
  'err.steam64Type': { en: 'That 64-bit ID is not a public individual account, so it has no SteamID3 or SteamID form.', zh: '这个 64 位 ID 不是公开个人账号，没有对应的 SteamID3 和 SteamID 形式。' },
};

/** 取文案：找不到键或语言时回落英文，再找不到就直接返回键名（开发时一眼可见）。 */
export function T(lang, key, vars) {
  const entry = S[key];
  if (!entry) return key;
  const text = entry[lang] !== undefined ? entry[lang] : entry.en;
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
}

/**
 * 某一种语言的扁平表，交给浏览器端脚本（工具与游戏各取自己那一份）。
 * prefixes 用来只带走这个脚本真正会用到的键：全站 200 多条文案对游戏来说太重。
 */
export function stringsFor(lang, prefixes = null) {
  const out = {};
  for (const [key, entry] of Object.entries(S)) {
    if (prefixes && !prefixes.some((p) => key.startsWith(p))) continue;
    out[key] = entry[lang] !== undefined ? entry[lang] : entry.en;
  }
  return out;
}
