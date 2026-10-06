/**
 * 仓库体检（零依赖，本地检查，默认不联网）
 *
 *   node scripts/git-doctor.mjs            体检
 *   node scripts/git-doctor.mjs --online   顺带确认远端 main 还在
 *
 * 为什么需要它：2026-10-06 发现本地 `.git` 被清成了空壳 ——
 * `refs/`、`logs/`、`packed-refs` 全没了，`objects/` 只剩 9 个松散对象
 * （原本上千个都在 pack 里），于是 **git 直接认为"这不是一个仓库"**。
 * 而当时**没有任何一条守卫会发现这件事**：check.mjs 只看内容、
 * deploy-push 的守卫自己也被这个坏状态骗过去了 —— 最后是靠推送失败才暴露的。
 *
 * 恢复路径（远端就是备份，所以一定救得回来）：
 *   git init                                    # 重建缺失的 refs/ 等结构
 *   git fetch origin main
 *   rm -f .git/index && git reset FETCH_HEAD     # HEAD 指向远端，工作区不动
 *   # 然后重新提交工作区里那些还没推上去的改动
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ONLINE = process.argv.includes('--online');

const git = (args, opts = {}) => execFileSync('git', args, {
  cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts,
}).trim();

const problems = [];
const notes = [];
const ok = [];

try {
  /* 1. 仓库本身有效吗 —— 这是那次事故最直接的信号 */
  git(['rev-parse', '--git-dir']);
  ok.push('git 能识别本目录为仓库');
} catch (e) {
  problems.push('git 不认为这是一个仓库（.git 结构损坏）→ 按下面「恢复路径」处理');
  console.log(report());
  process.exit(1);
}

/* 2. refs 在不在（那次的症状之一就是 refs/ 整个消失） */
if (!fs.existsSync(path.join(ROOT, '.git', 'refs', 'heads'))) {
  problems.push('.git/refs/heads 不存在 —— 分支引用层缺失');
}
try {
  const head = git(['rev-parse', '--short', 'HEAD']);
  ok.push(`HEAD 可解析（${head}）`);
} catch {
  problems.push('HEAD 解析不到任何提交（分支可能没指向任何对象）');
}

/* 3. 对象库规模 —— 上千个对象的仓库突然只剩几十个，就是被清过了。
      阈值取 100：正常开发到这个体量绝不会低于它，而空壳仓库通常是 0~20。 */
try {
  const v = git(['count-objects', '-v']);
  const num = (k) => Number((v.match(new RegExp(`${k}:\\s*(\\d+)`)) || [])[1] || 0);
  const loose = num('count');
  const packed = num('in-pack');
  const total = loose + packed;
  if (total < 100) problems.push(`对象库异常：松散 ${loose} + 打包 ${packed} = ${total} 个（正常应上千）→ 对象库被清过`);
  else ok.push(`对象库正常（松散 ${loose} + 打包 ${packed} = ${total} 个）`);
} catch {
  problems.push('读不到对象库统计（count-objects 失败）');
}

/* 4. 跟远端的关系：不是必须，但知道落后多少有助判断该不该先 rebase */
try {
  const remote = git(['remote', 'get-url', 'origin']);
  ok.push(`远端 ${remote}`);
  if (ONLINE) {
    const out = git(['ls-remote', '--exit-code', '--heads', 'origin', 'main'], { stdio: ['ignore', 'pipe', 'pipe'] });
    ok.push(`远端 main ${out.split(/\s+/)[0].slice(0, 8)}`);
  } else {
    notes.push('想顺带确认远端可达性，加 --online');
  }
} catch {
  notes.push('取不到远端信息（离线或未配置 origin）');
}

/* 5. 工作区里有没有还没提交的改动 —— 这类脚本最常见的用途就是"我现在敢不敢动" */
try {
  const st = git(['status', '--porcelain']);
  const n = st ? st.split('\n').length : 0;
  if (n) notes.push(`工作区有 ${n} 处未提交改动`);
  else ok.push('工作区干净');
} catch { /* 上面已经报过仓库问题了 */ }

console.log(report());

function report() {
  const L = [''];
  L.push('  仓库体检');
  L.push('  ' + '─'.repeat(52));
  for (const s of ok) L.push('  ✓ ' + s);
  for (const s of notes) L.push('  · ' + s);
  for (const s of problems) L.push('  ✗ ' + s);
  L.push('');
  if (problems.length) {
    L.push('  ⚠ 仓库结构有问题。远端就是备份，按这个顺序恢复：');
    L.push('      git init');
    L.push('      git fetch origin main');
    L.push('      rm -f .git/index && git reset FETCH_HEAD');
    L.push('    （工作区文件不会被这两步动到；然后重新提交未推上去的改动）');
    L.push('');
  } else {
    L.push('  结论：仓库健康。');
    L.push('');
  }
  return L.join('\n');
}

process.exit(problems.length ? 1 : 0);
