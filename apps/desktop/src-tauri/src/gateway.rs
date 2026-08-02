use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn sidecar_status() -> String {
  "未连接".to_string()
}

#[tauri::command]
pub fn app_data_dir(app: AppHandle) -> String {
  // 数据根目录由 scripts/run_gateway.py 统一解析（KSTOCK_APP_DATA_DIR 优先，
  // 默认 ~/.kstock）。不再使用 Tauri 标准 app_data_dir（Application Support），
  // 避免含空格路径导致的沙箱 bash 拆词故障；此处返回与产品默认一致的路径。
  app
    .path()
    .home_dir()
    .map(|home| home.join(".kstock").to_string_lossy().to_string())
    .unwrap_or_else(|_| ".kstock".to_string())
}
