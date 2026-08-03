mod gateway;

use base64::Engine;
use serde::Serialize;
use tauri::Manager;
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
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

/// 构建中文化的系统菜单（macOS 上显示在系统菜单栏）。
fn build_app_menu(app: &tauri::AppHandle) -> tauri::Result<()> {
  let app_menu = Submenu::with_items(
    app,
    "KStock",
    true,
    &[
      &PredefinedMenuItem::about(app, Some("关于 KStock"), Some(AboutMetadata::default()))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::hide(app, Some("隐藏 KStock"))?,
      &PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?,
      &PredefinedMenuItem::show_all(app, Some("全部显示"))?,
      &PredefinedMenuItem::separator(app)?,
      &PredefinedMenuItem::quit(app, Some("退出 KStock"))?,
    ],
  )?;

  let file_menu = Submenu::with_items(
    app,
    "文件",
    true,
    &[&PredefinedMenuItem::close_window(app, Some("关闭窗口"))?],
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

  let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &window_menu])?;
  app.set_menu(menu)?;
  Ok(())
}

/// 构建托盘图标及菜单：显示窗口 / 退出。
fn build_tray(app: &tauri::AppHandle, icon: tauri::image::Image) -> tauri::Result<()> {
  let show_item = MenuItem::with_id(app, "tray-show", "显示窗口", true, None::<&str>)?;
  let quit_item = MenuItem::with_id(app, "tray-quit", "退出", true, None::<&str>)?;
  let tray_menu = Menu::with_items(
    app,
    &[
      &show_item,
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

fn main() {
  tauri::Builder::default()
    .manage(gateway::GatewayProcess::new())
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
      "tray-quit" => app.exit(0),
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
