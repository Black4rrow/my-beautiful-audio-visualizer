// Audio sources: PC audio (getDisplayMedia), microphone, audio file or demo, all feeding one AnalyserNode.
// A holds the audio graph and the raw byte buffers (A.freq spectrum, A.wave waveform) read each frame.
"use strict";

const A = {
  ctx: null, an: null, src: null, stream: null, el: null, mode: null,
  freq: new Uint8Array(2048), wave: new Uint8Array(4096).fill(128),
};

function initAudioGraph() {
  A.ctx = new AudioContext();
  A.an = A.ctx.createAnalyser();
  A.an.fftSize = 4096;
  A.an.minDecibels = -90;
  A.an.maxDecibels = -20;
  A.an.smoothingTimeConstant = 0.5; // light smoothing here, the rest is done per band in analysis.js
  A.freq = new Uint8Array(A.an.frequencyBinCount);
  A.wave = new Uint8Array(A.an.fftSize);
  resetBands();
}

async function startSource(mode) {
  try {
    if (!A.ctx) initAudioGraph();
    await A.ctx.resume();

    if (mode === 'system') {
      const st = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1, width: { ideal: 320 }, height: { ideal: 180 } }, // required by the API, kept tiny
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        systemAudio: 'include', selfBrowserSurface: 'exclude',
      });
      if (!st.getAudioTracks().length) {
        st.getTracks().forEach(t => t.stop());
        throw new Error('No audio shared: pick "Entire screen" and tick "Also share system audio".');
      }
      stopSource();
      useStream(st);
    } else if (mode === 'mic') {
      const st = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      stopSource();
      useStream(st);
    } else if (mode === 'file') {
      $('#file').click(); // continues in playFile()
      return;
    } else {
      stopSource();
    }
    A.mode = mode;
    hideStart();
    renderDock();
  } catch (e) {
    toast(e.name === 'NotAllowedError' ? 'Sharing cancelled.' : (e.message || String(e)));
  }
}

function useStream(st) {
  A.stream = st;
  A.src = A.ctx.createMediaStreamSource(st);
  A.src.connect(A.an); // not routed to the output: analyse without playing the sound again
  st.getTracks().forEach(t => t.addEventListener('ended', () => {
    if (A.stream !== st) return;
    stopSource(); A.mode = null; showStart(); toast('Audio capture stopped.');
  }));
}

function playFile(file) {
  stopSource();
  const audio = new Audio();
  audio.src = URL.createObjectURL(file);
  audio.loop = true;
  A.el = audio;
  A.src = A.ctx.createMediaElementSource(audio);
  A.src.connect(A.an);
  A.src.connect(A.ctx.destination);
  audio.play();
  A.mode = 'file';
  hideStart(); renderDock();
  toast('▶ ' + file.name);
}

function stopSource() {
  if (A.stream) A.stream.getTracks().forEach(t => t.stop());
  if (A.src) A.src.disconnect();
  if (A.el) { A.el.pause(); URL.revokeObjectURL(A.el.src); }
  A.stream = A.src = A.el = null;
  A.freq.fill(0);
}

// Fills A.freq / A.wave for this frame from the active source
function readAudio(t) {
  if (A.mode === 'demo') synthDemo(t);
  else if (A.an && A.src) { A.an.getByteFrequencyData(A.freq); A.an.getByteTimeDomainData(A.wave); }
}

$('#file').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) playFile(f);
  e.target.value = '';
});
