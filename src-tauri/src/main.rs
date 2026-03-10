#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod hitmos;
mod secure_storage;

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
            secure_storage::save_secure_value,
            secure_storage::read_secure_value,
            secure_storage::delete_secure_value
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
