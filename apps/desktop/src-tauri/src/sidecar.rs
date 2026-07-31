#[tauri::command]
pub fn sidecar_status() -> String {
  "未连接".to_string()
}
