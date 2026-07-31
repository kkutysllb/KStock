use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn sidecar_status() -> String {
  "未连接".to_string()
}

#[tauri::command]
pub fn app_data_dir(app: AppHandle) -> Result<String, String> {
  app
    .path()
    .app_data_dir()
    .map(|path| path.to_string_lossy().to_string())
    .map_err(|error| format!("无法解析应用数据目录：{error}"))
}
