use serde::Serialize;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

/// 内置 gateway 进程管理器。
///
/// 发布包在 ``Resources/gateway/`` 内置自包含的 gateway 可执行目录
/// （PyInstaller onedir：Python 运行时 + 全部依赖 + 技能包 + 配置模板）。
/// 桌面端启动时自动拉起唯一的 gateway server child（监听 18001），
/// 退出或重启时联动终止，实现开箱即用。
pub struct GatewayProcess {
  child: Mutex<Option<Child>>,
}

/// 内置 gateway 监听端口（与 scripts/run_gateway.py 的 GATEWAY_PORT 默认值一致）。
const GATEWAY_PORT: u16 = 18001;

fn port_alive(port: u16) -> bool {
  // Python 默认绑定 localhost；Windows 上可能优先解析为 IPv6 ::1。
  // 同时探测 localhost、IPv4 和 IPv6，避免把已就绪的 gateway 判成超时。
  TcpStream::connect(("localhost", port)).is_ok()
    || TcpStream::connect(("127.0.0.1", port)).is_ok()
    || TcpStream::connect(("::1", port)).is_ok()
}

impl GatewayProcess {
  pub fn new() -> Self {
    Self {
      child: Mutex::new(None),
    }
  }

  /// 在应用资源目录中定位 gateway 可执行文件。
  fn gateway_executable(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_dir = app
      .path()
      .resource_dir()
      .map_err(|err| format!("无法定位资源目录：{err}"))?;
    let exe = if cfg!(target_os = "windows") {
      resource_dir.join("gateway").join("kstock-gateway.exe")
    } else {
      resource_dir.join("gateway").join("kstock-gateway")
    };
    if !exe.exists() {
      return Err(format!("内置 gateway 缺失：{}", exe.display()));
    }
    Ok(exe)
  }

  fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app
      .path()
      .home_dir()
      .map(|home| home.join(".kstock"))
      .map_err(|err| format!("无法定位用户目录：{err}"))
  }

  fn gateway_log_file(app: &AppHandle) -> Result<(std::fs::File, PathBuf), String> {
    let logs_dir = Self::app_data_dir(app)?.join("logs");
    fs::create_dir_all(&logs_dir).map_err(|err| format!("无法创建 gateway 日志目录：{err}"))?;
    let log_path = logs_dir.join("desktop-gateway.log");
    let mut file = OpenOptions::new()
      .create(true)
      .append(true)
      .open(&log_path)
      .map_err(|err| format!("无法打开 gateway 启动日志 {}：{err}", log_path.display()))?;
    let _ = writeln!(file, "\n=== starting bundled gateway ===");
    Ok((file, log_path))
  }

  /// 启动当前 Rust 实例托管的唯一 gateway server child。
  pub fn ensure_started(&self, app: &AppHandle) -> Result<String, String> {
    let mut guard = self.child.lock().unwrap();
    if let Some(child) = guard.as_mut() {
      match child
        .try_wait()
        .map_err(|err| format!("检查 gateway 进程失败：{err}"))?
      {
        None if port_alive(GATEWAY_PORT) => return Ok("gateway 已启动".to_string()),
        None => return Ok("gateway 正在启动中…".to_string()),
        Some(_) => {
          guard.take();
        }
      }
    }

    if port_alive(GATEWAY_PORT) {
      return Err(format!(
        "gateway 端口 {GATEWAY_PORT} 已被非托管进程占用；请先结束该进程后重试"
      ));
    }

    let exe = Self::gateway_executable(app)?;
    let app_data_dir = Self::app_data_dir(app)?;
    let (log_file, log_path) = Self::gateway_log_file(app)?;
    let stderr_file = log_file
      .try_clone()
      .map_err(|err| format!("无法复制 gateway 日志句柄：{err}"))?;
    let mut cmd = Command::new(&exe);
    cmd
      .arg("--serve")
      .env("KSTOCK_APP_DATA_DIR", app_data_dir)
      .stdin(Stdio::null())
      .stdout(Stdio::from(log_file))
      .stderr(Stdio::from(stderr_file));
    #[cfg(unix)]
    {
      // 新建进程组：退出时 kill(-pid) 可整树终止。
      use std::os::unix::process::CommandExt;
      cmd.process_group(0);
    }
    #[cfg(windows)]
    {
      // 即使旧产物仍是 console 子系统，也不能继承/创建可见终端窗口。
      use std::os::windows::process::CommandExt;
      const CREATE_NO_WINDOW: u32 = 0x0800_0000;
      cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let mut child = cmd
      .spawn()
      .map_err(|err| format!("启动内置 gateway 失败：{err}"))?;

    // 等待端口就绪（最长约 20 秒；首次启动需初始化 SQLite + 迁移）。
    for _ in 0..40 {
      if let Some(status) = child
        .try_wait()
        .map_err(|err| format!("检查 gateway 进程失败：{err}"))?
      {
        return Err(format!(
          "gateway 在监听端口前退出（{status}）；请查看日志：{}",
          log_path.display()
        ));
      }
      if port_alive(GATEWAY_PORT) {
        *guard = Some(child);
        return Ok("gateway 已启动".to_string());
      }
      std::thread::sleep(Duration::from_millis(500));
    }
    *guard = Some(child);
    Err(format!(
      "gateway 启动超时，端口 {GATEWAY_PORT} 未就绪；请查看日志：{}",
      log_path.display()
    ))
  }

  /// 重启 gateway server child。
  pub fn restart(&self, app: &AppHandle) -> Result<String, String> {
    self.stop()?;
    self.ensure_started(app)
  }

  /// 终止 gateway 进程树。
  pub fn stop(&self) -> Result<(), String> {
    let mut guard = self.child.lock().unwrap();
    if let Some(mut child) = guard.take() {
      if child
        .try_wait()
        .map_err(|err| format!("检查 gateway 进程失败：{err}"))?
        .is_none()
      {
        kill_process_tree(child.id());
        let _ = child.wait();
      }
    }
    Ok(())
  }

  /// 当前状态（供设置页 / 侧边栏展示）。
  pub fn status(&self) -> GatewayStatus {
    let running = port_alive(GATEWAY_PORT);
    let child_alive = self
      .child
      .lock()
      .unwrap()
      .as_mut()
      .map(|c| c.try_wait().ok().flatten().is_none())
      .unwrap_or(false);
    GatewayStatus {
      port: GATEWAY_PORT,
      running,
      child_alive,
    }
  }
}

#[derive(Serialize)]
pub struct GatewayStatus {
  pub port: u16,
  pub running: bool,
  pub child_alive: bool,
}

/// 终止整个进程树。
fn kill_process_tree(pid: u32) {
  #[cfg(unix)]
  {
    // 进程组信号：spawn 时已 setsid/进程组（见 ensure_started 的 Unix 配置）
    unsafe {
      libc::kill(-(pid as i32), libc::SIGTERM);
    }
  }
  #[cfg(windows)]
  {
    let _ = Command::new("taskkill")
      .args(["/PID", &pid.to_string(), "/T", "/F"])
      .status();
  }
}

// ── Tauri commands ────────────────────────────────────────────────

#[tauri::command]
pub fn gateway_start(app: AppHandle, state: State<'_, GatewayProcess>) -> Result<String, String> {
  state.ensure_started(&app)
}

#[tauri::command]
pub fn gateway_stop(state: State<'_, GatewayProcess>) -> Result<(), String> {
  state.stop()
}

#[tauri::command]
pub fn gateway_restart(
  app: AppHandle,
  state: State<'_, GatewayProcess>,
) -> Result<String, String> {
  state.restart(&app)
}

#[tauri::command]
pub fn gateway_status(state: State<'_, GatewayProcess>) -> GatewayStatus {
  state.status()
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
