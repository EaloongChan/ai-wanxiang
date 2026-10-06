/**
 * 推送本地站点到 GitHub（触发 Vercel 自动部署）
 *
 *   node scripts/deploy-push.mjs              推送（远端领先时拒绝，需 --force 才覆盖）
 *   node scripts/deploy-push.mjs --dry        只检查，不动远端
 *   node scripts/deploy-push.mjs --force      明确要求覆盖远端 main（丢掉远端独有的提交）
 *   node scripts/deploy-push.mjs --backup     覆盖前先把远端 main 存成归档分支
 *
 * 走 SSH 而不是 HTTPS：实测国内 SSH 22 端口直连可用，HTTPS 必须走代理且经常 502。
 * **22 端口被代理接管时会自动改走 GitHub 的 443 备用通道**（见下面 [1/3]）。
 *
 * 关于备份：默认**不做**归档，直接覆盖。真正的安全网是 Vercel 自己——
 * 它保留每一次部署记录，随时能在面板上回滚到上一个版本，比 git 分支更好用。
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVE = 'archive/ai-wanxiang-v1';
const KEY_PATH = '~/.ssh/id_ed25519_github.pub';
const DRY = process.argv.includes('--dry');
const BACKUP = process.argv.includes('--backup');
const FORCE = process.argv.includes('--force');

/* 22 端口被代理接管时的备用通道：GitHub 官方支持 SSH 走 443。
   检测到之后，本次所有 git 操作都带上它。
   踩过：本机代理切成 fake-IP/TUN 之后，github.com 被解析到 198.18.x（保留段），
   22 端口一连上就被切断（"Connection closed by 198.18.0.60 port 22"），
   而 HTTPS 走代理是通的 —— SSH over 443 也通。 */
const SSH_443 = 'ssh -o HostName=ssh.github.com -p 443 -o StrictHostKeyChecking=accept-new';
const SSH_ENV = {};

const line = (s = '') => console.log(s);
const rule = () => line('  ' + '─'.repeat(62));

function git(args, opts = {}) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: opts.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...SSH_ENV, GIT_TERMINAL_PROMPT: '0' },
    });
  } catch (e) {
    const msg = (e.stderr || e.stdout || e.message || '').toString().trim();
    const err = new Error(msg.split('\n').slice(0, 3).join('\n'));
    err.raw = msg;
    throw err;
  }
}

async function main() {
  line('');
  line('  推送到线上');
  rule();

  /* ---------- 0. 前置检查 ---------- */
  if (!fs.existsSync(path.join(ROOT, '.git'))) {
    line('  ✗ 当前目录不是 git 仓库');
    process.exit(1);
  }

  const remote = (() => { try { return git(['remote', 'get-url', 'origin']).trim(); } catch { return ''; } })();
  if (!remote) {
    line('  ✗ 没有配置 origin 远端');
    process.exit(1);
  }
  line(`  远端        ${remote}`);
  if (!/^git@/.test(remote)) {
    line('  ! 远端不是 SSH 地址。HTTPS 在国内必须走代理且不稳定，建议改成 SSH：');
    line('    git remote set-url origin git@github.com:EaloongChan/ai-wanxiang.git');
  }

  const dirty = git(['status', '--porcelain']).trim();
  if (dirty) {
    const n = dirty.split('\n').length;
    line(`  ! 有 ${n} 个文件没提交，本次推送不包含它们：`);
    dirty.split('\n').slice(0, 6).forEach((l) => line(`      ${l}`));
    if (n > 6) line(`      … 还有 ${n - 6} 个`);
    line('    要一起推的话先：git add -A && git commit -m "..."');
  }

  const branch = (() => { try { return git(['rev-parse', '--abbrev-ref', 'HEAD']).trim(); } catch { return 'main'; } })();
  const sha = (() => { try { return git(['rev-parse', '--short', 'HEAD']).trim(); } catch { return ''; } })();
  line(`  本地        ${branch} @ ${sha}`);

  /* ---------- 0. 仓库体检 ----------
     踩过（2026-10-06）：本地 .git 被清成空壳 —— refs/、logs/、packed-refs 全没，
     objects/ 只剩 9 个松散对象，git 直接认为"这不是一个仓库"。
     而当时**没有任何守卫会发现这件事**，是推送失败才暴露的。
     放在最前面：仓库结构不对就别谈推送，先按提示恢复。
     用 process.execPath 而不是 'node' —— 沙箱里 PATH 不一定能解析到 node。 */
  line('');
  line('  [0/3] 仓库体检');
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'git-doctor.mjs')], { stdio: 'inherit' });
  } catch {
    line('  ✗ 仓库结构有问题（原因与恢复步骤见上）。修好再推。');
    process.exit(1);
  }

  /* ---------- 1. 验证 SSH 密钥可用 ---------- */
  line('');
  line('  [1/3] 检查 SSH 授权');
  /* 重试几次再下结论。
     踩过一次：网络抖动导致 ssh -T 超时，脚本立刻判定「没配公钥」，
     让用户去 GitHub 加 key —— 但 key 本来就是好的，再推一次就成功了。
     **把瞬时故障说成配置问题，是比直接报错更糟的失败方式。** */
  let sshOk = false;
  let sshOut = '';
  let attempts = 0;
  for (; attempts < 3 && !sshOk; attempts++) {
    if (attempts) { line(`      · 第 ${attempts} 次没通，重试…`); await new Promise((r) => setTimeout(r, 2000)); }
    try {
      const out = execFileSync('ssh', ['-T', 'git@github.com'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 25000 });
      sshOut = out;
      sshOk = /successfully authenticated/i.test(out);
    } catch (e) {
      sshOut = ((e.stdout || '') + (e.stderr || '')).toString();
      // ssh -T 认证成功时也返回非 0，所以靠输出判断
      sshOk = /successfully authenticated/i.test(sshOut);
      // 明确的鉴权拒绝才是真的缺公钥
      if (/permission denied \(publickey\)/i.test(sshOut)) break;
      /* 连接层就断了的话，重试同一个端口没有意义（代理把 22 端口接管了），
         直接跳出重试、去试 443 备用通道。省掉几十秒白等。 */
      if (/connection closed|connection refused|connection timed out|broken pipe|reset by peer/i.test(sshOut)) break;
    }
  }

  if (!sshOk) {
    /* 22 端口不通时，先试 GitHub 的 443 备用通道再下结论。
       国内代理开 fake-IP/TUN 后，github.com 会被解析到 198.18.x 这种保留段，
       22 端口刚连上就被切断；而 ssh.github.com:443 通常还能走。 */
    line('      22 端口不通，试 GitHub 的 443 备用通道…');
    try {
      const out443 = execFileSync('ssh', ['-T', '-o', 'HostName=ssh.github.com', '-p', '443',
        '-o', 'StrictHostKeyChecking=accept-new', 'git@github.com'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 25000 });
      if (/successfully authenticated/i.test(out443)) { sshOk = true; sshOut = out443; }
    } catch (e) {
      const out = ((e.stdout || '') + (e.stderr || '')).toString();
      if (/successfully authenticated/i.test(out)) { sshOk = true; sshOut = out; }
      else sshOut = out || sshOut;
    }
    if (sshOk) {
      SSH_ENV.GIT_SSH_COMMAND = SSH_443;
      line('      ✓ 443 通道可用（22 端口被代理接管了），本次推送改走它');
      line('        注意：这是临时绕行，没有改你的 ~/.ssh/config');
    }
  }

  if (!sshOk) {
    // 分清「网络不通」和「真的没配公钥」—— 两者的处理方式完全不同
    const looksNetwork = !/permission denied \(publickey\)/i.test(sshOut);
    if (looksNetwork) {
      line('  ✗ 连不上 GitHub，但**看不出来是公钥的问题**（更像是网络/代理不通）。');
      line('');
      line('    你的公钥很可能本来就是好的，先直接试一次推送：');
      line('      git push origin main');
      line('');
      line('    如果上面这条报 Permission denied (publickey)，再回来跑本脚本按提示加公钥。');
      line('');
      line('    原始输出：' + (sshOut.trim().split('\n').slice(-2).join(' | ') || '(空)'));
      process.exit(1);
    }
    line('  ✗ GitHub 说没认出这台机器（公钥认证被拒）。需要用一次公钥，之后永久免密。');
    line('');
    line('    要加的公钥（这一整行，复制到 GitHub）:');
    line('');
    try {
      const pub = fs.readFileSync(path.join(os.homedir(), '.ssh', 'id_ed25519_github.pub'), 'utf8').trim();
      line('    ' + pub);
    } catch {
      line('    ✗ 读不到 ~/.ssh/id_ed25519_github.pub，密钥可能没生成成功');
    }
    line('');
    line('    加到哪里：');
    line('      https://github.com/settings/ssh/new');
    line('      Title 随便填（比如 workbuddy），Key type 选 Authentication Key，粘贴上面的整行，Save');
    line('');
    line('    加完再跑一次本脚本即可。这是一次性的，以后所有推送（包括每日自动化）都不用再操作。');
    process.exit(1);
  }
  line('  ✓ SSH 授权正常');

  /* ---------- 2. 可选：归档 ---------- */
  line('');
  if (BACKUP) {
    line('  [2/3] 归档远端现有的 main');
    let remoteMain = '';
    try {
      remoteMain = (git(['ls-remote', '--heads', 'origin', 'main']).trim().split(/\s+/)[0] || '');
    } catch (e) {
      line(`  ✗ 读不到远端 main：${e.message.split('\n')[0]}`);
      process.exit(1);
    }
    if (!remoteMain) {
      line('  远端还没有 main，跳过');
    } else {
      const exists = (() => { try { git(['ls-remote', '--exit-code', '--heads', 'origin', ARCHIVE]); return true; } catch { return false; } })();
      if (exists) {
        line(`  ${ARCHIVE} 已存在，跳过`);
      } else {
        git(['fetch', 'origin', 'main'], { inherit: true });
        git(['push', 'origin', `FETCH_HEAD:refs/heads/${ARCHIVE}`], { inherit: true });
        line(`  ✓ 旧内容已存到远端分支 ${ARCHIVE}`);
      }
    }
  } else {
    line('  [2/3] 跳过归档（默认直接覆盖）');
    line('  真正的回滚安全网是 Vercel：它保留每次部署，面板上可一键回滚到旧版本');
    line('  想保留 git 归档就加 --backup');
  }

  /* ---------- 3. 推送 ---------- */
  line('');
  if (DRY) {
    line('  [3/3] --dry：不推送');
    rule();
    line('  检查完成，远端未改动。');
    line('');
    return;
  }
  line(`  [3/3] 推送到远端 ${branch}:main`);
  /* ★ 先看远端有没有本地没有的提交。
     踩过一次（差点抹掉）：每日资讯是 GitHub Actions 直接提交到 main 的，
     本地放几天没推，远端就会领先十几个提交。而这里原来是**无条件 --force**，
     一推就把那十几个提交连同它们的 feed 内容一起抹掉 —— 而且不报错，
     你只会在几天后发现"某天的资讯怎么没了"。
     现在默认只做快进推送；确实要覆盖必须显式 --force。 */
  let remoteAhead = 0;
  try {
    git(['fetch', 'origin', 'main']);
    /* ★ 必须读 FETCH_HEAD，不能读 origin/main ——
       本仓库里**一个远程跟踪分支都没有**（`git branch -r` 是空的），
       所以 `rev-list HEAD..origin/main` 会直接报错，而那个错误被下面的 catch 吞掉，
       结果 remoteAhead 永远是 0、这条守卫**一次都不会触发**。
       （2026-10-06 实测撞上：本地与远端各领先 1 个提交，脚本照样往下走，
        最后是 git 自己以 non-fast-forward 拒收才没出事 —— 拦住推送的是 git，不是这条守卫。）
       FETCH_HEAD 由上面那句 fetch 保证存在（显式指定分支名时一定写）。 */
    remoteAhead = Number(git(['rev-list', '--count', 'HEAD..FETCH_HEAD']).trim()) || 0;
  } catch { /* 取不到就不拦，下面的快进推送会自然被 git 拒绝 */ }
  if (remoteAhead > 0 && !FORCE) {
    line(`  ✗ 远端 main 有 ${remoteAhead} 个本地没有的提交（通常是每日资讯自动提交）。`);
    line('    直接推会**把它们抹掉**，已中止。先把本地叠到远端之上：');
    line('      git fetch origin main && git rebase FETCH_HEAD');
    line('    （不要写 origin/main —— 本仓库没有远程跟踪分支，那条命令会直接报错）');
    line('    然后重新跑本脚本。确实要覆盖远端，就加 --force。');
    line('');
    process.exit(1);
  }
  if (remoteAhead > 0) line(`  ! --force：将覆盖远端独有的 ${remoteAhead} 个提交`);
  try {
    git(['push', 'origin', `${branch}:main`, ...(FORCE ? ['--force'] : [])], { inherit: true });
  } catch {
    line('  ✗ 推送失败，看上面的 git 报错。');
    process.exit(1);
  }

  rule();
  line('  推送完成 ✓');
  line('');

  /* ---------- 4. 确认 Vercel 真的部署成功了 ----------
     踩过一次：vercel.json 里有个 Vercel 不认识的字段，部署静默失败，
     但线上继续服务上一次成功的版本 —— 页面看着完全正常，
     verify-live 也全绿，我白推了两轮才发现。所以推完必须查部署状态。 */
  line('  等待 Vercel 构建……');
  const repoPath = (() => {
    const m = remote.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    return m ? `${m[1]}/${m[2]}` : '';
  })();
  const headSha = (() => { try { return git(['rev-parse', 'HEAD']).trim(); } catch { return ''; } })();

  if (!repoPath || !headSha) {
    line('  ! 拿不到仓库信息，跳过部署状态检查');
    line('');
    return;
  }

  const API = `https://api.github.com/repos/${repoPath}/commits/${headSha}/status`;
  let final = 'pending';
  let blocked = '';       // 查不到状态的原因（限流等）—— 不能当成"部署失败"
  for (let i = 1; i <= 24; i++) {            // 最多等约 4 分钟
    await new Promise((r) => setTimeout(r, 10000));
    try {
      const res = await fetch(API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'AIWanxiangDeploy' } });
      const j = await res.json();
      /* 匿名调用每小时只有 60 次，跑几次推送+轮询就会用完。
         用完时 API 返回的是 message 而不是 statuses —— 原来那种情况会被当成
         "还没有状态记录"，一直轮询到超时，最后打印成**部署失败**。
         把限流说成失败，比不知道更糟：你会去查一个根本不存在的问题。 */
      if (j.message && /rate limit/i.test(j.message)) { blocked = 'GitHub API 匿名限流（每小时 60 次）'; break; }
      if (j.message) { blocked = j.message.slice(0, 80); break; }
      const vercel = (j.statuses || []).find((s) => /vercel/i.test(s.context || ''));
      if (!vercel) { process.stdout.write(`\r    第 ${i} 次：还没有状态记录…   `); continue; }
      final = vercel.state;
      process.stdout.write(`\r    第 ${i} 次：${vercel.state}                        `);
      if (vercel.state !== 'pending') break;
    } catch {
      process.stdout.write(`\r    第 ${i} 次：查询失败，重试…   `);
    }
  }
  line('');
  line('');

  if (blocked) {
    line(`  ? 查不到部署状态：${blocked}`);
    line('    **这不代表部署失败**，只是没办法从接口确认。用内容确认：');
    line('      node scripts/verify-live.mjs');
    line('    或者等一会儿直接打开线上页面看改动在不在。');
    line('');
  } else if (final === 'success') {
    line('  ✓ Vercel 部署成功，线上已是最新版本');
    line('');
  } else if (final === 'pending') {
    line('  ! 4 分钟内没等到结果，去 Vercel 面板确认一下');
    line('');
  } else {
    line('  ✗ **Vercel 部署失败**。线上现在还是上一个版本的页面，看着正常但其实没更新。');
    line('');
    line('  排查顺序：');
    line('    1. 打开 https://vercel.com/dashboard 看这次构建的日志');
    line('    2. 最常见原因是 vercel.json 里有 Vercel 不认识的字段（本地 node scripts/check.mjs 能查出来）');
    line('    3. 改完重新跑本脚本');
    line('');
    process.exitCode = 1;
  }
}

await main();
