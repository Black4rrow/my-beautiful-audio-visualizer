//! Theme "Equalizer": vertical bars with LED segments, reflection, mirror mode and falling peak caps.
//! CPU side: band reduction and peak physics for ≤256 bars (4 KB upload per frame).
//! GPU side: one instanced draw, 4 quads per bar generated in `bars.wgsl`.

use bytemuck::{Pod, Zeroable};
use serde::{Deserialize, Serialize};

use super::{FrameCtx, PipelineCtx, Theme};
use crate::audio::analysis::BandMapper;

const MAX_BARS: usize = 256;
const QUADS_PER_BAR: u32 = 4; // body, reflection, peak cap, horizon segment
const FLAG_SEGMENTS: u32 = 1;
const FLAG_REFLECTION: u32 = 2;
const FLAG_PEAKS: u32 = 4;

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct BarsSettings {
    /// 16..256
    pub count: u32,
    /// Empty fraction of each bar slot, 0..0.8
    pub gap: f32,
    pub segments: bool,
    pub reflection: bool,
    /// Bass in the middle, highs on both sides.
    pub mirror: bool,
    pub peaks: bool,
}

impl Default for BarsSettings {
    fn default() -> Self {
        Self {
            count: 96,
            gap: 0.3,
            segments: true,
            reflection: true,
            mirror: false,
            peaks: true,
        }
    }
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct Params {
    count: u32,
    flags: u32,
    gap: f32,
    base: f32,
    seg: f32,
    seg_gap: f32,
    scale: f32,
    _pad: f32,
}

pub struct Bars {
    pipeline: wgpu::RenderPipeline,
    bind_group: wgpu::BindGroup,
    params: wgpu::Buffer,
    bars_buf: wgpu::Buffer,
    /// Per bar: height px, peak px, palette position, unused.
    bars: Vec<[f32; 4]>,
    bands: BandMapper,
    count: u32,
}

impl Bars {
    pub fn new(ctx: &PipelineCtx) -> Self {
        let device = ctx.device;
        let params = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("bars params"),
            size: size_of::<Params>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let bars_buf = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("bars data"),
            size: (MAX_BARS * size_of::<[f32; 4]>()) as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let entry = |binding, ty| wgpu::BindGroupLayoutEntry {
            binding,
            visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
            ty: wgpu::BindingType::Buffer {
                ty,
                has_dynamic_offset: false,
                min_binding_size: None,
            },
            count: None,
        };
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("bars"),
            entries: &[
                entry(0, wgpu::BufferBindingType::Uniform),
                entry(1, wgpu::BufferBindingType::Storage { read_only: true }),
            ],
        });
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("bars"),
            layout: &layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: params.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: bars_buf.as_entire_binding(),
                },
            ],
        });
        Self {
            pipeline: ctx.pipeline("bars", include_str!("../shaders/bars.wgsl"), &layout),
            bind_group,
            params,
            bars_buf,
            bars: vec![[0.0; 4]; MAX_BARS],
            bands: BandMapper::new(1, 48_000),
            count: 0,
        }
    }
}

impl Theme for Bars {
    fn update(&mut self, ctx: &FrameCtx) {
        let s = &ctx.settings.bars;
        let n = (s.count as usize).clamp(16, MAX_BARS);
        let half = n.div_ceil(2);
        let wanted = if s.mirror { half } else { n };
        if self.bands.len() != wanted {
            // Only when the bar count or mirror setting changes.
            self.bands = BandMapper::new(wanted, ctx.sample_rate);
        }
        self.bands
            .update(ctx.levels, ctx.settings.gain, ctx.settings.smoothing);
        let vals = self.bands.values();

        let (_, h) = ctx.size;
        let base = if s.reflection { h * 0.64 } else { h * 0.93 };
        let max_h = base * 0.84;
        let peak_fall = h * 0.21 * ctx.dt; // matches the prototype's 0.35 % of height per frame at 60 fps
        let center = (n - 1) as f32 / 2.0;
        for (i, bar) in self.bars[..n].iter_mut().enumerate() {
            let j = if s.mirror {
                ((i as f32 - center).abs() as usize).min(half - 1)
            } else {
                i
            };
            let t = if s.mirror {
                j as f32 / half as f32
            } else {
                i as f32 / n as f32
            } * 0.85;
            let height = (vals[j] * max_h).max(2.0 * ctx.scale);
            *bar = [height, height.max(bar[1] - peak_fall), t, 0.0];
        }

        let flags = (s.segments as u32 * FLAG_SEGMENTS)
            | (s.reflection as u32 * FLAG_REFLECTION)
            | (s.peaks as u32 * FLAG_PEAKS);
        let seg = (h / 95.0).max(4.0);
        let params = Params {
            count: n as u32,
            flags,
            gap: s.gap.clamp(0.0, 0.8),
            base,
            seg,
            seg_gap: (seg * 0.3).max(1.5),
            scale: ctx.scale,
            _pad: 0.0,
        };
        ctx.queue
            .write_buffer(&self.params, 0, bytemuck::bytes_of(&params));
        ctx.queue
            .write_buffer(&self.bars_buf, 0, bytemuck::cast_slice(&self.bars[..n]));
        self.count = n as u32;
    }

    fn draw(&self, pass: &mut wgpu::RenderPass<'_>) {
        pass.set_pipeline(&self.pipeline);
        pass.set_bind_group(1, &self.bind_group, &[]);
        pass.draw(0..QUADS_PER_BAR * 6, 0..self.count);
    }
}
