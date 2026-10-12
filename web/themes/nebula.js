// Theme "Nebula": a spiral galaxy of particles that swell with their band and burst outwards on bass hits.
"use strict";

(() => {
  const parts = [];

  registerTheme('nebula', {
    name: 'Nebula', icon: '✺',
    params: [
      { k: 'count', label: 'Particles', min: 100, max: 5000, step: 50, def: 1200 },
      { k: 'speed', label: 'Speed', min: 0, max: 3, step: 0.05, def: 1 },
      { k: 'burst', label: 'Bass burst', min: 0, max: 3, step: 0.05, def: 1 },
    ],
    draw(g, w, h, t, dt) {
      const p = S.nebula, n = p.count | 0, vals = bands(64);
      while (parts.length < n) {
        parts.push({ a: Math.random() * TAU, r0: 0.08 + Math.pow(Math.random(), 0.7) * 0.92,
                     sp: 0.4 + Math.random(), sz: 0.6 + Math.random() * 1.8, r: 0, v: 0 });
      }
      parts.length = n;
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.5;
      const spin = 0.35 + Math.sin(t * 0.1) * 0.1;

      if (F.hit) for (const q of parts) q.v += p.burst * (0.4 + Math.random()) * 0.9 * F.bass;

      g.globalCompositeOperation = 'lighter';
      for (const q of parts) {
        q.a += dt * q.sp * p.speed * (0.12 + F.energy * 1.3) / (0.25 + q.r0); // inner particles orbit faster
        let u = (q.a / TAU) % 1; if (u < 0) u += 1;
        const val = vals[Math.min(63, Math.floor((u < 0.5 ? u : 1 - u) * 2 * 64))];
        const target = q.r0 * (1 + val * 0.45);
        q.r += (target - q.r) * 0.08 + q.v * dt; q.v *= 0.93;
        const ang = q.a + Math.log(q.r0 + 0.05) * 1.6; // spiral arms
        const x0 = Math.cos(ang) * q.r * R, y0 = Math.sin(ang) * q.r * R * 0.55;
        const x = cx + x0 * Math.cos(spin) - y0 * Math.sin(spin), y = cy + x0 * Math.sin(spin) + y0 * Math.cos(spin);
        const sz = q.sz * DPR * (1 + val * 1.8);
        g.fillStyle = col(q.r0 * 0.85 + val * 0.15, 0.35 + val * 0.65, val * 0.4);
        g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
      const cr = R * (0.12 + F.bass * 0.12);
      const core = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
      core.addColorStop(0, col(0.1, 0.5 + F.beat * 0.4, 0.7)); core.addColorStop(0.4, col(0.05, 0.2)); core.addColorStop(1, col(0, 0));
      g.fillStyle = core; g.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
      g.globalCompositeOperation = 'source-over';
    },
  });
})();
