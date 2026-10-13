// Palettes: colour stops per palette, a 256-entry lookup table for the active one, and col() to sample it.
// Palettes are cyclic (last stop = first) so hueOff can scroll them without a seam.
"use strict";

const PALETTES = {
  rainbow: { name: 'Rainbow', stops: ['#ff1a1a', '#ff8a00', '#ffe600', '#3dff5a', '#00e5ff', '#2a6bff', '#a63dff', '#ff2bd6', '#ff1a1a'] },
  neon:    { name: 'Neon', stops: ['#ff00d4', '#00f0ff', '#ff00d4'] },
  synth:   { name: 'Synthwave', stops: ['#ff2a6d', '#d300c5', '#7b2ff7', '#05d9e8', '#ff2a6d'] },
  fire:    { name: 'Fire', stops: ['#ff1500', '#ff6a00', '#ffc400', '#fff3a0', '#ffc400', '#ff6a00', '#ff1500'] },
  ocean:   { name: 'Ocean', stops: ['#0033ff', '#00a2ff', '#00ffd0', '#8dff8a', '#00ffd0', '#00a2ff', '#0033ff'] },
  aurora:  { name: 'Aurora', stops: ['#00ff9d', '#00c3ff', '#8a2bff', '#ff4fd8', '#00ff9d'] },
  gold:    { name: 'Gold & night', stops: ['#ffd36b', '#ff8f3d', '#b03dff', '#3d6bff', '#ffd36b'] },
  custom:  { name: 'Custom', stops: null }, // positioned stops from the theme settings (cur().stops)
};

const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');

// Stops as { p: 0..1, c: '#rrggbb' } sorted by position. Presets are evenly spaced; custom stops get
// a wrapped copy on each side so the gradient loops (the colour after the last stop is the first one).
function positionedStops(key) {
  const preset = PALETTES[key]?.stops;
  if (preset) return preset.map((c, i) => ({ p: i / (preset.length - 1), c }));
  const s = [...cur().stops].sort((a, b) => a.p - b.p);
  const first = s[0], last = s[s.length - 1];
  return [{ p: last.p - 1, c: last.c }, ...s, { p: first.p + 1, c: first.c }];
}

// [r, g, b] at position t (0..1) of positioned stops
function colorAt(stops, t) {
  let k = 0;
  while (k < stops.length - 2 && stops[k + 1].p < t) k++;
  const a = stops[k], b = stops[k + 1], span = b.p - a.p;
  const f = span > 0 ? Math.min(1, Math.max(0, (t - a.p) / span)) : 0;
  const ca = hex(a.c), cb = hex(b.c);
  return ca.map((v, i) => v + (cb[i] - v) * f | 0);
}

const cssGradient = key =>
  `linear-gradient(90deg, ${positionedStops(key).map(s => `${s.c} ${(s.p * 100).toFixed(1)}%`).join(',')})`;

let LUT = [];
let hueOff = 0; // scrolls the palette over time (advanced in main.js)

function buildLUT() {
  const stops = positionedStops(cur().palette);
  LUT = new Array(256);
  for (let i = 0; i < 256; i++) LUT[i] = colorAt(stops, i / 255);
}

// t: position in the palette (0..1, wraps), a: alpha, light: 0..1 mix towards white
function col(t, a = 1, light = 0) {
  const c = LUT[((((t + hueOff) % 1) + 1) % 1) * 255 | 0];
  if (!light) return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  return `rgba(${c[0] + (255 - c[0]) * light | 0},${c[1] + (255 - c[1]) * light | 0},${c[2] + (255 - c[2]) * light | 0},${a})`;
}
