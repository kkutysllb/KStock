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
import { dirname, join } from "node:path";
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

/** 定位内置 gateway 可执行文件：打包态读 resources/gateway，开发态回退到项目 dist。 */
function gatewayExecutable(): string {
  const exeName = platform() === "win32" ? "kstock-gateway.exe" : "kstock-gateway";
  const bundled = join(process.resourcesPath, "gateway", exeName);
  if (existsSync(bundled)) return bundled;
  // 开发态：apps/desktop → ../../dist/kstock-gateway
  const devPath = join(app.getAppPath(), "..", "..", "dist", "kstock-gateway", exeName);
  if (existsSync(devPath)) return devPath;
  throw new Error(
    `内置 gateway 缺失：${bundled}（开发态请先执行 scripts/build-gateway-bundle.sh，` +
      `或手动 \`uv run python scripts/run_gateway.py\` 启动 gateway）`,
  );
}

function gatewayLogFd(): number {
  const logsDir = join(appDataDirectory(), "logs");
  mkdirSync(logsDir, { recursive: true });
  const logPath = join(logsDir, "desktop-gateway.log");
  const fd = openSync(logPath, "a");
  appendFileSync(fd, `\n=== starting bundled gateway ===\n`);
  return fd;
}

/** 终止整个进程树。 */
function killProcessTree(pid: number): void {
  if (platform() === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
  } else {
    try {
      // spawn 时已 detached 建独立进程组，kill(-pid) 整树终止。
      process.kill(-pid, "SIGTERM");
    } catch {
      // 进程已退出或信号失败，忽略。
    }
  }
}

/**
 * 等待端口完全释放（重启场景）。
 *
 * gateway graceful shutdown 需要 1-2s 完成 uvicorn ``Shutting down`` 序列并
 * 释放监听 socket。``stop()`` 后立即 ``spawn`` 新进程，会出现旧进程端口
 * 还没释放、新进程 bind 失败（EADDRINUSE）的竞态。此处轮询直到端口探测
 * 失败或超时，保证后续 spawn 不会撞上残留的旧监听。
 */
async function waitForPortReleased(port: number, timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    const alive = await portAlive(port);
    if (!alive) return;
    // eslint-disable-next-line no-await-in-loop
    await sleep(200);
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

    const exe = gatewayExecutable();
    const dataDir = appDataDirectory();
    const logFd = gatewayLogFd();
    const env = {
      ...process.env,
      // 强制桌面端和 bundled Python/vendor 配置使用同一端点；不能依赖
      // Windows 用户环境中可能残留的 GATEWAY_PORT/GATEWAY_HOST。
      GATEWAY_HOST: "localhost",
      GATEWAY_PORT: String(GATEWAY_PORT),
      KSTOCK_APP_DATA_DIR: dataDir,
    };

    const child = spawn(exe, ["--serve"], {
      env,
      cwd: dirname(exe),
      stdio: ["ignore", logFd, logFd],
      // Unix：建独立进程组以便 kill(-pid) 整树终止。
      detached: platform() !== "win32",
      // Windows：避免 PyInstaller onedir 子进程弹出 cmd 黑窗。
      windowsHide: true,
    });

    child.on("exit", () => {
      if (this.child === child) this.child = null;
    });

    // 等待端口就绪（最长约 20 秒；首次启动需初始化 SQLite + 迁移）。
    for (let i = 0; i < 40; i += 1) {
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
    this.stop();
    // 等待旧进程完全退出并释放端口，避免新进程 bind 撞上残留监听
    // （EADDRINUSE）或端口探测命中正在关闭的旧进程。
    await waitForPortReleased(GATEWAY_PORT);
    return this.ensureStarted();
  }

  /** 终止 gateway 进程树。 */
  stop(): void {
    const child = this.child;
    if (child && child.exitCode === null && child.signalCode === null) {
      killProcessTree(child.pid ?? 0);
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
