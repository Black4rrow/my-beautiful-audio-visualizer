// Theme "Ridges": stacked spectrum lines scrolling upwards (Unknown Pleasures style). A ring buffer keeps
// one spectrum snapshot per row; rows are drawn back to front and filled so nearer ones hide farther peaks.
"use strict";

(() => {
  const MAX_ROWS = 100;
  let history = [], head = 0, points = 0, tick = 0;

  function resetHistory(n) {
    points = n;
    history = Array.from({ length: MAX_ROWS }, () => new Float32Array(n));
    head = 0;
  }

  // One snapshot: either the spectrum left→right, or mirrored with the bass in the middle
  function snapshot(p) {
    const row = history[head = (head + 1) % MAX_ROWS];
    const vals = bands(p.mirror ? Math.ceil(points / 2) : points), half = vals.length;
    for (let i = 0; i < points; i++) {
      const j = p.mirror ? Math.min(half - 1, Math.abs(Math.round(i - (points - 1) / 2))) : i;
      row[i] = vals[j];
    }
  }

  registerTheme('ridges', {
    name: 'Ridges', icon: '⛰',
    defaults: { palette: 'neon', glow: 0.6, trail: 0 },
    params: [
      { section: 'Lines' },
      { k: 'rows', label: 'Lines', min: 6, max: MAX_ROWS, step: 1, def: 36 },
      { k: 'points', label: 'Detail', min: 24, max: 256, step: 4, def: 120 },
      { k: 'lineWidth', label: 'Line width', min: 0.5, max: 5, step: 0.1, def: 1.4 },
      { k: 'fill', label: 'Hide lines behind', def: true },
      { k: 'smooth', label: 'Smooth curves', def: true },
      { section: 'Shape' },
      { k: 'height', label: 'Peak height', min: 0.1, max: 3, step: 0.05, def: 1 },
      { k: 'focus', label: 'Focus on the center', min: 0, max: 1, step: 0.01, def: 0.6 },
      { k: 'mirror', label: 'Mirror (bass in the middle)', def: true },
      { k: 'width', label: 'Width', min: 0.3, max: 1, step: 0.01, def: 0.7 },
      { k: 'perspective', label: 'Perspective', min: 0, max: 1, step: 0.01, def: 0.35 },
      { k: 'spacing', label: 'Line spacing', min: 0.3, max: 2, step: 0.05, def: 1 },
      { section: 'Motion' },
      { k: 'speed', label: 'Scroll speed', min: 0.1, max: 4, step: 0.05, def: 1 },
      { k: 'direction', label: 'Direction', def: 'up', options: [['up', 'Newest at the bottom'], ['down', 'Newest at the top']] },
      { section: 'Colors' },
      { k: 'colorMode', label: 'Coloring', def: 'rows',
        options: [['rows', 'One color per line'], ['across', 'Gradient across'], ['single', 'Single color'], ['white', 'White']] },
      { k: 'fade', label: 'Fade far lines', min: 0, max: 1, step: 0.01, def: 0.6 },
    ],
    draw(g, w, h, t, dt) {
      const p = S.ridges, rows = p.rows | 0;
      if (points !== (p.points | 0)) resetHistory(p.points | 0);
      tick += dt * 20 * p.speed;
      while (tick >= 1) { snapshot(p); tick -= 1; }

      const gap = h * 0.62 / rows * p.spacing, front = h * 0.5 + rows * gap * 0.5;
      const across = p.colorMode === 'across' ? g.createLinearGradient(0, 0, w, 0) : null;
      if (across) for (let i = 0; i <= 6; i++) across.addColorStop(i / 6, col(i / 6 * 0.85));
      g.lineWidth = p.lineWidth * DPR;
      g.lineJoin = 'round';

      // Screen rows from the top (farthest) down, so each nearer line hides the peaks behind it.
      // r is the snapshot age: newest at the bottom when scrolling up, at the top otherwise.
      const up = p.direction === 'up';
      for (let rowIdx = rows - 1; rowIdx >= 0; rowIdx--) {
        const r = up ? rowIdx : rows - 1 - rowIdx;
        const data = history[(head - r + MAX_ROWS) % MAX_ROWS];
        const depth = rowIdx / Math.max(1, rows - 1), shrink = 1 - p.perspective * 0.6 * depth;
        const base = front - rowIdx * gap * (1 - p.perspective * 0.4 * depth) - tick * gap * (up ? 1 : -1);
        const span = w * p.width * shrink, x0 = (w - span) / 2;
        const line = new Path2D();
        let px = x0, py = base;
        line.moveTo(px, py);
        for (let i = 0; i < points; i++) {
          const u = i / (points - 1);
          const env = Math.exp(-((u - 0.5) ** 2) * 40 * p.focus * p.focus) * (1 - p.focus * 0.15) + (1 - p.focus) * 0.15;
          const x = x0 + u * span, y = base - data[i] * env * h * 0.28 * p.height * shrink;
          if (p.smooth) line.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2); else line.lineTo(x, y);
          px = x; py = y;
        }
        line.lineTo(x0 + span, base);
        if (p.fill) {
          // Erase (rather than paint) under the line so the real background shows through
          const area = new Path2D(line);
          area.lineTo(x0 + span, h); area.lineTo(x0, h); area.closePath();
          g.globalCompositeOperation = 'destination-out';
          g.fill(area);
          g.globalCompositeOperation = 'source-over';
        }
        const alpha = 1 - depth * p.fade;
        g.strokeStyle = p.colorMode === 'white' ? `rgba(255,255,255,${alpha})`
          : across ? across : col(p.colorMode === 'rows' ? depth * 0.85 : 0, alpha, 0.15);
        if (across) g.globalAlpha = alpha;
        g.stroke(line);
        g.globalAlpha = 1;
      }
    },
  });
})();
