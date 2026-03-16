use crate::hitmos::{
    encode_track_id, find_existing_download, DownloadResult, TrackBlobResult, DOWNLOAD_FILE_PREFIX,
};
use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use scraper::{Html, Selector};
use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::time::Duration;
use tauri::Manager;

const LMUSIC_BASE_URL: &str = "https://lmusic.kz";
const MAX_PARSED_TRACKS_PER_PAGE: usize = 240;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LmusicTrack {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub cover_url: String,
    pub audio_url: String,
    pub duration: u32,
    pub source_url: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LmusicArtistMetadata {
    pub name: String,
    pub slug: String,
    pub tags: Vec<String>,
    pub image_url: Option<String>,
    pub description: Option<String>,
    pub source_url: String,
}

#[derive(Clone, Debug)]
struct LmusicArtistCandidate {
    slug: String,
    name: String,
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
        return format!("{LMUSIC_BASE_URL}{url}");
    }

    format!("{LMUSIC_BASE_URL}/{url}")
}

fn normalize_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn normalize_lookup_text(value: &str) -> String {
    normalize_whitespace(
        &value
            .to_lowercase()
            .chars()
            .map(|char| if char.is_alphanumeric() { char } else { ' ' })
            .collect::<String>(),
    )
}

fn get_token_similarity(left: &str, right: &str) -> f32 {
    let left_tokens = normalize_lookup_text(left)
        .split_whitespace()
        .map(str::to_string)
        .collect::<HashSet<_>>();
    let right_tokens = normalize_lookup_text(right)
        .split_whitespace()
        .map(str::to_string)
        .collect::<HashSet<_>>();

    if left_tokens.is_empty() || right_tokens.is_empty() {
        return 0.0;
    }

    let intersection = left_tokens.intersection(&right_tokens).count() as f32;
    intersection / left_tokens.len().max(right_tokens.len()) as f32
}

fn score_artist_candidate(target_name: &str, candidate_name: &str) -> f32 {
    let normalized_target = normalize_lookup_text(target_name);
    let normalized_candidate = normalize_lookup_text(candidate_name);

    if normalized_target.is_empty() || normalized_candidate.is_empty() {
        return 0.0;
    }

    if normalized_target == normalized_candidate {
        return 200.0;
    }

    let contains_match = normalized_target.contains(&normalized_candidate)
        || normalized_candidate.contains(&normalized_target);
    let token_similarity = get_token_similarity(&normalized_target, &normalized_candidate);
    let mut score = token_similarity * 100.0;

    if contains_match {
        score += 25.0;
    }

    if normalized_candidate.starts_with(&normalized_target)
        || normalized_target.starts_with(&normalized_candidate)
    {
        score += 10.0;
    }

    score
}

fn build_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) PinguMusic/1.0")
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))
}

fn to_track_blob(bytes: Vec<u8>, mime_type: &str) -> TrackBlobResult {
    TrackBlobResult {
        mime_type: mime_type.to_string(),
        base64_data: STANDARD.encode(bytes),
    }
}

fn parse_tracks_from_html(html: &str) -> Vec<LmusicTrack> {
    let document = Html::parse_document(html);
    let item_selector = Selector::parse("div.c-card-mp3.js-item-mp3").expect("valid selector");
    let cover_selector = Selector::parse("img.c-card-mp3__cover").expect("valid selector");
    let duration_selector = Selector::parse(".c-card-mp3__duration").expect("valid selector");

    let mut dedupe = HashSet::new();
    let mut tracks = Vec::new();

    for item in document
        .select(&item_selector)
        .take(MAX_PARSED_TRACKS_PER_PAGE)
    {
        let track_id = item
            .value()
            .attr("data-mp3_id")
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or_default()
            .to_string();

        if track_id.is_empty() || !dedupe.insert(track_id.clone()) {
            continue;
        }

        let title = item
            .value()
            .attr("data-song_name")
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or_default()
            .to_string();
        let artist = item
            .value()
            .attr("data-artist_name")
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or_default()
            .to_string();

        if title.is_empty() || artist.is_empty() {
            continue;
        }

        let cover_url = item
            .value()
            .attr("data-cover_url")
            .or_else(|| {
                item.select(&cover_selector)
                    .next()
                    .and_then(|cover| cover.value().attr("data-src"))
            })
            .map(to_absolute_url)
            .unwrap_or_default();
        let source_url = item
            .value()
            .attr("data-url")
            .map(to_absolute_url)
            .unwrap_or_else(|| {
                format!("{LMUSIC_BASE_URL}/search?q={}", urlencoding::encode(&title))
            });
        let audio_url = item
            .value()
            .attr("data-src_url")
            .map(to_absolute_url)
            .unwrap_or_default();
        let duration = item
            .select(&duration_selector)
            .next()
            .map(|node| node.text().collect::<String>())
            .map(|value| parse_duration(&value))
            .unwrap_or(0);

        tracks.push(LmusicTrack {
            id: track_id,
            title,
            artist,
            cover_url,
            audio_url,
            duration,
            source_url,
        });
    }

    tracks
}

fn parse_artist_candidates_from_search_html(html: &str) -> Vec<LmusicArtistCandidate> {
    let document = Html::parse_document(html);
    let item_selector = Selector::parse("div.c-card-mp3.js-item-mp3").expect("valid selector");
    let artist_link_selector =
        Selector::parse(".c-card-mp3__title-artist a[href^='/artist/']").expect("valid selector");

    let mut seen_slugs = HashSet::new();
    let mut candidates = Vec::new();

    for item in document.select(&item_selector) {
        for artist_link in item.select(&artist_link_selector) {
            let href = artist_link.value().attr("href").unwrap_or("").trim();
            let slug = href
                .trim_start_matches("/artist/")
                .trim_matches('/')
                .trim()
                .to_string();
            let name = normalize_whitespace(&artist_link.text().collect::<String>());

            if slug.is_empty() || name.is_empty() || !seen_slugs.insert(slug.clone()) {
                continue;
            }

            candidates.push(LmusicArtistCandidate { slug, name });
        }
    }

    candidates
}

fn select_best_artist_candidate(
    artist_name: &str,
    candidates: &[LmusicArtistCandidate],
) -> Option<LmusicArtistCandidate> {
    let mut best_candidate: Option<LmusicArtistCandidate> = None;
    let mut best_score = 0.0;

    for candidate in candidates {
        let score = score_artist_candidate(artist_name, &candidate.name);

        if score > best_score {
            best_score = score;
            best_candidate = Some(candidate.clone());
        }
    }

    if best_score < 45.0 {
        return None;
    }

    best_candidate
}

fn parse_artist_metadata_from_html(html: &str, slug: &str) -> Option<LmusicArtistMetadata> {
    let document = Html::parse_document(html);
    let name_selector = Selector::parse("h1.c-artist-header__artist-name").expect("valid selector");
    let tag_selector =
        Selector::parse(".c-artist-header__sections .c-hashtag").expect("valid selector");
    let image_selector = Selector::parse(".c-artist-header__img").expect("valid selector");
    let description_selector =
        Selector::parse(".c-artist-header__description span").expect("valid selector");

    let name = normalize_whitespace(
        &document
            .select(&name_selector)
            .next()?
            .text()
            .collect::<String>(),
    );

    if name.is_empty() {
        return None;
    }

    let image_url = document
        .select(&image_selector)
        .next()
        .and_then(|image| {
            image
                .value()
                .attr("data-src")
                .or_else(|| image.value().attr("src"))
        })
        .map(to_absolute_url);
    let description = document
        .select(&description_selector)
        .next()
        .map(|node| normalize_whitespace(&node.text().collect::<String>()))
        .filter(|value| !value.is_empty());
    let mut seen_tags = HashSet::new();
    let mut tags = Vec::new();

    for tag_node in document.select(&tag_selector) {
        let tag = normalize_whitespace(&tag_node.text().collect::<String>());
        let normalized_tag = normalize_lookup_text(&tag);

        if normalized_tag.is_empty() || !seen_tags.insert(normalized_tag) {
            continue;
        }

        tags.push(tag);
    }

    Some(LmusicArtistMetadata {
        name,
        slug: slug.to_string(),
        tags,
        image_url,
        description,
        source_url: format!("{LMUSIC_BASE_URL}/artist/{slug}"),
    })
}

async fn fetch_html(url: &str) -> Result<String, String> {
    let client = build_http_client()?;
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("LMusic request failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("LMusic returned an error status: {error}"))?;

    response
        .text()
        .await
        .map_err(|error| format!("Failed to read LMusic response body: {error}"))
}

async fn fetch_track_bytes(audio_url: &str) -> Result<Vec<u8>, String> {
    let client = build_http_client()?;
    client
        .get(audio_url)
        .header(reqwest::header::REFERER, LMUSIC_BASE_URL)
        .header(reqwest::header::ORIGIN, LMUSIC_BASE_URL)
        .send()
        .await
        .map_err(|error| format!("LMusic track request failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("LMusic track request returned an error status: {error}"))?
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|error| format!("Failed to read LMusic track payload: {error}"))
}

#[tauri::command]
pub async fn search_lmusic(query: String) -> Result<Vec<LmusicTrack>, String> {
    let normalized_query = query.trim();

    if normalized_query.is_empty() {
        return Ok(Vec::new());
    }

    let url = format!(
        "{LMUSIC_BASE_URL}/search?q={}",
        urlencoding::encode(normalized_query)
    );
    let html = fetch_html(&url).await?;
    Ok(parse_tracks_from_html(&html))
}

#[tauri::command]
pub async fn get_lmusic_artist_metadata(
    artist_name: String,
) -> Result<Option<LmusicArtistMetadata>, String> {
    let normalized_artist_name = artist_name.trim();

    if normalized_artist_name.is_empty() {
        return Ok(None);
    }

    let search_url = format!(
        "{LMUSIC_BASE_URL}/search?q={}",
        urlencoding::encode(normalized_artist_name)
    );
    let search_html = fetch_html(&search_url).await?;
    let candidates = parse_artist_candidates_from_search_html(&search_html);
    let Some(candidate) = select_best_artist_candidate(normalized_artist_name, &candidates) else {
        return Ok(None);
    };
    let artist_url = format!("{LMUSIC_BASE_URL}/artist/{}", candidate.slug);
    let artist_html = fetch_html(&artist_url).await?;

    Ok(parse_artist_metadata_from_html(&artist_html, &candidate.slug))
}

#[tauri::command]
pub async fn save_lmusic_track(
    app: tauri::AppHandle,
    track_id: String,
    audio_url: String,
) -> Result<DownloadResult, String> {
    let normalized_url = audio_url.trim();

    if normalized_url.is_empty() {
        return Err("LMusic audio URL is empty".to_string());
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

    let file_name = format!("{DOWNLOAD_FILE_PREFIX}{}.mp3", encode_track_id(&track_id));
    let target_path = downloads_dir.join(file_name);
    let bytes = fetch_track_bytes(normalized_url).await?;

    fs::write(&target_path, &bytes)
        .map_err(|error| format!("Failed to write LMusic track file: {error}"))?;

    Ok(DownloadResult {
        local_path: target_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn get_lmusic_track_blob(audio_url: String) -> Result<TrackBlobResult, String> {
    let normalized_url = audio_url.trim();

    if normalized_url.is_empty() {
        return Err("LMusic audio URL is empty".to_string());
    }

    let bytes = fetch_track_bytes(normalized_url).await?;
    Ok(to_track_blob(bytes, "audio/mpeg"))
}

#[cfg(test)]
mod tests {
    use super::{
        parse_artist_candidates_from_search_html, parse_artist_metadata_from_html,
        select_best_artist_candidate, LmusicArtistCandidate,
    };

    #[test]
    fn parses_artist_tags_from_artist_page_html() {
        let html = r#"
            <div class="c-artist-header__content">
                <h1 class="c-artist-header__artist-name"> Noize Mc </h1>
                <div class="c-artist-header__sections">
                    <a class="c-hashtag" href="/sections/rusian"> Русские песни </a>
                    <a class="c-hashtag" href="/genres/hip-hop"> Рэп и хип-хоп </a>
                    <a class="c-hashtag" href="/genres/indie"> Инди </a>
                </div>
                <div class="c-artist-header__description">
                    <span> Российский музыкант и актёр. </span>
                </div>
                <img class="c-artist-header__img" data-src="/images/artist_cover/noize-mc.jpg" />
            </div>
        "#;
        let metadata = parse_artist_metadata_from_html(html, "noize-mc").expect("metadata");

        assert_eq!(metadata.name, "Noize Mc");
        assert_eq!(
            metadata.tags,
            vec![
                "Русские песни".to_string(),
                "Рэп и хип-хоп".to_string(),
                "Инди".to_string()
            ]
        );
        assert_eq!(
            metadata.image_url.as_deref(),
            Some("https://lmusic.kz/images/artist_cover/noize-mc.jpg")
        );
    }

    #[test]
    fn picks_best_artist_candidate_for_requested_name() {
        let best = select_best_artist_candidate(
            "Noize MC",
            &[
                LmusicArtistCandidate {
                    slug: "ram".to_string(),
                    name: "Ram".to_string(),
                },
                LmusicArtistCandidate {
                    slug: "noize-mc".to_string(),
                    name: "Noize MC".to_string(),
                },
            ],
        )
        .expect("best candidate");

        assert_eq!(best.slug, "noize-mc");
    }

    #[test]
    fn parses_artist_candidates_from_search_results() {
        let html = r#"
            <div class="c-card-mp3 js-item-mp3">
                <span class="c-card-mp3__title-artist">
                    <a href="/artist/noize-mc">Noize MC</a>
                </span>
            </div>
            <div class="c-card-mp3 js-item-mp3">
                <span class="c-card-mp3__title-artist">
                    <a href="/artist/noize-mc">Noize MC</a>
                    <a href="/artist/monetochka">Монеточка</a>
                </span>
            </div>
        "#;
        let candidates = parse_artist_candidates_from_search_html(html);

        assert_eq!(candidates.len(), 2);
        assert_eq!(candidates[0].slug, "noize-mc");
        assert_eq!(candidates[1].slug, "monetochka");
    }
}
