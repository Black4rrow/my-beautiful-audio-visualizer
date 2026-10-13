// Dock (floating, left by default): theme chips, palette, source, settings and fullscreen buttons, plus their actions.
"use strict";

const SRC_LABEL = { system: '🔊 PC', mic: '🎤 Mic', file: '📁 File', demo: '✨ Demo' };
let themeSince = 0; // clock time of the last theme change, for auto-cycling

function renderDock() {
  const d = $('#dockBody');
  d.innerHTML = '';
  for (const key of THEME_KEYS) {
    const th = THEMES[key];
    const b = el('button', { className: 'chip' + (S.theme === key ? ' on' : ''), title: th.name },
      el('span', { className: 'ic', textContent: th.icon }), th.name);
    b.onclick = () => setTheme(key);
    d.append(b);
  }
  d.append(el('div', { className: 'sep' }));
  const swatch = el('span', { id: 'palSwatch', style: `background:${cssGradient(cur().palette)}` });
  const pal = el('button', { className: 'chip', title: 'Next palette (P)' }, swatch, PALETTES[cur().palette].name);
  pal.onclick = nextPalette;
  const src = el('button', { className: 'chip', title: 'Change audio source', textContent: SRC_LABEL[A.mode] || 'Source' });
  src.onclick = showStart;
  const gear = el('button', { className: 'chip', title: 'Settings (S)' }, el('span', { className: 'ic', textContent: '⚙' }), 'Settings');
  gear.onclick = togglePanel;
  const fs = el('button', { className: 'chip', title: 'Fullscreen (F)' }, el('span', { className: 'ic', textContent: '⛶' }), 'Fullscreen');
  fs.onclick = toggleFullscreen;
  d.append(pal, src, gear, fs);
}

function setTheme(key) {
  S.theme = key; themeSince = T; save();
  buildLUT(); // each theme has its own palette
  renderDock();
  if (isPanelOpen()) renderPanel();
}

function setPalette(key) {
  cur().palette = key; save(); buildLUT(); renderDock();
  if (isPanelOpen()) renderPanel();
}

function nextPalette() {
  const keys = Object.keys(PALETTES);
  setPalette(keys[(keys.indexOf(cur().palette) + 1) % keys.length]);
  toast('Palette: ' + PALETTES[cur().palette].name);
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

makeFloating('dock', $('#dock'), { defaults: () => ({ x: 16, y: 16, w: 190, h: null }), minW: 64, minH: 80 });
