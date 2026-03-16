use crate::hitmos::{
    encode_track_id, find_existing_download, is_supported_audio_extension, DownloadResult,
    DOWNLOAD_FILE_PREFIX,
};
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;

const SOUNDCLOUD_SEARCH_LIMIT: usize = 20;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundcloudTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub cover_url: String,
    pub audio_url: String,
    pub duration: u32,
    pub source_url: String,
}

fn yt_dlp_error(error: std::io::Error) -> String {
    match error.kind() {
        std::io::ErrorKind::NotFound => {
            "yt-dlp was not found in PATH. Install yt-dlp and restart the app.".to_string()
        }
        std::io::ErrorKind::PermissionDenied => {
            "yt-dlp exists but could not be executed due to a permissions error.".to_string()
        }
        _ => format!("Failed to run yt-dlp: {error}"),
    }
}

fn run_yt_dlp(args: &[String]) -> Result<std::process::Output, String> {
    Command::new("yt-dlp")
        .args(args)
        .output()
        .map_err(yt_dlp_error)
}

fn output_to_error(output: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if !stderr.is_empty() {
        return stderr;
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if !stdout.is_empty() {
        return stdout;
    }

    "yt-dlp failed without output".to_string()
}

fn read_string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_default()
        .to_string()
}

fn read_first_string_field(value: &Value, keys: &[&str]) -> String {
    keys.iter()
        .map(|key| read_string_field(value, key))
        .find(|value| !value.is_empty())
        .unwrap_or_default()
}

fn read_u64_field(value: &Value, key: &str) -> u64 {
    value.get(key).and_then(Value::as_u64).unwrap_or_default()
}

fn get_thumbnail_variant_score(value: &str) -> i64 {
    let normalized = value.trim().to_ascii_lowercase();

    if normalized.contains("default_avatar") {
        return 1;
    }

    if normalized.contains("original") {
        return 100;
    }

    if normalized.contains("t500x500") {
        return 90;
    }

    if normalized.contains("crop") {
        return 80;
    }

    if normalized.contains("t300x300") {
        return 70;
    }

    if normalized.contains("large") {
        return 60;
    }

    if normalized.contains("t67x67") {
        return 50;
    }

    if normalized.contains("badge") {
        return 40;
    }

    if normalized.contains("small") {
        return 30;
    }

    if normalized.contains("tiny") {
        return 20;
    }

    if normalized.contains("mini") {
        return 10;
    }

    0
}

fn read_thumbnail(value: &Value) -> String {
    let mut candidates = Vec::new();

    for key in ["thumbnail", "artwork_url"] {
        let candidate = read_string_field(value, key);

        if !candidate.is_empty() {
            candidates.push((candidate, i64::MAX / 4));
        }
    }

    if let Some(thumbnails) = value.get("thumbnails").and_then(Value::as_array) {
        for item in thumbnails {
            let url = read_string_field(item, "url");

            if url.is_empty() {
                continue;
            }

            let preference = item
                .get("preference")
                .and_then(Value::as_i64)
                .unwrap_or_default();
            let area = read_u64_field(item, "width").saturating_mul(read_u64_field(item, "height"));
            let variant = read_string_field(item, "id");
            let score = preference.saturating_mul(1_000_000)
                + i64::try_from(area).unwrap_or(i64::MAX / 8)
                + get_thumbnail_variant_score(&variant).saturating_mul(1_000)
                + get_thumbnail_variant_score(&url);

            candidates.push((url, score));
        }
    }

    candidates.sort_by(|left, right| right.1.cmp(&left.1).then_with(|| left.0.cmp(&right.0)));
    candidates
        .into_iter()
        .map(|(url, _)| url)
        .next()
        .unwrap_or_default()
}

fn read_duration(value: &Value) -> u32 {
    if let Some(duration) = value.get("duration").and_then(Value::as_u64) {
        return duration.min(u32::MAX as u64) as u32;
    }

    if let Some(duration) = value.get("duration").and_then(Value::as_f64) {
        return duration.max(0.0).min(u32::MAX as f64) as u32;
    }

    0
}

fn parse_search_results(payload: &[u8]) -> Result<Vec<SoundcloudTrack>, String> {
    let value: Value = serde_json::from_slice(payload)
        .map_err(|error| format!("Failed to parse yt-dlp search response: {error}"))?;
    let entries = value
        .get("entries")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut tracks = Vec::new();

    for entry in entries {
        let id = read_string_field(&entry, "id");
        let title = read_string_field(&entry, "title");
        let source_url = read_first_string_field(&entry, &["webpage_url", "url", "original_url"]);

        if id.is_empty() || title.is_empty() || source_url.is_empty() {
            continue;
        }

        tracks.push(SoundcloudTrack {
            id,
            title,
            artist: read_first_string_field(&entry, &["artist", "uploader", "channel", "creator"]),
            cover_url: read_thumbnail(&entry),
            audio_url: source_url.clone(),
            duration: read_duration(&entry),
            source_url,
        });
    }

    Ok(tracks)
}

fn parse_stream_url(output: &std::process::Output) -> Result<String, String> {
    let stdout = String::from_utf8_lossy(&output.stdout);

    stdout
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| "yt-dlp did not return a playable URL".to_string())
}

fn prefixed_output_template(downloads_dir: &Path, track_id: &str) -> String {
    let encoded_track_id = encode_track_id(track_id);
    let file_name = format!("{DOWNLOAD_FILE_PREFIX}{encoded_track_id}.%(ext)s");
    downloads_dir.join(file_name).to_string_lossy().to_string()
}

fn find_new_download(downloads_dir: &Path, track_id: &str) -> Option<PathBuf> {
    if let Some(path) = find_existing_download(downloads_dir, track_id) {
        return Some(path);
    }

    let encoded_track_id = encode_track_id(track_id);
    let expected_stem = format!("{DOWNLOAD_FILE_PREFIX}{encoded_track_id}");
    let mut matches = Vec::new();

    for entry in fs::read_dir(downloads_dir).ok()?.flatten() {
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
            continue;
        };

        if !is_supported_audio_extension(extension) {
            continue;
        }

        let Some(stem) = path.file_stem().and_then(|value| value.to_str()) else {
            continue;
        };

        if stem == expected_stem {
            matches.push(path);
        }
    }

    matches.sort();
    matches.pop()
}

#[tauri::command]
pub async fn search_soundcloud(query: String) -> Result<Vec<SoundcloudTrack>, String> {
    let normalized_query = query.trim();

    if normalized_query.is_empty() {
        return Ok(Vec::new());
    }

    let search_query = format!("scsearch{SOUNDCLOUD_SEARCH_LIMIT}:{normalized_query}");
    let args = vec![
        "--ignore-config".to_string(),
        "--no-warnings".to_string(),
        "--flat-playlist".to_string(),
        "--skip-download".to_string(),
        "--dump-single-json".to_string(),
        search_query,
    ];
    let output = run_yt_dlp(&args)?;

    if !output.status.success() {
        return Err(output_to_error(&output));
    }

    parse_search_results(&output.stdout)
}

#[tauri::command]
pub async fn resolve_soundcloud_stream(source_url: String) -> Result<String, String> {
    let normalized_url = source_url.trim();

    if normalized_url.is_empty() {
        return Err("SoundCloud source URL is empty".to_string());
    }

    let args = vec![
        "--ignore-config".to_string(),
        "--no-warnings".to_string(),
        "--no-playlist".to_string(),
        "--format".to_string(),
        "bestaudio/best".to_string(),
        "--get-url".to_string(),
        normalized_url.to_string(),
    ];
    let output = run_yt_dlp(&args)?;

    if !output.status.success() {
        return Err(output_to_error(&output));
    }

    parse_stream_url(&output)
}

#[tauri::command]
pub async fn save_soundcloud_track(
    app: tauri::AppHandle,
    track_id: String,
    source_url: String,
    title: String,
    artist: String,
) -> Result<DownloadResult, String> {
    let normalized_url = source_url.trim();
    let _ = (&title, &artist);

    if normalized_url.is_empty() {
        return Err("SoundCloud source URL is empty".to_string());
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let downloads_dir = app_data_dir.join("downloads");
    fs::create_dir_all(&downloads_dir)
        .map_err(|error| format!("Failed to create downloads directory: {error}"))?;

    if let Some(existing_path) = find_existing_download(&downloads_dir, &track_id) {
        return Ok(DownloadResult {
            local_path: existing_path.to_string_lossy().to_string(),
        });
    }

    let output_template = prefixed_output_template(&downloads_dir, &track_id);
    let args = vec![
        "--ignore-config".to_string(),
        "--no-warnings".to_string(),
        "--no-progress".to_string(),
        "--no-playlist".to_string(),
        "--format".to_string(),
        "bestaudio/best".to_string(),
        "--output".to_string(),
        output_template,
        normalized_url.to_string(),
    ];
    let output = run_yt_dlp(&args)?;

    if !output.status.success() {
        return Err(output_to_error(&output));
    }

    let local_path = find_new_download(&downloads_dir, &track_id)
        .ok_or_else(|| "yt-dlp completed but no downloaded audio file was found".to_string())?;

    Ok(DownloadResult {
        local_path: local_path.to_string_lossy().to_string(),
    })
}
