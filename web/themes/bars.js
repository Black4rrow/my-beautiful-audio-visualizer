// Theme "Equalizer": vertical bars with LED segments, reflection, mirror mode and falling peak caps.
"use strict";

(() => {
  const peakStore = {};

  registerTheme('bars', {
    name: 'Equalizer', icon: '▥',
    params: [
      { section: 'Bars' },
      { k: 'count', label: 'Bar count', min: 16, max: 256, step: 1, def: 96 },
      { k: 'gap', label: 'Spacing', min: 0, max: 0.8, step: 0.01, def: 0.3 },
      { k: 'height', label: 'Max height', min: 0.2, max: 1.5, step: 0.01, def: 1 },
      { k: 'baseline', label: 'Baseline position', min: 0.3, max: 0.97, step: 0.01, def: 0.64 },
      { k: 'mirror', label: 'Mirror (bass in the middle)', def: false },
      { k: 'colorSpan', label: 'Palette span', min: 0.05, max: 1, step: 0.01, def: 0.85 },
      { k: 'highlight', label: 'Top highlight', min: 0, max: 1, step: 0.01, def: 0.35 },
      { section: 'LED segments' },
      { k: 'segments', label: 'LED segments', def: true },
      { k: 'segSize', label: 'Segment size', min: 2, max: 30, step: 0.5, def: 7.5 },
      { k: 'segGap', label: 'Segment gap', min: 0.1, max: 1, step: 0.01, def: 0.3 },
      { section: 'Peaks' },
      { k: 'peaks', label: 'Peaks', def: true },
      { k: 'peakSpeed', label: 'Peak fall speed', min: 0.1, max: 4, step: 0.05, def: 1 },
      { section: 'Reflection' },
      { k: 'reflection', label: 'Reflection', def: true },
      { k: 'reflectOpacity', label: 'Reflection opacity', min: 0, max: 1, step: 0.01, def: 0.28 },
      { k: 'reflectLength', label: 'Reflection length', min: 0.1, max: 1.5, step: 0.05, def: 0.6 },
    ],
    draw(g, w, h, t, dt) {
      const p = S.bars, n = p.count | 0, half = Math.ceil(n / 2);
      const vals = bands(p.mirror ? half : n);
      const base = h * p.baseline;
      const maxH = base * 0.84 * p.height, bw = w / n, ww = Math.max(1, bw * (1 - p.gap));
      const pk = peakStore[n] || (peakStore[n] = new Float32Array(n));
      const capH = Math.max(2, 3 * DPR);

      for (let i = 0; i < n; i++) {
        const j = p.mirror ? Math.min(half - 1, Math.floor(Math.abs(i - (n - 1) / 2))) : i;
        const t = (p.mirror ? j / half : i / n) * p.colorSpan;
        const v = vals[j], bh = Math.max(2 * DPR, v * maxH), x = i * bw + (bw - ww) / 2;
        const gr = g.createLinearGradient(0, base - bh, 0, base);
        gr.addColorStop(0, col(t, 1, p.highlight)); gr.addColorStop(1, col(t, 0.85));
        g.fillStyle = gr;
        g.fillRect(x, base - bh, ww, bh);
        if (p.reflection) { g.fillStyle = col(t, p.reflectOpacity); g.fillRect(x, base + 3 * DPR, ww, bh * p.reflectLength); }
        if (p.peaks) {
          pk[i] = Math.max(bh, pk[i] - h * 0.21 * p.peakSpeed * dt); // 0.21 = prototype's 0.35 % of height per frame at 60 fps
          g.fillStyle = col(t, 1, 0.6);
          g.fillRect(x, base - pk[i] - capH * 2.5, ww, capH);
        }
      }

      // LED gaps and reflection fade are erased in one pass across the whole width (cheaper than per-bar)
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = '#000';
      if (p.segments) {
        const seg = Math.max(2, p.segSize * h / 720), gap = Math.max(1.5, seg * p.segGap);
        for (let y = base - seg; y > 0; y -= seg + gap) g.fillRect(0, y - gap, w, gap);
        for (let y = base + 3 * DPR + seg; y < h; y += seg + gap) g.fillRect(0, y, w, gap);
      }
      if (p.reflection) {
        const gr = g.createLinearGradient(0, base, 0, h);
        gr.addColorStop(0, 'rgba(0,0,0,0.1)'); gr.addColorStop(0.75, 'rgba(0,0,0,1)');
        g.fillStyle = gr; g.fillRect(0, base, w, h - base);
      }
      g.globalCompositeOperation = 'source-over';

      // Horizon line
      const hl = g.createLinearGradient(0, 0, w, 0);
      for (let k = 0; k <= 6; k++) hl.addColorStop(k / 6, col(k / 6 * p.colorSpan, 0.5));
      g.fillStyle = hl; g.fillRect(0, base + DPR, w, DPR);
    },
  });
})();
