//! Theme contract and registry. A theme owns its GPU resources (bind group 1 + pipeline),
//! updates them once per frame from `FrameCtx`, then records its draw calls.

pub mod bars;

use crate::settings::Settings;

/// Everything a theme may read during `update`.
pub struct FrameCtx<'a> {
    pub queue: &'a wgpu::Queue,
    /// Per-bin spectrum levels in 0..1, input for a `BandMapper`.
    pub levels: &'a [f32],
    pub settings: &'a Settings,
    pub sample_rate: u32,
    /// Surface size in physical pixels.
    pub size: (f32, f32),
    /// Window scale factor, so line widths match the prototype's devicePixelRatio.
    pub scale: f32,
    pub dt: f32,
}

pub trait Theme {
    fn update(&mut self, ctx: &FrameCtx);
    /// Group 0 (globals) is already bound by the caller.
    fn draw(&self, pass: &mut wgpu::RenderPass<'_>);
}

/// Everything a theme needs to build its pipeline.
pub struct PipelineCtx<'a> {
    pub device: &'a wgpu::Device,
    pub format: wgpu::TextureFormat,
    pub globals_layout: &'a wgpu::BindGroupLayout,
}

impl PipelineCtx<'_> {
    /// Builds a pipeline from a theme's WGSL (prepended with the common declarations).
    /// Vertices are generated in the shader from vertex/instance indices: no vertex buffers.
    pub fn pipeline(
        &self,
        label: &str,
        wgsl: &str,
        theme_layout: &wgpu::BindGroupLayout,
    ) -> wgpu::RenderPipeline {
        let source = format!("{}\n{}", crate::render::globals::COMMON_WGSL, wgsl);
        let module = self
            .device
            .create_shader_module(wgpu::ShaderModuleDescriptor {
                label: Some(label),
                source: wgpu::ShaderSource::Wgsl(source.into()),
            });
        let layout = self
            .device
            .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some(label),
                bind_group_layouts: &[Some(self.globals_layout), Some(theme_layout)],
                immediate_size: 0,
            });
        self.device
            .create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some(label),
                layout: Some(&layout),
                vertex: wgpu::VertexState {
                    module: &module,
                    entry_point: Some("vs_main"),
                    compilation_options: Default::default(),
                    buffers: &[],
                },
                primitive: wgpu::PrimitiveState::default(),
                depth_stencil: None,
                multisample: wgpu::MultisampleState::default(),
                fragment: Some(wgpu::FragmentState {
                    module: &module,
                    entry_point: Some("fs_main"),
                    compilation_options: Default::default(),
                    targets: &[Some(wgpu::ColorTargetState {
                        format: self.format,
                        blend: Some(wgpu::BlendState::ALPHA_BLENDING),
                        write_mask: wgpu::ColorWrites::ALL,
                    })],
                }),
                multiview_mask: None,
                cache: None,
            })
    }
}

/// All themes, in display order. Built once at start-up.
pub fn create_all(ctx: &PipelineCtx) -> Vec<Box<dyn Theme>> {
    vec![Box::new(bars::Bars::new(ctx))]
}
