#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod artwork;
mod hitmos;
mod lmusic;
mod secure_storage;
mod soundcloud;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            hitmos::get_popular_hitmos,
            hitmos::search_hitmos,
            hitmos::save_hitmos_track,
            hitmos::get_hitmos_track_blob,
            hitmos::get_local_track_blob,
            hitmos::delete_local_track,
            hitmos::list_local_downloads,
            lmusic::search_lmusic,
            lmusic::get_lmusic_artist_metadata,
            lmusic::save_lmusic_track,
            lmusic::get_lmusic_track_blob,
            soundcloud::search_soundcloud,
            soundcloud::resolve_soundcloud_stream,
            soundcloud::save_soundcloud_track,
            artwork::resolve_cover_art_url,
            secure_storage::save_secure_value,
            secure_storage::read_secure_value,
            secure_storage::delete_secure_value
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
