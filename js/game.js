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
  const LEVEL_MS = 40000;      // speed goes up at least this often...
  const LINES_PER_LEVEL = 10;  // ...or after this many lines, whichever comes first

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
  const TSPIN_SCORE = [400, 800, 1200, 1600];
  const TSPIN_LABELS = ['טי-ספין!', 'טי-ספין יחיד!', 'טי-ספין כפול!', 'טי-ספין משולש!'];
  const PERFECT_SCORE = 2000;
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
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // keeps "+250" and "×4" in order inside right-to-left Hebrew text
  const ltr = (s) => '\u2066' + s + '\u2069';

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

  // a bright accent per piece, used by the lacquer and bamboo skins
  const ACCENTS = {
    I: [110, 205, 230], J: [90, 125, 215], L: [240, 160, 64], O: [242, 210, 74],
    S: [124, 196, 106], T: [200, 106, 214], Z: [224, 80, 80],
  };

  // the face of a block before bevels: natural wood, bamboo, black lacquer or gold-leaf lacquer
  function tileBase(type, variant, skin) {
    const s = TILE;
    const seed = TYPES.indexOf(type) * 13 + variant * 5 + 1;
    const a = ACCENTS[type];
    const c = makeCanvas(s, s);
    const ctx = c.getContext('2d');
    if (skin === 'bamboo') {
      const light = [226, 216, 140].map((v, i) => lerp(v, a[i], 0.3));
      const dark = [150, 150, 64].map((v, i) => lerp(v, a[i] * 0.6, 0.3));
      const g = woodCanvas(s, s, { light, dark, seed, ringFreq: 0.35, warp: 1.2, fiber: 0.35 });
      ctx.translate(s / 2, s / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(g, -s / 2, -s / 2);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const ny = s * (0.3 + variant * 0.2);
      ctx.fillStyle = 'rgba(70,60,20,.55)';
      ctx.fillRect(0, ny - 2, s, 3);
      ctx.fillStyle = 'rgba(255,250,200,.4)';
      ctx.fillRect(0, ny + 1, s, 2);
      return c;
    }
    if (skin === 'kuro') {
      ctx.drawImage(woodCanvas(s, s, { light: [62, 32, 28], dark: [16, 9, 8], seed, ringFreq: 0.09, warp: 5, fiber: 0.15 }), 0, 0);
      ctx.fillStyle = `rgba(${a},.18)`;
      ctx.fillRect(0, 0, s, s);
      ctx.lineWidth = s * 0.07;
      ctx.strokeStyle = `rgb(${a})`;
      roundRectPath(ctx, s * 0.16, s * 0.16, s * 0.68, s * 0.68, s * 0.08);
      ctx.stroke();
      return c;
    }
    if (skin === 'gold') {
      const light = a.map((v) => Math.min(255, v * 1.05));
      const dark = a.map((v) => v * 0.5);
      ctx.drawImage(woodCanvas(s, s, { light, dark, seed, ringFreq: 0.06, warp: 4, fiber: 0.12 }), 0, 0);
      const r = mulberry32(seed * 31 + 7);
      for (let i = 0; i < 16; i++) {
        const x = r() * s, y = r() * s, k = 2 + r() * 4;
        ctx.fillStyle = r() > 0.5 ? '#ffe08a' : '#d4a020';
        ctx.beginPath();
        ctx.moveTo(x, y - k);
        ctx.lineTo(x + k, y + r() * k);
        ctx.lineTo(x - k * 0.6, y + k);
        ctx.closePath();
        ctx.fill();
      }
      // kintsugi seam
      ctx.beginPath();
      let x = 0, y = s * (0.2 + r() * 0.6);
      ctx.moveTo(x, y);
      while (x < s) {
        x += 6 + r() * 10;
        y = clamp(y + (r() - 0.5) * 18, 6, s - 6);
        ctx.lineTo(x, y);
      }
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffd54a';
      ctx.shadowColor = 'rgba(255,220,120,.9)';
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
      return c;
    }
    const wood = WOODS[type];
    return woodCanvas(s, s, {
      light: wood.light,
      dark: wood.dark,
      seed,
      ringFreq: 0.11,
      warp: 5,
      fiber: 0.25,
      knot: variant === 2 ? { x: rand(18, 46), y: rand(18, 46), rx: 7, ry: 4 } : null,
    });
  }

  function woodTile(type, variant, skin = 'classic') {
    const s = TILE;
    const base = tileBase(type, variant, skin);
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
    noiseBuf() {
      if (!this._noise) {
        const ac = this.ctx, len = ac.sampleRate;
        this._noise = ac.createBuffer(1, len, ac.sampleRate);
        const d = this._noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      return this._noise;
    },
    // temple-bell: inharmonic partials with a long decay
    bell(freq, when, dur, vol) {
      if (this.muted || !this.ctx) return;
      const ac = this.ctx, t = ac.currentTime + when;
      [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]].forEach(([mul, amp], i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = freq * mul;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol * amp, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + i * 0.6));
        o.connect(g).connect(ac.destination);
        o.start(t);
        o.stop(t + dur);
      });
    },
    taiko(when, vol) {
      if (this.muted || !this.ctx) return;
      const ac = this.ctx, t = ac.currentTime + when;
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(52, t + 0.25);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.55);
      this.swoosh(when, 'lowpass', 500, 300, 0.12, vol * 0.6);
    },
    swoosh(when, type, f0, f1, dur, vol) {
      if (this.muted || !this.ctx) return;
      const ac = this.ctx, t = ac.currentTime + when;
      const src = ac.createBufferSource();
      src.buffer = this.noiseBuf();
      const f = ac.createBiquadFilter();
      f.type = type;
      f.Q.value = type === 'bandpass' ? 4 : 1;
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(ac.destination);
      src.start(t);
      src.stop(t + dur + 0.02);
    },
    // each link of a combo rings one step higher, so a long chain climbs the scale
    combo(n) {
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];
      const top = Math.min(n, scale.length - 1);
      this.taiko(0, 0.7);
      if (n >= 3) this.taiko(0.1, 0.5);
      if (n >= 5) this.taiko(0.2, 0.6);
      this.bell(scale[top], 0.18, 1.4, 0.16);
      if (n >= 2) this.bell(scale[Math.max(0, top - 2)], 0.18, 1.4, 0.1);
      if (n >= 4) this.bell(scale[top] * 2, 0.3, 1.2, 0.08);
    },
    tspin() {
      this.swoosh(0, 'bandpass', 300, 4200, 0.4, 0.5);
      this.pluck(659.25, 0.25);
      this.pluck(987.77, 0.33);
      this.pluck(1318.51, 0.41);
    },
    backToBack() {
      this.bell(392, 0.1, 3, 0.28);
      this.bell(587.33, 0.3, 3, 0.2);
      this.taiko(0.1, 0.8);
    },
    perfect() {
      this.bell(98, 0, 4.5, 0.45);
      const scale = [523.25, 587.33, 659.25, 783.99, 880.0];
      for (let i = 0; i < 15; i++) this.pluck(scale[i % 5] * Math.pow(2, Math.floor(i / 5)), 0.15 + i * 0.04);
      this.bell(2093, 0.8, 2.5, 0.15);
      [0, 0.12, 0.24, 0.5].forEach((w) => this.taiko(w, 0.8));
    },
    feverStart() {
      this.swoosh(0, 'bandpass', 400, 5000, 0.6, 0.4);
      [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093].forEach((f, i) => this.pluck(f, 0.05 + i * 0.05));
      this.taiko(0, 0.8);
      this.taiko(0.15, 0.8);
    },
    dangerEnter() {
      this.bell(196, 0, 1.2, 0.2);
      this.bell(185, 0.25, 1.2, 0.2);
    },
    relief() {
      this.bell(783.99, 0, 1.6, 0.12);
      this.bell(987.77, 0.08, 1.6, 0.1);
      this.bell(1174.66, 0.16, 1.8, 0.1);
    },
    mission() {
      [1046.5, 1318.51, 1567.98, 2093].forEach((f, i) => this.bell(f, i * 0.09, 1.2, 0.12));
    },
    gameOver() {
      [392, 349.23, 311.13, 261.63].forEach((f, i) => this.pluck(f, i * 0.18));
    },
    speedUp() {
      this.swoosh(0, 'bandpass', 500, 3500, 0.5, 0.35);
      this.bell(783.99, 0.35, 0.9, 0.14);
      this.bell(1046.5, 0.5, 1.2, 0.14);
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
    fever: false,
    tension: false,
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
      const chorus = bar >= 8 || this.fever;
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
      if (this.tension && s % 8 === 0) this.heart(t, 0.8);
      if (this.tension && s % 8 === 3) this.heart(t, 0.5);

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

    heart(t, v) {
      const ac = Sound.ctx;
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.15);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g).connect(this.out);
      o.start(t); o.stop(t + 0.28);
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
  const sign = $('sign');
  const muteBtn = $('mute-btn');
  const pauseBtn = $('pause-btn');
  const comboBadge = $('combo-badge');
  const feverBadge = $('fever-badge');
  const modeHud = $('mode-hud');
  const levelLabel = $('level-label');
  const mascotCanvas = $('mascot');
  mascotCanvas.width = mascotCanvas.height = 192;
  const bubble = $('bubble');
  const bubbleJp = $('bubble-jp');
  const bubbleHe = $('bubble-he');
  const toasts = $('toasts');
  const gardenBg = $('garden-bg');
  const gardenCanvas = $('garden-canvas');
  const gardenText = $('garden-text');
  const streakLine = $('streak-line');
  const collectionDot = $('collection-dot');
  const puzzleGrid = $('puzzle-grid');
  const missionList = $('mission-list');
  const missionsTotal = $('missions-total');
  const skinGrid = $('skin-grid');
  const flowerGrid = $('flower-grid');
  const boardTabs = $('board-tabs');
  const boardList = $('board-list');
  const boardNote = $('board-note');
  const shareImg = $('share-img');
  const shareTextEl = $('share-text');
  const shareNative = $('share-native');
  const shareSave = $('share-save');
  const shareCopy = $('share-copy');
  const shareStatus = $('share-status');
  const overJp = $('over-jp');
  const overTitle = $('over-title');
  const overRecord = $('over-record');
  const overStats = $('over-stats');
  const overNews = $('over-news');
  const againBtn = $('again-btn');
  const resumeBtn = $('resume-btn');
  const nameRow = $('name-row');
  const nameInput = $('name-input');
  const nameSave = $('name-save');
  const speedBar = $('speed-bar');
  const speedFill = $('speed-fill');
  const tutorial = $('tutorial');
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
  let tileSkin = null;
  function buildTiles(skin) {
    if (skin === tileSkin) return;
    tileSkin = skin;
    for (const t of TYPES) {
      tiles[t] = [];
      for (let v = 0; v < VARIANTS; v++) tiles[t].push(woodTile(t, v, skin));
    }
  }
  buildTiles('classic');

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

  const FLOWER_PALETTES = {
    sakura: PALETTES,
    wisteria: [
      { edge: '#a77bff', mid: '#f4ecff', core: '#6a2fd0', line: '#55259f' },
      { edge: '#c9a7ff', mid: '#ffffff', core: '#8f5ae8', line: '#6d3bbd' },
      { edge: '#8f6bff', mid: '#e6dcff', core: '#4b22a8', line: '#3a1a86' },
      { edge: '#e0b8ff', mid: '#fbf3ff', core: '#b45ad6', line: '#8a3aa8' },
    ],
    camellia: [
      { edge: '#d81b3c', mid: '#ff6f86', core: '#9e0c25', line: '#7a0a1c' },
      { edge: '#ff7a9a', mid: '#ffe3ea', core: '#e0456a', line: '#b52a4c' },
      { edge: '#f2f2f2', mid: '#ffffff', core: '#ffb3c4', line: '#c98a99' },
      { edge: '#c2185b', mid: '#ff8fb5', core: '#880e4f', line: '#6a0b3d' },
    ],
    kiku: [
      { edge: '#ffb300', mid: '#fff3c4', core: '#e65100', line: '#b85c00' },
      { edge: '#ffffff', mid: '#fffdf5', core: '#ffd54f', line: '#c8a64a' },
      { edge: '#ff8a50', mid: '#ffe0c8', core: '#d84315', line: '#a83210' },
      { edge: '#f48fb1', mid: '#fff0f5', core: '#c2185b', line: '#99154a' },
    ],
  };

  function flowerGlow(ctx, S, R) {
    const glow = ctx.createRadialGradient(0, 0, R * 0.2, 0, 0, S * 0.5);
    glow.addColorStop(0, 'rgba(255,220,230,.5)');
    glow.addColorStop(1, 'rgba(255,220,230,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-S / 2, -S / 2, S, S);
  }

  function stamens(ctx, S, R, pal, n, len) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const l = R * len * (i % 2 ? 0.8 : 1);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * l, Math.sin(a) * l, S * 0.02, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd94d';
      ctx.fill();
      ctx.lineWidth = S * 0.007;
      ctx.strokeStyle = '#d98a14';
      ctx.stroke();
    }
  }

  // camellia: round overlapping petals in two rings around a golden crown
  function makeCamellia(pal) {
    const S = 160, R = S * 0.42;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2);
    flowerGlow(ctx, S, R);
    for (const [n, dist, rx, ry, off] of [[6, 0.5, 0.36, 0.44, 0], [5, 0.26, 0.28, 0.32, 0.6]]) {
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.rotate(off + (i * Math.PI * 2) / n);
        ctx.translate(0, -R * dist);
        const g = ctx.createRadialGradient(0, R * 0.3, 0, 0, 0, R * ry * 1.3);
        g.addColorStop(0, pal.mid);
        g.addColorStop(1, pal.edge);
        ctx.beginPath();
        ctx.ellipse(0, 0, R * rx, R * ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = S * 0.02;
        ctx.strokeStyle = pal.line;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.beginPath();
        ctx.ellipse(-R * rx * 0.35, -R * ry * 0.35, R * 0.05, R * 0.13, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe27a';
    ctx.fill();
    stamens(ctx, S, R, pal, 14, 0.2);
    drawStar(ctx, R * 0.62, -R * 0.7, S * 0.08, '#fff');
    return c;
  }

  // chrysanthemum: many thin petals in two layers
  function makeKiku(pal) {
    const S = 160, R = S * 0.44;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2);
    flowerGlow(ctx, S, R);
    for (const [n, len, w, off] of [[24, 1, 0.1, 0], [16, 0.68, 0.11, 0.2]]) {
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.rotate(off + (i * Math.PI * 2) / n);
        const g = ctx.createLinearGradient(0, 0, 0, -R * len);
        g.addColorStop(0, pal.core);
        g.addColorStop(0.35, pal.mid);
        g.addColorStop(1, pal.edge);
        ctx.beginPath();
        ctx.ellipse(0, -R * len * 0.55, R * w, R * len * 0.45, 0, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.lineWidth = S * 0.012;
        ctx.strokeStyle = pal.line;
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.17, 0, Math.PI * 2);
    ctx.fillStyle = pal.core;
    ctx.fill();
    ctx.lineWidth = S * 0.014;
    ctx.strokeStyle = pal.line;
    ctx.stroke();
    stamens(ctx, S, R, pal, 10, 0.1);
    drawStar(ctx, R * 0.62, -R * 0.68, S * 0.08, '#fff');
    return c;
  }

  let blossoms = [];
  let bigBlossom = null;
  let petals = [];
  let flowerSet = null;
  function buildFlowers(id) {
    if (id === flowerSet) return;
    flowerSet = id;
    const pals = FLOWER_PALETTES[id] || PALETTES;
    blossoms = [];
    pals.forEach((p, i) => {
      if (id === 'camellia') blossoms.push(makeCamellia(p));
      else if (id === 'kiku') blossoms.push(makeKiku(p));
      else {
        blossoms.push(makeBlossom(p, 'sakura'));
        blossoms.push(makeBlossom(p, i % 2 ? 'ume' : 'yae'));
      }
    });
    bigBlossom = id === 'camellia' ? makeCamellia(pals[0]) : id === 'kiku' ? makeKiku(pals[0]) : makeBlossom(pals[0], 'yae');
    petals = pals.map(makePetal);
  }
  buildFlowers('sakura');
  const spinBlossoms = [makeBlossom(PALETTES[3], 'sakura'), makeBlossom(PALETTES[3], 'ume')];

  // ---- seasonal ambient sprites
  function makeMaple(color, dark) {
    const S = 48, R = S * 0.44;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    ctx.translate(S / 2, S / 2);
    ctx.beginPath();
    const N = 90;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      const lobe = Math.pow(Math.abs(Math.cos(2.5 * (a + Math.PI / 2))), 0.7);
      const r = R * (0.4 + 0.6 * lobe) + R * 0.06 * Math.sin(a * 26);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, color);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = dark;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(80,20,0,.5)';
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8);
      ctx.stroke();
    }
    return c;
  }

  function makeGlowDot(inner, outer) {
    const S = 32;
    const c = makeCanvas(S, S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, outer);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    return c;
  }

  const SEASON_SPRITES = [
    null, // spring uses the current petals
    [makeGlowDot('rgba(255,255,200,1)', 'rgba(190,255,110,.55)')],
    [makeMaple('#e53935', '#8e1b1b'), makeMaple('#ff7043', '#a8361a'), makeMaple('#ffb300', '#c25e00')],
    [makeGlowDot('rgba(255,255,255,1)', 'rgba(230,240,255,.6)')],
  ];
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

  function burstRows(rows, big, intensity = 1) {
    const rect = boardRect();
    const cellH = rect.height / ROWS;
    const scale = (reduceMotion ? 0.35 : 1) * intensity;
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

    if (big) {
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

  // lilac pinwheel of blossoms around a T-spin
  function spinBurst(cx, cy) {
    const n = reduceMotion ? 4 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      addBlossom(cx, cy, {
        img: spinBlossoms[i % 2], vx: Math.cos(a) * 320, vy: Math.sin(a) * 320 - 60,
        g: 200, size: rand(36, 54), life: 1.6,
      });
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

  // 0 spring petals, 1 summer fireflies, 2 autumn maple leaves, 3 winter snow
  let season = 0;
  const SEASON_COUNTS = [18, 14, 16, 40];

  function initAmbient() {
    ambient.length = 0;
    const n = reduceMotion ? 6 : SEASON_COUNTS[season];
    for (let i = 0; i < n; i++) ambient.push(newAmbientPetal(true));
  }

  function newAmbientPetal(anywhere) {
    const p = {
      kind: season,
      img: null,
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
    if (season === 0) {
      p.img = pick(petals);
    } else if (season === 1) {
      p.img = SEASON_SPRITES[1][0];
      if (!anywhere) p.y = vh + 20;
      p.vy = rand(-14, -4);
      p.vx = rand(-8, 8);
      p.size = rand(10, 18);
      p.sway = rand(10, 25);
    } else if (season === 2) {
      p.img = pick(SEASON_SPRITES[2]);
      p.size = rand(16, 26);
      p.vy = rand(25, 50);
    } else {
      p.img = SEASON_SPRITES[3][0];
      p.size = rand(6, 14);
      p.vy = rand(20, 40);
      p.vx = rand(-5, 10);
    }
    return p;
  }

  function updateAmbient(dt) {
    for (let i = 0; i < ambient.length; i++) {
      const p = ambient[i];
      p.age += dt;
      p.y += p.vy * dt;
      p.x += (p.vx + Math.sin(p.age * 0.9 + p.phase) * p.sway) * dt;
      p.rot += p.vr * dt;
      if (p.y > vh + 40 || p.x > vw + 40 || p.x < -60 || p.y < -80) ambient[i] = newAmbientPetal(false);
    }
  }

  const SEASON_NAMES = [
    { jp: '春', he: 'אביב' },
    { jp: '夏', he: 'קיץ: גחליליות' },
    { jp: '秋', he: 'סתיו: עלי מייפל' },
    { jp: '冬', he: 'חורף: שלג' },
  ];

  function setSeason(i, announce) {
    if (i === season) return;
    season = i;
    document.body.classList.remove('season-0', 'season-1', 'season-2', 'season-3');
    document.body.classList.add('season-' + i);
    initAmbient();
    if (announce) popup(SEASON_NAMES[i].jp, SEASON_NAMES[i].he, 'season', 30);
  }

  // ---------------------------------------------------------------------------
  // Sakura garden: a tree that grows and blooms with every line ever cleared
  // ---------------------------------------------------------------------------
  const gardenBlossoms = PALETTES.map((p) => makeBlossom(p, 'sakura'));

  function drawGarden(canvas, lifetimeLines) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const r = mulberry32(2026);
    const growth = clamp(lifetimeLines / 400, 0, 1);
    const depth = 4 + Math.round(growth * 4);
    const tips = [];
    const branch = (x, y, len, ang, width, d) => {
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      ctx.strokeStyle = d < 3 ? '#3b2314' : '#4d2e1a';
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * len * 0.3, (y + y2) / 2, x2, y2);
      ctx.stroke();
      if (d > 2) tips.push([x2, y2]);
      if (d >= depth) return;
      const n = r() > 0.65 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        branch(x2, y2, len * (0.68 + r() * 0.12), ang + (i - (n - 1) / 2) * 0.6 + (r() - 0.5) * 0.3, width * 0.68, d + 1);
      }
    };
    // ground
    const gg = ctx.createRadialGradient(w / 2, h * 0.97, 0, w / 2, h * 0.97, w * 0.45);
    gg.addColorStop(0, 'rgba(40,22,10,.85)');
    gg.addColorStop(1, 'rgba(40,22,10,0)');
    ctx.fillStyle = gg;
    ctx.fillRect(0, h * 0.85, w, h * 0.15);
    branch(w / 2, h * 0.96, h * (0.16 + 0.1 * growth), -Math.PI / 2, (w / 60) * (1 + 1.5 * growth), 1);
    const count = Math.min(tips.length * 5, Math.round(lifetimeLines * 1.5));
    const unit = w / 300;
    for (let i = 0; i < count; i++) {
      const [tx, ty] = tips[Math.floor(r() * tips.length)];
      const s = (7 + r() * 10) * unit;
      ctx.globalAlpha = 0.95;
      ctx.drawImage(gardenBlossoms[Math.floor(r() * gardenBlossoms.length)], tx + (r() - 0.5) * 26 * unit - s / 2, ty + (r() - 0.5) * 22 * unit - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    return { flowers: count, nextAt: Math.ceil((lifetimeLines + 1) / 50) * 50 };
  }

  // ---------------------------------------------------------------------------
  // Kitsune mascot, drawn live so it can blink, bounce and change faces
  // ---------------------------------------------------------------------------
  function drawMascot(ctx, S, expr, t) {
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    const u = S / 110;
    const bob = expr === 'excited' ? -Math.abs(Math.sin(t * 8)) * 6 * u : Math.sin(t * 2) * 1.5 * u;
    const shake = expr === 'scared' ? Math.sin(t * 40) * u : 0;
    ctx.translate(S / 2 + shake, S * 0.58 + bob);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const line = '#4a230c';
    const fur = (y0, y1) => {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, '#ffb05a');
      g.addColorStop(1, '#ee7418');
      return g;
    };

    // tail
    ctx.save();
    ctx.rotate(Math.sin(t * 3) * 0.12);
    ctx.beginPath();
    ctx.ellipse(34 * u, 20 * u, 13 * u, 24 * u, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = fur(0, 40 * u);
    ctx.fill();
    ctx.lineWidth = 2.4 * u;
    ctx.strokeStyle = line;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(46 * u, 6 * u, 6 * u, 9 * u, 0.9, 0, Math.PI * 2);
    ctx.fillStyle = '#fff6ec';
    ctx.fill();
    ctx.restore();

    // ears
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 12 * u, -24 * u);
      ctx.lineTo(sx * 33 * u, -50 * u);
      ctx.lineTo(sx * 36 * u, -12 * u);
      ctx.closePath();
      ctx.fillStyle = fur(-50 * u, -12 * u);
      ctx.fill();
      ctx.lineWidth = 2.4 * u;
      ctx.strokeStyle = line;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx * 18 * u, -23 * u);
      ctx.lineTo(sx * 31 * u, -41 * u);
      ctx.lineTo(sx * 32 * u, -17 * u);
      ctx.closePath();
      ctx.fillStyle = '#ffd6c2';
      ctx.fill();
    }

    // head
    ctx.beginPath();
    ctx.ellipse(0, 0, 37 * u, 30 * u, 0, 0, Math.PI * 2);
    ctx.fillStyle = fur(-30 * u, 30 * u);
    ctx.fill();
    ctx.lineWidth = 2.6 * u;
    ctx.strokeStyle = line;
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(-13 * u, 15 * u, 17 * u, 14 * u, 0, 0, Math.PI * 2);
    ctx.ellipse(13 * u, 15 * u, 17 * u, 14 * u, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff6ec';
    ctx.fill();
    ctx.restore();

    // red kitsune marks + blush
    ctx.fillStyle = '#e0245e';
    ctx.beginPath();
    ctx.ellipse(-7 * u, -21 * u, 2.2 * u, 5 * u, 0.3, 0, Math.PI * 2);
    ctx.ellipse(7 * u, -21 * u, 2.2 * u, 5 * u, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,110,140,.55)';
    ctx.beginPath();
    ctx.ellipse(-24 * u, 9 * u, 6 * u, 3.5 * u, 0, 0, Math.PI * 2);
    ctx.ellipse(24 * u, 9 * u, 6 * u, 3.5 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    // eyes
    ctx.lineWidth = 3 * u;
    ctx.strokeStyle = line;
    for (const sx of [-1, 1]) {
      const ex = sx * 14 * u, ey = -4 * u;
      if (expr === 'blink') {
        ctx.beginPath();
        ctx.moveTo(ex - 6 * u, ey);
        ctx.quadraticCurveTo(ex, ey + 3 * u, ex + 6 * u, ey);
        ctx.stroke();
      } else if (expr === 'happy') {
        ctx.beginPath();
        ctx.moveTo(ex - 6 * u, ey + 2 * u);
        ctx.quadraticCurveTo(ex, ey - 9 * u, ex + 6 * u, ey + 2 * u);
        ctx.stroke();
      } else if (expr === 'sad') {
        ctx.beginPath();
        ctx.moveTo(ex - 6 * u, ey - 1 * u);
        ctx.quadraticCurveTo(ex, ey + 4 * u, ex + 6 * u, ey - 1 * u);
        ctx.stroke();
      } else if (expr === 'scared') {
        ctx.beginPath();
        ctx.ellipse(ex, ey, 7 * u, 8.5 * u, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.lineWidth = 2 * u;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(ex, ey + 1 * u, 2.2 * u, 0, Math.PI * 2);
        ctx.fillStyle = '#2a1206';
        ctx.fill();
        ctx.lineWidth = 3 * u;
      } else {
        ctx.beginPath();
        ctx.ellipse(ex, ey, 6.5 * u, 8.5 * u, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#3a1a0a';
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(ex, ey + 3.5 * u, 5 * u, 4 * u, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#9a4416';
        ctx.fill();
        if (expr === 'excited') {
          drawStar(ctx, ex, ey - 1 * u, 7 * u, '#ffe14d');
        } else {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(ex - 2 * u, ey - 3.5 * u, 2.6 * u, 0, Math.PI * 2);
          ctx.arc(ex + 2.4 * u, ey + 2 * u, 1.2 * u, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (expr === 'scared') {
      ctx.beginPath();
      ctx.moveTo(30 * u, -26 * u);
      ctx.quadraticCurveTo(36 * u, -16 * u, 30 * u, -13 * u);
      ctx.quadraticCurveTo(24 * u, -16 * u, 30 * u, -26 * u);
      ctx.fillStyle = '#8fd3ff';
      ctx.fill();
      ctx.lineWidth = 1.5 * u;
      ctx.stroke();
    }
    if (expr === 'sad') {
      ctx.beginPath();
      ctx.ellipse(-14 * u, 6 * u, 2 * u, 3.5 * u, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#8fd3ff';
      ctx.fill();
    }

    // nose + mouth
    ctx.beginPath();
    ctx.ellipse(0, 5 * u, 2.4 * u, 1.7 * u, 0, 0, Math.PI * 2);
    ctx.fillStyle = line;
    ctx.fill();
    ctx.lineWidth = 2 * u;
    ctx.strokeStyle = line;
    if (expr === 'happy' || expr === 'excited') {
      ctx.beginPath();
      ctx.moveTo(-6 * u, 9 * u);
      ctx.quadraticCurveTo(0, 21 * u, 6 * u, 9 * u);
      ctx.closePath();
      ctx.fillStyle = '#a0283c';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 14.5 * u, 3 * u, 2 * u, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8fa8';
      ctx.fill();
    } else if (expr === 'scared') {
      ctx.beginPath();
      ctx.moveTo(-6 * u, 12 * u);
      ctx.quadraticCurveTo(-3 * u, 9 * u, 0, 12 * u);
      ctx.quadraticCurveTo(3 * u, 15 * u, 6 * u, 12 * u);
      ctx.stroke();
    } else if (expr === 'sad') {
      ctx.beginPath();
      ctx.moveTo(-4 * u, 13 * u);
      ctx.quadraticCurveTo(0, 9 * u, 4 * u, 13 * u);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(-3 * u, 8 * u, 3 * u, 0, Math.PI);
      ctx.arc(3 * u, 8 * u, 3 * u, 0, Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderEffects() {
    actx.setTransform(dpr, 0, 0, dpr, 0, 0);
    actx.clearRect(0, 0, vw, vh);
    for (const p of ambient) {
      actx.save();
      actx.globalAlpha = p.kind === 1 ? 0.35 + 0.6 * Math.abs(Math.sin(p.age * 1.7 + p.phase)) : p.kind === 3 ? 0.8 : 0.55;
      actx.translate(p.x, p.y);
      actx.rotate(p.rot);
      if (p.kind === 0 || p.kind === 2) actx.scale(Math.cos(p.age * p.flip + p.phase) || 0.05, 1);
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
    // a new clear replaces the previous clear's text instead of stacking on it
    if (!cls.includes('level')) popups.querySelectorAll('.popup:not(.level)').forEach((old) => old.remove());
    const el = document.createElement('div');
    el.className = 'popup ' + cls;
    const rect = boardRect();
    el.style.left = rect.left + rect.width / 2 + 'px';
    el.style.top = rect.top + rect.height * topPct / 100 + 'px';
    const j = document.createElement('span');
    j.className = 'jp';
    j.textContent = jp;
    el.appendChild(j);
    for (const line of [].concat(he)) {
      const s = document.createElement('span');
      s.className = 'he';
      s.textContent = line;
      el.appendChild(s);
    }
    popups.appendChild(el);
    setTimeout(() => el.remove(), 1700);
  }

  // ---------------------------------------------------------------------------
  // Modes, puzzles, missions, collection
  // ---------------------------------------------------------------------------
  const MODES = {
    marathon: { name: 'מרתון', levels: true, seasons: true },
    daily: { name: 'אתגר יומי', levels: true, seasons: true, timeLimit: 180000, seeded: true },
    sprint: { name: 'ספרינט 40', goalLines: 40 },
    zen: { name: 'זן', zen: true },
    puzzle: { name: 'חידות', puzzle: true },
  };

  // rows are bottom-aligned; '#' is a filled cell
  const PUZZLES = [
    { name: 'הטטריס הראשון', pieces: ['I'], goal: 4, rows: ['#########.', '#########.', '#########.', '#########.'] },
    { name: 'קובייה במקום', pieces: ['O'], goal: 2, rows: ['####..####', '####..####'] },
    { name: 'וו', pieces: ['J'], goal: 2, rows: ['#######...', '#########.'] },
    { name: 'שני עמודים', pieces: ['I', 'I'], goal: 4, rows: ['########..', '########..', '########..', '########..'] },
    { name: 'מראה', pieces: ['L', 'J'], goal: 2, rows: ['...####...', '.########.'] },
    { name: 'גג ועמוד', pieces: ['O', 'I'], goal: 4, rows: ['.#######..', '.#######..', '.#########', '.#########'] },
    {
      name: 'טי-ספין', pieces: ['T'], goal: 2, rows: ['####......', '###...####', '####.#####'],
      hint: 'הורידו את ה-T לאט עד למטה, ורק אז סובבו אותו לתוך החריץ',
    },
  ];

  const MISSION_POOL = [
    { id: 'lines30', text: 'נקו 30 שורות', key: 'lines', target: 30 },
    { id: 'lines80', text: 'נקו 80 שורות', key: 'lines', target: 80 },
    { id: 'tetris1', text: 'עשו טטריס', key: 'tetris', target: 1 },
    { id: 'tetris3', text: 'עשו 3 טטריסים', key: 'tetris', target: 3 },
    { id: 'tspin1', text: 'עשו טי-ספין', key: 'tspin', target: 1 },
    { id: 'combo3', text: `הגיעו לקומבו ${ltr('×3')}`, key: 'comboMax', target: 3, max: true },
    { id: 'combo5', text: `הגיעו לקומבו ${ltr('×5')}`, key: 'comboMax', target: 5, max: true },
    { id: 'score5k', text: 'השיגו 5,000 נקודות במשחק אחד', key: 'gameScore', target: 5000, max: true },
    { id: 'score15k', text: 'השיגו 15,000 נקודות במשחק אחד', key: 'gameScore', target: 15000, max: true },
    { id: 'fever', text: 'היכנסו למצב פיבר', key: 'fever', target: 1 },
    { id: 'level5', text: 'הגיעו לשלב 5', key: 'level', target: 5, max: true },
    { id: 'daily', text: 'שחקו את האתגר היומי', key: 'daily', target: 1 },
    { id: 'sprint', text: 'סיימו ספרינט 40', key: 'sprint', target: 1 },
    { id: 'puzzle2', text: 'פתרו 2 חידות', key: 'puzzle', target: 2 },
    { id: 'b2b', text: 'עשו טטריס או טי-ספין פעמיים ברצף', key: 'b2b', target: 1 },
  ];

  const DAILY_GOALS = [
    { key: 'lines', target: 25, text: 'נקו 25 שורות' },
    { key: 'tetris', target: 2, text: 'עשו 2 טטריסים' },
    { key: 'comboMax', target: 4, text: `הגיעו לקומבו ${ltr('×4')}` },
    { key: 'score', target: 8000, text: 'השיגו 8,000 נקודות' },
    { key: 'tspin', target: 1, text: 'עשו טי-ספין' },
  ];

  const SKINS = [
    { id: 'classic', name: 'עץ טבעי' },
    { id: 'bamboo', name: 'במבוק', need: 'נקו 100 שורות בסך הכול', prog: () => [P.lifeLines, 100] },
    { id: 'kuro', name: 'לכה שחורה', need: 'עשו 5 טטריסים בסך הכול', prog: () => [P.lifeTetris, 5] },
    { id: 'gold', name: 'עלה זהב', need: 'השלימו 6 משימות', prog: () => [P.missionsDone, 6] },
  ];
  const FLOWERS = [
    { id: 'sakura', name: 'סאקורה' },
    { id: 'wisteria', name: 'ויסטריה', need: 'השלימו 3 משימות', prog: () => [P.missionsDone, 3] },
    { id: 'camellia', name: 'קמליה', need: 'פתרו 4 חידות', prog: () => [P.puzzles.length, 4] },
    { id: 'kiku', name: 'כריזנטמה', need: 'שחקו 3 ימים ברצף', prog: () => [P.streak.best, 3] },
  ];
  const isUnlocked = (item) => !item.prog || item.prog()[0] >= item.prog()[1];

  const SAYINGS = {
    start: ['がんばって!', 'בהצלחה!'],
    tetris: ['すごい!', 'מדהים!'],
    combo: ['いいね!', 'יפה!'],
    tspin: ['かっこいい!', 'מגניב!'],
    perfect: ['完璧だ!', 'מושלם!'],
    danger: ['あぶない!', 'זהירות!'],
    relief: ['ふぅ…', 'פיו, ניצלנו'],
    fever: ['フィーバー!', 'פיבר!'],
    speed: ['はやい!', 'מהר!'],
    over: ['またね…', 'נתראה בפעם הבאה'],
    record: ['新記録!', 'שיא חדש!'],
    b2b: ['連続だ!', 'ברצף!'],
    puzzle: ['解けた!', 'פתרתם!'],
    mission: ['やった!', 'משימה הושלמה!'],
  };

  const fmt = (n) => Math.round(n).toLocaleString();
  function fmtTime(ms) {
    const t = Math.max(0, ms);
    return `${Math.floor(t / 60000)}:${String(Math.floor(t / 1000) % 60).padStart(2, '0')}.${Math.floor(t / 100) % 10}`;
  }
  function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  }
  function dailySeed(key = dateKey()) {
    let h = 2166136261;
    for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const dailyGoal = () => DAILY_GOALS[dailySeed() % DAILY_GOALS.length];

  // ---------------------------------------------------------------------------
  // Saved progress (this browser)
  // ---------------------------------------------------------------------------
  const PROGRESS_KEY = 'wood-tetris-progress';
  const P = {
    lifeLines: 0, lifeTetris: 0, lifeTspin: 0, games: 0, missionsDone: 0,
    best: { marathon: 0, zen: 0, sprint: 0 },
    board: { marathon: [], sprint: [], daily: [] },
    nick: '',
    daily: { date: '', best: 0, done: false },
    puzzles: [],
    streak: { last: '', count: 0, best: 0 },
    missions: [],
    skin: 'classic',
    flower: 'sakura',
    seenUnlocks: [],
  };

  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        for (const k of Object.keys(P)) {
          if (!(k in d)) continue;
          if (P[k] && typeof P[k] === 'object' && !Array.isArray(P[k])) Object.assign(P[k], d[k]);
          else P[k] = d[k];
        }
      }
      const old = parseInt(localStorage.getItem('wood-tetris-best') || '0', 10) || 0;
      if (old > P.best.marathon) P.best.marathon = old;
    } catch (e) { /* start fresh */ }
    for (const kind of Object.keys(P.board)) {
      P.board[kind] = (P.board[kind] || []).map((r, i) => ({ id: r.id || 'old' + kind + i, n: r.n || 'אני', v: r.v, d: r.d }));
    }
    if (!SKINS.some((s) => s.id === P.skin && isUnlocked(s))) P.skin = 'classic';
    if (!FLOWERS.some((f) => f.id === P.flower && isUnlocked(f))) P.flower = 'sakura';
    fillMissions();
  }

  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(P)); } catch (e) { /* storage unavailable */ }
  }

  function touchStreak() {
    const today = dateKey();
    const s = P.streak;
    if (s.last === today) return;
    s.count = s.last && daysBetween(s.last, today) === 1 ? s.count + 1 : 1;
    s.last = today;
    s.best = Math.max(s.best, s.count);
  }
  function activeStreak() {
    const s = P.streak;
    return s.last && daysBetween(s.last, dateKey()) <= 1 ? s.count : 0;
  }

  // every finished game goes into this device's table under the last name used
  const MAX_LOCAL = 100;
  function addLocal(kind, value) {
    const list = P.board[kind];
    const entry = { id: Date.now().toString(36), n: P.nick || 'שחקן', v: value, d: dateKey() };
    list.push(entry);
    list.sort((a, b) => (kind === 'sprint' ? a.v - b.v : b.v - a.v));
    if (list.length > MAX_LOCAL) list.length = MAX_LOCAL;
    return entry;
  }

  function localRows(kind) {
    const today = dateKey();
    return P.board[kind]
      .filter((r) => kind !== 'daily' || r.d === today)
      .map((r) => ({ id: r.id, name: r.n, date: r.d, value: r.v }));
  }

  // ---------------------------------------------------------------------------
  // Toasts, haptics, mascot
  // ---------------------------------------------------------------------------
  function toast(title, text) {
    const el = document.createElement('div');
    el.className = 'toast';
    const b = document.createElement('b');
    b.textContent = title;
    const s = document.createElement('span');
    s.textContent = text;
    el.append(b, s);
    toasts.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  function haptic(pattern) {
    if (Sound.muted) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* not supported */ }
  }

  const Mascot = {
    ctx: mascotCanvas.getContext('2d'),
    expr: 'idle',
    base: 'idle',
    until: 0,
    timer: null,
    set(expr, ms = 1800) {
      this.expr = expr;
      this.until = performance.now() + ms;
    },
    setBase(expr) { this.base = expr; },
    say(jp, he, expr, ms = 2000) {
      if (expr) this.set(expr, ms);
      bubbleJp.textContent = jp;
      bubbleHe.textContent = he;
      bubble.classList.remove('hidden', 'pop');
      void bubble.offsetWidth;
      bubble.classList.add('pop');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => bubble.classList.add('hidden'), ms + 400);
    },
    render(now) {
      if (now > this.until) this.expr = this.base;
      let e = this.expr;
      if (e === 'idle' && now % 3600 < 150) e = 'blink';
      drawMascot(this.ctx, mascotCanvas.width, e, now / 1000);
    },
  };
  function react(key, expr) {
    const [jp, he] = SAYINGS[key];
    Mascot.say(jp, he, expr);
  }

  // ---------------------------------------------------------------------------
  // Missions and unlocks
  // ---------------------------------------------------------------------------
  const missionDef = (id) => MISSION_POOL.find((t) => t.id === id);
  const gameNews = [];
  let knownUnlocks = new Set();

  function fillMissions(exclude = []) {
    P.missions = P.missions.filter((m) => missionDef(m.id));
    while (P.missions.length < 3) {
      const options = MISSION_POOL.filter((t) => !P.missions.some((m) => m.id === t.id) && !exclude.includes(t.id));
      const t = options[Math.floor(Math.random() * options.length)];
      P.missions.push({ id: t.id, progress: 0 });
    }
  }

  function track(key, value = 1) {
    let changed = false;
    const finished = [];
    for (const m of P.missions) {
      const def = missionDef(m.id);
      if (def.key !== key) continue;
      const before = m.progress;
      m.progress = def.max ? Math.max(m.progress, value) : m.progress + value;
      if (m.progress !== before) changed = true;
      if (m.progress >= def.target) finished.push(m);
    }
    if (finished.length) {
      for (const m of finished) {
        const def = missionDef(m.id);
        P.missionsDone++;
        toast('🎯 משימה הושלמה', def.text);
        gameNews.push('🎯 ' + def.text);
      }
      Sound.mission();
      haptic([20, 40, 20]);
      react('mission', 'excited');
      P.missions = P.missions.filter((m) => !finished.includes(m));
      fillMissions(finished.map((m) => m.id));
      checkUnlocks();
    }
    if (changed) saveProgress();
  }

  function checkUnlocks() {
    for (const item of [...SKINS, ...FLOWERS]) {
      if (!isUnlocked(item) || knownUnlocks.has(item.id)) continue;
      knownUnlocks.add(item.id);
      toast('🎁 נפתח באוסף', item.name);
      gameNews.push('🎁 נפתח באוסף: ' + item.name);
    }
  }

  // ---------------------------------------------------------------------------
  // Shared leaderboard (only when the page runs inside claude.ai with `db`)
  // ---------------------------------------------------------------------------
  const Cloud = { ready: false, readOnly: false, db: null, user: null, uid: null, mine: {}, downloads: null };

  async function initCloud() {
    const c = window.claude;
    if (!c || typeof c.use !== 'function') return;
    c.use('downloads').then((d) => { Cloud.downloads = d; }).catch(() => {});
    try {
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      Cloud.db = db;
      Cloud.user = user;
      Cloud.uid = uid;
      const snap = await db.doc('scores/' + uid).get();
      Cloud.mine = snap.exists ? { ...snap.data() } : {};
      Cloud.ready = true;
      if (currentPanel === 'leaders') renderLeaders();
    } catch (e) { Cloud.ready = false; }
  }

  async function cloudSubmit(fields) {
    if (!Cloud.ready || Cloud.readOnly) return;
    const mine = Cloud.mine;
    const next = { ...mine };
    let changed = false;
    if (fields.nick && fields.nick !== mine.nick) { next.nick = fields.nick; changed = true; }
    if (fields.marathon && fields.marathon > (mine.marathon || 0)) { next.marathon = fields.marathon; changed = true; }
    if (fields.sprint && (!mine.sprint || fields.sprint < mine.sprint)) { next.sprint = fields.sprint; changed = true; }
    if (fields.dailyDate && (mine.dailyDate !== fields.dailyDate || fields.dailyScore > (mine.dailyScore || 0))) {
      next.dailyDate = fields.dailyDate;
      next.dailyScore = fields.dailyScore;
      changed = true;
    }
    if (!changed) return;
    next.at = Date.now();
    try {
      await Cloud.db.doc('scores/' + Cloud.uid).set(next);
      Cloud.mine = next;
    } catch (e) {
      if (e && e.code === 'invalid_argument') Cloud.readOnly = true;
    }
  }

  async function cloudTop(kind) {
    const col = Cloud.db.collection('scores');
    let q;
    if (kind === 'marathon') q = col.where('marathon', '>', 0).orderBy('marathon', 'desc').limit(100);
    else if (kind === 'sprint') q = col.where('sprint', '>', 0).orderBy('sprint', 'asc').limit(100);
    else q = col.where('dailyDate', '==', dateKey()).orderBy('dailyScore', 'desc').limit(100);
    const snap = await q.get();
    const ids = snap.docs.map((d) => d.id);
    const profiles = ids.length ? await Cloud.user.profiles(ids) : {};
    return snap.docs.map((d) => {
      const v = d.data();
      return {
        name: (typeof v.nick === 'string' && v.nick.slice(0, 16)) || (profiles[d.id] && profiles[d.id].name) || 'שחקן',
        value: kind === 'marathon' ? v.marathon : kind === 'sprint' ? v.sprint : v.dailyScore,
        me: d.id === Cloud.uid,
      };
    });
  }


  // ---------------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------------
  let grid, bag, queue, cur, holdType, canHold;
  let score = 0, lines = 0, level = 1, combo = -1;
  let state = 'menu'; // menu | play | pause | clearing | over
  let mode = 'marathon';
  let puzzleIndex = 0;
  let rng = Math.random;
  let playTime = 0;
  let gs = { lines: 0, tetris: 0, tspin: 0, comboMax: 0, perfect: 0 };
  let lastResult = null;
  let pending = null;       // the table entry of the game that just ended
  let highlightId = null;   // row to highlight in the results table
  let overAt = 0;           // when the last game ended
  let dropAcc = 0, lockTimer = 0, lockResets = 0;
  let clearingRows = [], clearTimer = 0;
  const held = { left: false, right: false, down: false };
  let dasDir = 0, dasTimer = 0, arrTimer = 0;
  let b2b = false, lastRotate = false;
  let levelTimer = 0, linesInLevel = 0;
  let fever = 0;   // ms of fever left
  let danger = false;
  let dailyNotified = false;
  const FEVER_MS = 12000;

  function emptyGrid() {
    return Array.from({ length: TOTAL }, () => Array(COLS).fill(null));
  }

  function nextFromBag() {
    if (!bag.length) {
      bag = TYPES.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
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
    lastRotate = false;
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
        lastRotate = true;
        afterManipulation();
        return;
      }
    }
  }

  function softStep() {
    if (!collide(cur.m, cur.x, cur.y + 1)) {
      cur.y++;
      lockTimer = 0;
      lastRotate = false;
      return true;
    }
    return false;
  }

  function hardDrop() {
    if (state !== 'play' || !cur) return;
    let n = 0;
    while (!collide(cur.m, cur.x, cur.y + 1)) { cur.y++; n++; }
    if (n) lastRotate = false;
    score += n * 2;
    Sound.tok(1.4);
    lockPiece(true);
  }

  function doHold() {
    if (state !== 'play' || !cur || !canHold || mode === 'puzzle') return;
    const t = cur.type;
    if (holdType) {
      cur = makePiece(holdType);
      if (collide(cur.m, cur.x, cur.y)) { topOut(); return; }
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
    if (mode === 'puzzle') {
      if (lines >= PUZZLES[puzzleIndex].goal) { endGame('puzzle-win'); return; }
      if (!queue.length) { endGame('puzzle-fail'); return; }
      cur = makePiece(queue.shift());
    } else {
      cur = makePiece(queue.shift());
      queue.push(nextFromBag());
    }
    canHold = mode !== 'puzzle';
    lockTimer = 0;
    lockResets = 0;
    dropAcc = 0;
    if (collide(cur.m, cur.x, cur.y)) {
      cur.y--;
      if (collide(cur.m, cur.x, cur.y)) { topOut(); return; }
    }
    checkDanger();
    updateModeHud();
  }

  // Zen never ends: a full board blooms away and play goes on
  function topOut() {
    if (mode !== 'zen') { endGame('topout'); return; }
    const rows = [];
    for (let y = HIDDEN; y < TOTAL; y++) if (grid[y].some(Boolean)) rows.push(y);
    burstRows(rows.slice(-6), true, 0.6);
    grid = emptyGrid();
    popup('禅', 'הלוח התנקה, ממשיכים בשקט', 'level', 45);
    Sound.relief();
    cur = makePiece(queue.shift());
    queue.push(nextFromBag());
    checkDanger();
  }

  function gravityMs() {
    return Math.max(55, 900 * Math.pow(0.85, level - 1));
  }

  function levelUp() {
    level++;
    levelTimer = 0;
    updateModeHud();
    Music.setLevel(level);
    Sound.speedUp();
    setTimeout(() => popup('スピードアップ!', `שלב ${level} · מהירות עולה!`, 'level', 64), 450);
    speedBar.classList.remove('flash');
    void speedBar.offsetWidth;
    speedBar.classList.add('flash');
    track('level', level);
    react('speed', 'excited');
    if (MODES[mode].seasons) {
      const s = Math.floor((level - 1) / 3) % 4;
      if (s !== season) setTimeout(() => setSeason(s, true), 1400);
    }
    updateUI();
  }

  // 3-corner rule: the T was rotated into place and 3 of its 4 corners are blocked
  function isTSpin() {
    if (cur.type !== 'T' || !lastRotate) return false;
    let n = 0;
    for (const [cx, cy] of [[0, 0], [2, 0], [0, 2], [2, 2]]) {
      const x = cur.x + cx, y = cur.y + cy;
      if (x < 0 || x >= COLS || y >= TOTAL || (y >= 0 && grid[y][x])) n++;
    }
    return n >= 3;
  }

  function updateComboBadge() {
    if (combo >= 1) {
      comboBadge.textContent = `コンボ ×${combo + 1}`;
      comboBadge.classList.remove('hidden', 'bump');
      void comboBadge.offsetWidth;
      comboBadge.classList.add('bump');
    } else {
      comboBadge.classList.add('hidden');
    }
  }

  // ---- fever: a big combo doubles the score for a few seconds
  function startFever() {
    if (fever > 0) { fever = Math.min(fever + 4000, 15000); return; }
    fever = FEVER_MS;
    Music.fever = true;
    frame.classList.add('fever');
    feverBadge.classList.remove('hidden');
    Sound.feverStart();
    haptic([30, 30, 30, 30, 80]);
    setTimeout(() => popup('フィーバー!', ['מצב פיבר!', `ניקוד ${ltr('×2')}`], 'level fever', 30), 300);
    react('fever', 'excited');
    track('fever', 1);
  }

  function endFever() {
    fever = 0;
    Music.fever = false;
    frame.classList.remove('fever');
    feverBadge.classList.add('hidden');
  }

  // ---- danger: the stack is close to the top
  function stackTop() {
    for (let y = HIDDEN; y < TOTAL; y++) if (grid[y].some(Boolean)) return y - HIDDEN;
    return ROWS;
  }

  function checkDanger() {
    const now = state === 'play' && !!grid && stackTop() < 6;
    if (now === danger) return;
    danger = now;
    frame.classList.toggle('danger', danger);
    Music.tension = danger;
    if (danger) {
      Sound.dangerEnter();
      haptic([60, 40, 60]);
      Mascot.setBase('scared');
      react('danger', 'scared');
    } else {
      Mascot.setBase('idle');
      Sound.relief();
      react('relief', 'happy');
    }
  }

  function clearDanger() {
    danger = false;
    frame.classList.remove('danger');
    Music.tension = false;
    Mascot.setBase('idle');
  }

  function lockPiece(silent) {
    const tspin = isTSpin();
    const rect = boardRect();
    const spinX = rect.left + (cur.x + 1.5) * rect.width / COLS;
    const spinY = rect.top + (cur.y + 1.5 - HIDDEN) * rect.height / ROWS;

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
    haptic(10);
    cur = null;
    lastRotate = false;
    if (allHidden) { topOut(); return; }

    const full = [];
    for (let y = 0; y < TOTAL; y++) if (grid[y].every(Boolean)) full.push(y);
    const n = full.length;

    let pts = 0;
    let jp = null;
    let perfect = false;
    const tags = [];

    if (tspin) {
      pts += TSPIN_SCORE[n] * level;
      jp = 'Tスピン!';
      tags.push(TSPIN_LABELS[n]);
      Sound.tspin();
      spinBurst(spinX, spinY);
      gs.tspin++;
      P.lifeTspin++;
      track('tspin', 1);
      haptic([15, 20, 40]);
      react('tspin', 'excited');
    }

    if (n) {
      combo++;
      if (!tspin) {
        pts += SCORE_TABLE[n] * level;
        jp = CLEAR_LABELS[n].jp;
        tags.push(CLEAR_LABELS[n].he);
      }
      // back-to-back: two "difficult" clears (Tetris or T-spin) in a row
      const difficult = n === 4 || tspin;
      if (difficult && b2b) {
        pts = Math.round(pts * 1.5);
        jp = '連続' + jp;
        tags.push(`ברצף! ${ltr('×1.5')}`);
        Sound.backToBack();
        track('b2b', 1);
        react('b2b', 'excited');
      }
      b2b = difficult;
      if (combo > 0) {
        pts += 50 * combo * level;
        tags.push(`קומבו ${ltr('×' + (combo + 1))}!`);
        Sound.combo(combo);
        haptic([20, 30, 20]);
        if (combo >= 2 && !tspin) react('combo', 'happy');
      }
      const set = new Set(full);
      perfect = grid.every((row, y) => set.has(y) || row.every((cell) => !cell));
      if (perfect) {
        pts += PERFECT_SCORE * level;
        jp = '完璧!';
        tags.unshift('לוח נקי!');
        Sound.perfect();
        gs.perfect++;
        haptic([50, 50, 50, 50, 120]);
        react('perfect', 'excited');
      }
      if (n === 4) {
        gs.tetris++;
        P.lifeTetris++;
        track('tetris', 1);
        haptic([30, 40, 60]);
        if (!perfect && !b2b) react('tetris', 'excited');
      } else {
        haptic(25 + n * 10);
      }
      if (fever > 0) {
        pts *= 2;
        tags.push(`פיבר ${ltr('×2')}`);
        fever = Math.min(fever + 3000, 15000);
      }
      gs.comboMax = Math.max(gs.comboMax, combo + 1);
      track('comboMax', combo + 1);

      lines += n;
      gs.lines += n;
      P.lifeLines += n;
      track('lines', n);
      clearingRows = full;
      clearTimer = 0;
      state = 'clearing';
      const big = n === 4 || perfect || (tspin && n >= 2);
      burstRows(full, big, 1 + Math.min(combo, 6) * 0.2);
      Sound.clear(n);
      if (big && !reduceMotion) {
        frame.classList.remove('shake');
        void frame.offsetWidth;
        frame.classList.add('shake');
      }
      if (MODES[mode].levels) {
        linesInLevel += n;
        while (linesInLevel >= LINES_PER_LEVEL) {
          linesInLevel -= LINES_PER_LEVEL;
          levelUp();
        }
      }
      if (combo >= 4 || perfect) startFever();
    } else {
      combo = -1;
      spawnNext();
    }

    score += pts;
    if (pts) track('gameScore', score);
    if (jp) {
      tags.push(ltr('+' + pts.toLocaleString()));
      const cls = (n === 4 || perfect) ? 'big' : (tspin ? 'spin' : '');
      popup(jp, tags, cls, 42);
    }
    updateComboBadge();
    updateUI();
    updateModeHud();
  }

  function finishClear() {
    const set = new Set(clearingRows);
    grid = grid.filter((_, y) => !set.has(y));
    while (grid.length < TOTAL) grid.unshift(Array(COLS).fill(null));
    clearingRows = [];
    state = 'play';
    if (mode === 'sprint' && lines >= MODES.sprint.goalLines) { endGame('sprint-done'); return; }
    spawnNext();
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------
  function dailyProgress(g) {
    return g.key === 'score' ? score : gs[g.key] || 0;
  }

  function modeBest() {
    if (mode === 'sprint') return P.best.sprint ? fmtTime(P.best.sprint) : '—';
    if (mode === 'daily') return fmt(Math.max(score, P.daily.date === dateKey() ? P.daily.best : 0));
    if (mode === 'puzzle') return `${P.puzzles.length}/${PUZZLES.length}`;
    return fmt(Math.max(score, P.best[mode] || 0));
  }

  function levelValue() {
    if (mode === 'sprint') return fmtTime(playTime);
    if (mode === 'daily') return fmtTime(MODES.daily.timeLimit - playTime);
    if (mode === 'puzzle') return String(puzzleIndex + 1);
    return String(level);
  }

  function updateUI() {
    ui.score.textContent = fmt(score);
    ui.best.textContent = modeBest();
    ui.level.textContent = levelValue();
    ui.lines.textContent = lines;
  }

  function updateModeHud() {
    let t = '';
    if (mode === 'marathon') {
      t = `マラソン מרתון · שלב ${level}`;
    } else if (mode === 'sprint') {
      t = `🏁 ספרינט · ${ltr(Math.min(lines, 40) + '/40')} שורות`;
    } else if (mode === 'daily') {
      const g = dailyGoal();
      const p = Math.min(dailyProgress(g), g.target);
      t = `⏱ אתגר יומי · 🎯 ${g.text} ${ltr(p + '/' + g.target)}${p >= g.target ? ' ✓' : ''}`;
      if (p >= g.target && !dailyNotified && state !== 'menu') {
        dailyNotified = true;
        toast('🎯 המטרה היומית הושלמה!', g.text);
        Sound.mission();
      }
    } else if (mode === 'puzzle') {
      const pz = PUZZLES[puzzleIndex];
      const left = queue.length + (cur ? 1 : 0);
      t = `🧩 ${ltr(Math.min(lines, pz.goal) + '/' + pz.goal)} שורות · ${left} ${left === 1 ? 'חלק' : 'חלקים'}`;
    } else if (mode === 'zen') {
      t = '禅 זן · בלי לחץ';
    }
    modeHud.textContent = t;
    modeHud.classList.toggle('hidden', !t || state === 'menu' || !grid);
  }

  // ---------------------------------------------------------------------------
  // Game flow
  // ---------------------------------------------------------------------------
  function newGame(m = mode, opt = {}) {
    Sound.init();
    if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume();
    mode = m;
    const M = MODES[mode];
    rng = M.seeded ? mulberry32(dailySeed()) : Math.random;
    grid = emptyGrid();
    bag = [];
    holdType = null;
    canHold = true;
    score = 0; lines = 0; level = 1; combo = -1;
    b2b = false; lastRotate = false;
    levelTimer = 0; linesInLevel = 0; playTime = 0;
    gs = { lines: 0, tetris: 0, tspin: 0, comboMax: 0, perfect: 0 };
    dailyNotified = false;
    gameNews.length = 0;
    clearingRows = [];
    endFever();
    clearDanger();
    if (M.puzzle) {
      if (opt.puzzle !== undefined) puzzleIndex = opt.puzzle;
      const pz = PUZZLES[puzzleIndex];
      pz.rows.forEach((row, i) => {
        const y = TOTAL - pz.rows.length + i;
        [...row].forEach((ch, x) => {
          if (ch === '#') grid[y][x] = { t: TYPES[(x * 3 + y) % TYPES.length], v: (x + y) % VARIANTS };
        });
      });
      queue = pz.pieces.slice();
    } else {
      queue = [nextFromBag(), nextFromBag(), nextFromBag()];
    }
    frame.classList.toggle('no-speed', !M.levels);
    levelLabel.textContent = mode === 'sprint' ? 'זמן' : mode === 'daily' ? 'נשאר' : mode === 'puzzle' ? 'חידה' : 'שלב';
    setSeason(0, false);
    touchStreak();
    P.games++;
    saveProgress();
    state = 'play';
    hideOverlay();
    updateComboBadge();
    spawnNext();
    updateUI();
    updateModeHud();
    Music.setLevel(1);
    Music.play(true);
    react('start', 'happy');
    if (M.puzzle && PUZZLES[puzzleIndex].hint) toast('💡 רמז', PUZZLES[puzzleIndex].hint);
  }

  function endGame(reason) {
    if (state === 'over') return;
    state = 'over';
    overAt = performance.now();
    cur = null;
    Music.stop();
    endFever();
    clearDanger();
    updateComboBadge();

    let title = 'המשחק נגמר';
    let big = '終';
    let record = false;
    const stats = [['ניקוד', fmt(score)], ['שורות', String(lines)]];

    if (mode === 'marathon' || mode === 'zen') {
      if (score > (P.best[mode] || 0)) { record = score > 0; P.best[mode] = score; }
      stats.push(['שלב', String(level)]);
    }
    pending = null;
    if (mode === 'marathon') {
      pending = { kind: 'marathon', entry: addLocal('marathon', score) };
      cloudSubmit({ marathon: score });
    }
    if (reason === 'sprint-done') {
      title = 'ספרינט הושלם!';
      big = '速';
      const t = Math.round(playTime);
      if (!P.best.sprint || t < P.best.sprint) { record = true; P.best.sprint = t; }
      pending = { kind: 'sprint', entry: addLocal('sprint', t) };
      cloudSubmit({ sprint: t });
      track('sprint', 1);
      stats.unshift(['זמן', fmtTime(t)]);
    }
    if (mode === 'daily') {
      title = reason === 'time-up' ? 'הזמן נגמר!' : 'המשחק נגמר';
      big = '今';
      const today = dateKey();
      if (P.daily.date !== today) P.daily = { date: today, best: 0, done: false };
      if (score > P.daily.best) { record = P.daily.best > 0; P.daily.best = score; }
      const g = dailyGoal();
      const done = dailyProgress(g) >= g.target;
      if (done) P.daily.done = true;
      stats.push(['מטרה', `${g.text} ${done ? '✓' : '✗'}`]);
      pending = { kind: 'daily', entry: addLocal('daily', score) };
      cloudSubmit({ dailyDate: today, dailyScore: P.daily.best });
      track('daily', 1);
    }
    if (reason === 'puzzle-win') {
      title = 'החידה נפתרה!';
      big = '解';
      if (!P.puzzles.includes(puzzleIndex)) P.puzzles.push(puzzleIndex);
      track('puzzle', 1);
    }
    if (reason === 'puzzle-fail') {
      title = 'לא הפעם';
      big = '惜';
    }
    if (pending) {
      const list = localRows(pending.kind);
      stats.push(['מקום בטבלה', `${list.findIndex((r) => r.id === pending.entry.id) + 1} מתוך ${list.length}`]);
    }
    if (gs.tetris) stats.push(['טטריסים', String(gs.tetris)]);
    if (gs.comboMax > 1) stats.push(['קומבו מרבי', '×' + gs.comboMax]);

    checkUnlocks();
    saveProgress();

    const won = reason === 'puzzle-win' || reason === 'sprint-done';
    if (won) { Sound.clear(4); Sound.mission(); }
    else if (reason === 'time-up') Sound.relief();
    else { Sound.gameOver(); haptic(250); }
    if (record) react('record', 'excited');
    else if (reason === 'puzzle-win') react('puzzle', 'excited');
    else if (!won) react('over', 'sad');

    lastResult = { mode, reason, score, lines, level, time: playTime, record, puzzle: puzzleIndex };

    overJp.textContent = big;
    overTitle.textContent = title;
    overRecord.classList.toggle('hidden', !record);
    overStats.textContent = '';
    for (const [k, v] of stats) {
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      overStats.append(dt, dd);
    }
    overNews.textContent = '';
    for (const line of gameNews) {
      const li = document.createElement('li');
      li.textContent = line;
      overNews.appendChild(li);
    }
    nameRow.hidden = !pending;
    nameInput.value = P.nick;
    againBtn.textContent = reason === 'puzzle-win' && puzzleIndex < PUZZLES.length - 1 ? 'לחידה הבאה'
      : reason === 'puzzle-fail' ? 'נסו שוב' : 'שוב';
    showPanel('over');
    drawGardenBg();
  }

  function playAgain() {
    if (lastResult && lastResult.reason === 'puzzle-win' && puzzleIndex < PUZZLES.length - 1) newGame('puzzle', { puzzle: puzzleIndex + 1 });
    else newGame(mode);
  }

  function quitToMenu() {
    state = 'menu';
    cur = null;
    grid = null;
    score = 0; lines = 0; combo = -1;
    Music.stop();
    endFever();
    clearDanger();
    updateComboBadge();
    updateModeHud();
    updateUI();
    saveProgress();
  }

  function togglePause() {
    if (state === 'play') {
      state = 'pause';
      Music.stop();
      saveProgress();
      showPanel('pause');
    } else if (state === 'pause') {
      state = 'play';
      hideOverlay();
      Music.play(false);
    }
  }

  // Enter, the tutorial's last button and "play" all land here
  function start() {
    Sound.init();
    if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume();
    if (state === 'pause') togglePause();
    else if (state === 'over') playAgain();
    else if (state === 'menu') newGame('marathon');
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

    const M = MODES[mode];
    playTime += dt;
    if (M.timeLimit && playTime >= M.timeLimit) { endGame('time-up'); return; }
    if (M.levels) {
      levelTimer += dt;
      if (levelTimer >= LEVEL_MS) {
        linesInLevel = 0;
        levelUp();
      }
    }
    if (M.zen) {
      const s = Math.floor(playTime / 90000) % 4;
      if (s !== season) setSeason(s, true);
    }
    if (fever > 0) {
      fever -= dt;
      if (fever <= 0) endFever();
    }

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

  function renderBoard(now) {
    const ctx = bctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(boardBg, 0, 0, COLS * CELL, ROWS * CELL);
    if (!grid) return;

    if (fever > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, ROWS * CELL);
      const a = 0.1 + 0.06 * Math.sin(now / 180);
      g.addColorStop(0, `rgba(255,120,170,${a * 1.6})`);
      g.addColorStop(1, `rgba(255,170,90,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    }

    const clearSet = new Set(clearingRows);
    const p = state === 'clearing' ? clamp(clearTimer / CLEAR_MS, 0, 1) : 0;
    const pulse = 0.5 + 0.5 * Math.sin(now / 220);

    for (let y = HIDDEN; y < TOTAL; y++) {
      const py = (y - HIDDEN) * CELL;
      let filled = 0, gap = -1;
      for (let x = 0; x < COLS; x++) {
        const cell = grid[y][x];
        if (!cell) { gap = x; continue; }
        filled++;
        if (clearSet.has(y)) {
          const s = CELL * (1 - p * p);
          drawCell(ctx, cell.t, cell.v, x * CELL + (CELL - s) / 2, py + (CELL - s) / 2, s, 1 - p * 0.6);
        } else {
          drawCell(ctx, cell.t, cell.v, x * CELL, py, CELL);
        }
      }
      // "almost!": one cell missing, so the gap glows
      if (filled === COLS - 1 && !clearSet.has(y)) {
        ctx.fillStyle = `rgba(255,190,215,${0.05 + 0.05 * pulse})`;
        ctx.fillRect(0, py, COLS * CELL, CELL);
        ctx.fillStyle = `rgba(255,170,205,${0.12 + 0.18 * pulse})`;
        roundRectPath(ctx, gap * CELL + 3, py + 3, CELL - 6, CELL - 6, 6);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = `rgba(255,215,232,${0.5 + 0.4 * pulse})`;
        ctx.stroke();
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
    if (holdType && state !== 'menu') drawMini(hctx, holdType, hw / 2, hh / 2, Math.min(hw / 5, hh / 3), canHold ? 1 : 0.4);

    const nw = nextCanvas.width / dpr, nh = nextCanvas.height / dpr;
    nctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nctx.clearRect(0, 0, nw, nh);
    if (!queue || state === 'menu') return;
    const count = nh > nw * 1.4 ? 3 : 1;
    const slot = nh / count;
    for (let i = 0; i < count && queue[i]; i++) {
      const size = Math.min(nw / 5, slot / 3) * (i === 0 ? 1 : 0.82);
      drawMini(nctx, queue[i], nw / 2, slot * i + slot / 2, size, i === 0 ? 1 : 0.85);
    }
  }

  let shownProgress = -1;
  function renderSpeedBar() {
    const p = clamp(Math.max(levelTimer / LEVEL_MS, linesInLevel / LINES_PER_LEVEL), 0, 1);
    if (Math.abs(p - shownProgress) < 0.004) return;
    shownProgress = p;
    speedFill.style.transform = `scaleX(${p.toFixed(3)})`;
  }

  let shownFever = -1, shownTime = '';
  function renderHud() {
    const sec = fever > 0 ? Math.ceil(fever / 1000) : 0;
    if (sec !== shownFever) {
      shownFever = sec;
      feverBadge.textContent = sec ? `🔥 פיבר ${ltr('×2')} · ${sec}` : '';
    }
    if (state === 'play' && (mode === 'sprint' || mode === 'daily')) {
      const t = levelValue();
      if (t !== shownTime) { shownTime = t; ui.level.textContent = t; }
    }
  }

  let last = performance.now();
  function loop(now) {
    const dtMs = Math.min(50, now - last);
    last = now;
    update(dtMs);
    updateParts(dtMs / 1000);
    updateAmbient(dtMs / 1000);
    if (fever > 0 && !reduceMotion && Math.random() < 0.18) {
      addPetal(rand(0, vw), -10, { vx: rand(-30, 30), vy: rand(40, 120), life: 4 });
    }
    renderBoard(now);
    renderSide();
    renderEffects();
    renderSpeedBar();
    renderHud();
    Mascot.render(now);
    requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------------------------
  // Menu panels
  // ---------------------------------------------------------------------------
  const panels = [...overlay.querySelectorAll('.panel')];
  let currentPanel = 'menu';
  let boardKind = 'marathon';

  function showPanel(name) {
    currentPanel = name;
    overlay.classList.remove('hidden');
    panels.forEach((p) => { p.hidden = p.dataset.panel !== name; });
    sign.scrollTop = 0;
    const render = { menu: renderMenu, puzzles: renderPuzzles, missions: renderMissions, garden: renderGarden, collection: renderCollection, leaders: renderLeaders, share: renderShare }[name];
    if (render) render();
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function renderMenu() {
    const n = activeStreak();
    streakLine.textContent = '';
    const label = document.createElement('span');
    label.textContent = n ? `🔥 ${n} ${n === 1 ? 'יום' : 'ימים'} ברצף` : 'שחקו היום כדי להתחיל רצף 🔥';
    const flowers = document.createElement('span');
    flowers.className = 'streak-flowers';
    const filled = n ? ((n - 1) % 7) + 1 : 0;
    for (let i = 0; i < 7; i++) {
      const f = document.createElement('i');
      f.textContent = i < filled ? '🌸' : '·';
      flowers.appendChild(f);
    }
    streakLine.append(label, flowers);

    $('mode-sub-marathon').textContent = P.best.marathon ? `שיא: ${fmt(P.best.marathon)}` : 'אינסופי, המהירות עולה';
    const g = dailyGoal();
    const doneToday = P.daily.date === dateKey() && P.daily.done;
    $('mode-sub-daily').textContent = `${g.text} · 3 דקות${doneToday ? ' ✓' : ''}`;
    $('mode-sub-sprint').textContent = P.best.sprint ? `שיא: ${fmtTime(P.best.sprint)}` : '40 שורות, כמה שיותר מהר';
    $('mode-sub-puzzle').textContent = `${P.puzzles.length}/${PUZZLES.length} נפתרו`;
    collectionDot.classList.toggle('hidden', ![...SKINS, ...FLOWERS].some((i) => isUnlocked(i) && i.prog && !P.seenUnlocks.includes(i.id)));
  }

  function renderPuzzles() {
    puzzleGrid.textContent = '';
    PUZZLES.forEach((pz, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'puzzle-btn' + (P.puzzles.includes(i) ? ' solved' : '');
      const num = document.createElement('b');
      num.textContent = P.puzzles.includes(i) ? '✓' : String(i + 1);
      const name = document.createElement('span');
      name.textContent = pz.name;
      b.append(num, name);
      b.addEventListener('click', () => newGame('puzzle', { puzzle: i }));
      puzzleGrid.appendChild(b);
    });
  }

  function renderMissions() {
    missionList.textContent = '';
    for (const m of P.missions) {
      const def = missionDef(m.id);
      const li = document.createElement('li');
      const t = document.createElement('span');
      t.textContent = def.text;
      const bar = document.createElement('i');
      bar.className = 'bar';
      const fill = document.createElement('i');
      fill.style.width = Math.min(100, (m.progress / def.target) * 100) + '%';
      bar.appendChild(fill);
      const n = document.createElement('small');
      n.textContent = ltr(`${Math.min(m.progress, def.target)}/${def.target}`);
      li.append(t, bar, n);
      missionList.appendChild(li);
    }
    missionsTotal.textContent = `השלמתם ${P.missionsDone} משימות עד היום.`;
  }

  function renderGarden() {
    const res = drawGarden(gardenCanvas, P.lifeLines);
    gardenText.textContent = P.lifeLines
      ? `נוקו ${fmt(P.lifeLines)} שורות עד היום, ויש ${fmt(res.flowers)} פרחים על העץ. כל שורה מוסיפה פריחה, והעץ גדל עד 400 שורות.`
      : 'העץ עוד צעיר. כל שורה שתנקו תוסיף עליו פריחה.';
  }

  function drawGardenBg() {
    if (!gardenBg.clientWidth) return;
    gardenBg.width = Math.round(gardenBg.clientWidth * dpr);
    gardenBg.height = Math.round(gardenBg.clientHeight * dpr);
    drawGarden(gardenBg, P.lifeLines);
  }

  const previews = {};
  function previewCanvas(kind, id) {
    const key = kind + ':' + id;
    if (previews[key]) return previews[key];
    let c;
    if (kind === 'skin') {
      c = makeCanvas(96, 64);
      const ctx = c.getContext('2d');
      ['T', 'S', 'I'].forEach((t, i) => ctx.drawImage(woodTile(t, i % VARIANTS, id), 4 + i * 30, 17, 30, 30));
    } else {
      const pal = (FLOWER_PALETTES[id] || PALETTES)[0];
      c = id === 'camellia' ? makeCamellia(pal) : id === 'kiku' ? makeKiku(pal) : makeBlossom(pal, 'sakura');
    }
    previews[key] = c;
    return c;
  }

  function renderCollection() {
    const build = (gridEl, items, kind, selected, choose) => {
      gridEl.textContent = '';
      for (const item of items) {
        const open = isUnlocked(item);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'collect-item' + (item.id === selected ? ' on' : '') + (open ? '' : ' locked');
        const img = document.createElement('img');
        img.alt = '';
        img.src = previewCanvas(kind, item.id).toDataURL();
        const name = document.createElement('b');
        name.textContent = open ? item.name : '🔒 ' + item.name;
        b.append(img, name);
        if (!open) {
          const [v, t] = item.prog();
          const need = document.createElement('small');
          need.textContent = `${item.need} ${ltr(Math.min(v, t) + '/' + t)}`;
          b.appendChild(need);
          b.disabled = true;
        }
        b.addEventListener('click', () => { if (open) choose(item.id); });
        gridEl.appendChild(b);
      }
    };
    build(skinGrid, SKINS, 'skin', P.skin, (id) => {
      P.skin = id;
      buildTiles(id);
      saveProgress();
      renderCollection();
    });
    build(flowerGrid, FLOWERS, 'flower', P.flower, (id) => {
      P.flower = id;
      buildFlowers(id);
      saveProgress();
      renderCollection();
      const r = sign.getBoundingClientRect();
      for (let i = 0; i < 5; i++) addBlossom(r.left + rand(20, r.width - 20), r.top + r.height * 0.7, { delay: i * 0.05 });
    });
    P.seenUnlocks = [...SKINS, ...FLOWERS].filter(isUnlocked).map((i) => i.id);
    saveProgress();
  }

  async function renderLeaders() {
    [...boardTabs.children].forEach((b) => b.classList.toggle('on', b.dataset.board === boardKind));
    const kind = boardKind;
    let rows = null;
    if (Cloud.ready) {
      boardNote.textContent = 'טבלה משותפת לכל מי שמשחק מהקישור הזה.';
      try { rows = await cloudTop(kind); } catch (e) { rows = null; }
      if (kind !== boardKind || currentPanel !== 'leaders') return;
    }
    if (!rows) {
      rows = localRows(kind);
      boardNote.textContent = `${rows.length} תוצאות ששוחקו במכשיר הזה${kind === 'daily' ? ' היום' : ''}.`;
    }
    boardList.textContent = '';
    if (!rows.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'עוד אין תוצאות כאן. שחקו כדי להופיע בטבלה!';
      boardList.appendChild(li);
      return;
    }
    let mark = null;
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      if (r.me || (highlightId && r.id === highlightId)) li.className = 'me';
      if (highlightId && r.id === highlightId) mark = li;
      const rank = document.createElement('b');
      rank.textContent = i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1);
      const name = document.createElement('span');
      name.textContent = r.name;
      if (r.date) {
        const d = document.createElement('small');
        d.textContent = r.date.slice(5).split('-').reverse().join('.');
        name.appendChild(d);
      }
      const val = document.createElement('em');
      val.textContent = kind === 'sprint' ? fmtTime(r.value) : fmt(r.value);
      li.append(rank, name, val);
      boardList.appendChild(li);
    });
    if (mark) mark.scrollIntoView({ block: 'center' });
  }

  // ---- share card
  function shareText(r) {
    if (r.reason === 'sprint-done') return `סיימתי ספרינט 40 בטטריס עץ ב-${fmtTime(r.time)} 🌸 תנצחו אותי!`;
    if (r.mode === 'puzzle') return `פתרתי את חידה ${r.puzzle + 1} בטטריס עץ 🌸`;
    return `השגתי ${fmt(r.score)} נקודות ב${MODES[r.mode].name} של טטריס עץ (${r.lines} שורות) 🌸 תנצחו אותי!`;
  }

  function makeShareCard(r) {
    const W = 720, H = 960;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.drawImage(woodCanvas(180, 240, { light: [232, 196, 146], dark: [184, 136, 84], seed: 5, ringFreq: 0.08, warp: 7 }), 0, 0, W, H);
    ctx.fillStyle = 'rgba(40,22,12,.9)';
    roundRectPath(ctx, 36, 36, W - 72, H - 72, 30);
    ctx.fill();
    const rr = mulberry32(r.score + 7);
    for (let i = 0; i < 16; i++) {
      const s = 50 + rr() * 70;
      const edge = i % 4;
      const x = edge < 2 ? (edge === 0 ? 30 : W - 30) + (rr() - 0.5) * 80 : rr() * W;
      const y = edge >= 2 ? (edge === 2 ? 40 : H - 40) + (rr() - 0.5) * 60 : rr() * H;
      ctx.drawImage(blossoms[Math.floor(rr() * blossoms.length)], x - s / 2, y - s / 2, s, s);
    }
    const m = makeCanvas(240, 240);
    drawMascot(m.getContext('2d'), 240, r.record || r.reason === 'puzzle-win' || r.reason === 'sprint-done' ? 'excited' : 'happy', 0.4);
    ctx.drawImage(m, W / 2 - 120, 520);
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.fillStyle = '#ffb7cf';
    ctx.font = '44px "Yusei Magic", sans-serif';
    ctx.fillText('木のテトリス', W / 2, 140);
    ctx.fillStyle = '#fff';
    ctx.font = '800 66px Rubik, sans-serif';
    ctx.fillText('טטריס עץ', W / 2, 218);
    ctx.fillStyle = '#ffd6e6';
    ctx.font = '600 34px Rubik, sans-serif';
    ctx.fillText(r.mode === 'puzzle' ? `חידה ${r.puzzle + 1}: ${PUZZLES[r.puzzle].name}` : MODES[r.mode].name, W / 2, 280);
    ctx.save();
    ctx.shadowColor = 'rgba(255,110,170,.9)';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#fff';
    ctx.font = '800 120px Rubik, sans-serif';
    ctx.direction = 'ltr';
    ctx.fillText(r.reason === 'sprint-done' ? fmtTime(r.time) : fmt(r.score), W / 2, 420);
    ctx.restore();
    ctx.fillStyle = '#ffe9f1';
    ctx.font = '600 32px Rubik, sans-serif';
    ctx.fillText(`${r.lines} שורות · שלב ${r.level}`, W / 2, 480);
    ctx.fillStyle = '#fff';
    ctx.font = '700 46px Rubik, sans-serif';
    ctx.fillText('תנצחו אותי! 🌸', W / 2, 830);
    ctx.fillStyle = 'rgba(255,230,240,.7)';
    ctx.font = '400 26px Rubik, sans-serif';
    ctx.fillText(dateKey().split('-').reverse().join('.'), W / 2, 880);
    return c;
  }

  let shareCard = null;
  function renderShare() {
    shareStatus.textContent = '';
    if (!lastResult) return;
    shareCard = makeShareCard(lastResult);
    shareImg.src = shareCard.toDataURL('image/png');
    shareTextEl.value = shareText(lastResult);
    shareNative.hidden = !navigator.share;
  }

  function cardBlob() {
    return new Promise((res) => shareCard.toBlob(res, 'image/png'));
  }

  shareNative.addEventListener('click', async () => {
    try {
      const blob = await cardBlob();
      const file = new File([blob], 'wood-tetris.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], text: shareTextEl.value });
      else await navigator.share({ text: shareTextEl.value });
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      shareStatus.textContent = 'השיתוף לא זמין כאן. אפשר לשמור את התמונה או להעתיק את הטקסט.';
    }
  });

  shareSave.addEventListener('click', async () => {
    const blob = await cardBlob();
    if (Cloud.downloads) {
      try {
        await Cloud.downloads.save({ filename: 'wood-tetris.png', data: blob });
        shareStatus.textContent = 'התמונה נשמרה.';
      } catch (e) {
        shareStatus.textContent = e && e.code === 'declined' ? '' : 'לא הצלחנו לשמור כאן. אפשר ללחוץ לחיצה ארוכה על התמונה.';
      }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wood-tetris.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    shareStatus.textContent = 'אם ההורדה לא התחילה, לחצו לחיצה ארוכה על התמונה ושמרו אותה.';
  });

  shareCopy.addEventListener('click', () => {
    const text = shareTextEl.value;
    const fallback = () => {
      shareTextEl.focus();
      shareTextEl.select();
      shareStatus.textContent = 'הטקסט מסומן. העתיקו אותו ידנית.';
    };
    try {
      navigator.clipboard.writeText(text).then(() => { shareStatus.textContent = 'הטקסט הועתק.'; }, fallback);
    } catch (e) { fallback(); }
  });

  // ---- panel wiring
  overlay.addEventListener('click', (e) => {
    const go = e.target.closest('[data-goto]');
    if (go) {
      if (go.dataset.quit) quitToMenu();
      showPanel(go.dataset.goto);
      return;
    }
    const modeBtn = e.target.closest('[data-mode]');
    if (modeBtn) {
      if (modeBtn.dataset.mode === 'puzzle') showPanel('puzzles');
      else newGame(modeBtn.dataset.mode);
      return;
    }
    if (e.target.closest('.howto-btn')) openTutorial();
    else if (e.target.closest('.music-toggle')) toggleMusic();
    else if (e.target.closest('.sound-toggle')) toggleMute();
  });
  boardTabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-board]');
    if (!b) return;
    boardKind = b.dataset.board;
    highlightId = null;
    renderLeaders();
  });
  function saveName() {
    if (!pending) return;
    const name = nameInput.value.replace(/\s+/g, ' ').trim().slice(0, 16) || 'שחקן';
    pending.entry.n = name;
    P.nick = name;
    saveProgress();
    cloudSubmit({ nick: name });
    boardKind = pending.kind;
    highlightId = pending.entry.id;
    nameInput.blur();
    showPanel('leaders');
  }
  nameSave.addEventListener('click', saveName);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveName(); }
  });
  resumeBtn.addEventListener('click', togglePause);
  againBtn.addEventListener('click', playAgain);

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------
  function press(act) {
    if (act === 'pause') { togglePause(); return; }
    if (act === 'mute') { toggleMute(); return; }
    if (act === 'music') { toggleMusic(); return; }
    if (state === 'menu' || state === 'over') {
      // a drop key still held from the last move must not skip the results screen
      if (state === 'over' && performance.now() - overAt < 1200) return;
      if ((act === 'start' || act === 'drop') && (currentPanel === 'menu' || currentPanel === 'over')) start();
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
    if (tutorialOpen()) {
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'ArrowLeft') { e.preventDefault(); tutNextStep(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); showTutPage(Math.max(0, tutIndex - 1)); }
      else if (e.code === 'Escape') { e.preventDefault(); closeTutorial(); }
      return;
    }
    const act = KEYMAP[e.code];
    if (!act) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea')) return;
    if (e.target && e.target.closest && e.target.closest('button') && (e.code === 'Space' || e.code === 'Enter')) return;
    e.preventDefault();
    if (e.repeat) return;
    Sound.init();
    press(act);
  });
  window.addEventListener('keyup', (e) => {
    const act = KEYMAP[e.code];
    if (act) release(act);
  });

  pauseBtn.addEventListener('click', () => {
    Sound.init();
    if (state === 'play' || state === 'pause') togglePause();
  });

  function syncMusic() {
    if (state === 'play' || state === 'clearing') Music.play(false);
    else Music.stop();
    if (!Music.on || Sound.muted) Music.stop();
  }

  function refreshAudioButtons() {
    muteBtn.textContent = Sound.muted ? '🔇 מושתק' : '🔊 צליל';
    musicBtn.textContent = Music.on ? '🎵 מוזיקה: פועלת' : '🎵 מוזיקה: כבויה';
    document.querySelectorAll('.sound-toggle').forEach((b) => { b.textContent = Sound.muted ? '🔇 מושתק' : '🔊 צליל'; });
    document.querySelectorAll('.music-toggle').forEach((b) => { b.textContent = Music.on ? '🎵 מוזיקה' : '🎵 כבויה'; });
  }

  function toggleMute() {
    Sound.muted = !Sound.muted;
    refreshAudioButtons();
    syncMusic();
  }
  muteBtn.addEventListener('click', toggleMute);

  function toggleMusic() {
    Music.on = !Music.on;
    refreshAudioButtons();
    syncMusic();
  }
  musicBtn.addEventListener('click', toggleMusic);

  // ---------------------------------------------------------------------------
  // How-to-play walkthrough: opens by itself the first time, then from the menu
  // ---------------------------------------------------------------------------
  const TUTORIAL_KEY = 'wood-tetris-tutorial-seen';
  const tutPages = [...tutorial.querySelectorAll('.tut-page')];
  const tutDots = $('tut-dots');
  const tutNext = $('tut-next');
  let tutIndex = 0;
  tutPages.forEach(() => tutDots.appendChild(document.createElement('i')));

  function tutorialOpen() {
    return !tutorial.classList.contains('hidden');
  }

  function showTutPage(i) {
    tutIndex = i;
    tutPages.forEach((pg, k) => { pg.hidden = k !== i; });
    [...tutDots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    const lastPage = i === tutPages.length - 1;
    tutNext.textContent = !lastPage ? 'הבא' : state === 'pause' ? 'חזרה למשחק' : 'יאללה, משחקים!';
  }

  function openTutorial() {
    tutorial.classList.remove('hidden');
    showTutPage(0);
  }

  function closeTutorial() {
    tutorial.classList.add('hidden');
    try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch (e) { /* ignore */ }
  }

  function tutNextStep() {
    if (tutIndex < tutPages.length - 1) {
      showTutPage(tutIndex + 1);
    } else {
      closeTutorial();
      start();
    }
  }

  tutNext.addEventListener('click', tutNextStep);
  $('tut-skip').addEventListener('click', closeTutorial);

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

  // Android/Chrome: offer our own install button once the browser says the app can be installed
  let installPrompt = null;
  const installBtn = $('install-btn');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch (err) { /* dismissed */ }
    installPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => {
    installBtn.hidden = true;
    toast('📲 הותקן!', 'טטריס עץ נמצא עכשיו במסך הבית');
  });

  window.addEventListener('blur', () => {
    held.left = held.right = held.down = false;
    dasDir = 0;
    if (state === 'play') togglePause();
  });

  window.addEventListener('resize', () => {
    resize();
    drawGardenBg();
  });

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  loadProgress();
  buildTiles(P.skin);
  buildFlowers(P.flower);
  knownUnlocks = new Set([...SKINS, ...FLOWERS].filter(isUnlocked).map((i) => i.id));
  resize();
  initAmbient();
  document.body.classList.add('season-0');
  refreshAudioButtons();
  updateUI();
  showPanel('menu');
  drawGardenBg();
  let tutorialSeen = false;
  try { tutorialSeen = localStorage.getItem(TUTORIAL_KEY) === '1'; } catch (e) { tutorialSeen = false; }
  if (!tutorialSeen) openTutorial();
  initCloud();
  requestAnimationFrame(loop);

})();
