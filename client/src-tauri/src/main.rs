#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ai_gateway;

use tauri::Manager;

fn main() {
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .connect_timeout(std::time::Duration::from_secs(10))
        .no_proxy()
        .build()
        .expect("Failed to build HTTP client");

    tauri::Builder::default()
        .manage(http_client)
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            log::info!("课伴桌面端启动，日志目录: {:?}", app.path().app_log_dir());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ai_gateway::ai_summarize,
            ai_gateway::ai_generate_cards,
            ai_gateway::ai_evaluate,
            ai_gateway::ai_recommend_duration,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
