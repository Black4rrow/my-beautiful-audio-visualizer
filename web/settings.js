// Settings: global params schema, defaults built from all schemas, and localStorage persistence.
// S is the live settings object read by every module.
"use strict";

const GLOBAL_PARAMS = [
  { k: 'gain', label: 'Sensitivity', min: 0.2, max: 3, step: 0.05, def: 1.2 },
  { k: 'smoothing', label: 'Smoothing', min: 0, max: 0.95, step: 0.01, def: 0.72 },
  { k: 'glow', label: 'Glow', min: 0, max: 2, step: 0.05, def: 0.9 },
  { k: 'trail', label: 'Trail', min: 0, max: 0.95, step: 0.01, def: 0.3 },
  { k: 'hueSpeed', label: 'Color cycling speed', min: 0, max: 0.5, step: 0.01, def: 0.04 },
  { k: 'autoCycle', label: 'Auto theme switch (s, 0 = off)', min: 0, max: 120, step: 5, def: 0 },
];

const THEME_KEYS = Object.keys(THEMES);

const DEFAULTS = (() => {
  const d = { theme: THEME_KEYS[0], palette: 'rainbow', c1: '#ff00d4', c2: '#00f0ff' };
  for (const p of GLOBAL_PARAMS) d[p.k] = p.def;
  for (const key of THEME_KEYS) {
    d[key] = {};
    for (const p of THEMES[key].params) d[key][p.k] = p.def;
  }
  return d;
})();

// Copies saved values over defaults, ignoring unknown keys and type mismatches from older versions
function deepMerge(a, b) {
  for (const k in b) {
    if (!(k in a)) continue;
    if (a[k] && typeof a[k] === 'object' && b[k] && typeof b[k] === 'object') deepMerge(a[k], b[k]);
    else if (typeof a[k] === typeof b[k]) a[k] = b[k];
  }
  return a;
}

function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem('spectra') || '{}') || {}; } catch {}
  return deepMerge(structuredClone(DEFAULTS), s);
}

let S = loadSettings();

let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem('spectra', JSON.stringify(S)); } catch {} }, 300);
}
