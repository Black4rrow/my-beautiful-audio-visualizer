//! User settings, persisted as TOML in %APPDATA%\Spectra\settings.toml. Missing keys fall back
//! to defaults, so older files keep working. Theme settings are declared in each theme's module.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::themes::bars::BarsSettings;

#[derive(Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct Settings {
    /// Key of a palette in `render::palette::PALETTES`.
    pub palette: String,
    /// Input gain applied to the spectrum ("Sensitivity" in the prototype).
    pub gain: f32,
    /// Release smoothing of the bands, 0 (snappy) to 0.95 (slow).
    pub smoothing: f32,
    /// Palette scrolling speed.
    pub hue_speed: f32,
    /// Prefer the integrated GPU: lower power and memory use, plenty for these themes.
    pub low_power_gpu: bool,
    pub bars: BarsSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            palette: "rainbow".into(),
            gain: 1.2,
            smoothing: 0.72,
            hue_speed: 0.04,
            low_power_gpu: true,
            bars: BarsSettings::default(),
        }
    }
}

fn path() -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|d| PathBuf::from(d).join("Spectra").join("settings.toml"))
}

impl Settings {
    /// Loads the settings file, creating it with defaults on first run so it can be edited by hand.
    pub fn load() -> Self {
        let Some(path) = path() else {
            return Self::default();
        };
        match std::fs::read_to_string(&path) {
            Ok(text) => toml::from_str(&text).unwrap_or_else(|e| {
                eprintln!("invalid {}: {e}; using defaults", path.display());
                Self::default()
            }),
            Err(_) => {
                let settings = Self::default();
                settings.save();
                settings
            }
        }
    }

    pub fn save(&self) {
        let Some(path) = path() else { return };
        let result = path
            .parent()
            .map_or(Ok(()), std::fs::create_dir_all)
            .and_then(|_| std::fs::write(&path, toml::to_string_pretty(self).unwrap_or_default()));
        if let Err(e) = result {
            eprintln!("could not save {}: {e}", path.display());
        }
    }
}
