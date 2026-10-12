// Start screen (audio source choice) and the guide popup shown before PC audio capture.
"use strict";

function showStart() { $('#start').classList.remove('gone'); }
function hideStart() { $('#start').classList.add('gone'); }

let skipGuide = false;
try { skipGuide = localStorage.getItem('spectra-skipGuide') === '1'; } catch {}
$('#skipGuide').checked = skipGuide;

function showGuide() { $('#guide').classList.remove('gone'); $('#guideOk').focus(); }
function hideGuide() { $('#guide').classList.add('gone'); }

$('#guideCancel').onclick = hideGuide;
$('#guide').addEventListener('click', e => { if (e.target.id === 'guide') hideGuide(); });
$('#guideOk').onclick = () => {
  skipGuide = $('#skipGuide').checked;
  try { localStorage.setItem('spectra-skipGuide', skipGuide ? '1' : '0'); } catch {}
  hideGuide();
  startSource('system');
};

document.querySelectorAll('.src').forEach(b => b.addEventListener('click', () => {
  if (b.dataset.src === 'system' && !skipGuide) showGuide();
  else startSource(b.dataset.src);
}));
$('#start').addEventListener('click', e => { if (e.target.id === 'start' && A.mode) hideStart(); });

function disableSource(key, msg) {
  const btn = $(`[data-src="${key}"]`);
  btn.disabled = true;
  btn.querySelector('small').textContent = msg;
}
if (!navigator.mediaDevices?.getDisplayMedia) {
  disableSource('system', 'Not supported by this browser — open the page in Chrome or Edge.');
}
// Embedded viewers (e.g. a claude.ai artifact) block screen and microphone capture
const EMBEDDED = (() => { try { return window.self !== window.top; } catch { return true; } })();
if (EMBEDDED) {
  disableSource('system', 'Blocked in this embedded view. Open spectra.html directly in Chrome or Edge.');
  disableSource('mic', 'Blocked in this embedded view.');
}
