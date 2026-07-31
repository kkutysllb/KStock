mod sidecar;

use tauri::Manager;
use tauri::tray::TrayIconBuilder;

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
    .invoke_handler(tauri::generate_handler![sidecar::sidecar_status])
    .run(tauri::generate_context!())
    .expect("failed to run tauri application");
}
