//! Spectrum analysis, ported from the web prototype: FFT → smoothed 0..1 levels per bin,
//! log-scaled band reduction (`BandMapper`) and global features (bass, mids, highs, beat).
//! All buffers are allocated once; `update` runs every frame without allocating.

use std::sync::Arc;

use realfft::num_complex::Complex;
use realfft::{RealFftPlanner, RealToComplex};

use super::capture::SampleRing;

const FFT_SIZE: usize = 4096;
/// Same mapping as the Web Audio AnalyserNode used by the prototype (minDecibels / maxDecibels).
const MIN_DB: f32 = -90.0;
const MAX_DB: f32 = -20.0;
/// Temporal smoothing applied to bin magnitudes (AnalyserNode.smoothingTimeConstant).
const BIN_SMOOTHING: f32 = 0.5;
/// After this long without new samples, Windows is silent: analyse zeros so everything decays.
const STALE_AFTER: f32 = 0.1;

/// Reduces per-bin levels to `n` bands on a log scale from 32 Hz to 16 kHz, with fast attack
/// and a configurable release. Each consumer owns one sized for its needs.
pub struct BandMapper {
    edges: Vec<f32>,
    values: Vec<f32>,
}

impl BandMapper {
    pub fn new(n: usize, sample_rate: u32) -> Self {
        let n = n.max(1);
        let hz_per_bin = sample_rate as f32 / FFT_SIZE as f32;
        let (lo, hi) = (32f32.log2(), 16_000f32.log2());
        let edges = (0..=n)
            .map(|i| (lo + (hi - lo) * i as f32 / n as f32).exp2() / hz_per_bin)
            .collect();
        Self {
            edges,
            values: vec![0.0; n],
        }
    }

    pub fn len(&self) -> usize {
        self.values.len()
    }

    pub fn values(&self) -> &[f32] {
        &self.values
    }

    pub fn update(&mut self, levels: &[f32], gain: f32, smoothing: f32) {
        let n = self.values.len();
        let last = levels.len() - 1;
        let release = 1.0 - smoothing * 0.95;
        for i in 0..n {
            let (a, b) = (self.edges[i], self.edges[i + 1]);
            let s = if b - a < 1.0 {
                // Narrower than one bin (low end): interpolate between neighbours.
                let x = (a + b) * 0.5;
                let k = (x.floor() as usize).min(last - 1);
                let f = x - k as f32;
                levels[k] * (1.0 - f) + levels[k + 1] * f
            } else {
                let (start, end) = (a.floor() as usize, (b.ceil() as usize).min(last));
                levels[start.min(end)..end]
                    .iter()
                    .copied()
                    .fold(0.0, f32::max)
            };
            // The tilt boosts highs, which read weaker than bass at equal loudness.
            let v = (s.powf(1.5) * gain * (0.85 + 0.55 * i as f32 / n as f32)).min(1.0);
            let p = self.values[i];
            self.values[i] = if v > p {
                p + (v - p) * 0.65
            } else {
                p + (v - p) * release
            };
        }
    }
}

/// Global features shared by every theme.
#[derive(Default, Clone, Copy)]
pub struct Features {
    pub bass: f32,
    pub mid: f32,
    pub high: f32,
    pub energy: f32,
    /// 1 on a detected beat, then decays towards 0.
    pub beat: f32,
    /// True only on the frame a beat is detected.
    pub hit: bool,
    avg_bass: f32,
    last_beat: f32,
}

pub struct Analyzer {
    fft: Arc<dyn RealToComplex<f32>>,
    window: Vec<f32>,
    input: Vec<f32>,
    spectrum: Vec<Complex<f32>>,
    scratch: Vec<Complex<f32>>,
    magnitudes: Vec<f32>,
    levels: Vec<f32>,
    last_written: u64,
    stale_for: f32,
    feature_bands: BandMapper,
    pub features: Features,
    pub sample_rate: u32,
}

impl Analyzer {
    pub fn new(sample_rate: u32) -> Self {
        let fft = RealFftPlanner::<f32>::new().plan_fft_forward(FFT_SIZE);
        // Blackman window, as used by the AnalyserNode.
        let window = (0..FFT_SIZE)
            .map(|i| {
                let x = std::f32::consts::TAU * i as f32 / FFT_SIZE as f32;
                0.42 - 0.5 * x.cos() + 0.08 * (2.0 * x).cos()
            })
            .collect();
        let bins = FFT_SIZE / 2;
        Self {
            input: fft.make_input_vec(),
            spectrum: fft.make_output_vec(),
            scratch: fft.make_scratch_vec(),
            fft,
            window,
            magnitudes: vec![0.0; bins],
            levels: vec![0.0; bins],
            last_written: 0,
            stale_for: 0.0,
            feature_bands: BandMapper::new(32, sample_rate),
            features: Features::default(),
            sample_rate,
        }
    }

    /// Per-bin levels in 0..1 (FFT_SIZE / 2 bins), input for every `BandMapper`.
    pub fn levels(&self) -> &[f32] {
        &self.levels
    }

    pub fn update(
        &mut self,
        ring: Option<&SampleRing>,
        dt: f32,
        now: f32,
        gain: f32,
        smoothing: f32,
    ) {
        let written = ring.map_or(0, SampleRing::written);
        self.stale_for = if written == self.last_written {
            self.stale_for + dt
        } else {
            0.0
        };
        self.last_written = written;

        match ring {
            Some(ring) if self.stale_for < STALE_AFTER => ring.read_latest(&mut self.input),
            _ => self.input.fill(0.0),
        }
        for (s, w) in self.input.iter_mut().zip(&self.window) {
            *s *= w;
        }
        if self
            .fft
            .process_with_scratch(&mut self.input, &mut self.spectrum, &mut self.scratch)
            .is_err()
        {
            return;
        }

        let norm = 1.0 / FFT_SIZE as f32;
        for ((mag, level), c) in self
            .magnitudes
            .iter_mut()
            .zip(&mut self.levels)
            .zip(&self.spectrum)
        {
            *mag = BIN_SMOOTHING * *mag + (1.0 - BIN_SMOOTHING) * c.norm() * norm;
            let db = 20.0 * mag.max(1e-9).log10();
            *level = ((db - MIN_DB) / (MAX_DB - MIN_DB)).clamp(0.0, 1.0);
        }

        self.feature_bands.update(&self.levels, gain, smoothing);
        self.update_features(now);
    }

    fn update_features(&mut self, now: f32) {
        let b = self.feature_bands.values();
        let avg = |r: std::ops::Range<usize>| b[r.clone()].iter().sum::<f32>() / r.len() as f32;
        let f = &mut self.features;
        f.bass = avg(0..4);
        f.mid = avg(4..18);
        f.high = avg(18..32);
        f.energy = (f.bass + f.mid + f.high) / 3.0;
        f.avg_bass = f.avg_bass * 0.94 + f.bass * 0.06;
        f.hit = f.bass > f.avg_bass * 1.2 + 0.04 && f.bass > 0.25 && now - f.last_beat > 0.22;
        if f.hit {
            f.beat = 1.0;
            f.last_beat = now;
        } else {
            f.beat *= 0.9;
        }
    }
}
