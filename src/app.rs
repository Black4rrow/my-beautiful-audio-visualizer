//! Application state and winit event handling: wires audio capture → analysis → theme → GPU,
//! and paces frames (vsync while visible, 15 fps after a few seconds of silence, nothing when hidden).

use std::sync::Arc;
use std::time::{Duration, Instant};

use winit::application::ApplicationHandler;
use winit::dpi::LogicalSize;
use winit::event::{ElementState, KeyEvent, WindowEvent};
use winit::event_loop::{ActiveEventLoop, ControlFlow};
use winit::keyboard::{Key, NamedKey};
use winit::window::{Fullscreen, Window, WindowId};

use crate::audio::analysis::Analyzer;
use crate::audio::capture::AudioCapture;
use crate::render::globals::Globals;
use crate::render::gpu::Gpu;
use crate::render::palette::PALETTES;
use crate::settings::Settings;
use crate::themes::{self, FrameCtx, PipelineCtx, Theme};

const SILENCE_ENERGY: f32 = 0.01;
const SILENCE_DELAY: f32 = 3.0;
const IDLE_FRAME: Duration = Duration::from_millis(66);
const BACKGROUND: wgpu::Color = wgpu::Color {
    r: 0.02,
    g: 0.02,
    b: 0.045,
    a: 1.0,
};

pub struct App {
    settings: Settings,
    state: Option<State>,
}

/// Exists once the window is created (winit only allows that inside `resumed`).
struct State {
    window: Arc<Window>,
    gpu: Gpu,
    globals: Globals,
    themes: Vec<Box<dyn Theme>>,
    current: usize,
    audio: Option<AudioCapture>,
    analyzer: Analyzer,
    last_frame: Instant,
    time: f32,
    hue_off: f32,
    silent_for: f32,
    visible: bool,
    next_frame: Option<Instant>,
}

impl App {
    pub fn new(settings: Settings) -> Self {
        Self {
            settings,
            state: None,
        }
    }

    fn init(&self, event_loop: &ActiveEventLoop) -> Result<State, String> {
        let attrs = Window::default_attributes()
            .with_title("Spectra")
            .with_inner_size(LogicalSize::new(1280.0, 720.0));
        let window = Arc::new(event_loop.create_window(attrs).map_err(|e| e.to_string())?);
        let gpu = Gpu::new(window.clone(), self.settings.low_power_gpu)?;
        let globals = Globals::new(&gpu.device, &gpu.queue, &self.settings.palette);
        let themes = themes::create_all(&PipelineCtx {
            device: &gpu.device,
            format: gpu.config.format,
            globals_layout: &globals.layout,
        });

        // No audio is not fatal: the app still opens and shows idle visuals.
        let audio = AudioCapture::start()
            .map_err(|e| eprintln!("audio capture unavailable: {e}"))
            .ok();
        let analyzer = Analyzer::new(audio.as_ref().map_or(48_000, |a| a.sample_rate));

        Ok(State {
            window,
            gpu,
            globals,
            themes,
            current: 0,
            audio,
            analyzer,
            last_frame: Instant::now(),
            time: 0.0,
            hue_off: 0.0,
            silent_for: 0.0,
            visible: true,
            next_frame: None,
        })
    }

    fn handle_key(&mut self, event_loop: &ActiveEventLoop, key: &Key) {
        let Some(state) = self.state.as_mut() else {
            return;
        };
        match key {
            Key::Named(NamedKey::Escape) if state.window.fullscreen().is_some() => {
                state.window.set_fullscreen(None)
            }
            Key::Named(NamedKey::Escape) => event_loop.exit(),
            Key::Named(NamedKey::F11) => toggle_fullscreen(&state.window),
            Key::Character(c) if c.eq_ignore_ascii_case("f") => toggle_fullscreen(&state.window),
            Key::Character(c) if c.eq_ignore_ascii_case("p") => {
                let i = PALETTES
                    .iter()
                    .position(|p| p.key == self.settings.palette)
                    .unwrap_or(0);
                self.settings.palette = PALETTES[(i + 1) % PALETTES.len()].key.into();
                state
                    .globals
                    .set_palette(&state.gpu.queue, &self.settings.palette);
                self.settings.save();
            }
            _ => {}
        }
    }
}

fn toggle_fullscreen(window: &Window) {
    let next = match window.fullscreen() {
        Some(_) => None,
        None => Some(Fullscreen::Borderless(None)),
    };
    window.set_fullscreen(next);
}

impl State {
    fn render(&mut self, settings: &Settings) {
        let now = Instant::now();
        let dt = (now - self.last_frame).as_secs_f32().min(0.05); // a stalled frame must not make things jump
        self.last_frame = now;
        self.time += dt;

        let ring = self.audio.as_ref().map(|a| &*a.ring);
        self.analyzer
            .update(ring, dt, self.time, settings.gain, settings.smoothing);
        let features = self.analyzer.features;
        self.hue_off =
            (self.hue_off + dt * settings.hue_speed * (0.3 + features.energy * 1.5)).fract();
        self.silent_for = if features.energy < SILENCE_ENERGY {
            self.silent_for + dt
        } else {
            0.0
        };

        let size = self.gpu.size();
        self.globals
            .write(&self.gpu.queue, size, self.time, self.hue_off, &features);
        let theme = &mut self.themes[self.current];
        theme.update(&FrameCtx {
            queue: &self.gpu.queue,
            levels: self.analyzer.levels(),
            settings,
            sample_rate: self.analyzer.sample_rate,
            size,
            scale: (self.window.scale_factor() as f32).clamp(1.0, 2.0),
            dt,
        });

        let frame = match self.gpu.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(f)
            | wgpu::CurrentSurfaceTexture::Suboptimal(f) => f,
            wgpu::CurrentSurfaceTexture::Outdated | wgpu::CurrentSurfaceTexture::Lost => {
                let (w, h) = (self.gpu.config.width, self.gpu.config.height);
                self.gpu.resize(w, h);
                return;
            }
            _ => return, // timeout, occluded or validation error: skip this frame
        };
        let view = frame
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());
        let mut encoder = self
            .gpu
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor { label: None });
        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("scene"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &view,
                    depth_slice: None,
                    resolve_target: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(BACKGROUND),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                timestamp_writes: None,
                occlusion_query_set: None,
                multiview_mask: None,
            });
            pass.set_bind_group(0, &self.globals.bind_group, &[]);
            theme.draw(&mut pass);
        }
        self.gpu.queue.submit([encoder.finish()]);
        self.window.pre_present_notify();
        self.gpu.queue.present(frame);
    }

    /// Asks for the next frame right away, later when silent, or not at all when hidden.
    fn schedule_next(&mut self) {
        if !self.visible {
            return;
        }
        if self.silent_for > SILENCE_DELAY {
            self.next_frame = Some(Instant::now() + IDLE_FRAME);
        } else {
            self.window.request_redraw();
        }
    }
}

impl ApplicationHandler for App {
    fn resumed(&mut self, event_loop: &ActiveEventLoop) {
        if self.state.is_some() {
            return;
        }
        match self.init(event_loop) {
            Ok(state) => self.state = Some(state),
            Err(e) => {
                eprintln!("startup failed: {e}");
                event_loop.exit();
            }
        }
    }

    fn window_event(&mut self, event_loop: &ActiveEventLoop, _: WindowId, event: WindowEvent) {
        match event {
            WindowEvent::CloseRequested => event_loop.exit(),
            WindowEvent::KeyboardInput {
                event:
                    KeyEvent {
                        logical_key,
                        state: ElementState::Pressed,
                        repeat: false,
                        ..
                    },
                ..
            } => self.handle_key(event_loop, &logical_key),
            WindowEvent::Resized(size) => {
                if let Some(state) = self.state.as_mut() {
                    // A minimized window reports 0x0: stop rendering until it comes back.
                    state.visible = size.width > 0 && size.height > 0;
                    state.gpu.resize(size.width, size.height);
                    state.window.request_redraw();
                }
            }
            WindowEvent::Occluded(occluded) => {
                if let Some(state) = self.state.as_mut() {
                    state.visible = !occluded;
                    state.window.request_redraw();
                }
            }
            WindowEvent::RedrawRequested => {
                if let Some(state) = self.state.as_mut().filter(|s| s.visible) {
                    state.render(&self.settings);
                    state.schedule_next();
                }
            }
            _ => {}
        }
    }

    fn about_to_wait(&mut self, event_loop: &ActiveEventLoop) {
        let Some(state) = self.state.as_mut() else {
            return;
        };
        match state.next_frame {
            Some(at) if Instant::now() >= at => {
                state.next_frame = None;
                state.window.request_redraw();
                event_loop.set_control_flow(ControlFlow::Wait);
            }
            Some(at) => event_loop.set_control_flow(ControlFlow::WaitUntil(at)),
            None => event_loop.set_control_flow(ControlFlow::Wait),
        }
    }
}
