//! Palettes (same stops as the web prototype) baked into a 256x1 texture. Palettes are cyclic
//! (last stop = first) and the sampler repeats, so scrolling the hue offset never shows a seam.

pub struct Palette {
    pub key: &'static str,
    pub stops: &'static [u32],
}

pub const PALETTES: &[Palette] = &[
    Palette {
        key: "rainbow",
        stops: &[
            0xff1a1a, 0xff8a00, 0xffe600, 0x3dff5a, 0x00e5ff, 0x2a6bff, 0xa63dff, 0xff2bd6,
            0xff1a1a,
        ],
    },
    Palette {
        key: "neon",
        stops: &[0xff00d4, 0x00f0ff, 0xff00d4],
    },
    Palette {
        key: "synth",
        stops: &[0xff2a6d, 0xd300c5, 0x7b2ff7, 0x05d9e8, 0xff2a6d],
    },
    Palette {
        key: "fire",
        stops: &[
            0xff1500, 0xff6a00, 0xffc400, 0xfff3a0, 0xffc400, 0xff6a00, 0xff1500,
        ],
    },
    Palette {
        key: "ocean",
        stops: &[
            0x0033ff, 0x00a2ff, 0x00ffd0, 0x8dff8a, 0x00ffd0, 0x00a2ff, 0x0033ff,
        ],
    },
    Palette {
        key: "aurora",
        stops: &[0x00ff9d, 0x00c3ff, 0x8a2bff, 0xff4fd8, 0x00ff9d],
    },
    Palette {
        key: "gold",
        stops: &[0xffd36b, 0xff8f3d, 0xb03dff, 0x3d6bff, 0xffd36b],
    },
];

const LUT_LEN: u32 = 256;

/// RGBA8 texels for `key`, falling back to the first palette for unknown keys.
fn lut(key: &str) -> Vec<u8> {
    let stops = PALETTES
        .iter()
        .find(|p| p.key == key)
        .unwrap_or(&PALETTES[0])
        .stops;
    let rgb = |c: u32| {
        [
            (c >> 16 & 255) as f32,
            (c >> 8 & 255) as f32,
            (c & 255) as f32,
        ]
    };
    let mut out = Vec::with_capacity(LUT_LEN as usize * 4);
    for i in 0..LUT_LEN {
        let t = i as f32 / (LUT_LEN - 1) as f32 * (stops.len() - 1) as f32;
        let k = (t as usize).min(stops.len() - 2);
        let f = t - k as f32;
        let (a, b) = (rgb(stops[k]), rgb(stops[k + 1]));
        for c in 0..3 {
            out.push((a[c] + (b[c] - a[c]) * f) as u8);
        }
        out.push(255);
    }
    out
}

pub fn create_texture(device: &wgpu::Device) -> wgpu::Texture {
    device.create_texture(&wgpu::TextureDescriptor {
        label: Some("palette"),
        size: wgpu::Extent3d {
            width: LUT_LEN,
            height: 1,
            depth_or_array_layers: 1,
        },
        mip_level_count: 1,
        sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format: wgpu::TextureFormat::Rgba8Unorm,
        usage: wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
        view_formats: &[],
    })
}

/// Uploads a palette. Only called at start-up and when the palette changes (1 KB).
pub fn upload(queue: &wgpu::Queue, texture: &wgpu::Texture, key: &str) {
    queue.write_texture(
        wgpu::TexelCopyTextureInfo {
            texture,
            mip_level: 0,
            origin: wgpu::Origin3d::ZERO,
            aspect: wgpu::TextureAspect::All,
        },
        &lut(key),
        wgpu::TexelCopyBufferLayout {
            offset: 0,
            bytes_per_row: Some(LUT_LEN * 4),
            rows_per_image: None,
        },
        wgpu::Extent3d {
            width: LUT_LEN,
            height: 1,
            depth_or_array_layers: 1,
        },
    );
}
