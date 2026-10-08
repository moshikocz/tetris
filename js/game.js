(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------
  const COLS = 10;
  const ROWS = 20;
  const HIDDEN = 2;
  const TOTAL = ROWS + HIDDEN;
  const CELL = 34;
  const TILE = 64;
  const VARIANTS = 3;

  const LOCK_MS = 500;
  const MAX_LOCK_RESETS = 15;
  const CLEAR_MS = 420;
  const DAS_MS = 150;
  const ARR_MS = 45;
  const SOFT_MS = 32;

  const TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  };

  // SRS wall kicks, (x, y) with y pointing up.
  const KICKS_JLSTZ = {
    '01': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '10': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '12': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '21': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '23': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '32': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '30': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '03': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  };
  const KICKS_I = {
    '01': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '10': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '12': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '21': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '23': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '32': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '30': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '03': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  };

  // Each piece is a different (stained) wood.
  const WOODS = {
    I: { light: [246, 224, 182], dark: [205, 168, 112] }, // maple
    J: { light: [140, 150, 170], dark: [78, 86, 104] },   // blue-stained ash
    L: { light: [236, 160, 92], dark: [178, 98, 44] },    // teak
    O: { light: [232, 190, 100], dark: [176, 126, 48] },  // golden oak
    S: { light: [176, 178, 98], dark: [112, 116, 48] },   // olive-stained pine
    T: { light: [214, 120, 112], dark: [150, 62, 62] },   // cherry
    Z: { light: [168, 70, 52], dark: [100, 34, 26] },     // mahogany
  };

  const SCORE_TABLE = [0, 100, 300, 500, 800];
  const CLEAR_LABELS = [
    null,
    { jp: '咲く!', he: 'פריחה!' },
    { jp: '二輪咲き!', he: 'פריחה כפולה!' },
    { jp: '三輪咲き!', he: 'פריחה משולשת!' },
    { jp: '満開!', he: 'טטריס! פריחה מלאה' },
  ];

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ---------------------------------------------------------------------------
  // Procedural wood
  // ---------------------------------------------------------------------------
  function makeNoise(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    const rnd = () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
    const vals = new Float32Array(256);
    const perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) { vals[i] = rnd(); perm[i] = i; }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const v = (x, y) => vals[perm[perm[x & 255] + (y & 255)]];
    const noise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
      const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
      return lerp(lerp(a, b, u), lerp(c, d, u), w);
    };
    noise.fbm = (x, y) => noise(x, y) * 0.5 + noise(x * 2, y * 2) * 0.25 + noise(x * 4, y * 4) * 0.125;
    return noise;
  }

  // Paints wood grain (horizontal) into an ImageData region.
  function paintWood(img, x0, y0, w, h, opts) {
    const { light, dark, seed = 1, ringFreq = 0.09, warp = 7, fiber = 0.22, knot = null, scale = 1 } = opts;
    const n = makeNoise(seed);
    const n2 = makeNoise(seed + 101);
    const data = img.data;
    const iw = img.width;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = x * scale, sy = y * scale;
        let ring = sy * ringFreq + n.fbm(sx * 0.012, sy * 0.05) * warp + seed * 0.37;
        if (knot) {
          const dx = (x - knot.x) / knot.rx, dy = (y - knot.y) / knot.ry;
          const d2 = dx * dx + dy * dy;
          ring += Math.exp(-d2) * 4 + Math.sqrt(d2) * Math.exp(-d2 * 0.5) * 2;
        }
        let t = 0.5 + 0.5 * Math.sin(ring * Math.PI * 2);
        t = Math.pow(t, 2.6);
        const f = n2(sx * 0.06, sy * 1.1);
        const k = clamp(t * 0.7 + f * fiber + n.fbm(sx * 0.03, sy * 0.03) * 0.18, 0, 1);
        const i = ((y0 + y) * iw + (x0 + x)) * 4;
        data[i] = lerp(light[0], dark[0], k);
        data[i + 1] = lerp(light[1], dark[1], k);
        data[i + 2] = lerp(light[2], dark[2], k);
        data[i + 3] = 255;
      }
    }
  }

  function woodCanvas(w, h, opts) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    paintWood(img, 0, 0, w, h, opts);
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function wallTexture() {
    const S = 512, PH = 64;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(S, S);
    for (let p = 0; p < S / PH; p++) {
      const tint = rand(-14, 14);
      paintWood(img, 0, p * PH, S, PH, {
        light: [96 + tint, 62 + tint * 0.6, 38 + tint * 0.4],
        dark: [52 + tint * 0.5, 31, 18],
        seed: p * 7 + 3,
        ringFreq: 0.11,
        warp: 6,
        scale: 1,
      });
    }
    ctx.putImageData(img, 0, 0);
    // plank seams + butt joints (one at x=0 hides the tiling seam)
    for (let p = 0; p < S / PH; p++) {
      const y = p * PH;
      ctx.fillStyle = 'rgba(15,6,2,.85)';
      ctx.fillRect(0, y, S, 3);
      ctx.fillStyle = 'rgba(255,210,160,.08)';
      ctx.fillRect(0, y + 3, S, 1);
      const joints = [0, ((p * 197) % 380) + 66];
      for (const jx of joints) {
        ctx.fillStyle = 'rgba(15,6,2,.8)';
        ctx.fillRect(jx, y, 3, PH);
        ctx.fillStyle = 'rgba(255,210,160,.07)';
        ctx.fillRect(jx + 3, y, 1, PH);
        // little nails near joints
        for (const ny of [y + 14, y + PH - 14]) {
          for (const nx of [jx + 10, (jx - 10 + S) % S]) {
            const g = ctx.createRadialGradient(nx - 1, ny - 1, 0, nx, ny, 3.2);
            g.addColorStop(0, '#d9c6a6');
            g.addColorStop(1, '#2a1c10');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(nx, ny, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
    return c;
  }

  function woodTile(type, variant) {
    const wood = WOODS[type];
    const s = TILE;
    const base = woodCanvas(s, s, {
      light: wood.light,
      dark: wood.dark,
      seed: TYPES.indexOf(type) * 13 + variant * 5 + 1,
      ringFreq: 0.11,
      warp: 5,
      fiber: 0.25,
      knot: variant === 2 ? { x: rand(18, 46), y: rand(18, 46), rx: 7, ry: 4 } : null,
    });
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    const r = s * 0.14;

    ctx.save();
    roundRectPath(ctx, 1, 1, s - 2, s - 2, r);
    ctx.clip();
    ctx.drawImage(base, 0, 0);

    // bevels
    const b = s * 0.13;
    const bevel = (pts, color) => {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    bevel([0, 0, s, 0, s - b, b, b, b], 'rgba(255,240,210,.38)');
    bevel([0, 0, b, b, b, s - b, 0, s], 'rgba(255,240,210,.2)');
    bevel([0, s, b, s - b, s - b, s - b, s, s], 'rgba(30,12,2,.42)');
    bevel([s, 0, s, s, s - b, s - b, s - b, b], 'rgba(30,12,2,.3)');

    // varnish sheen
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, 'rgba(255,255,255,.18)');
    g.addColorStop(0.45, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(0,0,0,.18)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.restore();

    // outline
    roundRectPath(ctx, 1, 1, s - 2, s - 2, r);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(25,10,2,.85)';
    ctx.stroke();

    // tiny wooden peg
    const pg = ctx.createRadialGradient(s / 2 - 2, s / 2 - 2, 0, s / 2, s / 2, s * 0.08);
    pg.addColorStop(0, 'rgba(255,235,200,.35)');
    pg.addColorStop(0.6, 'rgba(60,30,10,.15)');
    pg.addColorStop(1, 'rgba(30,12,2,.45)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.075, 0, Math.PI * 2);
    ctx.fill();
    return c;
  }

  // ---------------------------------------------------------------------------
  // Anime sakura sprites
  // ---------------------------------------------------------------------------
  const PALETTES = [
    { edge: '#ff8fbd', mid: '#ffeef5', core: '#ff4f8f', line: '#d23a74' },
    { edge: '#ffbfd6', mid: '#ffffff', core: '#ff7aa8', line: '#df6c97' },
    { edge: '#ff5f99', mid: '#ffc2d9', core: '#d1145a', line: '#a50f48' },
    { edge: '#e9a3ff', mid: '#fbf0ff', core: '#b840d8', line: '#8f2cab' },
    { edge: '#ffd0e0', mid: '#ffffff', core: '#ff9cbf', line: '#e08aab' },
  ];

  function petalPath(ctx, r, notch) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-r * 0.55, -r * 0.22, -r * 0.66, -r * 0.84, -r * 0.22, -r);
    if (notch) {
      ctx.lineTo(0, -r * 0.82);
      ctx.lineTo(r * 0.22, -r);
    } else {
      ctx.quadraticCurveTo(0, -r * 1.14, r * 0.22, -r);
    }
    ctx.bezierCurveTo(r * 0.66, -r * 0.84, r * 0.55, -r * 0.22, 0, 0);
    ctx.closePath();
  }

  function drawStar(ctx, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const a2 = a + Math.PI / 4;
      ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
      ctx.lineTo(Math.cos(a2) * size * 0.22, Math.sin(a2) * size * 0.22);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function makeBlossom(pal, kind) {
    const S = 160;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2);
    const R = S * 0.4;

    // soft glow
    const glow = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, S * 0.5);
    glow.addColorStop(0, 'rgba(255,200,225,.55)');
    glow.addColorStop(1, 'rgba(255,200,225,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-S / 2, -S / 2, S, S);

    const layers = kind === 'yae' ? [[R, 0], [R * 0.68, Math.PI / 5]] : [[R, 0]];
    const notch = kind !== 'ume';
    for (const [r, off] of layers) {
      for (let i = 0; i < 5; i++) {
        ctx.save();
        ctx.rotate(off + (i * Math.PI * 2) / 5);
        ctx.translate(0, -r * 0.05);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
        g.addColorStop(0, pal.core);
        g.addColorStop(0.3, pal.mid);
        g.addColorStop(0.72, pal.mid);
        g.addColorStop(1, pal.edge);
        petalPath(ctx, r, notch);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = S * 0.022;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = pal.line;
        ctx.stroke();
        // vein
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.18);
        ctx.quadraticCurveTo(r * 0.04, -r * 0.4, 0, -r * 0.6);
        ctx.lineWidth = S * 0.009;
        ctx.strokeStyle = pal.core + '88';
        ctx.stroke();
        // anime gloss
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.24, -r * 0.62, r * 0.07, r * 0.17, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // center + stamens
    ctx.fillStyle = pal.core;
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = S * 0.014;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.2;
      const len = R * (i % 2 ? 0.3 : 0.38);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.1, Math.sin(a) * R * 0.1);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.lineWidth = S * 0.01;
      ctx.strokeStyle = pal.line;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(Math.cos(a) * len, Math.sin(a) * len, S * 0.018, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd94d';
      ctx.fill();
      ctx.lineWidth = S * 0.007;
      ctx.strokeStyle = '#d98a14';
      ctx.stroke();
    }

    // sparkle shine
    drawStar(ctx, R * 0.62, -R * 0.68, S * 0.08, '#fff');
    drawStar(ctx, -R * 0.7, R * 0.5, S * 0.04, '#fff');
    return c;
  }

  function makePetal(pal) {
    const S = 48;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const r = S * 0.8;
    ctx.translate(S / 2, S / 2 + r / 2);
    const g = ctx.createLinearGradient(0, 0, 0, -r);
    g.addColorStop(0, pal.core);
    g.addColorStop(0.35, pal.mid);
    g.addColorStop(1, pal.edge);
    petalPath(ctx, r, true);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = pal.line;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.2, -r * 0.6, r * 0.06, r * 0.16, -0.4, 0, Math.PI * 2);
    ctx.fill();
    return c;
  }

  function makeSparkle(color) {
    const S = 40;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(0.3, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    drawStar(ctx, S / 2, S / 2, S * 0.48, '#fff');
    return c;
  }

  // ---------------------------------------------------------------------------
  // Sound (tiny Web Audio synth: wooden "tok" + koto-like plucks)
  // ---------------------------------------------------------------------------
  const Sound = {
    ctx: null,
    muted: false,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { this.ctx = null; }
    },
    tok(strength = 1) {
      if (this.muted || !this.ctx) return;
      const ac = this.ctx, t = ac.currentTime;
      const len = Math.floor(ac.sampleRate * 0.06);
      const buf = ac.createBuffer(1, len, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 2;
      const gn = ac.createGain();
      gn.gain.value = 0.35 * strength;
      src.connect(bp).connect(gn).connect(ac.destination);
      src.start(t);

      const o = ac.createOscillator();
      const og = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.08);
      og.gain.setValueAtTime(0.25 * strength, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(og).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.12);
    },
    pluck(freq, when) {
      if (this.muted || !this.ctx) return;
      const ac = this.ctx, t = ac.currentTime + when;
      const o = ac.createOscillator();
      const o2 = ac.createOscillator();
      const lp = ac.createBiquadFilter();
      const g = ac.createGain();
      o.type = 'sawtooth';
      o2.type = 'triangle';
      o.frequency.value = freq;
      o2.frequency.value = freq * 2.003;
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(freq * 8, t);
      lp.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.5);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      o.connect(lp);
      o2.connect(lp);
      lp.connect(g).connect(ac.destination);
      o.start(t); o2.start(t);
      o.stop(t + 1.2); o2.stop(t + 1.2);
    },
    clear(n) {
      // C major pentatonic, in key with the music
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];
      const count = n === 4 ? 9 : n + 2;
      const step = n === 4 ? 0.06 : 0.08;
      for (let i = 0; i < count; i++) this.pluck(scale[i % scale.length], i * step);
    },
  };

  // ---------------------------------------------------------------------------
  // Music: an upbeat anime-opening style loop, synthesized live with Web Audio.
  // Royal-road progression (IV-V-iii-vi), driving 8th-note bass, drums, arps
  // and a lead melody with echo. Verse then chorus, 16 bars, looped.
  // ---------------------------------------------------------------------------
  const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  const CHORDS = {
    F: { bass: 41, notes: [53, 57, 60, 64] },
    G: { bass: 43, notes: [55, 59, 62, 67] },
    Em: { bass: 40, notes: [52, 55, 59, 62] },
    Am: { bass: 45, notes: [57, 60, 64, 67] },
    C: { bass: 36, notes: [55, 60, 64, 67] },
  };
  const PROGRESSION = ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'];

  // [step, midi, length in 16th steps] per bar
  const VERSE = [
    [[0, 76, 2], [2, 74, 2], [4, 72, 2], [6, 74, 2], [8, 76, 4], [12, 79, 4]],
    [[0, 77, 2], [2, 76, 2], [4, 74, 4], [8, 71, 2], [10, 74, 2], [12, 79, 4]],
    [[0, 76, 3], [3, 74, 1], [4, 76, 2], [6, 79, 2], [8, 83, 4], [12, 81, 2], [14, 79, 2]],
    [[0, 81, 6], [6, 76, 2], [8, 72, 4]],
    [[0, 69, 2], [2, 72, 2], [4, 77, 2], [6, 76, 2], [8, 77, 2], [10, 79, 2], [12, 81, 4]],
    [[0, 79, 2], [2, 77, 2], [4, 76, 2], [6, 74, 2], [8, 71, 2], [10, 74, 2], [12, 79, 2], [14, 77, 2]],
    [[0, 76, 4], [4, 79, 2], [6, 84, 6], [12, 83, 2], [14, 81, 2]],
    [[0, 79, 8], [12, 76, 2], [14, 79, 2]],
  ];
  const CHORUS = [
    [[0, 81, 3], [3, 79, 3], [6, 81, 2], [8, 84, 4], [12, 81, 2], [14, 79, 2]],
    [[0, 79, 3], [3, 77, 3], [6, 79, 2], [8, 83, 4], [12, 86, 4]],
    [[0, 88, 3], [3, 86, 3], [6, 83, 2], [8, 79, 2], [10, 83, 2], [12, 86, 4]],
    [[0, 84, 6], [6, 83, 2], [8, 81, 6], [14, 76, 2]],
    [[0, 77, 2], [2, 81, 2], [4, 84, 4], [8, 81, 2], [10, 84, 2], [12, 89, 4]],
    [[0, 88, 2], [2, 86, 2], [4, 83, 2], [6, 79, 2], [8, 86, 4], [12, 83, 4]],
    [[0, 84, 4], [4, 86, 2], [6, 88, 6], [12, 91, 4]],
    [[0, 88, 4], [4, 86, 2], [6, 84, 10]],
  ];

  const Music = {
    on: true,
    playing: false,
    bpm: 150,
    step: 0,
    nextTime: 0,
    timer: null,
    out: null,
    echo: null,
    noise: null,

    setup() {
      const ac = Sound.ctx;
      if (!ac || this.out) return !!this.out;
      this.out = ac.createGain();
      this.out.gain.value = 0;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      this.out.connect(comp).connect(ac.destination);

      // dotted-8th echo for the lead and arps
      this.echo = ac.createGain();
      const delay = ac.createDelay(1);
      const fb = ac.createGain();
      const wet = ac.createGain();
      const tone = ac.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 2800;
      fb.gain.value = 0.32;
      wet.gain.value = 0.35;
      this.delay = delay;
      this.echo.connect(delay);
      delay.connect(tone).connect(fb).connect(delay);
      tone.connect(wet).connect(this.out);

      const len = ac.sampleRate;
      this.noise = ac.createBuffer(1, len, ac.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    },

    stepDur() { return 60 / this.bpm / 4; },

    setLevel(level) {
      this.bpm = 150 + Math.min(level - 1, 10) * 3;
      if (this.delay) this.delay.delayTime.value = this.stepDur() * 3;
    },

    play(fromStart) {
      if (!this.on || Sound.muted || !Sound.ctx || !this.setup()) return;
      const ac = Sound.ctx;
      if (fromStart) this.step = 0;
      this.delay.delayTime.value = this.stepDur() * 3;
      this.out.gain.cancelScheduledValues(ac.currentTime);
      this.out.gain.setTargetAtTime(0.55, ac.currentTime, 0.15);
      if (this.playing) return;
      this.playing = true;
      this.nextTime = ac.currentTime + 0.08;
      this.timer = setInterval(() => this.schedule(), 25);
    },

    stop() {
      if (!this.playing) return;
      this.playing = false;
      clearInterval(this.timer);
      const ac = Sound.ctx;
      this.out.gain.cancelScheduledValues(ac.currentTime);
      this.out.gain.setTargetAtTime(0, ac.currentTime, 0.08);
    },

    schedule() {
      const ac = Sound.ctx;
      while (this.nextTime < ac.currentTime + 0.15) {
        this.playStep(this.step, this.nextTime);
        this.nextTime += this.stepDur();
        this.step = (this.step + 1) % (16 * 16);
      }
    },

    playStep(step, t) {
      const bar = Math.floor(step / 16) % 16;
      const s = step % 16;
      const chorus = bar >= 8;
      const chord = CHORDS[PROGRESSION[bar % 8]];
      const sd = this.stepDur();
      const fill = bar === 7 && s >= 12;

      // drums
      if (chorus) {
        if (s % 4 === 0) this.kick(t);
      } else if (s === 0 || s === 8 || s === 10) {
        this.kick(t);
      }
      if (s === 4 || s === 12 || (fill && s > 12)) this.snare(t, fill ? 0.7 : 1);
      if (chorus) this.hat(t, s % 4 === 2, s % 2 ? 0.5 : 1);
      else if (s % 2 === 0) this.hat(t, false, s % 4 ? 0.6 : 1);
      if (bar % 8 === 0 && s === 0 && step > 0) this.crash(t);

      // driving 8th-note bass with octave jumps
      if (s % 2 === 0) {
        const m = chord.bass + (s % 4 === 2 ? 12 : 0);
        this.bass(midiHz(m), t, sd * 1.8);
      }

      // pad in the verse, sparkly 16th arps in the chorus
      if (!chorus && s === 0) for (const n of chord.notes) this.pad(midiHz(n), t, sd * 16);
      if (chorus) {
        const order = [0, 1, 2, 3, 2, 1, 2, 3];
        const n = chord.notes[order[s % 8]] + 12;
        this.arp(midiHz(n), t, sd);
        if (s === 0 || s === 6 || s === 10) for (const n2 of chord.notes) this.stab(midiHz(n2), t, sd * 1.5);
      }

      // melody
      const line = (chorus ? CHORUS : VERSE)[bar % 8];
      for (const [st, m, len] of line) if (st === s) this.lead(midiHz(m), t, sd * len, chorus);
    },

    env(g, t, peak, attack, dur, release) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.setValueAtTime(peak, t + Math.max(attack, dur - release));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    },

    kick(t) {
      const ac = Sound.ctx;
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(g).connect(this.out);
      o.start(t); o.stop(t + 0.35);
    },

    noiseHit(t, type, freq, peak, dur) {
      const ac = Sound.ctx;
      const src = ac.createBufferSource();
      src.buffer = this.noise;
      const f = ac.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = ac.createGain();
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(f).connect(g).connect(this.out);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.02);
    },

    snare(t, v) {
      this.noiseHit(t, 'highpass', 1400, 0.45 * v, 0.16);
      const ac = Sound.ctx;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
      g.gain.setValueAtTime(0.3 * v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(g).connect(this.out);
      o.start(t); o.stop(t + 0.12);
    },

    hat(t, open, v) {
      this.noiseHit(t, 'highpass', 7500, (open ? 0.12 : 0.1) * v, open ? 0.22 : 0.045);
    },

    crash(t) {
      this.noiseHit(t, 'highpass', 5000, 0.18, 1.4);
    },

    bass(freq, t, dur) {
      const ac = Sound.ctx;
      const o = ac.createOscillator(), o2 = ac.createOscillator();
      const f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth';
      o2.type = 'square';
      o.frequency.value = freq;
      o2.frequency.value = freq / 2;
      f.type = 'lowpass';
      f.Q.value = 6;
      f.frequency.setValueAtTime(1400, t);
      f.frequency.exponentialRampToValueAtTime(260, t + dur);
      this.env(g, t, 0.2, 0.005, dur, 0.05);
      o.connect(f); o2.connect(f);
      f.connect(g).connect(this.out);
      o.start(t); o2.start(t);
      o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
    },

    pad(freq, t, dur) {
      const ac = Sound.ctx;
      const f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = 'lowpass';
      f.frequency.value = 1500;
      this.env(g, t, 0.035, 0.12, dur, 0.3);
      f.connect(g).connect(this.out);
      for (const det of [-9, 9]) {
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        o.detune.value = det;
        o.connect(f);
        o.start(t); o.stop(t + dur + 0.02);
      }
    },

    arp(freq, t, dur) {
      const ac = Sound.ctx;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.045, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.95);
      o.connect(g);
      g.connect(this.out);
      g.connect(this.echo);
      o.start(t); o.stop(t + dur);
    },

    stab(freq, t, dur) {
      const ac = Sound.ctx;
      const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      f.type = 'lowpass';
      f.frequency.setValueAtTime(3200, t);
      f.frequency.exponentialRampToValueAtTime(600, t + dur);
      this.env(g, t, 0.05, 0.004, dur, 0.04);
      o.connect(f).connect(g).connect(this.out);
      o.start(t); o.stop(t + dur + 0.02);
    },

    lead(freq, t, dur, bright) {
      const ac = Sound.ctx;
      const o = ac.createOscillator(), o2 = ac.createOscillator();
      const f = ac.createBiquadFilter(), g = ac.createGain();
      const lfo = ac.createOscillator(), lfoGain = ac.createGain();
      o.type = 'square';
      o2.type = 'triangle';
      o.frequency.value = freq;
      o2.frequency.value = freq;
      o2.detune.value = 7;
      lfo.frequency.value = 5.5;
      lfoGain.gain.setValueAtTime(0, t);
      lfoGain.gain.linearRampToValueAtTime(freq * 0.006, t + Math.min(dur, 0.35));
      lfo.connect(lfoGain);
      lfoGain.connect(o.frequency);
      lfoGain.connect(o2.frequency);
      f.type = 'lowpass';
      f.frequency.value = bright ? 3600 : 2600;
      this.env(g, t, bright ? 0.075 : 0.065, 0.01, dur * 0.95, 0.06);
      o.connect(f); o2.connect(f);
      f.connect(g);
      g.connect(this.out);
      g.connect(this.echo);
      const end = t + dur + 0.02;
      o.start(t); o2.start(t); lfo.start(t);
      o.stop(end); o2.stop(end); lfo.stop(end);
    },
  };

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const boardCanvas = $('board');
  const bctx = boardCanvas.getContext('2d');
  const holdCanvas = $('hold');
  const hctx = holdCanvas.getContext('2d');
  const nextCanvas = $('next');
  const nctx = nextCanvas.getContext('2d');
  const fxCanvas = $('fx');
  const fctx = fxCanvas.getContext('2d');
  const ambCanvas = $('ambient');
  const actx = ambCanvas.getContext('2d');
  const frame = $('frame');
  const popups = $('popups');
  const overlay = $('overlay');
  const overlayTitle = $('overlay-title');
  const overlayText = $('overlay-text');
  const startBtn = $('start-btn');
  const muteBtn = $('mute-btn');
  const musicBtn = $('music-btn');
  const ui = { score: $('score'), best: $('best'), level: $('level'), lines: $('lines') };

  let dpr = 1;
  let vw = 0, vh = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth;
    vh = window.innerHeight;
    for (const c of [fxCanvas, ambCanvas]) {
      c.width = Math.round(vw * dpr);
      c.height = Math.round(vh * dpr);
    }
    boardCanvas.width = COLS * CELL * dpr;
    boardCanvas.height = ROWS * CELL * dpr;
    for (const c of [holdCanvas, nextCanvas]) {
      const w = c.clientWidth || c.width, h = c.clientHeight || c.height;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
  }

  // ---------------------------------------------------------------------------
  // Build assets
  // ---------------------------------------------------------------------------
  const tiles = {};
  for (const t of TYPES) {
    tiles[t] = [];
    for (let v = 0; v < VARIANTS; v++) tiles[t].push(woodTile(t, v));
  }

  const boardBg = (() => {
    const w = COLS * TILE, h = ROWS * TILE;
    const c = woodCanvas(w, h, {
      light: [92, 60, 38], dark: [50, 30, 18], seed: 42, ringFreq: 0.035, warp: 9, scale: 1,
    });
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(15,6,2,.35)';
    ctx.fillRect(0, 0, w, h);
    // carved grid
    for (let x = 0; x <= COLS; x++) {
      ctx.fillStyle = 'rgba(10,4,0,.5)';
      ctx.fillRect(x * TILE - 1, 0, 2, h);
      ctx.fillStyle = 'rgba(255,215,170,.07)';
      ctx.fillRect(x * TILE + 1, 0, 1, h);
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.fillStyle = 'rgba(10,4,0,.5)';
      ctx.fillRect(0, y * TILE - 1, w, 2);
      ctx.fillStyle = 'rgba(255,215,170,.07)';
      ctx.fillRect(0, y * TILE + 1, w, 1);
    }
    // inner shadow
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, h * 0.65);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    return c;
  })();

  (function applyCssTextures() {
    const root = document.documentElement.style;
    root.setProperty('--wall', `url(${wallTexture().toDataURL()})`);
    root.setProperty('--frame-wood', `url(${woodCanvas(256, 256, {
      light: [140, 86, 48], dark: [74, 40, 20], seed: 9, ringFreq: 0.07, warp: 8,
      knot: { x: 180, y: 60, rx: 14, ry: 7 },
    }).toDataURL()})`);
    root.setProperty('--panel-wood', `url(${woodCanvas(256, 256, {
      light: [232, 196, 146], dark: [184, 136, 84], seed: 5, ringFreq: 0.06, warp: 7,
      knot: { x: 70, y: 190, rx: 10, ry: 5 },
    }).toDataURL()})`);
  })();

  const blossoms = [];
  PALETTES.forEach((p, i) => {
    blossoms.push(makeBlossom(p, 'sakura'));
    blossoms.push(makeBlossom(p, i % 2 ? 'ume' : 'yae'));
  });
  const bigBlossom = makeBlossom(PALETTES[0], 'yae');
  const petals = PALETTES.map(makePetal);
  const sparkles = ['rgba(255,190,220,.8)', 'rgba(255,240,170,.8)', 'rgba(255,255,255,.8)'].map(makeSparkle);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------
  const parts = [];
  const ambient = [];

  function addBlossom(x, y, opts = {}) {
    parts.push({
      kind: 'blossom',
      img: opts.img || pick(blossoms),
      x, y,
      vx: opts.vx ?? rand(-140, 140),
      vy: opts.vy ?? rand(-460, -220),
      g: opts.g ?? 520,
      rot: rand(0, Math.PI * 2),
      vr: rand(-3, 3),
      size: opts.size ?? rand(34, 62),
      age: 0,
      life: opts.life ?? rand(1.5, 2.2),
      delay: opts.delay ?? 0,
    });
  }

  function addPetal(x, y, opts = {}) {
    parts.push({
      kind: 'petal',
      img: pick(petals),
      x, y,
      vx: opts.vx ?? rand(-220, 220),
      vy: opts.vy ?? rand(-320, -60),
      g: 140,
      rot: rand(0, Math.PI * 2),
      vr: rand(-4, 4),
      size: rand(12, 22),
      phase: rand(0, Math.PI * 2),
      flip: rand(4, 9),
      sway: rand(30, 70),
      age: 0,
      life: opts.life ?? rand(2.4, 3.6),
      delay: opts.delay ?? 0,
    });
  }

  function addSparkle(x, y, delay = 0) {
    parts.push({
      kind: 'sparkle',
      img: pick(sparkles),
      x, y,
      vx: rand(-60, 60),
      vy: rand(-120, -20),
      g: 0,
      rot: rand(0, 1),
      vr: rand(-2, 2),
      size: rand(14, 30),
      phase: rand(0, 6),
      age: 0,
      life: rand(0.7, 1.2),
      delay,
    });
  }

  function boardRect() {
    return boardCanvas.getBoundingClientRect();
  }

  function burstRows(rows, count) {
    const rect = boardRect();
    const cellH = rect.height / ROWS;
    const scale = reduceMotion ? 0.35 : 1;
    rows.forEach((r, ri) => {
      const y = rect.top + (r - HIDDEN + 0.5) * cellH;
      const nb = Math.round(6 * scale) || 1;
      for (let i = 0; i < nb; i++) {
        const x = rect.left + rect.width * ((i + 0.5) / nb) + rand(-10, 10);
        addBlossom(x, y, { delay: ri * 0.05 + i * 0.025 });
      }
      for (let i = 0; i < Math.round(12 * scale); i++) {
        addPetal(rect.left + rand(0, rect.width), y + rand(-8, 8), { delay: ri * 0.05 });
      }
      for (let i = 0; i < Math.round(6 * scale); i++) {
        addSparkle(rect.left + rand(0, rect.width), y + rand(-cellH, cellH), rand(0, 0.3));
      }
    });

    if (count === 4) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.45;
      parts.push({
        kind: 'big', img: bigBlossom, x: cx, y: cy, vx: 0, vy: 0, g: 0,
        rot: 0, vr: 0.8, size: Math.min(rect.width * 1.1, 360), age: 0, life: 2.4, delay: 0,
      });
      const ring = Math.round(14 * scale);
      for (let i = 0; i < ring; i++) {
        const a = (i / ring) * Math.PI * 2;
        const sp = rand(380, 520);
        addBlossom(cx, cy, {
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 300,
          size: rand(46, 74), life: rand(2, 2.6), delay: 0.12,
        });
      }
      for (let i = 0; i < Math.round(60 * scale); i++) {
        addPetal(rand(0, vw), rand(-80, -10), { vx: rand(-40, 40), vy: rand(20, 120), life: rand(4, 6), delay: rand(0, 1.2) });
      }
      for (let i = 0; i < Math.round(16 * scale); i++) {
        addSparkle(cx + rand(-150, 150), cy + rand(-150, 150), rand(0, 0.8));
      }
    }
  }

  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      if (p.age >= p.life) { parts.splice(i, 1); continue; }
      if (p.kind === 'petal') {
        p.vy = Math.min(p.vy + p.g * dt, 110);
        p.vx *= Math.pow(0.35, dt);
        p.x += (p.vx + Math.sin(p.age * 2 + p.phase) * p.sway) * dt;
      } else {
        p.vy += p.g * dt;
        p.vx *= Math.pow(0.6, dt);
        p.x += p.vx * dt;
      }
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  function drawPart(ctx, p) {
    const t = p.age / p.life;
    let alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    let s = p.size;
    let sx = 1;
    if (p.kind === 'blossom') {
      s *= easeOutBack(clamp(p.age / 0.4, 0, 1));
    } else if (p.kind === 'big') {
      s *= easeOutBack(clamp(p.age / 0.6, 0, 1));
      alpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      alpha *= 0.95;
    } else if (p.kind === 'petal') {
      sx = Math.cos(p.age * p.flip + p.phase);
      alpha = Math.min(alpha, p.age * 4);
    } else if (p.kind === 'sparkle') {
      s *= 0.6 + 0.4 * Math.abs(Math.sin(p.age * 12 + p.phase));
      alpha = Math.sin(t * Math.PI);
    }
    if (s <= 0.5 || alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(sx || 0.05, 1);
    ctx.drawImage(p.img, -s / 2, -s / 2, s, s);
    ctx.restore();
  }

  function initAmbient() {
    ambient.length = 0;
    const n = reduceMotion ? 6 : 18;
    for (let i = 0; i < n; i++) ambient.push(newAmbientPetal(true));
  }

  function newAmbientPetal(anywhere) {
    return {
      img: pick(petals),
      x: rand(0, vw),
      y: anywhere ? rand(0, vh) : rand(-60, -20),
      vy: rand(18, 45),
      vx: rand(10, 30),
      rot: rand(0, 6),
      vr: rand(-1.2, 1.2),
      size: rand(10, 20),
      phase: rand(0, 6),
      flip: rand(1.5, 3.5),
      sway: rand(15, 35),
      age: 0,
    };
  }

  function updateAmbient(dt) {
    for (let i = 0; i < ambient.length; i++) {
      const p = ambient[i];
      p.age += dt;
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(p.age * 0.9 + p.phase) * p.sway) * dt;
      p.rot += p.vr * dt;
      if (p.y > vh + 40 || p.x > vw + 40) ambient[i] = newAmbientPetal(false);
    }
  }

  function renderEffects() {
    actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    actx.clearRect(0, 0, vw, vh);
    for (const p of ambient) {
      actx.save();
      actx.globalAlpha = 0.55;
      actx.translate(p.x, p.y);
      actx.rotate(p.rot);
      actx.scale(Math.cos(p.age * p.flip + p.phase) || 0.05, 1);
      actx.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
      actx.restore();
    }

    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.clearRect(0, 0, vw, vh);
    // big blooms first so the smaller ones fly over them
    for (const p of parts) if (p.kind === 'big' && p.delay <= 0) drawPart(fctx, p);
    for (const p of parts) if (p.kind !== 'big' && p.delay <= 0) drawPart(fctx, p);
  }

  function popup(jp, he, cls = '', topPct = 40) {
    const el = document.createElement('div');
    el.className = 'popup ' + cls;
    const rect = boardRect();
    el.style.left = rect.left + rect.width / 2 + 'px';
    el.style.top = rect.top + rect.height * topPct / 100 + 'px';
    el.innerHTML = `<span class="jp"></span><span class="he"></span>`;
    el.firstChild.textContent = jp;
    el.lastChild.textContent = he;
    popups.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  let grid, bag, queue, cur, holdType, canHold;
  let score = 0, lines = 0, level = 1, combo = -1;
  let best = 0;
  let state = 'menu'; // menu | play | pause | clearing | over
  let dropAcc = 0, lockTimer = 0, lockResets = 0;
  let clearingRows = [], clearTimer = 0;
  const held = { left: false, right: false, down: false };
  let dasDir = 0, dasTimer = 0, arrTimer = 0;

  try { best = parseInt(localStorage.getItem('wood-tetris-best') || '0', 10) || 0; } catch (e) { best = 0; }

  function emptyGrid() {
    return Array.from({ length: TOTAL }, () => Array(COLS).fill(null));
  }

  function nextFromBag() {
    if (!bag.length) {
      bag = TYPES.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  }

  function makePiece(type) {
    const m = SHAPES[type].map((r) => r.slice());
    return { type, m, rot: 0, x: Math.floor((COLS - m.length) / 2), y: HIDDEN - 1 };
  }

  function rotCW(m) {
    const n = m.length;
    return m.map((row, y) => row.map((_, x) => m[n - 1 - x][y]));
  }
  function rotCCW(m) {
    const n = m.length;
    return m.map((row, y) => row.map((_, x) => m[x][n - 1 - y]));
  }

  function collide(m, px, py) {
    for (let r = 0; r < m.length; r++) {
      for (let c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        const x = px + c, y = py + r;
        if (x < 0 || x >= COLS || y >= TOTAL) return true;
        if (y >= 0 && grid[y][x]) return true;
      }
    }
    return false;
  }

  function onGround() {
    return collide(cur.m, cur.x, cur.y + 1);
  }

  function afterManipulation() {
    if (onGround() && lockResets < MAX_LOCK_RESETS) {
      lockTimer = 0;
      lockResets++;
    }
  }

  function move(dx) {
    if (state !== 'play' || !cur) return false;
    if (collide(cur.m, cur.x + dx, cur.y)) return false;
    cur.x += dx;
    afterManipulation();
    return true;
  }

  function rotate(dir) {
    if (state !== 'play' || !cur || cur.type === 'O') return;
    const from = cur.rot;
    const to = (from + dir + 4) % 4;
    const m = dir === 1 ? rotCW(cur.m) : rotCCW(cur.m);
    const kicks = (cur.type === 'I' ? KICKS_I : KICKS_JLSTZ)['' + from + to];
    for (const [kx, ky] of kicks) {
      if (!collide(m, cur.x + kx, cur.y - ky)) {
        cur.m = m;
        cur.x += kx;
        cur.y -= ky;
        cur.rot = to;
        afterManipulation();
        return;
      }
    }
  }

  function softStep() {
    if (!collide(cur.m, cur.x, cur.y + 1)) {
      cur.y++;
      lockTimer = 0;
      return true;
    }
    return false;
  }

  function hardDrop() {
    if (state !== 'play' || !cur) return;
    let n = 0;
    while (!collide(cur.m, cur.x, cur.y + 1)) { cur.y++; n++; }
    score += n * 2;
    Sound.tok(1.4);
    lockPiece(true);
  }

  function doHold() {
    if (state !== 'play' || !cur || !canHold) return;
    const t = cur.type;
    if (holdType) {
      cur = makePiece(holdType);
      if (collide(cur.m, cur.x, cur.y)) { gameOver(); return; }
    } else {
      spawnNext();
    }
    holdType = t;
    canHold = false;
    lockTimer = 0;
    lockResets = 0;
    dropAcc = 0;
  }

  function spawnNext() {
    cur = makePiece(queue.shift());
    queue.push(nextFromBag());
    canHold = true;
    lockTimer = 0;
    lockResets = 0;
    dropAcc = 0;
    if (collide(cur.m, cur.x, cur.y)) {
      cur.y--;
      if (collide(cur.m, cur.x, cur.y)) gameOver();
    }
  }

  function gravityMs() {
    return Math.max(16, 1000 * Math.pow(0.8 - (level - 1) * 0.007, level - 1));
  }

  function lockPiece(silent) {
    let allHidden = true;
    for (let r = 0; r < cur.m.length; r++) {
      for (let c = 0; c < cur.m[r].length; c++) {
        if (!cur.m[r][c]) continue;
        const y = cur.y + r;
        if (y >= HIDDEN) allHidden = false;
        if (y >= 0) grid[y][cur.x + c] = { t: cur.type, v: Math.floor(Math.random() * VARIANTS) };
      }
    }
    if (!silent) Sound.tok(1);
    cur = null;
    if (allHidden) { gameOver(); return; }

    const full = [];
    for (let y = 0; y < TOTAL; y++) if (grid[y].every(Boolean)) full.push(y);

    if (full.length) {
      combo++;
      const n = full.length;
      score += SCORE_TABLE[n] * level + (combo > 0 ? 50 * combo * level : 0);
      lines += n;
      clearingRows = full;
      clearTimer = 0;
      state = 'clearing';
      burstRows(full, n);
      Sound.clear(n);
      const label = CLEAR_LABELS[n];
      popup(label.jp, combo > 0 ? `${label.he} · קומבו ×${combo + 1}` : label.he, n === 4 ? 'big' : '', 42);
      if (n === 4 && !reduceMotion) {
        frame.classList.remove('shake');
        void frame.offsetWidth;
        frame.classList.add('shake');
      }
      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel > level) {
        level = newLevel;
        Music.setLevel(level);
        setTimeout(() => popup('レベルアップ', `שלב ${level}`, 'level', 62), 500);
      }
    } else {
      combo = -1;
      spawnNext();
    }
    updateUI();
  }

  function finishClear() {
    const set = new Set(clearingRows);
    grid = grid.filter((_, y) => !set.has(y));
    while (grid.length < TOTAL) grid.unshift(Array(COLS).fill(null));
    clearingRows = [];
    state = 'play';
    spawnNext();
  }

  function updateUI() {
    if (score > best) {
      best = score;
      try { localStorage.setItem('wood-tetris-best', String(best)); } catch (e) { /* ignore */ }
    }
    ui.score.textContent = score.toLocaleString();
    ui.best.textContent = best.toLocaleString();
    ui.level.textContent = level;
    ui.lines.textContent = lines;
  }

  function newGame() {
    grid = emptyGrid();
    bag = [];
    queue = [nextFromBag(), nextFromBag(), nextFromBag()];
    holdType = null;
    score = 0; lines = 0; level = 1; combo = -1;
    clearingRows = [];
    state = 'play';
    spawnNext();
    updateUI();
    overlay.classList.add('hidden');
    Music.setLevel(1);
    Music.play(true);
  }

  function gameOver() {
    state = 'over';
    cur = null;
    Music.stop();
    updateUI();
    overlayTitle.textContent = 'המשחק נגמר';
    overlayText.textContent = `ניקוד: ${score.toLocaleString()} · שורות: ${lines}`;
    startBtn.textContent = 'שחק שוב';
    overlay.classList.remove('hidden');
  }

  function togglePause() {
    if (state === 'play') {
      state = 'pause';
      overlayTitle.textContent = 'הפסקה';
      overlayText.textContent = 'תה ירוק וממשיכים 🍵';
      startBtn.textContent = 'המשך';
      overlay.classList.remove('hidden');
      Music.stop();
    } else if (state === 'pause') {
      state = 'play';
      overlay.classList.add('hidden');
      Music.play(false);
    }
  }

  function start() {
    Sound.init();
    if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume();
    if (state === 'pause') togglePause();
    else newGame();
  }

  // ---------------------------------------------------------------------------
  // Update / render
  // ---------------------------------------------------------------------------
  function update(dt) {
    if (state === 'clearing') {
      clearTimer += dt;
      if (clearTimer >= CLEAR_MS) finishClear();
      return;
    }
    if (state !== 'play' || !cur) return;

    // auto-shift
    if (dasDir) {
      dasTimer += dt;
      if (dasTimer >= DAS_MS) {
        arrTimer += dt;
        while (arrTimer >= ARR_MS) {
          arrTimer -= ARR_MS;
          if (!move(dasDir)) { arrTimer = 0; break; }
        }
      }
    }

    if (onGround()) {
      dropAcc = 0;
      lockTimer += dt;
      if (lockTimer >= LOCK_MS) lockPiece(false);
      return;
    }

    dropAcc += dt;
    const interval = held.down ? Math.min(SOFT_MS, gravityMs()) : gravityMs();
    while (dropAcc >= interval && cur) {
      dropAcc -= interval;
      if (softStep()) {
        if (held.down) score += 1;
      } else {
        dropAcc = 0;
      }
    }
    if (held.down) updateUI();
  }

  function drawCell(ctx, type, variant, x, y, size, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(tiles[type][variant], x, y, size, size);
    ctx.globalAlpha = 1;
  }

  function renderBoard() {
    const ctx = bctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(boardBg, 0, 0, COLS * CELL, ROWS * CELL);
    if (!grid) return;

    const clearSet = new Set(clearingRows);
    const p = state === 'clearing' ? clamp(clearTimer / CLEAR_MS, 0, 1) : 0;

    for (let y = HIDDEN; y < TOTAL; y++) {
      const py = (y - HIDDEN) * CELL;
      for (let x = 0; x < COLS; x++) {
        const cell = grid[y][x];
        if (!cell) continue;
        if (clearSet.has(y)) {
          const s = CELL * (1 - p * p);
          drawCell(ctx, cell.t, cell.v, x * CELL + (CELL - s) / 2, py + (CELL - s) / 2, s, 1 - p * 0.6);
        } else {
          drawCell(ctx, cell.t, cell.v, x * CELL, py, CELL);
        }
      }
      if (clearSet.has(y)) {
        const a = Math.sin(p * Math.PI);
        const g = ctx.createLinearGradient(0, py, 0, py + CELL);
        g.addColorStop(0, `rgba(255,190,215,${0.25 * a})`);
        g.addColorStop(0.5, `rgba(255,245,250,${0.85 * a})`);
        g.addColorStop(1, `rgba(255,190,215,${0.25 * a})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, py - 4, COLS * CELL, CELL + 8);
      }
    }

    if (cur && (state === 'play' || state === 'pause')) {
      // ghost: carved outline where the piece will land
      let gy = cur.y;
      while (!collide(cur.m, cur.x, gy + 1)) gy++;
      for (let r = 0; r < cur.m.length; r++) {
        for (let c = 0; c < cur.m[r].length; c++) {
          if (!cur.m[r][c] || gy + r < HIDDEN) continue;
          const x = (cur.x + c) * CELL, y = (gy + r - HIDDEN) * CELL;
          ctx.fillStyle = 'rgba(255,200,225,.08)';
          roundRectPath(ctx, x + 3, y + 3, CELL - 6, CELL - 6, 5);
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(255,190,215,.45)';
          ctx.stroke();
        }
      }
      for (let r = 0; r < cur.m.length; r++) {
        for (let c = 0; c < cur.m[r].length; c++) {
          if (!cur.m[r][c] || cur.y + r < HIDDEN) continue;
          drawCell(ctx, cur.type, (r + c) % VARIANTS, (cur.x + c) * CELL, (cur.y + r - HIDDEN) * CELL, CELL);
        }
      }
    }
  }

  function drawMini(ctx, type, cx, cy, size, alpha) {
    const m = SHAPES[type];
    let minR = 9, maxR = -1, minC = 9, maxC = -1;
    m.forEach((row, r) => row.forEach((v, c) => {
      if (!v) return;
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    }));
    const w = (maxC - minC + 1) * size, h = (maxR - minR + 1) * size;
    m.forEach((row, r) => row.forEach((v, c) => {
      if (!v) return;
      drawCell(ctx, type, (r + c) % VARIANTS, cx - w / 2 + (c - minC) * size, cy - h / 2 + (r - minR) * size, size, alpha);
    }));
  }

  function renderSide() {
    const hw = holdCanvas.width / dpr, hh = holdCanvas.height / dpr;
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hctx.clearRect(0, 0, hw, hh);
    if (holdType) drawMini(hctx, holdType, hw / 2, hh / 2, Math.min(hw / 5, hh / 3), canHold ? 1 : 0.4);

    const nw = nextCanvas.width / dpr, nh = nextCanvas.height / dpr;
    nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nctx.clearRect(0, 0, nw, nh);
    if (!queue) return;
    const count = nh > nw * 1.4 ? 3 : 1;
    const slot = nh / count;
    for (let i = 0; i < count; i++) {
      const size = Math.min(nw / 5, slot / 3) * (i === 0 ? 1 : 0.82);
      drawMini(nctx, queue[i], nw / 2, slot * i + slot / 2, size, i === 0 ? 1 : 0.85);
    }
  }

  let last = performance.now();
  function loop(now) {
    const dtMs = Math.min(50, now - last);
    last = now;
    update(dtMs);
    updateParts(dtMs / 1000);
    updateAmbient(dtMs / 1000);
    renderBoard();
    renderSide();
    renderEffects();
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  function press(act) {
    if (act === 'pause') { togglePause(); return; }
    if (act === 'mute') { toggleMute(); return; }
    if (act === 'music') { toggleMusic(); return; }
    if (state === 'menu' || state === 'over') {
      if (act === 'drop' || act === 'start') start();
      return;
    }
    if (state === 'pause') {
      if (act === 'start') togglePause();
      return;
    }
    switch (act) {
      case 'left':
      case 'right': {
        const d = act === 'left' ? -1 : 1;
        held[act] = true;
        move(d);
        dasDir = d; dasTimer = 0; arrTimer = 0;
        break;
      }
      case 'down':
        held.down = true;
        dropAcc = SOFT_MS;
        break;
      case 'rotate': rotate(1); break;
      case 'rotateCCW': rotate(-1); break;
      case 'drop': hardDrop(); break;
      case 'hold': doHold(); break;
    }
  }

  function release(act) {
    if (act === 'left' || act === 'right') {
      held[act] = false;
      const d = act === 'left' ? -1 : 1;
      if (dasDir === d) {
        const other = act === 'left' ? 'right' : 'left';
        dasDir = held[other] ? -d : 0;
        dasTimer = 0; arrTimer = 0;
      }
    } else if (act === 'down') {
      held.down = false;
    }
  }

  const KEYMAP = {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down',
    ArrowUp: 'rotate', KeyX: 'rotate', KeyZ: 'rotateCCW',
    Space: 'drop', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
    KeyP: 'pause', Escape: 'pause', KeyM: 'mute', KeyB: 'music', Enter: 'start',
  };

  window.addEventListener('keydown', (e) => {
    const act = KEYMAP[e.code];
    if (!act) return;
    e.preventDefault();
    if (e.repeat) return;
    Sound.init();
    press(act);
  });
  window.addEventListener('keyup', (e) => {
    const act = KEYMAP[e.code];
    if (act) release(act);
  });

  document.querySelectorAll('.touch button').forEach((btn) => {
    const act = btn.dataset.act;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('on');
      Sound.init();
      press(act);
    });
    const up = () => { btn.classList.remove('on'); release(act); };
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('pointercancel', up);
  });

  startBtn.addEventListener('click', start);

  function syncMusic() {
    if (state === 'play' || state === 'clearing') Music.play(false);
    else Music.stop();
    if (!Music.on || Sound.muted) Music.stop();
  }

  function toggleMute() {
    Sound.muted = !Sound.muted;
    muteBtn.textContent = Sound.muted ? '🔇 מושתק' : '🔊 צליל';
    syncMusic();
  }
  muteBtn.addEventListener('click', toggleMute);

  function toggleMusic() {
    Music.on = !Music.on;
    musicBtn.textContent = Music.on ? '🎵 מוזיקה: פועלת' : '🎵 מוזיקה: כבויה';
    document.querySelector('.touch [data-act="music"]')?.classList.toggle('off', !Music.on);
    syncMusic();
  }
  musicBtn.addEventListener('click', toggleMusic);

  // ---------------------------------------------------------------------------
  // Touch gestures on the board: drag sideways to move, tap to rotate,
  // drag down to soft drop, flick down to hard drop, flick up to hold.
  // ---------------------------------------------------------------------------
  const gesture = { id: null };

  frame.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || state !== 'play' || gesture.id !== null) return;
    e.preventDefault();
    Sound.init();
    gesture.id = e.pointerId;
    gesture.x0 = gesture.ax = e.clientX;
    gesture.y0 = gesture.ay = e.clientY;
    gesture.t0 = performance.now();
    gesture.cell = boardRect().width / COLS;
    gesture.axis = null;
    gesture.moved = false;
    gesture.samples = [{ t: gesture.t0, y: e.clientY }];
    gesture.lx = e.clientX;
    gesture.ly = e.clientY;
    try { frame.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });

  // downward finger speed (px/ms) over the last ~150ms
  function recentSpeed(e) {
    const now = performance.now();
    const s = gesture.samples;
    if (e) {
      s.push({ t: now, y: e.clientY });
      gesture.lx = e.clientX;
      gesture.ly = e.clientY;
    }
    while (s.length > 2 && now - s[1].t > 150) s.shift();
    return (s[s.length - 1].y - s[0].y) / Math.max(1, s[s.length - 1].t - s[0].t);
  }
  const FLICK_SPEED = 0.5;

  frame.addEventListener('pointermove', (e) => {
    if (e.pointerId !== gesture.id || state !== 'play') return;
    const c = gesture.cell;
    const speed = recentSpeed(e);
    const tdx = e.clientX - gesture.x0, tdy = e.clientY - gesture.y0;
    if (!gesture.axis && Math.max(Math.abs(tdx), Math.abs(tdy)) > c * 0.5) {
      gesture.axis = Math.abs(tdx) > Math.abs(tdy) ? 'x' : 'y';
    }
    if (gesture.axis === 'x') {
      let dx = e.clientX - gesture.ax;
      while (Math.abs(dx) >= c) {
        const d = Math.sign(dx);
        move(d);
        gesture.ax += d * c;
        dx = e.clientX - gesture.ax;
        gesture.moved = true;
      }
    } else if (gesture.axis === 'y') {
      // slow drag down = soft drop, one row per cell of finger travel
      while (speed < FLICK_SPEED && e.clientY - gesture.ay >= c && cur) {
        if (softStep()) score += 1;
        gesture.ay += c;
        gesture.moved = true;
      }
    }
  });

  function endGesture(e) {
    if (e.pointerId !== gesture.id) return;
    gesture.id = null;
    if (state !== 'play' || e.type === 'pointercancel') return;
    const c = gesture.cell;
    const dt = performance.now() - gesture.t0;
    const dx = gesture.lx - gesture.x0, dy = gesture.ly - gesture.y0;
    const speed = recentSpeed(null);
    if (gesture.axis === 'y' && dy > c * 1.5 && speed >= FLICK_SPEED) {
      hardDrop();
    } else if (gesture.axis === 'y' && dy < -c * 1.5) {
      doHold();
    } else if (!gesture.moved && dt < 350 && Math.hypot(dx, dy) < c * 0.6) {
      rotate(1);
    }
    updateUI();
  }
  frame.addEventListener('pointerup', endGesture);
  frame.addEventListener('pointercancel', endGesture);

  window.addEventListener('blur', () => {
    held.left = held.right = held.down = false;
    dasDir = 0;
    if (state === 'play') togglePause();
  });

  window.addEventListener('resize', resize);

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  resize();
  initAmbient();
  updateUI();
  requestAnimationFrame(loop);

})();
