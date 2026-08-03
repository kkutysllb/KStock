mod gateway;

use base64::Engine;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::TrayIconBuilder;

#[derive(Default)]
struct ZoomState {
  factor: Mutex<f64>,
}

#[derive(Serialize)]
struct SaveArtifactResult {
  saved: bool,
  path: Option<String>,
}

#[derive(Clone, Serialize)]
struct DesktopMenuPayload<'a> {
  command: &'a str,
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

fn custom_menu_item(
  app: &tauri::AppHandle,
  id: &str,
  text: &str,
  accelerator: Option<&str>,
) -> tauri::Result<MenuItem<tauri::Wry>> {
  MenuItem::with_id(app, id, text, true, accelerator)
}

/// 构建中文化的系统菜单（macOS 上显示在系统菜单栏）。
fn build_app_menu(app: &tauri::AppHandle) -> tauri::Result<()> {
  let about = AboutMetadata {
    name: Some("KStock".to_string()),
    version: Some(env!("CARGO_PKG_VERSION").to_string()),
    comments: Some("对话式 Stock Quant 桌面端".to_string()),
    website: Some("https://github.com/kkutysllb/KStock".to_string()),
    website_label: Some("KStock 项目主页".to_string()),
    ..AboutMetadata::default()
  };
  let check_update = custom_menu_item(app, "app-check-update", "检查更新…", Some("CmdOrCtrl+Shift+U"))?;
  let preferences = custom_menu_item(app, "app-open-settings", "偏好设置…", Some("CmdOrCtrl+,"))?;
  let app_menu = Submenu::with_items(
    app,
    "KStock",
    true,
    &[
      &PredefinedMenuItem::about(app, Some("关于 KStock"), Some(about))?,
      &PredefinedMenuItem::separator(app)?,
      &check_update,
      &preferences,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::hide(app, Some("隐藏 KStock"))?,
      &PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?,
      &PredefinedMenuItem::show_all(app, Some("全部显示"))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::quit(app, Some("退出 KStock"))?,
    ],
  )?;

  let new_task = custom_menu_item(app, "file-new-task", "新建任务", Some("CmdOrCtrl+N"))?;
  let open_reports = custom_menu_item(app, "file-open-reports", "打开报告库", Some("CmdOrCtrl+Shift+L"))?;
  let open_outputs = custom_menu_item(app, "file-open-outputs-dir", "打开交付文件目录", Some("CmdOrCtrl+Shift+O"))?;
  let open_data = custom_menu_item(app, "file-open-app-data-dir", "打开应用数据目录", None)?;
  let file_menu = Submenu::with_items(
    app,
    "文件",
    true,
    &[
      &new_task,
      &open_reports,
      &PredefinedMenuItem::separator(app)?,
      &open_outputs,
      &open_data,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::close_window(app, Some("关闭窗口"))?,
    ],
  )?;

  let edit_menu = Submenu::with_items(
    app,
    "编辑",
    true,
    &[
      &PredefinedMenuItem::undo(app, Some("撤销"))?,
      &PredefinedMenuItem::redo(app, Some("重做"))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::cut(app, Some("剪切"))?,
      &PredefinedMenuItem::copy(app, Some("复制"))?,
      &PredefinedMenuItem::paste(app, Some("粘贴"))?,
      &PredefinedMenuItem::select_all(app, Some("全选"))?,
    ],
  )?;

  let reload = custom_menu_item(app, "view-reload", "重新加载", Some("CmdOrCtrl+R"))?;
  let force_reload = custom_menu_item(app, "view-force-reload", "强制重新加载", Some("CmdOrCtrl+Shift+R"))?;
  let zoom_in = custom_menu_item(app, "view-zoom-in", "放大", Some("CmdOrCtrl+="))?;
  let zoom_out = custom_menu_item(app, "view-zoom-out", "缩小", Some("CmdOrCtrl+-"))?;
  let zoom_reset = custom_menu_item(app, "view-zoom-reset", "实际大小", Some("CmdOrCtrl+0"))?;
  #[cfg(debug_assertions)]
  let devtools = custom_menu_item(app, "view-toggle-devtools", "开发者工具", Some("F12"))?;
  #[cfg(debug_assertions)]
  let view_menu = Submenu::with_items(
    app,
    "视图",
    true,
    &[
      &reload,
      &force_reload,
      &devtools,
      &PredefinedMenuItem::separator(app)?,
      &zoom_in,
      &zoom_out,
      &zoom_reset,
    ],
  )?;
  #[cfg(not(debug_assertions))]
  let view_menu = Submenu::with_items(
    app,
    "视图",
    true,
    &[
      &reload,
      &force_reload,
      &PredefinedMenuItem::separator(app)?,
      &zoom_in,
      &zoom_out,
      &zoom_reset,
    ],
  )?;

  let window_menu = Submenu::with_items(
    app,
    "窗口",
    true,
    &[
      &PredefinedMenuItem::minimize(app, Some("最小化"))?,
      &PredefinedMenuItem::maximize(app, Some("最大化"))?,
      &PredefinedMenuItem::fullscreen(app, Some("进入全屏"))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::bring_all_to_front(app, Some("前置全部窗口"))?,
    ],
  )?;

  let help_check_update = custom_menu_item(app, "help-check-update", "检查更新…", None)?;
  let help_app_data = custom_menu_item(app, "help-open-app-data-dir", "打开应用数据目录", None)?;
  let help_logs = custom_menu_item(app, "help-open-logs-dir", "打开日志目录", None)?;
  let help_homepage = custom_menu_item(app, "help-open-homepage", "打开项目主页", None)?;
  let help_feedback = custom_menu_item(app, "help-open-feedback", "问题反馈", None)?;
  let help_menu = Submenu::with_items(
    app,
    "帮助",
    true,
    &[
      &help_check_update,
      &PredefinedMenuItem::separator(app)?,
      &help_app_data,
      &help_logs,
      &PredefinedMenuItem::separator(app)?,
      &help_homepage,
      &help_feedback,
    ],
  )?;

  let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])?;
  app.set_menu(menu)?;
  Ok(())
}

/// 构建托盘图标及菜单：显示窗口 / 隐藏窗口 / 检查更新 / 退出。
fn build_tray(app: &tauri::AppHandle, icon: tauri::image::Image) -> tauri::Result<()> {
  let show_item = MenuItem::with_id(app, "tray-show", "显示窗口", true, None::<&str>)?;
  let hide_item = MenuItem::with_id(app, "tray-hide", "隐藏窗口", true, None::<&str>)?;
  let check_update_item = MenuItem::with_id(app, "tray-check-update", "检查更新…", true, None::<&str>)?;
  let quit_item = MenuItem::with_id(app, "tray-quit", "退出", true, None::<&str>)?;
  let tray_menu = Menu::with_items(
    app,
    &[
      &show_item,
      &hide_item,
      &PredefinedMenuItem::separator(app)?,
      &check_update_item,
      &PredefinedMenuItem::separator(app)?,
      &quit_item,
    ],
  )?;
  TrayIconBuilder::new()
    .icon(icon)
    .tooltip("KStock 量化助手")
    .menu(&tray_menu)
    .build(app)?;
  Ok(())
}

/// 显示并聚焦主窗口（托盘“显示窗口”菜单）。
fn show_main_window(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.unminimize();
    let _ = window.set_focus();
  }
}

fn hide_main_window(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.hide();
  }
}

fn emit_menu_command(app: &tauri::AppHandle, command: &'static str) {
  let _ = app.emit("kstock://menu", DesktopMenuPayload { command });
}

fn kstock_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app
    .path()
    .home_dir()
    .map(|home| home.join(".kstock"))
    .map_err(|err| format!("无法定位用户目录：{err}"))
}

fn open_path(path: &Path) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  let result = std::process::Command::new("open").arg(path).spawn();
  #[cfg(target_os = "windows")]
  let result = std::process::Command::new("explorer").arg(path).spawn();
  #[cfg(all(unix, not(target_os = "macos")))]
  let result = std::process::Command::new("xdg-open").arg(path).spawn();

  result.map(|_| ()).map_err(|err| format!("无法打开目录 {}：{err}", path.display()))
}

fn open_existing_or_create_dir(path: PathBuf) {
  if let Err(err) = std::fs::create_dir_all(&path).and_then(|_| open_path(&path).map_err(std::io::Error::other)) {
    eprintln!("[menu] 打开目录失败 {}: {err}", path.display());
  }
}

fn open_app_data_dir(app: &tauri::AppHandle) {
  match kstock_data_dir(app) {
    Ok(path) => open_existing_or_create_dir(path),
    Err(err) => eprintln!("[menu] {err}"),
  }
}

fn open_outputs_dir(app: &tauri::AppHandle) {
  match kstock_data_dir(app) {
    Ok(path) => open_existing_or_create_dir(path.join("runtime").join("qilin").join("users")),
    Err(err) => eprintln!("[menu] {err}"),
  }
}

fn open_logs_dir(app: &tauri::AppHandle) {
  match kstock_data_dir(app) {
    Ok(path) => open_existing_or_create_dir(path.join("logs")),
    Err(err) => eprintln!("[menu] {err}"),
  }
}

fn reload_main_window(app: &tauri::AppHandle, hard: bool) {
  if let Some(window) = app.get_webview_window("main") {
    let script = if hard {
      "window.location.reload(true);"
    } else {
      "window.location.reload();"
    };
    let _ = window.eval(script);
  }
}

fn set_main_zoom(app: &tauri::AppHandle, factor: f64) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.set_zoom(factor);
  }
}

fn adjust_main_zoom(app: &tauri::AppHandle, delta: f64) {
  let state = app.state::<ZoomState>();
  let mut factor = state.factor.lock().unwrap();
  *factor = (*factor + delta).clamp(0.6, 2.0);
  set_main_zoom(app, *factor);
}

fn reset_main_zoom(app: &tauri::AppHandle) {
  let state = app.state::<ZoomState>();
  let mut factor = state.factor.lock().unwrap();
  *factor = 1.0;
  set_main_zoom(app, *factor);
}

fn open_project_url(url: &str) {
  if let Err(err) = open_external_url(url.to_string()) {
    eprintln!("[menu] 打开链接失败 {url}: {err}");
  }
}

#[cfg(debug_assertions)]
fn toggle_devtools(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    if window.is_devtools_open() {
      window.close_devtools();
    } else {
      window.open_devtools();
    }
  }
}

fn main() {
  tauri::Builder::default()
    .manage(gateway::GatewayProcess::new())
    .manage(ZoomState { factor: Mutex::new(1.0) })
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .setup(|app| {
      // 自动拉起内置 gateway（打包态；开发态若端口已有实例则直接复用）
      let gateway = app.state::<gateway::GatewayProcess>();
      if let Err(err) = gateway.ensure_started(app.handle()) {
        eprintln!("[gateway] 自动启动失败（开发模式可忽略）: {err}");
      }
      if let Some(window) = app.get_webview_window("main") {
        window.set_title("")?;
      }
      build_app_menu(app.handle())?;
      if let Some(icon) = app.default_window_icon() {
        build_tray(app.handle(), icon.clone())?;
      }
      Ok(())
    })
    .on_menu_event(|app, event| match event.id().as_ref() {
      "tray-show" => show_main_window(app),
      "tray-hide" => hide_main_window(app),
      "tray-check-update" | "app-check-update" | "help-check-update" => emit_menu_command(app, "check-update"),
      "tray-quit" => app.exit(0),
      "app-open-settings" => emit_menu_command(app, "open-settings"),
      "file-new-task" => emit_menu_command(app, "new-task"),
      "file-open-reports" => emit_menu_command(app, "open-reports"),
      "file-open-outputs-dir" => open_outputs_dir(app),
      "file-open-app-data-dir" | "help-open-app-data-dir" => open_app_data_dir(app),
      "help-open-logs-dir" => open_logs_dir(app),
      "help-open-homepage" => open_project_url("https://github.com/kkutysllb/KStock"),
      "help-open-feedback" => open_project_url("https://github.com/kkutysllb/KStock/issues"),
      "view-reload" => reload_main_window(app, false),
      "view-force-reload" => reload_main_window(app, true),
      "view-zoom-in" => adjust_main_zoom(app, 0.1),
      "view-zoom-out" => adjust_main_zoom(app, -0.1),
      "view-zoom-reset" => reset_main_zoom(app),
      #[cfg(debug_assertions)]
      "view-toggle-devtools" => toggle_devtools(app),
      _ => {}
    })
    .invoke_handler(tauri::generate_handler![
      gateway::gateway_start,
      gateway::gateway_stop,
      gateway::gateway_status,
      gateway::app_data_dir,
      open_external_url,
      save_artifact_file
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app_handle: &tauri::AppHandle, event| {
      // 应用退出时联动终止内置 gateway（含 supervisor 子进程树）
      if let tauri::RunEvent::Exit = event {
        let gateway = app_handle.state::<gateway::GatewayProcess>();
        if let Err(err) = gateway.stop() {
          eprintln!("[gateway] 停止失败: {err}");
        }
      }
    });
}
