#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai_gateway;

fn main() {
    let http_client = reqwest::Client::new();

    tauri::Builder::default()
        .manage(http_client)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            ai_gateway::ai_summarize,
            ai_gateway::ai_generate_cards,
            ai_gateway::ai_evaluate,
            ai_gateway::ai_recommend_duration,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
