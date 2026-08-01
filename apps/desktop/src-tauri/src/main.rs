mod gateway;

use tauri::Manager;
use tauri::tray::TrayIconBuilder;

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
  if !(url.starts_with("https://") || url.starts_with("http://")) {
    return Err("仅允许打开 http(s) 链接".to_string());
  }

  #[cfg(target_os = "macos")]
  let result = std::process::Command::new("open").arg(&url).spawn();
  #[cfg(target_os = "windows")]
  let result = std::process::Command::new("rundll32")
    .args(["url.dll,FileProtocolHandler", &url])
    .spawn();
  #[cfg(all(unix, not(target_os = "macos")))]
  let result = std::process::Command::new("xdg-open").arg(&url).spawn();

  result.map(|_| ()).map_err(|err| format!("无法打开外部链接：{err}"))
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      if let Some(window) = app.get_webview_window("main") {
        window.set_title("")?;
      }
      if let Some(icon) = app.default_window_icon() {
        TrayIconBuilder::new()
          .icon(icon.clone())
          .tooltip("KStock Quant Agent")
          .build(app)?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      gateway::sidecar_status,
      gateway::app_data_dir,
      open_external_url
    ])
    .run(tauri::generate_context!())
    .expect("failed to run tauri application");
}
