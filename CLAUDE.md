# Spectra

Real-time audio visualizer for Windows: captures what the PC is playing and renders animated themes
(Equalizer, Portal, Waves, Sphere, Nebula) with palettes and per-theme settings.

## Communication

- Reply to the user in **French**. Code, comments, docs, commit messages and UI text in **English**.
- Ask before adding a dependency, changing the architecture below, or deleting a feature.

## Project status

| Phase | State | What |
|---|---|---|
| 1. Web prototype | done | Single-file prototype. It is the **visual reference** for the native app. |
| 2. Split prototype | done | `web/`, one file per concern, mirroring the native layout. |
| 3. Native app | in progress | Rust + wgpu, Windows only. This is the product. Milestone 1 (window, loopback capture, analysis, Equalizer) on branch `native-m1`: builds and passes clippy in CI, **never run yet** (shaders are only validated at startup). |

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

**Build blocker on the work PC:** the company antivirus (WatchGuard) blocks running any freshly built `.exe`,
including Cargo build scripts, so `cargo build`/`check`/`clippy` fail with "Accès refusé (os error 5)".
Never try to work around it. Only `cargo fmt` works there. Compiling happens in GitHub Actions
(`.github/workflows/ci.yml`: fmt, clippy, release build, exe uploaded as the `spectra-windows` artifact).

**Before saying a change is done:** `cargo fmt`, `cargo clippy -- -D warnings`, `cargo build --release`,
and run the app once if the change is visible.

## Web prototype (`web/`)

- Open `web/spectra.html` directly in Chrome or Edge (double-click works). PC audio uses `getDisplayMedia` with system audio.
- Plain `<script src>` files sharing globals, no ES modules (they break on `file://`). Load order is in `spectra.html`:
  themes register before `settings.js` builds the defaults from their schemas.
- Shared globals: `S` settings, `A` audio graph and buffers, `F` audio features, `bands(n)`, `col(t, a, light)`,
  `g`/`W`/`H`/`DPR` scene canvas, `T` clock, `THEMES`/`THEME_KEYS`.
- **Adding a theme:** new `web/themes/<name>.js` calling `registerTheme()` (see `themes/registry.js`) + one
  `<script>` tag. Its params schema drives the defaults, the settings panel and persistence.
- **claude.ai artifact:** `python tools/build-artifact.py` bundles everything into `dist/spectra-artifact.html`
  (gitignored), then publish that file to https://claude.ai/artifact/UgNr4z9pkQhG5jjWG9ZozY (pass it as `url`).
  PC audio and mic are disabled there because the viewer blocks capture.

## File map

| Path | Role |
|---|---|
| `src/main.rs` | Entry point, event loop |
| `src/app.rs` | Window events, frame loop and pacing, keyboard (F/F11 fullscreen, P palette, Esc) |
| `src/settings.rs` | Settings struct, TOML load/save in %APPDATA%\Spectra |
| `src/audio/capture.rs` | WASAPI loopback via cpal → lock-free `SampleRing` |
| `src/audio/analysis.rs` | FFT, `BandMapper` (log bands), `Features` (bass, beat...) |
| `src/render/gpu.rs` | wgpu device, DX12 surface, resize |
| `src/render/globals.rs` | Bind group 0: per-frame globals + palette texture |
| `src/render/palette.rs` | Palette stops and 256x1 LUT upload |
| `src/themes/mod.rs` | `Theme` trait, `FrameCtx`, shared pipeline builder, registry |
| `src/themes/bars.rs` | Equalizer theme (CPU side) + its `BarsSettings` |
| `src/shaders/common.wgsl` | Globals, `palette()`, `px_to_clip()`; prepended to every theme shader |
| `src/shaders/bars.wgsl` | Equalizer: instanced quads generated in the vertex shader |
| `web/spectra.html` | Markup (dock, panel, start screen, guide popup) and script load order |
| `web/style.css` | All UI styles |
| `web/util.js` | `$`, `el()`, `toast()`, `TAU` |
| `web/settings.js` | Global params schema, defaults from all schemas, load/save (`S`) |
| `web/main.js` | Frame loop and boot |
| `web/audio/capture.js` | Sources (PC audio, mic, file, demo) → AnalyserNode, `readAudio()` |
| `web/audio/demo.js` | Synthetic spectrum for demo mode |
| `web/audio/analysis.js` | `bands(n)` log bands, `analyse()` → `F` (bass, beat...) |
| `web/render/palette.js` | Palettes, LUT, `col()` |
| `web/render/canvas.js` | Canvases, resize, trail fade, compose + bloom |
| `web/themes/registry.js` | `registerTheme()` and the theme contract |
| `web/themes/{bars,radial,waves,sphere,nebula}.js` | One theme each |
| `web/ui/panel.js` | Settings panel built from schemas |
| `web/ui/dock.js` | Bottom dock, theme/palette switching, fullscreen |
| `web/ui/start.js` | Start screen, PC audio guide, source availability |
| `web/ui/input.js` | Keyboard shortcuts, idle auto-hide |
| `.github/workflows/ci.yml` | Windows CI: fmt, clippy, release build, uploads `spectra.exe` |
| `tools/build-artifact.py` | Bundles `web/` into `dist/spectra-artifact.html` |
| `.claude/launch.json` | Local server (`python -m http.server 8765`) serving the repo root |
