// Theme "Waves": glowing vertical lines per band, crossed by wavy strands and the raw waveform.
"use strict";

registerTheme('waves', {
  name: 'Waves', icon: '∿',
  params: [
    { k: 'lines', label: 'Lines', min: 20, max: 300, step: 1, def: 110 },
    { k: 'strands', label: 'Wavy strands', min: 0, max: 24, step: 1, def: 9 },
    { k: 'amp', label: 'Amplitude', min: 0.2, max: 2, step: 0.05, def: 1 },
  ],
  draw(g, w, h, t) {
    const p = S.waves, n = p.lines | 0, vals = bands(n), cy = h / 2, maxA = h * 0.4 * p.amp;
    g.lineCap = 'round';
    g.lineWidth = Math.max(1, w / n * 0.38);
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) / n * w, tc = i / n * 0.85;
      const hh = Math.max(h * 0.006, vals[i] * maxA);
      const gr = g.createLinearGradient(0, cy - hh, 0, cy + hh);
      gr.addColorStop(0, col(tc, 0)); gr.addColorStop(0.5, col(tc, 0.95, 0.15)); gr.addColorStop(1, col(tc, 0));
      g.strokeStyle = gr;
      g.beginPath(); g.moveTo(x, cy - hh); g.lineTo(x, cy + hh); g.stroke();
    }

    const strands = p.strands | 0;
    if (strands) {
      const hg = g.createLinearGradient(0, 0, w, 0);
      for (let k = 0; k <= 6; k++) hg.addColorStop(k / 6, col(k / 6 * 0.85, 0.7, 0.55));
      g.strokeStyle = hg;
      g.lineWidth = Math.max(1, 1.2 * DPR);
      const steps = 160;
      for (let s = 0; s < strands; s++) {
        g.beginPath();
        for (let k = 0; k <= steps; k++) {
          const u = k / steps, x = u * w;
          const fi = u * (n - 1), i0 = fi | 0, v = vals[i0] + (vals[Math.min(n - 1, i0 + 1)] - vals[i0]) * (fi - i0);
          const env = Math.pow(Math.sin(Math.PI * u), 1.4); // pin both ends to the centre line
          const y = cy + Math.sin(u * Math.PI * (4 + s * 0.45) + t * (1.1 + s * 0.13) + s * 1.7)
                       * maxA * 0.55 * (0.12 + v) * env * (0.55 + 0.45 * Math.sin(s * 2.3 + t * 0.3));
          k ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.stroke();
      }
    }

    // Raw waveform
    const W8 = A.wave, L = W8.length, step = Math.max(1, (L / 600) | 0);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = Math.max(1, DPR);
    g.beginPath();
    for (let i = 0, k = 0; i < L; i += step, k++) {
      const x = i / L * w, y = cy + (W8[i] - 128) / 128 * maxA * 0.5 * S.gain;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  },
});
