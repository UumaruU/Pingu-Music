use serde::Deserialize;
use std::time::Duration;

#[derive(Debug, Deserialize)]
struct CoverArtArchiveResponse {
    images: Option<Vec<CoverArtImage>>,
}

#[derive(Debug, Deserialize)]
struct CoverArtImage {
    front: Option<bool>,
    image: Option<String>,
    thumbnails: Option<CoverArtThumbnails>,
}

#[derive(Debug, Deserialize)]
struct CoverArtThumbnails {
    large: Option<String>,
    small: Option<String>,
}

fn build_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) PinguMusic/1.0")
        .build()
        .map_err(|error| format!("Failed to create HTTP client: {error}"))
}

fn collect_cover_urls(payload: CoverArtArchiveResponse) -> Vec<String> {
    let Some(images) = payload.images else {
        return Vec::new();
    };
    let front_image = images.iter().find(|image| image.front.unwrap_or(false));
    let primary = front_image.or_else(|| images.first());
    let Some(primary) = primary else {
        return Vec::new();
    };
    let thumbnails = primary.thumbnails.as_ref();

    let mut urls = Vec::new();

    if let Some(thumbs) = thumbnails {
        if let Some(large) = thumbs.large.clone().filter(|url| !url.trim().is_empty()) {
            urls.push(large);
        }

        if let Some(small) = thumbs.small.clone().filter(|url| !url.trim().is_empty()) {
            if !urls.iter().any(|existing| existing == &small) {
                urls.push(small);
            }
        }
    }

    if let Some(image) = primary.image.clone().filter(|url| !url.trim().is_empty()) {
        if !urls.iter().any(|existing| existing == &image) {
            urls.push(image);
        }
    }

    urls
}

async fn validate_cover_url(client: &reqwest::Client, url: &str) -> bool {
    match client.get(url).send().await {
        Ok(response) => response.status().is_success(),
        Err(_) => false,
    }
}

#[tauri::command]
pub async fn resolve_cover_art_url(release_id: String) -> Result<Option<String>, String> {
    let normalized_release_id = release_id.trim();

    if normalized_release_id.is_empty() {
        return Ok(None);
    }

    let client = build_http_client()?;
    let url = format!("https://coverartarchive.org/release/{normalized_release_id}");
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Cover Art Archive request failed: {error}"))?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }

    let response = response
        .error_for_status()
        .map_err(|error| format!("Cover Art Archive returned an error status: {error}"))?;

    let payload_text = response
        .text()
        .await
        .map_err(|error| format!("Failed to read Cover Art Archive response: {error}"))?;
    let payload = serde_json::from_str::<CoverArtArchiveResponse>(&payload_text)
        .map_err(|error| format!("Failed to parse Cover Art Archive response: {error}"))?;

    for candidate_url in collect_cover_urls(payload) {
        if validate_cover_url(&client, &candidate_url).await {
            return Ok(Some(candidate_url));
        }
    }

    Ok(None)
}
