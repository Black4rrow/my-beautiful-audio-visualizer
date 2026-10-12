// Demo mode: writes a synthetic spectrum and waveform straight into A.freq / A.wave (126 BPM groove).
"use strict";

function synthDemo(t) {
  const Fq = A.freq, n = Fq.length, hz = 24000 / n;
  const beat = t * 2.1, ph = beat % 1;
  const kick = Math.exp(-ph * 6);
  const snare = Math.exp(-((beat + 0.5) % 1) * 8) * (Math.floor(beat + 0.5) % 2 ? 1 : 0.35);
  const hat = Math.exp(-((beat * 2) % 1) * 12);
  const prog = [0, 5, 3, 7][Math.floor(beat / 4) % 4];
  const notes = [0, 4, 7, 12].map((s, i) => 110 * Math.pow(2, (prog + s + (i === 3 && ph > .5 ? 2 : 0)) / 12));
  const gauss = (x, m, s) => Math.exp(-(((x - m) / s) ** 2)); // bump on a log2(Hz) axis
  for (let i = 1; i < n; i++) {
    const lf = Math.log2(i * hz);
    let v = kick * gauss(lf, 5.9, 1.0) * 235
          + snare * gauss(lf, 11, 1.6) * 150
          + hat * gauss(lf, 13.2, 0.7) * 120
          + 70 * gauss(lf, 8, 3) * (0.7 + 0.3 * Math.sin(t * 0.7));
    for (const f0 of notes) for (let h = 1; h <= 4; h++) v += (170 / h) * gauss(lf, Math.log2(f0 * h), 0.06);
    v += Math.random() * 18;
    Fq[i] = Math.min(255, v);
  }
  const W8 = A.wave;
  for (let i = 0; i < W8.length; i++) W8[i] = 128 + 60 * F.energy * Math.sin(i * 0.02 + t * 9) * Math.sin(i * 0.0031 + t);
}
