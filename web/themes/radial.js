// Theme "Portal": counter-rotating rings of radial bars over a scrolling synthwave floor with light pillars.
"use strict";

(() => {
  let rot = 0, gridScroll = 0;

  function drawGrid(g, w, h, cx, hy, dt, speed) {
    gridScroll += dt * (0.35 + F.bass * 2.5) * speed;
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

  function drawPillars(g, w, h, cx, hy, R, count, height) {
    const vals = bands(14);
    for (let k = 0; k < count; k++) {
      for (const side of [-1, 1]) {
        const x = cx + side * (R * 1.25 + k * w * 0.045);
        if (x < -w * 0.05 || x > w * 1.05) continue;
        const v = vals[side < 0 ? k : 13 - k];
        const pw = w * 0.022 * (1 - k * 0.05), ph = (h * 0.05 + v * h * 0.42 * (1 - k * 0.06)) * height;
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

  function drawRings(g, cx, cy, R, p) {
    const rings = p.rings | 0;
    for (let r = 0; r < rings; r++) {
      const f = rings > 1 ? r / (rings - 1) : 1;
      const rr = R * (0.3 + 0.62 * f), count = Math.max(8, Math.round((40 + r * 20) * p.density / 2) * 2), hc = count / 2;
      const vals = bands(hc), len = R * (0.32 - f * 0.12) * p.barLength * (1 + F.beat * 0.25 * p.beatPunch);
      const dir = p.alternate && r % 2 ? -1 : 1, tc = r % 2 ? p.ringColorShift : 0;
      g.lineWidth = Math.max(1, TAU * rr / count * p.barWidth);
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
      g.beginPath(); g.arc(cx, cy, Math.max(0, rr - 4 * DPR), 0, TAU); g.stroke();
    }
  }

  registerTheme('radial', {
    name: 'Portal', icon: '◎',
    params: [
      { section: 'Rings' },
      { k: 'rings', label: 'Rings', min: 1, max: 7, step: 1, def: 4 },
      { k: 'size', label: 'Size', min: 0.4, max: 1.6, step: 0.01, def: 1 },
      { k: 'centerY', label: 'Vertical position', min: 0.25, max: 0.75, step: 0.01, def: 0.42 },
      { k: 'density', label: 'Bars per ring', min: 0.3, max: 2.5, step: 0.05, def: 1 },
      { k: 'barLength', label: 'Bar length', min: 0.2, max: 2.5, step: 0.05, def: 1 },
      { k: 'barWidth', label: 'Bar width', min: 0.1, max: 0.95, step: 0.01, def: 0.5 },
      { k: 'beatPunch', label: 'Beat punch', min: 0, max: 3, step: 0.05, def: 1 },
      { k: 'ringColorShift', label: 'Alternate ring color', min: 0, max: 1, step: 0.01, def: 0.5 },
      { section: 'Motion' },
      { k: 'spin', label: 'Rotation', min: -2, max: 2, step: 0.05, def: 0.3 },
      { k: 'alternate', label: 'Counter-rotating rings', def: true },
      { section: 'Decorations' },
      { k: 'dashed', label: 'Dashed outer circles', def: true },
      { k: 'core', label: 'Glowing core', def: true },
      { k: 'grid', label: 'Neon floor', def: true },
      { k: 'gridSpeed', label: 'Floor speed', min: 0, max: 3, step: 0.05, def: 1 },
      { k: 'pillarCount', label: 'Pillars per side', min: 0, max: 7, step: 1, def: 7 },
      { k: 'pillarHeight', label: 'Pillar height', min: 0.2, max: 2, step: 0.05, def: 1 },
    ],
    draw(g, w, h, t, dt) {
      const p = S.radial, cx = w / 2, cy = h * p.centerY, R = Math.min(w, h) * 0.34 * p.size, hy = h * 0.66;
      rot += dt * p.spin * (0.4 + F.energy * 1.6);

      if (p.grid) drawGrid(g, w, h, cx, hy, dt, p.gridSpeed);
      if (p.pillarCount) drawPillars(g, w, h, cx, hy, R, p.pillarCount, p.pillarHeight);

      // Outer dashed circles
      g.setLineDash([R * 0.03, R * 0.045]);
      for (let k = 0; k < (p.dashed ? 2 : 0); k++) {
        g.lineWidth = Math.max(2, R * 0.012);
        g.strokeStyle = col(k ? 0.5 : 0, 0.75);
        g.lineDashOffset = (k ? -1 : 1) * rot * R * 0.6;
        g.beginPath(); g.arc(cx, cy, R * (1.18 + k * 0.17) * (1 + F.bass * 0.06), 0, TAU); g.stroke();
      }
      g.setLineDash([]);

      drawRings(g, cx, cy, R, p);
      if (!p.core) return;

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
