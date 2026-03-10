use base64::Engine;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::time::Duration;
use tauri::Manager;

const HITMOS_BASE_URL: &str = "https://rus.hitmotop.com";
const MAX_PARSED_TRACKS_PER_PAGE: usize = 240;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HitmosTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub cover_url: String,
    pub audio_url: String,
    pub duration: u32,
    pub source_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub local_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrackBlobResult {
    pub mime_type: String,
    pub base64_data: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDownloadEntry {
    pub track_id: String,
    pub local_path: String,
}

#[derive(Debug, Deserialize)]
struct HitmosMeta {
    artist: String,
    title: String,
    url: String,
    img: String,
    id: String,
}

fn parse_duration(duration_text: &str) -> u32 {
    let mut parts = duration_text.trim().split(':');
    let minutes = parts
        .next()
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(0);
    let seconds = parts
        .next()
        .and_then(|value| value.parse::<u32>().ok())
        .unwrap_or(0);
    minutes.saturating_mul(60).saturating_add(seconds.min(59))
}

fn to_absolute_url(url: &str) -> String {
    if url.starts_with("http://") || url.starts_with("https://") {
        return url.to_string();
    }

    if url.starts_with("//") {
        return format!("https:{url}");
    }

    if url.starts_with('/') {
        return format!("{HITMOS_BASE_URL}{url}");
    }

    format!("{HITMOS_BASE_URL}/{url}")
}

fn sanitize_track_id(track_id: &str) -> String {
    let sanitized: String = track_id
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-' || *ch == '_')
        .collect();

    if sanitized.is_empty() {
        "track".to_string()
    } else {
        sanitized
    }
}

fn build_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) PinguMusic/1.0")
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))
}

fn parse_tracks_from_html(html: &str) -> Vec<HitmosTrack> {
    let document = Html::parse_document(html);
    let item_selector = Selector::parse("li.tracks__item.track.mustoggler").expect("valid selector");
    let duration_selector = Selector::parse(".track__fulltime").expect("valid selector");
    let source_selector = Selector::parse("a.track__info-l").expect("valid selector");
    let download_selector = Selector::parse("a.track__download-btn").expect("valid selector");

    let mut dedupe = HashSet::new();
    let mut tracks = Vec::new();

    for item in document.select(&item_selector).take(MAX_PARSED_TRACKS_PER_PAGE) {
        let Some(meta_json) = item.value().attr("data-musmeta") else {
            continue;
        };

        let Ok(meta) = serde_json::from_str::<HitmosMeta>(meta_json) else {
            continue;
        };

        let track_id = meta.id.trim_start_matches("track-id-").to_string();

        if track_id.is_empty() || !dedupe.insert(track_id.clone()) {
            continue;
        }

        let duration = item
            .select(&duration_selector)
            .next()
            .map(|node| node.text().collect::<String>())
            .map(|value| parse_duration(&value))
            .unwrap_or(0);

        let source_url = item
            .select(&source_selector)
            .next()
            .and_then(|anchor| anchor.value().attr("href"))
            .map(to_absolute_url)
            .unwrap_or_else(|| {
                format!("{HITMOS_BASE_URL}/search?q={}", urlencoding::encode(&meta.title))
            });

        let audio_url = item
            .select(&download_selector)
            .next()
            .and_then(|anchor| anchor.value().attr("href"))
            .map(to_absolute_url)
            .unwrap_or_else(|| to_absolute_url(&meta.url));

        tracks.push(HitmosTrack {
            id: track_id,
            title: meta.title,
            artist: meta.artist,
            cover_url: to_absolute_url(&meta.img),
            audio_url,
            duration,
            source_url,
        });
    }

    tracks
}

async fn fetch_html(url: &str) -> Result<String, String> {
    let client = build_http_client()?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Hitmos request failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Hitmos returned an error status: {error}"))?;

    response
        .text()
        .await
        .map_err(|error| format!("Failed to read Hitmos response body: {error}"))
}

async fn fetch_track_bytes(audio_url: &str) -> Result<Vec<u8>, String> {
    let client = build_http_client()?;
    client
        .get(audio_url)
        .header(reqwest::header::REFERER, HITMOS_BASE_URL)
        .header(reqwest::header::ORIGIN, HITMOS_BASE_URL)
        .send()
        .await
        .map_err(|error| format!("Track request failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Track request returned an error status: {error}"))?
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|error| format!("Failed to read track payload: {error}"))
}

fn to_track_blob(bytes: Vec<u8>) -> TrackBlobResult {
    let base64_data = base64::engine::general_purpose::STANDARD.encode(bytes);
    TrackBlobResult {
        mime_type: "audio/mpeg".to_string(),
        base64_data,
    }
}

#[tauri::command]
pub async fn get_popular_hitmos() -> Result<Vec<HitmosTrack>, String> {
    let html = fetch_html(HITMOS_BASE_URL).await?;
    Ok(parse_tracks_from_html(&html))
}

#[tauri::command]
pub async fn search_hitmos(query: String) -> Result<Vec<HitmosTrack>, String> {
    let normalized_query = query.trim();

    if normalized_query.is_empty() {
        return get_popular_hitmos().await;
    }

    let url = format!(
        "{HITMOS_BASE_URL}/search?q={}",
        urlencoding::encode(normalized_query)
    );

    let html = fetch_html(&url).await?;
    Ok(parse_tracks_from_html(&html))
}

#[tauri::command]
pub async fn save_hitmos_track(
    app: tauri::AppHandle,
    track_id: String,
    audio_url: String,
) -> Result<DownloadResult, String> {
    let normalized_url = audio_url.trim();

    if normalized_url.is_empty() {
        return Err("Audio URL is empty".to_string());
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;

    let downloads_dir = app_data_dir.join("downloads");
    fs::create_dir_all(&downloads_dir)
        .map_err(|error| format!("Failed to create downloads directory: {error}"))?;

    let file_name = format!("{}.mp3", sanitize_track_id(&track_id));
    let target_path = downloads_dir.join(file_name);

    if target_path.exists() {
        return Ok(DownloadResult {
            local_path: target_path.to_string_lossy().to_string(),
        });
    }

    let bytes = fetch_track_bytes(normalized_url).await?;

    fs::write(&target_path, &bytes)
        .map_err(|error| format!("Failed to write track file: {error}"))?;

    Ok(DownloadResult {
        local_path: target_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn get_hitmos_track_blob(audio_url: String) -> Result<TrackBlobResult, String> {
    let normalized_url = audio_url.trim();

    if normalized_url.is_empty() {
        return Err("Audio URL is empty".to_string());
    }

    let bytes = fetch_track_bytes(normalized_url).await?;
    Ok(to_track_blob(bytes))
}

#[tauri::command]
pub fn get_local_track_blob(local_path: String) -> Result<TrackBlobResult, String> {
    let normalized_path = local_path.trim();

    if normalized_path.is_empty() {
        return Err("Local path is empty".to_string());
    }

    let path = Path::new(normalized_path);

    if !path.exists() {
        return Err(format!("Local file does not exist: {normalized_path}"));
    }

    let bytes = fs::read(path).map_err(|error| format!("Failed to read local track file: {error}"))?;
    Ok(to_track_blob(bytes))
}

#[tauri::command]
pub fn delete_local_track(local_path: String) -> Result<(), String> {
    let normalized_path = local_path.trim();

    if normalized_path.is_empty() {
        return Ok(());
    }

    let path = Path::new(normalized_path);

    if !path.exists() {
        return Ok(());
    }

    fs::remove_file(path).map_err(|error| format!("Failed to delete local track file: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn list_local_downloads(app: tauri::AppHandle) -> Result<Vec<LocalDownloadEntry>, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Failed to resolve app data directory: {error}"))?;
    let downloads_dir = app_data_dir.join("downloads");

    if !downloads_dir.exists() {
        return Ok(Vec::new());
    }

    let mut downloads = Vec::new();

    for entry in fs::read_dir(&downloads_dir)
        .map_err(|error| format!("Failed to read downloads directory: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Failed to read download entry: {error}"))?;
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let Some(extension) = path.extension().and_then(|extension| extension.to_str()) else {
            continue;
        };

        if !extension.eq_ignore_ascii_case("mp3") {
            continue;
        }

        let Some(track_id) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };

        downloads.push(LocalDownloadEntry {
            track_id: track_id.to_string(),
            local_path: path.to_string_lossy().to_string(),
        });
    }

    downloads.sort_by(|left, right| left.track_id.cmp(&right.track_id));
    Ok(downloads)
}
