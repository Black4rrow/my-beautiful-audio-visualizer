//! Bind group 0 shared by every theme shader: per-frame globals (size, time, audio features)
//! and the palette texture. Matches `shaders/common.wgsl`, which is prepended to each theme shader.

use bytemuck::{Pod, Zeroable};

use super::palette;
use crate::audio::analysis::Features;

pub const COMMON_WGSL: &str = include_str!("../shaders/common.wgsl");

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct GlobalsData {
    resolution: [f32; 2],
    time: f32,
    hue_off: f32,
    bass: f32,
    mid: f32,
    high: f32,
    energy: f32,
    beat: f32,
    _pad: [f32; 3], // uniform structs are sized in multiples of 16 bytes
}

pub struct Globals {
    buffer: wgpu::Buffer,
    palette: wgpu::Texture,
    pub layout: wgpu::BindGroupLayout,
    pub bind_group: wgpu::BindGroup,
}

impl Globals {
    pub fn new(device: &wgpu::Device, queue: &wgpu::Queue, palette_key: &str) -> Self {
        let buffer = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("globals"),
            size: size_of::<GlobalsData>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let palette = palette::create_texture(device);
        palette::upload(queue, &palette, palette_key);
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("palette"),
            address_mode_u: wgpu::AddressMode::Repeat,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        let all = wgpu::ShaderStages::VERTEX_FRAGMENT;
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("globals"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: all,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: all,
                    ty: wgpu::BindingType::Texture {
                        sample_type: wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled: false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: all,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });
        let view = palette.create_view(&wgpu::TextureViewDescriptor::default());
        let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("globals"),
            layout: &layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&view),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&sampler),
                },
            ],
        });
        Self {
            buffer,
            palette,
            layout,
            bind_group,
        }
    }

    pub fn set_palette(&self, queue: &wgpu::Queue, key: &str) {
        palette::upload(queue, &self.palette, key);
    }

    /// 48 bytes per frame.
    pub fn write(
        &self,
        queue: &wgpu::Queue,
        size: (f32, f32),
        time: f32,
        hue_off: f32,
        f: &Features,
    ) {
        let data = GlobalsData {
            resolution: [size.0, size.1],
            time,
            hue_off,
            bass: f.bass,
            mid: f.mid,
            high: f.high,
            energy: f.energy,
            beat: f.beat,
            _pad: [0.0; 3],
        };
        queue.write_buffer(&self.buffer, 0, bytemuck::bytes_of(&data));
    }
}
