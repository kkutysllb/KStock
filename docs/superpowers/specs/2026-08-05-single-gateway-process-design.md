# Windows 单层 Gateway 进程设计

## 问题

当前发布版由 Tauri 启动 PyInstaller supervisor，再由 supervisor 启动同一个
`kstock-gateway.exe --serve` worker。Windows 日志显示 gateway 曾正常监听
`localhost:18001`，但后续连续出现两个 supervisor，worker 均未进入 uvicorn；
这与黑色终端窗口和前端断连同时发生。两层进程同时承担生命周期管理，容易产生
重复启动、孤儿进程和 Windows 控制台继承问题。

## 目标

- Tauri 开发态和发布态统一只保留一条启动链：
  `Tauri/Rust -> kstock-gateway executable --serve`。
- Rust 是 gateway 进程唯一所有者，负责启动、停止、重启和退出清理。
- Windows 启动全程使用无控制台标志，标准输出和错误继续写入
  `~/.kstock/logs/desktop-gateway.log`。
- 设置页“重启后端”继续可用，用户配置和 SQLite 数据不受影响。
- 源码模式仍可直接运行 `scripts/run_gateway.py --serve`；删除生产路径对 Python
  supervisor 的依赖。

## 设计

### Rust 生命周期

`GatewayProcess::ensure_started` 直接以 `--serve` 启动 gateway。开发态和发布态
都只接受当前 Rust 实例托管的 child，不再仅凭端口存在就接受任意外部进程。
启动前若 18001 已被其他进程占用，则返回包含端口冲突信息的错误，不静默复用。
Windows 使用 `CREATE_NO_WINDOW`，stdin 置空，stdout/stderr 指向现有日志文件。

`tauri dev` 使用同一套 Rust 生命周期；纯浏览器 `dev:web` 因没有 Tauri 宿主，
仍由开发者单独启动 gateway，不提供桌面端进程管理与重启 command。

`GatewayProcess::restart` 在同一互斥锁下结束当前 child，等待进程树退出，再启动
新的 `--serve` child。新增 Tauri command `gateway_restart`，返回启动结果。

应用退出仍调用 `GatewayProcess::stop`，确保不会留下锁住安装目录 DLL 的进程。

### 前端重启

设置页不再请求 `/api/v1/kstock/restart`。`restartGateway` 调用
`invoke("gateway_restart")`，随后沿用现有 `/health` 轮询等待恢复。浏览器预览环境
无法调用 Tauri command 时返回明确错误。

### Python 入口

打包程序收到 `--serve` 后直接构造 FastAPI app 并运行 uvicorn。默认入口也直接
运行 server，避免双击或误调用时再次进入 supervisor。移除 `_run_supervisor`、
`RESTART_EXIT_CODE` 和 supervisor PID 协议；HTTP `/restart` 路由不再挂载。

### 错误处理

Rust 启动失败或 child 在就绪前退出时，读取退出状态并返回包含日志路径的错误，
不再把“进程已拉起”误报为成功。健康检查超时仍由前端显示恢复失败。

## 验证

- Python 回归测试确认默认入口不再调用 supervisor，`--serve` 仍启动 server。
- Rust/源码契约测试确认启动参数包含 `--serve`、Windows 无控制台标志和重启
  command 已注册。
- 前端测试确认重启使用 Tauri invoke 后再轮询健康状态。
- 运行发布打包测试、桌面 Vitest、Python gateway 控制测试和 `cargo check`。
- 开发态与 Windows 发布产物分别验证：启动无终端窗口、端口 18001 可达、连续
  重启两次后仍只有一个 gateway 进程；端口被外部进程占用时明确报错。
