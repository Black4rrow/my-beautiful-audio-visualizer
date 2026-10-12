// Canvases and compositing. Themes draw on `g` (scene, keeps a fading trail); composeFrame() paints
// background + scene + a 1/4-resolution bloom onto the visible canvas.
"use strict";

const display = $('#c'), dctx = display.getContext('2d');
const scene = document.createElement('canvas'), g = scene.getContext('2d');
const bloom = document.createElement('canvas'), bctx = bloom.getContext('2d');
let W = 1, H = 1, DPR = 1;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.max(1, Math.floor(innerWidth * DPR)); H = Math.max(1, Math.floor(innerHeight * DPR));
  display.width = scene.width = W; display.height = scene.height = H;
  bloom.width = Math.max(1, W >> 2); bloom.height = Math.max(1, H >> 2);
}
addEventListener('resize', resize);

// Fades the previous frame instead of clearing it, which creates the trail
function beginScene() {
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = `rgba(0,0,0,${1 - S.trail * 0.92})`;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
}

function composeFrame() {
  const bg = dctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2);
  bg.addColorStop(0, '#0c0b1c'); bg.addColorStop(1, '#020206');
  dctx.globalCompositeOperation = 'source-over'; dctx.globalAlpha = 1;
  dctx.fillStyle = bg; dctx.fillRect(0, 0, W, H);
  dctx.fillStyle = col(0.3, 0.04 + F.bass * 0.06); dctx.fillRect(0, 0, W, H);
  dctx.drawImage(scene, 0, 0);
  if (S.glow > 0) {
    bctx.clearRect(0, 0, bloom.width, bloom.height);
    bctx.filter = 'blur(4px)';
    bctx.drawImage(scene, 0, 0, bloom.width, bloom.height);
    bctx.filter = 'none';
    dctx.globalCompositeOperation = 'lighter';
    dctx.globalAlpha = Math.min(1, S.glow);
    dctx.drawImage(bloom, 0, 0, W, H);
    if (S.glow > 1) { dctx.globalAlpha = S.glow - 1; dctx.drawImage(bloom, 0, 0, W, H); }
    dctx.globalAlpha = 1; dctx.globalCompositeOperation = 'source-over';
  }
}
