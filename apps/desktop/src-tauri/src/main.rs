mod gateway;

use base64::Engine;
use serde::Serialize;
use tauri::Manager;
use tauri::tray::TrayIconBuilder;

#[derive(Serialize)]
struct SaveArtifactResult {
  saved: bool,
  path: Option<String>,
}

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

#[tauri::command]
fn save_artifact_file(name: String, contents_base64: String) -> Result<SaveArtifactResult, String> {
  let filename = safe_artifact_filename(&name);
  let path = rfd::FileDialog::new()
    .set_file_name(&filename)
    .save_file();

  let Some(path) = path else {
    return Ok(SaveArtifactResult { saved: false, path: None });
  };

  let bytes = base64::engine::general_purpose::STANDARD
    .decode(contents_base64)
    .map_err(|err| format!("文件内容解码失败：{err}"))?;
  std::fs::write(&path, bytes).map_err(|err| format!("文件保存失败：{err}"))?;

  Ok(SaveArtifactResult {
    saved: true,
    path: Some(path.to_string_lossy().to_string()),
  })
}

fn safe_artifact_filename(name: &str) -> String {
  let filename = name
    .rsplit(|character| character == '/' || character == '\\')
    .next()
    .unwrap_or(name)
    .trim()
    .chars()
    .map(|character| match character {
      '/' | '\\' | ':' => '_',
      other => other,
    })
    .collect::<String>();

  if filename.is_empty() {
    "artifact".to_string()
  } else {
    filename
  }
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
      open_external_url,
      save_artifact_file
    ])
    .run(tauri::generate_context!())
    .expect("failed to run tauri application");
}
