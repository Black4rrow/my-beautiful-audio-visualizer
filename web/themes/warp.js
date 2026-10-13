// Theme "Hyperspace": stars streaking out of a vanishing point, accelerating on bass, with optional
// tunnel rings fired on beats. Stars are batched into depth buckets (one stroke per bucket and colour band).
"use strict";

(() => {
  const BUCKETS = 12;
  let stars = [], rings = [], angle = 0, ringClock = 0;

  const spawn = (s, z) => {
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * 0.9 + 0.1;
    s.x = Math.cos(a) * r; s.y = Math.sin(a) * r; s.a = a; s.z = z; s.band = Math.random();
    return s;
  };

  registerTheme('warp', {
    name: 'Hyperspace', icon: '✦',
    defaults: { palette: 'synth', trail: 0.2 },
    params: [
      { section: 'Stars' },
      { k: 'count', label: 'Stars', min: 100, max: 4000, step: 50, def: 900 },
      { k: 'length', label: 'Streak length', min: 0, max: 3, step: 0.05, def: 1 },
      { k: 'thickness', label: 'Thickness', min: 0.3, max: 5, step: 0.1, def: 1.6 },
      { k: 'fov', label: 'Field of view', min: 0.4, max: 2.5, step: 0.05, def: 1 },
      { k: 'colorMode', label: 'Star colors', def: 'depth',
        options: [['depth', 'By depth'], ['angle', 'By angle'], ['random', 'Random'], ['white', 'White']] },
      { section: 'Motion' },
      { k: 'speed', label: 'Cruise speed', min: 0, max: 3, step: 0.05, def: 0.8 },
      { k: 'bassBoost', label: 'Bass acceleration', min: 0, max: 4, step: 0.05, def: 1.5 },
      { k: 'spin', label: 'Rotation speed', min: -2, max: 2, step: 0.05, def: 0.2 },
      { k: 'twist', label: 'Spiral twist', min: -3, max: 3, step: 0.05, def: 0.6 },
      { k: 'shake', label: 'Beat shake', min: 0, max: 2, step: 0.05, def: 0.4 },
      { section: 'Tunnel rings' },
      { k: 'rings', label: 'Rings', def: true },
      { k: 'ringRate', label: 'Extra rings per second', min: 0, max: 4, step: 0.1, def: 0.5 },
      { k: 'ringWidth', label: 'Ring thickness', min: 0.5, max: 6, step: 0.1, def: 2 },
      { k: 'ringSides', label: 'Ring sides (0 = circle)', min: 0, max: 12, step: 1, def: 0 },
      { section: 'Center' },
      { k: 'core', label: 'Center glow', def: true },
      { k: 'coreSize', label: 'Center glow size', min: 0.1, max: 2, step: 0.05, def: 1 },
    ],
    draw(g, w, h, t, dt) {
      const p = S.warp, n = p.count | 0;
      while (stars.length < n) stars.push(spawn({}, Math.random()));
      stars.length = n;

      const velocity = p.speed * (0.25 + F.bass * p.bassBoost);
      angle = (angle + dt * p.spin) % TAU; // wraps, so rotation speed never drifts
      const shake = F.beat * p.shake * 6 * DPR;
      const cx = w / 2 + (Math.random() - 0.5) * shake, cy = h / 2 + (Math.random() - 0.5) * shake;
      const R = Math.min(w, h) * 0.35 * p.fov;

      // Depth bucket × colour band → one path each
      const paths = new Map();
      const pathFor = (bucket, tc) => {
        const key = bucket * 32 + Math.round(tc * 31);
        let e = paths.get(key);
        if (!e) paths.set(key, e = { bucket, tc, path: new Path2D() });
        return e.path;
      };
      for (const s of stars) {
        s.z -= dt * velocity;
        if (s.z <= 0.03) spawn(s, 1);
        const z0 = Math.min(1.2, s.z + dt * velocity * 4 * p.length + 0.002);
        // The twist is a fixed spiral shape (more bend as stars come closer), not an accumulating angle
        const rot = angle + p.twist * (1 - s.z), c = Math.cos(rot), sn = Math.sin(rot);
        const x = s.x * c - s.y * sn, y = s.x * sn + s.y * c;
        const bucket = Math.min(BUCKETS - 1, ((1 - s.z) * BUCKETS) | 0);
        const tc = p.colorMode === 'angle' ? s.a / TAU : p.colorMode === 'random' ? s.band : 1 - s.z;
        const path = pathFor(bucket, p.colorMode === 'white' ? 0 : tc);
        path.moveTo(cx + x / z0 * R, cy + y / z0 * R);
        path.lineTo(cx + x / s.z * R, cy + y / s.z * R);
      }
      g.lineCap = 'round';
      for (const { bucket, tc, path } of paths.values()) {
        const near = (bucket + 1) / BUCKETS;
        g.lineWidth = p.thickness * DPR * (0.3 + near * 1.2);
        g.strokeStyle = p.colorMode === 'white' ? `rgba(255,255,255,${near})` : col(tc * 0.85, near, near * 0.3);
        g.stroke(path);
      }

      if (p.rings) {
        ringClock += dt * p.ringRate;
        if (F.hit || ringClock >= 1) { rings.push(1); ringClock = 0; }
        rings = rings.map(z => z - dt * velocity).filter(z => z > 0.05);
        g.lineWidth = p.ringWidth * DPR;
        for (const z of rings) {
          const r = R * 1.1 / z, alpha = Math.min(1, (1 - z) * 1.5) * 0.7;
          g.strokeStyle = col(z, alpha, 0.2);
          g.beginPath();
          if (p.ringSides >= 3) {
            for (let i = 0; i <= p.ringSides; i++) {
              const a = i / p.ringSides * TAU + angle;
              i ? g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
            }
          } else g.arc(cx, cy, r, 0, TAU);
          g.stroke();
        }
      }

      if (p.core) {
        const cr = R * 0.35 * p.coreSize * (1 + F.bass * 0.8);
        const core = g.createRadialGradient(cx, cy, 0, cx, cy, cr);
        core.addColorStop(0, col(0.2, 0.35 + F.beat * 0.4, 0.6)); core.addColorStop(1, col(0.2, 0));
        g.fillStyle = core; g.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
      }
    },
  });
})();
