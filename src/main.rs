//! Spectra entry point: loads settings and runs the winit event loop.

// Release builds are GUI apps (no console window); debug builds keep the console for logs.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod audio;
mod render;
mod settings;
mod themes;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let event_loop = winit::event_loop::EventLoop::new()?;
    let mut app = app::App::new(settings::Settings::load());
    event_loop.run_app(&mut app)?;
    Ok(())
}
