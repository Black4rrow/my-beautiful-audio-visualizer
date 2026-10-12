// Theme "Sphere": rotating wireframe sphere whose radius is pushed out by the spectrum, over drifting waves.
"use strict";

(() => {
  let rot = 0, pts = new Float32Array(0);

  function drawBackground(g, w, h, t) {
    g.lineWidth = 2 * DPR;
    for (let k = 0; k < 7; k++) {
      g.strokeStyle = col(k / 7, 0.13 + F.bass * 0.1);
      g.beginPath();
      for (let x = 0; x <= w; x += w / 80) {
        const u = x / w;
        const y = h * (0.28 + k * 0.075) + Math.sin(u * TAU * 1.1 + t * 0.35 + k * 0.8) * h * 0.09 * (1 + F.bass * 0.8)
                + Math.sin(u * TAU * 2.7 - t * 0.5 + k) * h * 0.025;
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
  }

  // Projects the deformed sphere grid into pts as [x, y, depth] triplets
  function project(p, lat, lon, vals, cx, cy, R, t) {
    const N = (lat + 1) * (lon + 1);
    if (pts.length !== N * 3) pts = new Float32Array(N * 3);
    const tilt = 0.35 + Math.sin(t * 0.2) * 0.2;
    const cy0 = Math.cos(rot), sy0 = Math.sin(rot), cx0 = Math.cos(tilt), sx0 = Math.sin(tilt);
    const fov = 3.2;
    for (let a = 0; a <= lat; a++) {
      const th = a / lat * Math.PI, ct = Math.cos(th), st = Math.sin(th);
      const v = vals[Math.round(Math.abs(a / lat - 0.5) * 2 * lat)]; // bass at the equator, highs at the poles
      for (let b = 0; b <= lon; b++) {
        const ph = b / lon * TAU;
        const ripple = Math.sin(ph * 3 + t * 1.6 + th * 2.5) * 0.5 + 0.5;
        const d = 1 + p.amp * v * (0.45 + 0.55 * ripple);
        const x = st * Math.cos(ph) * d, y = ct * d, z = st * Math.sin(ph) * d;
        const x1 = x * cy0 + z * sy0, z1 = -x * sy0 + z * cy0;
        const y2 = y * cx0 - z1 * sx0, z2 = y * sx0 + z1 * cx0;
        const s = fov / (fov + z2), o = (a * (lon + 1) + b) * 3;
        pts[o] = cx + x1 * R * s; pts[o + 1] = cy + y2 * R * s; pts[o + 2] = z2;
      }
    }
  }

  // One polyline split into a front path and a dimmed back path: 2 strokes instead of one per segment
  function strokeLine(g, idx, tc) {
    const front = new Path2D(), back = new Path2D();
    for (let k = 0; k < idx.length - 1; k++) {
      const o1 = idx[k] * 3, o2 = idx[k + 1] * 3;
      const path = pts[o1 + 2] + pts[o2 + 2] < 0 ? front : back;
      path.moveTo(pts[o1], pts[o1 + 1]); path.lineTo(pts[o2], pts[o2 + 1]);
    }
    g.strokeStyle = col(tc, 0.16); g.stroke(back);
    g.strokeStyle = col(tc, 0.95); g.stroke(front);
  }

  registerTheme('sphere', {
    name: 'Sphere', icon: '◍',
    params: [
      { k: 'res', label: 'Resolution', min: 12, max: 60, step: 1, def: 32 },
      { k: 'spin', label: 'Rotation', min: -2, max: 2, step: 0.05, def: 0.35 },
      { k: 'amp', label: 'Deformation', min: 0, max: 1.5, step: 0.05, def: 0.6 },
      { k: 'bgLines', label: 'Background waves', def: true },
    ],
    draw(g, w, h, t, dt) {
      const p = S.sphere, lat = p.res | 0, lon = lat * 2, vals = bands(lat + 1);
      const R = Math.min(w, h) * 0.23 * (1 + F.bass * 0.08);
      rot += dt * p.spin * (0.5 + F.energy * 1.5);

      if (p.bgLines) drawBackground(g, w, h, t);
      project(p, lat, lon, vals, w / 2, h / 2, R, t);

      g.lineWidth = Math.max(1, DPR * 1.1);
      for (let a = 1; a < lat; a++) {
        const idx = []; for (let b = 0; b <= lon; b++) idx.push(a * (lon + 1) + b);
        strokeLine(g, idx, a / lat * 0.85);
      }
      for (let b = 0; b < lon; b++) {
        const idx = []; for (let a = 0; a <= lat; a++) idx.push(a * (lon + 1) + b);
        strokeLine(g, idx, b / lon);
      }
    },
  });
})();
