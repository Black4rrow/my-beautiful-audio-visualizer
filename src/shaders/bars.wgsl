// Equalizer theme. One instance per bar, 4 quads per instance:
// 0 body, 1 reflection, 2 peak cap, 3 horizon segment. Disabled quads collapse to zero area.

struct Params {
    count: u32,
    flags: u32,
    gap: f32,
    base: f32,
    seg: f32,
    seg_gap: f32,
    scale: f32,
    _pad: f32,
};

const SEGMENTS: u32 = 1u;
const REFLECTION: u32 = 2u;
const PEAKS: u32 = 4u;

@group(1) @binding(0) var<uniform> params: Params;
// x: height px, y: peak px, z: palette position
@group(1) @binding(1) var<storage, read> bars: array<vec4<f32>>;

struct VsOut {
    @builtin(position) pos: vec4<f32>,
    @location(0) @interpolate(flat) kind: u32,
    @location(1) @interpolate(flat) t: f32,
    @location(2) v: f32, // 0 at the top of the quad, 1 at the bottom
};

fn has(flag: u32) -> bool {
    return (params.flags & flag) != 0u;
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32, @builtin(instance_index) bar: u32) -> VsOut {
    let corners = array<vec2<f32>, 6>(
        vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0),
        vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(1.0, 1.0),
    );
    let kind = vi / 6u;
    let c = corners[vi % 6u];
    let d = bars[bar];
    let slot = globals.resolution.x / f32(params.count);
    let width = max(1.0, slot * (1.0 - params.gap));
    var x0 = f32(bar) * slot + (slot - width) * 0.5;
    var w = width;
    var y0 = 0.0;
    var h = 0.0;
    let cap = max(2.0, 3.0 * params.scale);

    switch kind {
        case 0u: { y0 = params.base - d.x; h = d.x; }
        case 1u: {
            if has(REFLECTION) { y0 = params.base + 3.0 * params.scale; h = d.x * 0.6; }
        }
        case 2u: {
            if has(PEAKS) { y0 = params.base - d.y - cap * 2.5; h = cap; }
        }
        default: {
            x0 = f32(bar) * slot;
            w = slot;
            y0 = params.base + params.scale;
            h = params.scale;
        }
    }

    var out: VsOut;
    out.pos = px_to_clip(vec2(x0 + c.x * w, y0 + c.y * h));
    out.kind = kind;
    out.t = d.z;
    out.v = c.y;
    return out;
}

// True inside an LED gap, counting `dist` pixels away from the baseline.
fn in_gap(dist: f32) -> bool {
    return has(SEGMENTS) && (dist % (params.seg + params.seg_gap)) >= params.seg;
}

@fragment
fn fs_main(in: VsOut) -> @location(0) vec4<f32> {
    let y = in.pos.y;
    let c = palette(in.t);
    switch in.kind {
        case 0u: {
            if in_gap(params.base - y) { discard; }
            // Lighter towards the top, slightly transparent at the base.
            return vec4(mix(c, vec3(1.0), 0.35 * (1.0 - in.v)), mix(1.0, 0.85, in.v));
        }
        case 1u: {
            let top = params.base + 3.0 * params.scale;
            if in_gap(y - top) { discard; }
            let fade = mix(0.1, 1.0, clamp((y - params.base) / ((globals.resolution.y - params.base) * 0.75), 0.0, 1.0));
            return vec4(c, 0.28 * (1.0 - fade));
        }
        case 2u: {
            return vec4(mix(c, vec3(1.0), 0.6), 1.0);
        }
        default: {
            return vec4(palette(in.pos.x / globals.resolution.x * 0.85), 0.5);
        }
    }
}
