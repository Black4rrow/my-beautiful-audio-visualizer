// Analysis: groups FFT bins into log-scaled bands (bands(n)) and derives global features F (bass, beat...).
"use strict";

let frameId = 0; // bumped by main.js each frame so bands(n) computes once per frame per size
let bandCache = {};
function resetBands() { bandCache = {}; }

// Returns n smoothed band values in 0..1, from 32 Hz to 16 kHz on a log scale
function bands(n) {
  n = Math.max(1, n | 0);
  let m = bandCache[n];
  if (!m) {
    const sr = A.ctx ? A.ctx.sampleRate : 48000, hz = sr / 2 / A.freq.length;
    const lo = Math.log2(32), hi = Math.log2(16000), edges = [];
    for (let i = 0; i <= n; i++) edges.push(Math.pow(2, lo + (hi - lo) * i / n) / hz);
    m = bandCache[n] = { edges, val: new Float32Array(n), frame: -1 };
  }
  if (m.frame === frameId) return m.val;
  m.frame = frameId;
  const Fq = A.freq, L = Fq.length - 1, release = 1 - S.smoothing * 0.95;
  for (let i = 0; i < n; i++) {
    const a = m.edges[i], b = m.edges[i + 1];
    let s = 0;
    if (b - a < 1) { // narrower than one bin (low end): interpolate
      const x = (a + b) / 2, k = Math.min(L - 1, Math.floor(x)), f = x - k;
      s = Fq[k] * (1 - f) + Fq[k + 1] * f;
    } else {
      for (let k = Math.floor(a), e = Math.min(L, Math.ceil(b)); k < e; k++) if (Fq[k] > s) s = Fq[k];
    }
    let v = Math.pow(s / 255, 1.5) * S.gain * (0.85 + 0.55 * i / n); // tilt boosts highs, which read weaker
    if (v > 1) v = 1;
    const p = m.val[i];
    m.val[i] = v > p ? p + (v - p) * 0.65 : p + (v - p) * release; // fast attack, configurable release
  }
  return m.val;
}

const F = { bass: 0, mid: 0, high: 0, energy: 0, beat: 0, hit: false, avgBass: 0, lastBeat: 0 };

// F.hit is true on the frame a beat is detected; F.beat is a 1 → 0 pulse that follows it
function analyse(now) {
  const b = bands(32);
  let bs = 0, md = 0, hi = 0;
  for (let i = 0; i < 4; i++) bs += b[i];
  for (let i = 4; i < 18; i++) md += b[i];
  for (let i = 18; i < 32; i++) hi += b[i];
  F.bass = bs / 4; F.mid = md / 14; F.high = hi / 14;
  F.energy = (F.bass + F.mid + F.high) / 3;
  F.avgBass = F.avgBass * 0.94 + F.bass * 0.06;
  F.hit = F.bass > F.avgBass * 1.2 + 0.04 && F.bass > 0.25 && now - F.lastBeat > 0.22;
  if (F.hit) { F.beat = 1; F.lastBeat = now; } else F.beat *= 0.9;
}
