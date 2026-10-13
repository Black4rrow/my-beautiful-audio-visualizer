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
  custom:  { name: 'Custom', stops: null }, // built from the theme's c1 / c2
};

const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const paletteStops = key => PALETTES[key]?.stops || [cur().c1, cur().c2, cur().c1];
const cssGradient = key => `linear-gradient(90deg, ${paletteStops(key).join(',')})`;

let LUT = [];
let hueOff = 0; // scrolls the palette over time (advanced in main.js)

function buildLUT() {
  const rgb = paletteStops(cur().palette).map(hex);
  LUT = new Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255 * (rgb.length - 1);
    const k = Math.min(rgb.length - 2, Math.floor(t)), f = t - k;
    const a = rgb[k], b = rgb[k + 1];
    LUT[i] = [a[0] + (b[0] - a[0]) * f | 0, a[1] + (b[1] - a[1]) * f | 0, a[2] + (b[2] - a[2]) * f | 0];
  }
}

// t: position in the palette (0..1, wraps), a: alpha, light: 0..1 mix towards white
function col(t, a = 1, light = 0) {
  const c = LUT[((((t + hueOff) % 1) + 1) % 1) * 255 | 0];
  if (!light) return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  return `rgba(${c[0] + (255 - c[0]) * light | 0},${c[1] + (255 - c[1]) * light | 0},${c[2] + (255 - c[2]) * light | 0},${a})`;
}
