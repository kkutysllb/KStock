/**
 * 内置 gateway 子进程管理（对齐原 Rust ``src-tauri/src/gateway.rs``）。
 *
 * 发布包在 ``resources/gateway/`` 内置自包含的 gateway 可执行目录
 * （PyInstaller onedir：Python 运行时 + 全部依赖 + 技能包 + 配置模板）。
 * 桌面端启动时自动拉起唯一的 gateway server child（监听 18001），
 * 退出或重启时联动终止整个进程树，实现开箱即用。
 */

import { app } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  openSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir, platform } from "node:os";

/** 内置 gateway 监听端口（与 scripts/run_gateway.py 的 GATEWAY_PORT 默认值一致）。 */
export const GATEWAY_PORT = 18001;

const GATEWAY_HOSTS = ["localhost", "127.0.0.1", "::1"];

/** 用户数据根目录（与 scripts/run_gateway.py 默认 ~/.kstock 一致）。 */
export function appDataDirectory(): string {
  return join(homedir(), ".kstock");
}

function tryConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    const socket = createConnection({ host, port }, () => {
      socket.destroy();
      finish(true);
    });
    socket.on("error", () => finish(false));
    socket.setTimeout(800, () => {
      socket.destroy();
      finish(false);
    });
  });
}

/**
 * 端口探测。Python 默认绑定 localhost；Windows 上可能优先解析为 IPv6 ::1。
 * 同时探测 localhost、IPv4 和 IPv6，避免把已就绪的 gateway 判成超时。
 */
export async function portAlive(port: number): Promise<boolean> {
  const results = await Promise.all(
    GATEWAY_HOSTS.map((host) => tryConnect(host, port)),
  );
  return results.some(Boolean);
}

/** gateway 子进程启动规格：打包态走 PyInstaller 产物；dev 模式无产物时回退到 Python 入口。 */
interface GatewayLaunchSpec {
  /** spawn 的可执行程序（绝对路径，或 PATH 中可解析的二进制名）。 */
  command: string;
  /** 透传给 command 的参数列表。 */
  args: string[];
  /** 子进程工作目录。 */
  cwd: string;
  /** 用于错误信息的人可读描述（与日志/UI 文案一致）。 */
  label: string;
}

/**
 * 解析 gateway 子进程启动方式，按以下顺序尝试：
 *
 * 1. 打包态 ``process.resourcesPath/gateway/kstock-gateway(.exe)``（electron-builder
 *    extraResources 注入位置）。
 * 2. 开发态 ``<repo>/dist/kstock-gateway/kstock-gateway(.exe)``（scripts/build-gateway-bundle.sh
 *    的 PyInstaller 产物；dev 与打包态同源同一份二进制，保证开发环境验证效果一致）。
 * 3. dev 模式 ``app.isPackaged === false`` 且 1/2 均缺失时，自动回退到 ``uv run python
 *    scripts/run_gateway.py``，cwd 切到仓库根，让 venv/.venv 解析到 ``.venv``。
 *    这样新贡献者无需先跑 PyInstaller 打包就能 dev；运行期行为与 1/2 完全一致
 *    （同一份 scripts/run_gateway.py）。
 *
 * 任何路径都不可用时抛错：打包态指引重装；dev 模式指引装 uv 或构建产物。
 */
function resolveGatewayLaunch(): GatewayLaunchSpec {
  const exeName = platform() === "win32" ? "kstock-gateway.exe" : "kstock-gateway";
  const bundled = join(process.resourcesPath, "gateway", exeName);
  if (existsSync(bundled)) {
    return {
      command: bundled,
      args: ["--serve"],
      cwd: dirname(bundled),
      label: "bundled gateway (PyInstaller onedir)",
    };
  }
  // 开发态：apps/desktop → ../../dist/kstock-gateway（与 build-gateway-bundle.sh 产物路径一致）
  const devDist = join(app.getAppPath(), "..", "..", "dist", "kstock-gateway", exeName);
  if (existsSync(devDist)) {
    return {
      command: devDist,
      args: ["--serve"],
      cwd: dirname(devDist),
      label: "dev bundled gateway (PyInstaller onedir)",
    };
  }
  // dev 模式兜底：直接 spawn `uv run python scripts/run_gateway.py`，无需先打 PyInstaller 包。
  // 打包态（app.isPackaged === true）下不进入此分支——客户机不应当依赖外部 uv/python。
  if (!app.isPackaged) {
    const repoRoot = resolve(app.getAppPath(), "..", "..");
    const scriptPath = join(repoRoot, "scripts", "run_gateway.py");
    if (!existsSync(scriptPath)) {
      throw new Error(
        `dev gateway 入口缺失：${scriptPath}（仓库结构异常，请确认 scripts/run_gateway.py 存在）`,
      );
    }
    const uv = resolveUvBinary(repoRoot);
    if (!uv) {
      throw new Error(
        `dev gateway 兜底失败：未在 PATH 找到 uv，且项目本地 .tools/uv/${platform() === "win32" ? "uv.exe" : "uv"} 不存在。` +
          `解决方案：(1) 安装 uv（https://github.com/astral-sh/uv）；` +
          `(2) 执行 bash scripts/build-gateway-bundle.sh 构建 PyInstaller 产物；` +
          `(3) 手动 \`uv run python scripts/run_gateway.py\` 启动 gateway 后再启动 Electron。`,
      );
    }
    return {
      command: uv,
      // --no-sync 跳过 venv 同步（开发态期望 venv 已就绪；省一次 lockfile 检查）
      args: ["run", "--no-sync", "python", "scripts/run_gateway.py"],
      cwd: repoRoot,
      label: "dev python gateway (uv run scripts/run_gateway.py)",
    };
  }
  throw new Error(
    `内置 gateway 缺失：${bundled}（打包态请重装 KStock；dev 态请确认 uv 可用或执行 bash scripts/build-gateway-bundle.sh）`,
  );
}

/**
 * 解析 uv 二进制位置。优先级：
 * 1. 项目本地 ``<repo>/.tools/uv/uv(.exe)``（与 scripts/kstock_python_runtime.py
 *    的策略一致；CI 与本地共享同一份 uv，避免 winget/homebrew 版本漂移）。
 * 2. PATH 上的 ``uv``（依赖用户已安装 uv）。
 *
 * 未找到返回 null；调用方负责给出修复指引。
 */
function resolveUvBinary(repoRoot: string): string | null {
  const localCandidates = [
    join(repoRoot, ".tools", "uv", platform() === "win32" ? "uv.exe" : "uv"),
    join(repoRoot, ".tools", "uv", "uv.exe"),
    join(repoRoot, ".tools", "uv", "uv"),
  ];
  for (const candidate of localCandidates) {
    if (existsSync(candidate)) return candidate;
  }
  // 退化到 PATH：让 Node spawn 自行解析。无法提前判定 uv 是否真的在 PATH，
  // 但 launch 失败时会得到 ENOENT，调用方 try/catch 可识别。
  return "uv";
}

/** gateway 子进程日志 fd 缓存：首次打开时覆盖写入，本次进程内复用。 */
let gatewayLogFdCache: number | null = null;

function gatewayLogFd(): number {
  const logsDir = join(appDataDirectory(), "logs");
  mkdirSync(logsDir, { recursive: true });
  const logPath = join(logsDir, "desktop-gateway.log");
  if (gatewayLogFdCache === null) {
    // "w" 首次打开即覆盖写入；fd 缓存后同一进程内的 gateway 重启继续追加，
    // 实现「每次启动覆盖、本次运行追加」，避免跨启动日志无限膨胀。
    gatewayLogFdCache = openSync(logPath, "w");
  }
  appendFileSync(gatewayLogFdCache, `\n=== starting bundled gateway ===\n`);
  return gatewayLogFdCache;
}

/** 终止整个进程树（SIGTERM，允许 graceful shutdown）。 */
function killProcessTree(pid: number): void {
  if (pid <= 0) return;
  if (platform() === "win32") {
    // Windows taskkill /F 已是强制终止（等同 SIGKILL），不再二次优雅。
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  } else {
    try {
      // spawn 时已 detached 建独立进程组，kill(-pid) 整树 SIGTERM。
      process.kill(-pid, "SIGTERM");
    } catch {
      // 进程已退出或信号失败，忽略。
    }
  }
}

/** SIGKILL 强制终止进程树（graceful 超时兜底）。 */
function forceKill(pid: number): void {
  if (pid <= 0) return;
  if (platform() === "win32") {
    // Windows killProcessTree 已用 /F，这里不重复。
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // 进程已退出或信号失败，忽略。
  }
}


export interface GatewayStatus {
  port: number;
  running: boolean;
  childAlive: boolean;
}

/** 内置 gateway 进程管理器（单例，由主进程持有）。 */
export class GatewayProcess {
  private child: ChildProcess | null = null;

  /** 当前是否已托管一个存活的子进程。 */
  private childAlive(): boolean {
    return (
      this.child !== null &&
      !this.child.killed &&
      this.child.exitCode === null &&
      this.child.signalCode === null
    );
  }

  /** 启动当前实例托管的唯一 gateway server child。 */
  async ensureStarted(): Promise<string> {
    if (this.childAlive() && (await portAlive(GATEWAY_PORT))) {
      return "gateway 已启动";
    }

    // 开发态可能 gateway 已被手动启动（uv run python scripts/run_gateway.py）。
    if (!this.childAlive() && (await portAlive(GATEWAY_PORT))) {
      return "gateway 已启动";
    }

    const launch = resolveGatewayLaunch();
    const dataDir = appDataDirectory();
    const logFd = gatewayLogFd();
    // 写入 launch 路径选择（便于 dev 模式排查回退路径、确认是打包还是 Python 入口）
    appendFileSync(logFd, `[launcher] mode=${launch.label} command=${launch.command} args=${JSON.stringify(launch.args)} cwd=${launch.cwd}\n`);
    const env = {
      ...process.env,
      // 强制桌面端和 bundled Python/vendor 配置使用同一端点；不能依赖
      // Windows 用户环境中可能残留的 GATEWAY_PORT/GATEWAY_HOST。
      GATEWAY_HOST: "localhost",
      GATEWAY_PORT: String(GATEWAY_PORT),
      KSTOCK_APP_DATA_DIR: dataDir,
      // dev 模式 spawn 的 uv/python 子进程默认 buffering 会延迟日志；
      // 强制无缓冲让 desktop-gateway.log 实时可见 gateway 启动进度。
      PYTHONUNBUFFERED: "1",
    };

    const child = spawn(launch.command, launch.args, {
      env,
      cwd: launch.cwd,
      stdio: ["ignore", logFd, logFd],
      // Unix：建独立进程组以便 kill(-pid) 整树终止。
      detached: platform() !== "win32",
      // Windows：避免 PyInstaller onedir / uv 中转进程弹出 cmd 黑窗。
      windowsHide: true,
    });

    child.on("exit", () => {
      if (this.child === child) this.child = null;
    });

    // 等待端口就绪（最长约 60 秒；首次启动需初始化 SQLite + 迁移，
    // dev 模式走 `uv run python scripts/run_gateway.py` 还会再叠 uv 引导 + venv
    // 解析；冷启动实测可达 30-50s。Electron 启动本身已 2-3s，留充足缓冲。
    for (let i = 0; i < 120; i += 1) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(
          `gateway 在监听端口前退出（code=${child.exitCode}, signal=${child.signalCode}）；` +
            `请查看日志：${join(appDataDirectory(), "logs", "desktop-gateway.log")}`,
        );
      }
      // eslint-disable-next-line no-await-in-loop
      if (await portAlive(GATEWAY_PORT)) {
        this.child = child;
        return "gateway 已启动";
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(500);
    }
    this.child = child;
    throw new Error(
      `gateway 启动超时，端口 ${GATEWAY_PORT} 未就绪；请查看日志：` +
        `${join(appDataDirectory(), "logs", "desktop-gateway.log")}`,
    );
  }

  /** 重启 gateway server child。 */
  async restart(): Promise<string> {
    // killAndWait 保证旧进程彻底退出（SIGTERM + SIGKILL 兜底）并释放
    // 端口，避免新进程 bind 撞上残留监听（EADDRINUSE）或端口探测命中
    // 正在关闭的旧进程。
    await this.killAndWait();
    return this.ensureStarted();
  }


  /** 终止 gateway 进程树（仅发 SIGTERM，无等待、无 SIGKILL 兜底）。
   *
   * @deprecated 不要再用：uvicorn graceful shutdown 会等待未断开的 SSE 长
   * 连接导致进程残留，主进程退出后 detached 子进程成为孤儿进程继续占用
   * 端口。请用 ``killAndWait()``（SIGTERM + 超时 SIGKILL 兜底）。
   */
  stop(): void {
    const child = this.child;
    if (child && child.exitCode === null && child.signalCode === null) {
      killProcessTree(child.pid ?? 0);
    }
    this.child = null;
  }

  /**
   * 终止 gateway 进程树并等待子进程真正退出。
   *
   * 用于应用更新安装前的清理：先发 SIGTERM 让 uvicorn graceful shutdown，
   * 若 ``timeoutMs`` 内未退出则 SIGKILL 强制终止（防止僵尸进程占用 .exe
   * 或端口导致安装器替换文件失败）。仅 Unix 需要 SIGKILL 兜底；Windows
   * 的 ``taskkill /F`` 本身就是强制终止。
   */
  async killAndWait(timeoutMs = 5000): Promise<void> {
    const child = this.child;
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      this.child = null;
      return;
    }
    const pid = child.pid ?? 0;

    const exited = new Promise<void>((resolve) => {
      child.once("exit", () => resolve());
    });

    killProcessTree(pid);

    // 等待 graceful exit，超时后 SIGKILL 强制终止整树。
    const timer = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
    await Promise.race([exited, timer]);

    if (child.exitCode === null && child.signalCode === null) {
      forceKill(pid);
      // 给 SIGKILL 一点时间生效。
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
    }
    this.child = null;
  }

  /** 当前状态（供设置页 / 侧边栏展示）。 */
  async status(): Promise<GatewayStatus> {
    return {
      port: GATEWAY_PORT,
      running: await portAlive(GATEWAY_PORT),
      childAlive: this.childAlive(),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
