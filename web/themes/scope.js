// Theme "Oscilloscope": the raw waveform drawn like a CRT trace, either as a phase portrait (sample vs. a
// delayed sample), a Lissajous figure driven by the bands, or a classic triggered trace.
"use strict";

(() => {
  let pts = new Float32Array(0), rot = 0, time = 0;
  const CHUNKS = 24; // colour segments when the trace is a gradient

  // Fills pts with n (x, y) pairs in -1..1 and returns n
  function sample(p, n) {
    const W8 = A.wave, L = W8.length, gain = p.gain;
    const at = i => (W8[i] - 128) / 128 * gain;
    if (p.mode === 'xy') {
      n = Math.min(n, L - p.delay);
      const step = (L - p.delay) / n;
      for (let i = 0; i < n; i++) {
        const k = (i * step) | 0;
        pts[i * 2] = at(k); pts[i * 2 + 1] = at(k + p.delay);
      }
    } else if (p.mode === 'lissajous') {
      const amp = 0.45 + F.energy * 0.7 * p.wobble, phase = time * 1.3 + F.bass * p.wobble * 2;
      for (let i = 0; i < n; i++) {
        const s = i / (n - 1) * TAU, wob = at((i * 7) % L) * 0.25 * p.wobble;
        pts[i * 2] = Math.sin(p.ratioA * s + phase) * amp + wob;
        pts[i * 2 + 1] = Math.sin(p.ratioB * s) * amp - wob;
      }
    } else {
      // Trigger on a rising zero crossing so the trace stands still instead of sliding
      let start = 1;
      while (start < L / 2 && !(W8[start - 1] < 128 && W8[start] >= 128)) start++;
      const span = Math.min(L - start, (L / 2) | 0);
      for (let i = 0; i < n; i++) {
        pts[i * 2] = i / (n - 1) * 2 - 1;
        pts[i * 2 + 1] = at(start + ((i / n * span) | 0));
      }
    }
    return n;
  }

  function trace(g, n, toX, toY, from, to) {
    g.beginPath();
    for (let i = from; i < to; i++) {
      const x = toX(pts[i * 2], pts[i * 2 + 1]), y = toY(pts[i * 2], pts[i * 2 + 1]);
      i === from ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }

  registerTheme('scope', {
    name: 'Oscilloscope', icon: '⌁',
    defaults: { palette: 'aurora', glow: 1.3, trail: 0.6 },
    params: [
      { section: 'Signal' },
      { k: 'mode', label: 'Mode', def: 'xy',
        options: [['xy', 'Phase portrait (XY)'], ['lissajous', 'Lissajous'], ['wave', 'Classic trace']] },
      { k: 'gain', label: 'Signal gain', min: 0.2, max: 6, step: 0.05, def: 2 },
      { k: 'samples', label: 'Points', min: 128, max: 4000, step: 32, def: 1600 },
      { k: 'delay', label: 'XY delay (samples)', min: 1, max: 400, step: 1, def: 24 },
      { k: 'ratioA', label: 'Lissajous ratio X', min: 1, max: 9, step: 1, def: 3 },
      { k: 'ratioB', label: 'Lissajous ratio Y', min: 1, max: 9, step: 1, def: 2 },
      { k: 'wobble', label: 'Audio wobble', min: 0, max: 2, step: 0.05, def: 1 },
      { section: 'Look' },
      { k: 'size', label: 'Size', min: 0.3, max: 1.5, step: 0.01, def: 1 },
      { k: 'thickness', label: 'Line width', min: 0.5, max: 6, step: 0.1, def: 1.6 },
      { k: 'colorMode', label: 'Coloring', def: 'gradient',
        options: [['gradient', 'Gradient along the line'], ['solid', 'Single color'], ['phosphor', 'Green phosphor']] },
      { k: 'halo', label: 'Soft halo', def: true },
      { k: 'spin', label: 'Rotation', min: -2, max: 2, step: 0.05, def: 0 },
      { k: 'beatZoom', label: 'Beat zoom', min: 0, max: 1, step: 0.01, def: 0.15 },
      { section: 'Screen' },
      { k: 'grid', label: 'Graticule', def: true },
      { k: 'divisions', label: 'Grid divisions', min: 2, max: 16, step: 1, def: 8 },
    ],
    draw(g, w, h, t, dt) {
      const p = S.scope;
      time += dt;
      rot += dt * p.spin;
      if (pts.length < p.samples * 2) pts = new Float32Array(p.samples * 2);
      const n = sample(p, p.samples | 0);

      const cx = w / 2, cy = h / 2, wave = p.mode === 'wave';
      const sx = (wave ? w * 0.46 : Math.min(w, h) * 0.42) * p.size * (1 + F.beat * p.beatZoom);
      const sy = (wave ? h * 0.35 : Math.min(w, h) * 0.42) * p.size * (1 + F.beat * p.beatZoom);
      const c = Math.cos(rot), s = Math.sin(rot);
      const toX = wave ? x => cx + x * sx : (x, y) => cx + (x * c - y * s) * sx;
      const toY = wave ? (x, y) => cy - y * sy : (x, y) => cy - (x * s + y * c) * sy;

      const phosphor = p.colorMode === 'phosphor';
      if (p.grid) {
        g.strokeStyle = phosphor ? 'rgba(120,255,170,0.12)' : col(0.3, 0.12);
        g.lineWidth = DPR;
        g.beginPath();
        for (let i = 0; i <= p.divisions; i++) {
          const f = i / p.divisions * 2 - 1;
          g.moveTo(cx + f * sx, cy - sy); g.lineTo(cx + f * sx, cy + sy);
          g.moveTo(cx - sx, cy + f * sy); g.lineTo(cx + sx, cy + f * sy);
        }
        g.stroke();
      }

      g.lineJoin = 'round'; g.lineCap = 'round';
      const passes = p.halo ? [[4, 0.15], [1, 1]] : [[1, 1]];
      for (const [widthMul, alpha] of passes) {
        g.lineWidth = p.thickness * DPR * widthMul;
        if (p.colorMode === 'gradient') {
          // Chunks overlap by one point so the line stays continuous
          for (let k = 0; k < CHUNKS; k++) {
            const from = Math.floor(k / CHUNKS * (n - 1)), to = Math.min(n, Math.floor((k + 1) / CHUNKS * (n - 1)) + 1);
            g.strokeStyle = col(k / CHUNKS * 0.85, alpha, 0.1);
            trace(g, n, toX, toY, from, to);
          }
        } else {
          g.strokeStyle = phosphor ? `rgba(120,255,170,${alpha})` : col(0.2 + F.energy * 0.2, alpha, 0.15);
          trace(g, n, toX, toY, 0, n);
        }
      }
    },
  });
})();
