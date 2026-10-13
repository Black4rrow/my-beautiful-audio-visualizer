// Theme "Aurora": curtains of light rippling across a starry sky; each column's length follows its band.
// Each curtain is three batched paths (fading upwards, brightest at the lower edge), each with a horizontal gradient.
"use strict";

(() => {
  let stars = [], time = 0;

  function makeStars(n) {
    stars = Array.from({ length: n }, () => ({
      x: Math.random(), y: Math.pow(Math.random(), 1.6), r: 0.4 + Math.random() * 1.2,
      ph: Math.random() * TAU, sp: 0.5 + Math.random() * 2,
    }));
  }

  function drawStars(g, w, h, p) {
    if (stars.length !== p.starCount) makeStars(p.starCount);
    for (const s of stars) {
      const tw = 0.5 + 0.5 * Math.sin(time * s.sp * p.twinkle + s.ph);
      g.fillStyle = `rgba(255,255,255,${(0.15 + 0.6 * tw * (0.6 + F.high)) * p.starBrightness})`;
      const r = s.r * DPR;
      g.fillRect(s.x * w, s.y * h * p.starArea, r, r);
    }
  }

  function drawCurtain(g, w, h, p, k, vals) {
    const n = vals.length, step = Math.max(1, p.density * DPR);
    const phase = k * 2.1, hueBase = p.curtains > 1 ? k / (p.curtains - 1) * p.colorSpread : 0;
    // Three bands per ray, fading towards the top like a real aurora; brightest at the lower edge
    const layers = [[0, 0.45, 0.05, 0], [0.45, 0.78, 0.12, 0.1], [0.78, 1, 0.32, 0.35]];
    const paths = layers.map(() => new Path2D());
    const amp = h * 0.07 * p.waviness, base = h * (p.altitude + k * p.layerGap);
    for (let x = 0; x <= w; x += step) {
      const u = x / w;
      const fi = u * (n - 1), i0 = fi | 0, v = vals[i0] + (vals[Math.min(n - 1, i0 + 1)] - vals[i0]) * (fi - i0);
      const fold = Math.sin(u * 7 * p.folds + time * 0.8 + phase) * amp + Math.sin(u * 17 * p.folds - time * 1.3 + phase) * amp * 0.35;
      const bottom = base + fold + h * 0.25 * p.height;
      const len = h * (0.08 + v * 0.45) * p.height;
      layers.forEach(([from, to], i) => {
        paths[i].moveTo(x, bottom - len * (1 - from)); paths[i].lineTo(x, bottom - len * (1 - to));
      });
    }
    g.lineWidth = step * 0.9;
    layers.forEach(([, , alpha, light], i) => {
      const grad = g.createLinearGradient(0, 0, w, 0);
      for (let j = 0; j <= 4; j++) grad.addColorStop(j / 4, col(hueBase + j / 4 * p.colorSpread * 0.5, alpha * p.opacity, light));
      g.strokeStyle = grad;
      g.stroke(paths[i]);
    });
  }

  registerTheme('aurora', {
    name: 'Aurora', icon: '≋',
    defaults: { palette: 'aurora', glow: 0.8, trail: 0.15 },
    params: [
      { section: 'Curtains' },
      { k: 'curtains', label: 'Curtains', min: 1, max: 6, step: 1, def: 3 },
      { k: 'height', label: 'Height', min: 0.2, max: 2, step: 0.05, def: 1 },
      { k: 'altitude', label: 'Altitude', min: 0, max: 0.7, step: 0.01, def: 0.18 },
      { k: 'layerGap', label: 'Gap between curtains', min: 0, max: 0.2, step: 0.005, def: 0.06 },
      { k: 'opacity', label: 'Brightness', min: 0.2, max: 2, step: 0.05, def: 1 },
      { k: 'density', label: 'Ray spacing (px)', min: 1, max: 8, step: 1, def: 2 },
      { section: 'Motion' },
      { k: 'speed', label: 'Drift speed', min: 0, max: 3, step: 0.05, def: 1 },
      { k: 'waviness', label: 'Waviness', min: 0, max: 2.5, step: 0.05, def: 1 },
      { k: 'folds', label: 'Folds', min: 0.2, max: 3, step: 0.05, def: 1 },
      { k: 'bassPulse', label: 'Bass pulse', min: 0, max: 3, step: 0.05, def: 1 },
      { section: 'Colors' },
      { k: 'colorSpread', label: 'Color spread', min: 0, max: 1, step: 0.01, def: 0.5 },
      { k: 'skyGlow', label: 'Sky glow', def: true },
      { section: 'Stars' },
      { k: 'starCount', label: 'Stars', min: 0, max: 600, step: 10, def: 160 },
      { k: 'starArea', label: 'Star area', min: 0.2, max: 1, step: 0.05, def: 0.8 },
      { k: 'starBrightness', label: 'Star brightness', min: 0, max: 2, step: 0.05, def: 1 },
      { k: 'twinkle', label: 'Twinkle speed', min: 0, max: 3, step: 0.05, def: 1 },
    ],
    draw(g, w, h, t, dt) {
      const p = S.aurora;
      time += dt * p.speed * (0.6 + F.bass * p.bassPulse);
      if (p.skyGlow) {
        const sky = g.createLinearGradient(0, h * 0.3, 0, h);
        sky.addColorStop(0, col(0.1, 0)); sky.addColorStop(1, col(0.1, 0.03 + F.energy * 0.06));
        g.fillStyle = sky; g.fillRect(0, h * 0.3, w, h * 0.7);
      }
      if (p.starCount) drawStars(g, w, h, p);
      const vals = bands(96);
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < p.curtains; k++) drawCurtain(g, w, h, p, k, vals);
      g.globalCompositeOperation = 'source-over';
    },
  });
})();
