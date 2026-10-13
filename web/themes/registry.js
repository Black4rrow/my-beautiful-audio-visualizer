// Theme registry. Each theme file calls registerTheme() with its name, icon, params schema and draw function.
// Params schema entries: { section } groups the following params under a title; { k, label, def, options: [[value, text]] }
// is a select; { k, label, def: bool } a toggle; { k, label, def, min, max, step } a slider.
// Optional `defaults` overrides shared settings for this theme (e.g. { palette: 'aurora', glow: 1.2 }).
// draw(g, w, h, t, dt) paints one frame on the scene canvas; it reads S (settings), F (audio features),
// bands(n) and col(t, alpha, light).
"use strict";

const THEMES = {};
function registerTheme(key, theme) { THEMES[key] = theme; }
