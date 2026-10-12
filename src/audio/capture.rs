//! Captures the default output device through WASAPI loopback and pushes mono samples
//! into a lock-free ring that the render thread reads once per frame.

use std::sync::Arc;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

/// Power of two so the write index wraps with a mask. Holds ~170 ms at 48 kHz, more than one FFT window.
const RING_LEN: usize = 8192;

/// Single-producer ring of f32 samples stored as bits. The reader may see a sample being
/// overwritten mid-frame; that is harmless for a visualizer and keeps both sides wait-free.
pub struct SampleRing {
    samples: Box<[AtomicU32]>,
    written: AtomicU64,
}

impl SampleRing {
    fn new() -> Self {
        Self {
            samples: (0..RING_LEN).map(|_| AtomicU32::new(0)).collect(),
            written: AtomicU64::new(0),
        }
    }

    /// Total samples ever written. Stops moving when Windows plays nothing (loopback sends no packets).
    pub fn written(&self) -> u64 {
        self.written.load(Ordering::Acquire)
    }

    /// Copies the most recent `out.len()` samples, oldest first.
    pub fn read_latest(&self, out: &mut [f32]) {
        let end = self.written() as usize;
        let start = end.wrapping_sub(out.len());
        for (i, o) in out.iter_mut().enumerate() {
            let idx = start.wrapping_add(i) & (RING_LEN - 1);
            *o = f32::from_bits(self.samples[idx].load(Ordering::Relaxed));
        }
    }
}

/// Keeps the cpal stream alive; dropping it stops the capture.
pub struct AudioCapture {
    _stream: cpal::Stream,
    pub ring: Arc<SampleRing>,
    pub sample_rate: u32,
}

impl AudioCapture {
    pub fn start() -> Result<Self, String> {
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or("no audio output device")?;
        let supported = device.default_output_config().map_err(|e| e.to_string())?;
        if supported.sample_format() != cpal::SampleFormat::F32 {
            // The WASAPI shared-mode mix format is float on every modern Windows setup.
            return Err(format!(
                "unsupported sample format {:?}",
                supported.sample_format()
            ));
        }
        let config: cpal::StreamConfig = supported.config();
        let channels = config.channels.max(1) as usize;
        let ring = Arc::new(SampleRing::new());

        let writer = ring.clone();
        // Building an input stream on an output device is how cpal requests WASAPI loopback.
        let stream = device
            .build_input_stream(
                config.clone(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    let mut pos = writer.written.load(Ordering::Relaxed);
                    for frame in data.chunks_exact(channels) {
                        let mono = frame.iter().sum::<f32>() / channels as f32;
                        writer.samples[pos as usize & (RING_LEN - 1)]
                            .store(mono.to_bits(), Ordering::Relaxed);
                        pos += 1;
                    }
                    writer.written.store(pos, Ordering::Release);
                },
                |err| eprintln!("audio stream error: {err}"),
                None,
            )
            .map_err(|e| e.to_string())?;
        stream.play().map_err(|e| e.to_string())?;

        Ok(Self {
            _stream: stream,
            ring,
            sample_rate: config.sample_rate,
        })
    }
}
