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
/// 桌面端启动时自动拉起 gateway（supervisor 模式，监听 18001），
/// 退出时联动终止，实现开箱即用。
pub struct GatewayProcess {
  child: Mutex<Option<Child>>,
}

/// 内置 gateway 监听端口（与 scripts/run_gateway.py 的 GATEWAY_PORT 默认值一致）。
const GATEWAY_PORT: u16 = 18001;

fn port_alive(port: u16) -> bool {
  TcpStream::connect(("127.0.0.1", port)).is_ok()
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

  fn gateway_log_file(app: &AppHandle) -> Result<std::fs::File, String> {
    let logs_dir = Self::app_data_dir(app)?.join("logs");
    fs::create_dir_all(&logs_dir).map_err(|err| format!("无法创建 gateway 日志目录：{err}"))?;
    let log_path = logs_dir.join("desktop-gateway.log");
    let mut file = OpenOptions::new()
      .create(true)
      .append(true)
      .open(&log_path)
      .map_err(|err| format!("无法打开 gateway 启动日志 {}：{err}", log_path.display()))?;
    let _ = writeln!(file, "\n=== starting bundled gateway ===");
    Ok(file)
  }

  /// 确保 gateway 在运行：
  /// - 端口已有实例（历史残留 / 手动启动）→ 直接采用，不重复拉起；
  /// - 无实例 → 启动资源目录内的 gateway 可执行文件并等待端口就绪。
  pub fn ensure_started(&self, app: &AppHandle) -> Result<String, String> {
    if port_alive(GATEWAY_PORT) {
      return Ok("已连接（gateway 实例已在运行）".to_string());
    }

    let mut guard = self.child.lock().unwrap();
    if let Some(child) = guard.as_mut() {
      if child
        .try_wait()
        .map_err(|err| format!("检查 gateway 进程失败：{err}"))?
        .is_none()
      {
        return Ok("gateway 正在启动中…".to_string());
      }
    }

    let exe = Self::gateway_executable(app)?;
    let app_data_dir = Self::app_data_dir(app)?;
    let log_file = Self::gateway_log_file(app)?;
    let stderr_file = log_file
      .try_clone()
      .map_err(|err| format!("无法复制 gateway 日志句柄：{err}"))?;
    let mut cmd = Command::new(&exe);
    cmd
      .env("KSTOCK_APP_DATA_DIR", app_data_dir)
      .stdout(Stdio::from(log_file))
      .stderr(Stdio::from(stderr_file));
    #[cfg(unix)]
    {
      // 新建进程组：退出时 kill(-pid) 可整树终止（supervisor + uvicorn 子进程）
      use std::os::unix::process::CommandExt;
      cmd.process_group(0);
    }
    #[cfg(windows)]
    {
      // GUI 宿主 spawn 控制台子进程（PyInstaller console=True）时系统会默认
      // 弹出可见 cmd 黑窗口：CREATE_NO_WINDOW 让控制台创建但不可见，
      // 日志仍通过 stdout/stderr 重定向到文件，不受影响。
      use std::os::windows::process::CommandExt;
      const CREATE_NO_WINDOW: u32 = 0x0800_0000;
      cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let child = cmd
      .spawn()
      .map_err(|err| format!("启动内置 gateway 失败：{err}"))?;
    *guard = Some(child);

    // 等待端口就绪（最长约 20 秒；首次启动需初始化 SQLite + 迁移）
    for _ in 0..40 {
      if port_alive(GATEWAY_PORT) {
        return Ok("gateway 已启动".to_string());
      }
      std::thread::sleep(Duration::from_millis(500));
    }
    Ok("gateway 进程已拉起，等待端口就绪…".to_string())
  }

  /// 终止 gateway（含其 supervisor 子进程树）。
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

/// 终止整个进程树（supervisor 收到 SIGTERM 后会自动终止其 uvicorn 子进程）。
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
