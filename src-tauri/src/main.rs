#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod hitmos;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            hitmos::get_popular_hitmos,
            hitmos::search_hitmos,
            hitmos::save_hitmos_track,
            hitmos::get_hitmos_track_blob,
            hitmos::get_local_track_blob,
            hitmos::delete_local_track
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
