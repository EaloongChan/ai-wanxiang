/**
 * Clockwork Grove — canvas renderer.
 *
 * Knows how to draw, nothing about the rules. main.js tells it what changed through
 * setTree / fell / burst / floatText / shake and drives tick(dt) + render().
 *
 * Cost control:
 *   - redraws only while something is moving (dirty flag + animation timers), so an idle
 *     tab costs nothing;
 *   - device pixel ratio is capped at 2;
 *   - particles come from a fixed pool and are reused, never allocated per hit.
 */

const PARTICLE_MAX = 200;
const FLOATER_MAX = 24;

export function createStage(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let bg = null;
  let groundY = 0;

  let tree = null;             // { def, hp, grow, squash, gear }
  let falling = null;          // { def, t, dir }
  let stumpDef = null;         // the tree that last stood here; gives the stump its colours
  let shake = 0;
  let dirty = true;
  let time = 0;

  const particles = Array.from({ length: PARTICLE_MAX }, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0, size: 0, rot: 0, spin: 0, color: '#fff' }));
  const floaters = Array.from({ length: FLOATER_MAX }, () => ({ on: false, x: 0, y: 0, vy: 0, life: 0, max: 0, text: '', color: '#fff', size: 16, scale: 1 }));

  /* ---------- geometry ---------- */

  function resize() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    groundY = h * 0.86;
    buildBackground();
    dirty = true;
  }

  const treeHeight = () => Math.min(h * 0.52, w * 0.5, 340);
  const canopy = () => ({ x: w / 2, y: groundY - treeHeight() * 0.62, r: treeHeight() * 0.3 });

  /* ---------- static background ---------- */

  function buildBackground() {
    bg = document.createElement('canvas');
    bg.width = canvas.width;
    bg.height = canvas.height;
    const b = bg.getContext('2d');
    b.scale(dpr, dpr);

    const sky = b.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#080b16');
    sky.addColorStop(0.55, '#101830');
    sky.addColorStop(1, '#1b1a38');
    b.fillStyle = sky;
    b.fillRect(0, 0, w, h);

    // sparks, placed by a fixed hash so the sky does not flicker on resize
    for (let i = 0; i < 46; i++) {
      const a = frac(Math.sin(i * 127.1) * 43758.5453);
      const c = frac(Math.sin(i * 311.7) * 12543.1233);
      b.globalAlpha = 0.25 + a * 0.5;
      b.fillStyle = i % 5 === 0 ? '#ffd27a' : '#cfe3ff';
      const s = 0.8 + c * 1.3;
      b.fillRect(a * w, c * groundY * 0.8, s, s);
    }
    b.globalAlpha = 1;

    hills(b, groundY - 30, 46, '#141c33', 0.011, 0);
    hills(b, groundY - 6, 30, '#111827', 0.017, 40);
  }

  function hills(b, base, amp, color, freq, phase) {
    b.fillStyle = color;
    b.beginPath();
    b.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) {
      const y = base - Math.abs(Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.7 + phase) * amp * 0.35);
      b.lineTo(x, y);
    }
    b.lineTo(w, h);
    b.closePath();
    b.fill();
  }

  /* ---------- shapes ---------- */

  function gearPath(c, cx, cy, r, teeth, rot, tooth = 0.8) {
    const n = teeth * 2;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      const rad = i % 2 === 0 ? r : r * tooth;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i) c.lineTo(x, y); else c.moveTo(x, y);
    }
    c.closePath();
    c.moveTo(cx + r * 0.3, cy);
    c.arc(cx, cy, r * 0.3, 0, Math.PI * 2, true);
  }

  function tapered(c, x1, y1, w1, x2, y2, w2) {
    c.beginPath();
    c.moveTo(x1 - w1 / 2, y1);
    c.lineTo(x2 - w2 / 2, y2);
    c.arc(x2, y2, w2 / 2, Math.PI, 0);
    c.lineTo(x1 + w1 / 2, y1);
    c.closePath();
  }

  function drawTree(def, cx, baseY, H, o) {
    const grow = o.grow;
    const squash = o.squash;
    ctx.save();
    ctx.translate(cx, baseY);
    ctx.rotate(o.tilt);
    ctx.globalAlpha = o.alpha;
    ctx.scale((1 + squash * 0.05) * grow, (1 - squash * 0.05) * grow);

    if (def.gears) {
      const g = ctx.createRadialGradient(0, -H * 0.62, H * 0.05, 0, -H * 0.62, H * 0.62);
      g.addColorStop(0, hex(def.glow, 0.26));
      g.addColorStop(1, hex(def.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-H, -H * 1.3, H * 2, H * 1.4);
    }

    // trunk and two limbs
    const tw = H * 0.17;
    ctx.fillStyle = def.trunk;
    tapered(ctx, 0, 6, tw, 0, -H * 0.6, tw * 0.55);
    ctx.fill();
    tapered(ctx, -tw * 0.1, -H * 0.4, tw * 0.36, -H * 0.24, -H * 0.6, tw * 0.16);
    ctx.fill();
    tapered(ctx, tw * 0.1, -H * 0.46, tw * 0.34, H * 0.25, -H * 0.64, tw * 0.15);
    ctx.fill();

    // rivets
    ctx.fillStyle = hex(def.glow, 0.7);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, -H * (0.12 + i * 0.15), Math.max(1.5, H * 0.013), 0, Math.PI * 2);
      ctx.fill();
    }

    // canopy
    const blobs = [[0, -0.64, 0.31], [-0.25, -0.52, 0.21], [0.25, -0.54, 0.22], [0, -0.86, 0.19]];
    for (const [x, y, r] of blobs) {
      const px = x * H;
      const py = y * H;
      const pr = r * H;
      const g = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.4, pr * 0.1, px, py, pr);
      g.addColorStop(0, def.leaf);
      g.addColorStop(1, def.leafDark);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    // gears nested in the canopy
    const gears = [[-0.14, -0.64, 0.095, 9, 1], [0.15, -0.74, 0.075, 8, -1.4], [0.03, -0.52, 0.055, 7, 1.9]];
    for (const [x, y, r, teeth, speed] of gears) {
      const px = x * H;
      const py = y * H;
      const pr = r * H;
      ctx.fillStyle = hex(def.leafDark, 0.95);
      gearPath(ctx, px, py, pr, teeth, o.gear * speed);
      ctx.fill('evenodd');
      ctx.fillStyle = hex(def.glow, 0.85);
      ctx.beginPath();
      ctx.arc(px, py, pr * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawStump(def, grow) {
    if (!def) return;
    const H = treeHeight();
    const tw = H * 0.17;
    ctx.save();
    ctx.translate(w / 2, groundY);
    ctx.fillStyle = def.trunk;
    tapered(ctx, 0, 6, tw, 0, -H * 0.07 * grow, tw * 0.92);
    ctx.fill();
    ctx.fillStyle = hex(def.glow, 0.55);
    ctx.beginPath();
    ctx.ellipse(0, -H * 0.07 * grow, tw * 0.42, tw * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- public: scene changes ---------- */

  function setTree(def, hpRatio) {
    if (!tree || tree.def !== def) tree = { def, hp: hpRatio, grow: reduced ? 1 : 0, squash: 0, gear: Math.random() * 6 };
    tree.hp = hpRatio;
    dirty = true;
  }

  function hit(strength = 1) {
    if (tree) tree.squash = Math.min(1.4, strength);
    if (!reduced) shake = Math.min(9, shake + 2.2 * strength);
    dirty = true;
  }

  function fell(def, dir) {
    falling = { def, t: 0, dir };
    stumpDef = def;
    tree = null;
    if (!reduced) shake = Math.min(11, shake + 5);
    dirty = true;
  }

  function burst(x, y, color, count, power = 1) {
    if (reduced) count = Math.min(3, count);
    let left = count;
    for (const p of particles) {
      if (p.on || left <= 0) continue;
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const sp = (90 + Math.random() * 220) * power;
      p.on = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = p.max = 0.35 + Math.random() * 0.4;
      p.size = 2 + Math.random() * 3.5;
      p.rot = Math.random() * 6;
      p.spin = (Math.random() - 0.5) * 16;
      p.color = color;
      left--;
    }
    dirty = true;
  }

  let lastGain = null;       // the most recent "+N" floater, so rapid gains add up instead of piling up

  /**
   * Rising text. A gain that arrives within 140 ms of the previous one, in the same
   * colour, is added to it: forty clicks a second then read as "+38.5", not as a clump
   * of overlapping "+1"s.
   */
  function floatText(x, y, text, color, size = 17, scale = 1) {
    const isGain = /^[+-][\d.]+/.test(text);
    if (isGain && lastGain && lastGain.on && lastGain.max - lastGain.life < 0.14 && lastGain.color === color) {
      lastGain.text = formatGain(parseFloat(lastGain.text) + parseFloat(text));
      lastGain.life = lastGain.max;
      dirty = true;
      return;
    }
    let slot = floaters.find((f) => !f.on);
    if (!slot) {
      slot = floaters.reduce((oldest, f) => (f.life < oldest.life ? f : oldest), floaters[0]);
    }
    Object.assign(slot, { on: true, x: x + (Math.random() - 0.5) * 28, y, vy: -62, life: 0.85, max: 0.85, text, color, size, scale });
    lastGain = isGain ? slot : null;
    dirty = true;
  }

  /* ---------- frame ---------- */

  function tick(dt) {
    time += dt;
    let live = false;

    if (tree) {
      if (tree.grow < 1) { tree.grow = Math.min(1, tree.grow + dt / 0.22); live = true; }
      if (tree.squash > 0) { tree.squash = Math.max(0, tree.squash - dt * 14); live = true; }
      tree.gear += dt * (0.35 + (1 - tree.hp) * 1.1);
    }
    if (falling) {
      falling.t += dt / 0.34;
      if (falling.t >= 1) falling = null;
      live = true;
    }

    for (const p of particles) {
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      p.vy += 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      live = true;
    }
    for (const f of floaters) {
      if (!f.on) continue;
      f.life -= dt;
      if (f.life <= 0) { f.on = false; continue; }
      f.y += f.vy * dt;
      f.vy *= 1 - dt * 1.5;
      live = true;
    }
    if (shake > 0) { shake = Math.max(0, shake - dt * 34); live = true; }
    if (live) dirty = true;
    return live;
  }

  function render() {
    if (!dirty || !bg) return false;
    dirty = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(bg, 0, 0, w, h);

    // distant clockwork, slow enough to read as scenery
    ctx.fillStyle = 'rgba(255,210,122,.05)';
    const gears = [[0.12, 0.2, 0.22, 12, 0.06], [0.3, 0.34, 0.13, 10, -0.11], [0.88, 0.26, 0.18, 12, -0.05]];
    for (const [fx, fy, fr, teeth, speed] of gears) {
      const r = Math.min(w, h) * fr;
      gearPath(ctx, w * fx, h * fy, r, teeth, time * speed);
      ctx.fill('evenodd');
    }

    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.6 : 0;

    ctx.save();
    ctx.translate(sx, sy);

    // ground
    const soil = ctx.createLinearGradient(0, groundY, 0, h);
    soil.addColorStop(0, '#1f2338');
    soil.addColorStop(1, '#0d1020');
    ctx.fillStyle = soil;
    ctx.fillRect(-20, groundY, w + 40, h - groundY + 20);
    ctx.fillStyle = '#3a4668';
    ctx.fillRect(-20, groundY - 2, w + 40, 3);
    ctx.fillStyle = 'rgba(255,210,122,.35)';
    for (let x = ((w / 2) % 34) - 34; x < w + 20; x += 34) {
      ctx.beginPath();
      ctx.arc(x, groundY + 12, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    if (falling) {
      const t = falling.t;
      const ease = t * t;
      drawTree(falling.def, w / 2, groundY, treeHeight() * falling.def.scale, {
        grow: 1, squash: 0, gear: time * 0.4,
        tilt: falling.dir * ease * 1.25,
        alpha: t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45,
      });
    }
    if (tree) {
      drawTree(tree.def, w / 2, groundY, treeHeight() * tree.def.scale, { grow: tree.grow, squash: tree.squash, gear: tree.gear, tilt: 0, alpha: 1 });
    } else {
      drawStump(stumpDef, 1);
    }

    for (const p of particles) {
      if (!p.on) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const f of floaters) {
      if (!f.on) continue;
      const k = f.life / f.max;
      const pop = 1 + (1 - Math.min(1, (f.max - f.life) / 0.1)) * 0.35;
      ctx.globalAlpha = Math.min(1, k * 2.2);
      ctx.font = `600 ${Math.round(f.size * f.scale * pop)}px "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(6,8,16,.85)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    ctx.restore();
    return true;
  }

  resize();
  return { resize, setTree, hit, fell, burst, floatText, tick, render, canopy, ground: () => groundY, size: () => ({ w, h }) };
}

function hex(color, alpha) {
  const n = parseInt(color.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

function frac(x) {
  return x - Math.floor(x);
}

function formatGain(value) {
  return `${value < 0 ? '-' : '+'}${value < 100 ? Number(value.toFixed(1)) : Math.round(value)}`;
}
