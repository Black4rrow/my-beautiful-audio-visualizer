// Main loop: read audio → analyse → draw the active theme → compose. Also boots the app.
"use strict";

let last = performance.now();
let T = 0; // app clock in seconds

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); // clamp so a stalled tab doesn't jump
  last = now; T += dt; frameId++;

  readAudio(T);
  analyse(T);
  hueOff = (hueOff + dt * S.hueSpeed * (0.3 + F.energy * 1.5)) % 1;

  if (S.autoCycle > 0 && A.mode && T - themeSince > S.autoCycle) {
    setTheme(THEME_KEYS[(THEME_KEYS.indexOf(S.theme) + 1) % THEME_KEYS.length]);
  }

  beginScene();
  THEMES[S.theme].draw(g, W, H, T, dt);
  composeFrame();
}

resize();
buildLUT();
renderDock();
requestAnimationFrame(frame);
