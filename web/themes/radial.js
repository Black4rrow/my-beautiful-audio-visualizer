// Theme "Portal": counter-rotating rings of radial bars over a scrolling synthwave floor with light pillars.
"use strict";

(() => {
  let rot = 0, gridScroll = 0;

  function drawGrid(g, w, h, cx, hy, dt) {
    gridScroll += dt * (0.35 + F.bass * 2.5);
    g.lineWidth = Math.max(1, DPR);
    g.strokeStyle = col(0.5, 0.45);
    g.beginPath();
    for (let k = -24; k <= 24; k++) { g.moveTo(cx + k * w * 0.004, hy); g.lineTo(cx + k * w * 0.11, h); }
    g.stroke();
    for (let k = 0; k < 22; k++) {
      const z = k + 1 - (gridScroll % 1);
      const y = hy + (h - hy) * (1 / z) * 0.98;
      if (y <= hy + 1) continue;
      g.strokeStyle = col(0.02, Math.min(0.7, 0.9 / z + F.beat * 0.15 / z));
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    }
    // Fade the floor out towards the horizon
    g.globalCompositeOperation = 'destination-out';
    const fade = g.createLinearGradient(0, hy, 0, hy + (h - hy) * 0.35);
    fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fade; g.fillRect(0, hy - 2, w, (h - hy) * 0.35 + 2);
    g.globalCompositeOperation = 'source-over';
  }

  function drawPillars(g, w, h, cx, hy, R) {
    const vals = bands(14);
    for (let k = 0; k < 7; k++) {
      for (const side of [-1, 1]) {
        const x = cx + side * (R * 1.25 + k * w * 0.045);
        if (x < -w * 0.05 || x > w * 1.05) continue;
        const v = vals[side < 0 ? k : 13 - k];
        const pw = w * 0.022 * (1 - k * 0.05), ph = h * 0.05 + v * h * 0.42 * (1 - k * 0.06);
        const base = hy + (h - hy) * 0.08 * (k + 1);
        const tc = side < 0 ? 0.5 : 0.0;
        const gr = g.createLinearGradient(0, base - ph, 0, base);
        gr.addColorStop(0, col(tc, 0.95, 0.5)); gr.addColorStop(0.5, col(tc + 0.5, 0.8)); gr.addColorStop(1, col(tc, 0.9));
        g.fillStyle = gr; g.fillRect(x - pw / 2, base - ph, pw, ph);
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x - pw / 2, base - ph, pw * 0.18, ph);
        g.fillStyle = col(tc, 0.18); g.fillRect(x - pw / 2, base + 2, pw, ph * 0.35);
      }
    }
  }

  function drawRings(g, cx, cy, R, rings) {
    for (let r = 0; r < rings; r++) {
      const f = rings > 1 ? r / (rings - 1) : 1;
      const rr = R * (0.3 + 0.62 * f), count = 40 + r * 20, hc = count / 2;
      const vals = bands(hc), len = R * (0.32 - f * 0.12) * (1 + F.beat * 0.25);
      const dir = r % 2 ? -1 : 1, tc = r % 2 ? 0.5 : 0;
      g.lineWidth = Math.max(1.5, TAU * rr / count * 0.5);
      g.strokeStyle = col(tc + F.energy * 0.1, 0.95);
      g.beginPath();
      for (let i = 0; i < count; i++) {
        const j = i < hc ? i : count - 1 - i; // symmetric around the ring
        const a = rot * dir * (1 + r * 0.25) + i / count * TAU - Math.PI / 2;
        const l = Math.max(2 * DPR, vals[j] * len), ca = Math.cos(a), sa = Math.sin(a);
        g.moveTo(cx + ca * rr, cy + sa * rr); g.lineTo(cx + ca * (rr + l), cy + sa * (rr + l));
      }
      g.stroke();
      g.lineWidth = Math.max(1, DPR * 1.2);
      g.strokeStyle = col(tc, 0.35);
      g.beginPath(); g.arc(cx, cy, rr - 4 * DPR, 0, TAU); g.stroke();
    }
  }

  registerTheme('radial', {
    name: 'Portal', icon: '◎',
    params: [
      { k: 'rings', label: 'Rings', min: 1, max: 7, step: 1, def: 4 },
      { k: 'spin', label: 'Rotation', min: -2, max: 2, step: 0.05, def: 0.3 },
      { k: 'grid', label: 'Neon floor', def: true },
      { k: 'pillars', label: 'Pillars', def: true },
    ],
    draw(g, w, h, t, dt) {
      const p = S.radial, cx = w / 2, cy = h * 0.42, R = Math.min(w, h) * 0.34, hy = h * 0.66;
      rot += dt * p.spin * (0.4 + F.energy * 1.6);

      if (p.grid) drawGrid(g, w, h, cx, hy, dt);
      if (p.pillars) drawPillars(g, w, h, cx, hy, R);

      // Outer dashed circles
      g.setLineDash([R * 0.03, R * 0.045]);
      for (let k = 0; k < 2; k++) {
        g.lineWidth = Math.max(2, R * 0.012);
        g.strokeStyle = col(k ? 0.5 : 0, 0.75);
        g.lineDashOffset = (k ? -1 : 1) * rot * R * 0.6;
        g.beginPath(); g.arc(cx, cy, R * (1.18 + k * 0.17) * (1 + F.bass * 0.06), 0, TAU); g.stroke();
      }
      g.setLineDash([]);

      drawRings(g, cx, cy, R, p.rings | 0);

      // Core
      const cr = R * 0.17 * (1 + F.bass * 0.35);
      const core = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
      core.addColorStop(0, col(0.5, 0.15 + F.beat * 0.4, 0.5)); core.addColorStop(1, col(0, 0));
      g.fillStyle = core; g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fill();
      g.lineWidth = 3 * DPR; g.strokeStyle = col(0, 0.9);
      g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.stroke();
    },
  });
})();
