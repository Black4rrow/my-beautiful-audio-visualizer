// Shared declarations prepended to every theme shader (see render/globals.rs).

struct Globals {
    resolution: vec2<f32>,
    time: f32,
    hue_off: f32,
    bass: f32,
    mid: f32,
    high: f32,
    energy: f32,
    beat: f32,
};

@group(0) @binding(0) var<uniform> globals: Globals;
@group(0) @binding(1) var palette_tex: texture_2d<f32>;
@group(0) @binding(2) var palette_samp: sampler;

// Colour at position t (0..1, wraps) of the active palette, scrolled by the hue offset.
fn palette(t: f32) -> vec3<f32> {
    return textureSampleLevel(palette_tex, palette_samp, vec2<f32>(t + globals.hue_off, 0.5), 0.0).rgb;
}

// Pixel coordinates (origin top-left, y down, like the prototype's canvas) to clip space.
fn px_to_clip(p: vec2<f32>) -> vec4<f32> {
    let ndc = p / globals.resolution * 2.0 - 1.0;
    return vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
}
