// Theme registry. Each theme file calls registerTheme() with its name, icon, params schema and draw function.
// Param schema: { k, label, def } is a toggle when def is boolean, otherwise a slider with { min, max, step }.
// draw(g, w, h, t, dt) paints one frame on the scene canvas; it reads S (settings), F (audio features),
// bands(n) and col(t, alpha, light).
"use strict";

const THEMES = {};
function registerTheme(key, theme) { THEMES[key] = theme; }
