//! wgpu device, queue and window surface. Owns the surface configuration and handles resizes.

use std::sync::Arc;

use winit::window::Window;

pub struct Gpu {
    pub surface: wgpu::Surface<'static>,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub config: wgpu::SurfaceConfiguration,
}

impl Gpu {
    pub fn new(window: Arc<Window>, low_power: bool) -> Result<Self, String> {
        let mut desc = wgpu::InstanceDescriptor::new_without_display_handle();
        // DX12 only: one backend loaded means less memory and a faster start than probing all of them.
        desc.backends = wgpu::Backends::DX12;
        let instance = wgpu::Instance::new(desc);
        let size = window.inner_size();
        let surface = instance.create_surface(window).map_err(|e| e.to_string())?;

        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: if low_power {
                wgpu::PowerPreference::LowPower
            } else {
                wgpu::PowerPreference::HighPerformance
            },
            force_fallback_adapter: false,
            compatible_surface: Some(&surface),
            apply_limit_buckets: false,
        }))
        .map_err(|e| e.to_string())?;

        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
            label: Some("spectra"),
            required_limits: wgpu::Limits::downlevel_defaults().using_resolution(adapter.limits()),
            memory_hints: wgpu::MemoryHints::MemoryUsage,
            ..Default::default()
        }))
        .map_err(|e| e.to_string())?;

        let caps = surface.get_capabilities(&adapter);
        // A non-sRGB format keeps blending in gamma space, which is what the prototype's canvas does.
        let format = caps
            .formats
            .iter()
            .copied()
            .find(|f| !f.is_srgb())
            .unwrap_or(caps.formats[0]);
        let mut config = surface
            .get_default_config(&adapter, size.width.max(1), size.height.max(1))
            .ok_or("surface not supported by the adapter")?;
        config.format = format;
        config.present_mode = wgpu::PresentMode::Fifo; // vsync: never renders faster than the display
        config.desired_maximum_frame_latency = 2;
        surface.configure(&device, &config);

        Ok(Self {
            surface,
            device,
            queue,
            config,
        })
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        if width == 0 || height == 0 {
            return;
        }
        self.config.width = width;
        self.config.height = height;
        self.surface.configure(&self.device, &self.config);
    }

    pub fn size(&self) -> (f32, f32) {
        (self.config.width as f32, self.config.height as f32)
    }
}
