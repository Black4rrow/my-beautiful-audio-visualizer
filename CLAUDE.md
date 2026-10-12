# Spectra

Real-time audio visualizer for Windows: captures what the PC is playing and renders animated themes
(Equalizer, Portal, Waves, Sphere, Nebula) with palettes and per-theme settings.

## Communication

- Reply to the user in **French**. Code, comments, docs, commit messages and UI text in **English**.
- Ask before adding a dependency, changing the architecture below, or deleting a feature.

## Project status

| Phase | State | What |
|---|---|---|
| 1. Web prototype | done | `spectra.html`, a single file. It is the **visual reference** for the native app. |
| 2. Split prototype | todo | Split into files mirroring the native layout (see "Web prototype"). |
| 3. Native app | todo | Rust + wgpu, Windows only. This is the product. |

New features go into the native app once it exists. The prototype only gets fixes and visual experiments.

## Engineering rules (all phases)

**Readable and cheap to read.** Every session pays tokens for each file opened, so:
- One responsibility per file, ideally under 300 lines. Name files after what they do.
- Start each file with a 1-2 line comment stating its role, so a quick look is enough to know if it matters.
- Comments explain *why*, never restate the code. No commented-out code, no dead code, no duplicate helpers.
- Keep the **File map** below up to date when adding, moving or deleting a file. Use it instead of searching.
- Declare data once: theme parameters, palettes and defaults live in one schema that drives
  the settings UI, persistence and defaults. Never hard-code the same list in two places.

**Performance is a feature.** It runs all day in the background, so RAM, VRAM, CPU and GPU usage matter as much as looks.
- No heap allocation in hot paths (audio callback, per-frame update, render). Preallocate and reuse buffers.
- Audio → render handoff is lock-free (atomic / triple buffer). The audio thread never waits on the render thread.
- Do work at the lowest rate that looks right: analysis once per frame, not per draw; static data uploaded once.
- Prefer computing geometry on the GPU (vertex/compute shaders from a small band buffer) over building it on the CPU.
- Stop rendering when nothing is visible (minimized, occluded, wallpaper covered by a fullscreen app).
  Drop to a low frame rate after a few seconds of silence.
- Any change to rendering or audio states its expected cost. If it adds a render target, a pass,
  a texture or a per-frame allocation, say so and justify it.

## Native app (phase 3)

**Stack:** Rust (stable), `winit` (window), `wgpu` (rendering, WGSL shaders), `cpal` (WASAPI loopback capture),
`realfft` (FFT), `serde` + `toml` (settings). Settings UI: decide when we get there (egui is the candidate,
drawn only while the panel is open). Any other crate needs a reason and the user's approval.

**Display modes:** window / fullscreen, and animated desktop wallpaper (rendered behind the desktop icons via the
`WorkerW` window). Both share the same renderer; only the window setup differs.

**Planned layout:**
```
src/
  main.rs            entry point, CLI flags, event loop
  app.rs             app state, wires audio → themes → renderer
  settings.rs        schema, defaults, load/save (%APPDATA%\Spectra\settings.toml)
  audio/capture.rs   WASAPI loopback on its own thread
  audio/analysis.rs  FFT, log bands, bass/mid/high, beat detection → AudioFrame
  render/gpu.rs      device, surface, resize
  render/post.rs     trail + bloom passes
  render/palette.rs  256x1 palette LUT texture
  themes/mod.rs      Theme trait + registry
  themes/<name>.rs   one file per theme
  shaders/<name>.wgsl
  platform/wallpaper.rs  WorkerW embedding, fullscreen-app detection
  ui/                settings panel
```
**Adding a theme:** one `themes/<name>.rs` + one shader, register it in `themes/mod.rs`, declare its params in the
theme's schema. Nothing else should need to change.

**GPU budget rules:**
- One draw call per theme layer (instancing). Uniform/storage updates per frame stay in the kilobytes.
- Bloom at 1/4 resolution with a fixed number of passes. Render targets are created once and rebuilt only on resize.
- No MSAA by default (anti-alias in shaders). Use `Rgba8` targets unless HDR is actually needed.
- Default to `PowerPreference::LowPower`. Expose the choice and an FPS cap (30 / 60 / display) in settings.

**Targets** (1080p, measured in Task Manager in release builds): RAM < 50 MB, VRAM < 64 MB, CPU < 3 %.
These are targets: measure before claiming them.

**Build profile:** `[profile.release]` with `lto = "thin"`, `codegen-units = 1`, `panic = "abort"`, `strip = true`.

**Before saying a change is done:** `cargo fmt`, `cargo clippy -- -D warnings`, `cargo build --release`,
and run the app once if the change is visible.

## Web prototype (phases 1-2)

- Open `spectra.html` directly in Chrome or Edge. PC audio uses `getDisplayMedia` with system audio.
- `spectra-artifact.html` is the copy published as a claude.ai artifact (no `<html>/<head>/<body>` tags,
  PC audio and mic disabled because the viewer blocks them). Regenerate it from the main file; never edit it by hand.
- Phase 2 split: plain `<script src>` files (not ES modules, so double-clicking the HTML still works from `file://`),
  folders mirroring the native layout: `web/audio/`, `web/render/`, `web/themes/`, `web/ui/`, `web/settings.js`.

## File map

| Path | Role |
|---|---|
| `spectra.html` | Whole web prototype: audio capture, analysis, 5 themes, settings UI |
| `spectra-artifact.html` | Generated artifact copy of `spectra.html` |
| `.claude/launch.json` | Local preview server (`python -m http.server 8765`) |
