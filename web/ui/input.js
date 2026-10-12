// Keyboard shortcuts and auto-hiding of the interface when the mouse is idle.
"use strict";

let idleTimer;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (A.mode && !isPanelOpen()) document.body.classList.add('idle');
  }, 2500);
}
addEventListener('mousemove', wake);
addEventListener('pointerdown', wake);

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= String(THEME_KEYS.length)) setTheme(THEME_KEYS[+k - 1]);
  else if (k === 'p') nextPalette();
  else if (k === 's') togglePanel();
  else if (k === 'f') toggleFullscreen();
  else if (k === 'h') document.body.classList.toggle('hideui');
  else if (k === 'escape') { $('#panel').classList.remove('open'); hideGuide(); }
  else return;
  wake();
});
