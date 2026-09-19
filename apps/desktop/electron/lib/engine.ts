/**
 * 内置引擎子进程管理（2.0：QiLin 3.x 引擎单进程托管）。
 *
 * 发布包在 ``resources/engine/`` 内置引擎单文件可执行（上游
 * build-exe-for-python-sdk 产物，自带 Node 运行时与全部插件依赖）。
 * 桌面端启动时以 ``--profile kstock`` 拉起唯一引擎进程（监听 18001）。
 * stdout 的 token URL（``/workspace?token=...``）仅作就绪信号与日志诊断，
 * 主窗口加载不带 token 的 /workspace，由引擎账户门引导注册/登录；
 * 退出或更新安装前联动终止整个进程树。
 *
 * 所有产品数据面（四库 / 报告 / 公共页 / 量化 API）都在引擎插件体系内，
 * 壳不再有任何业务进程或反向代理。
 */

import { app } from "electron";
import { spawn, type ChildProcess } from "node:child_process";
import { createConnection } from "node:net";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir, platform } from "node:os";
import { ensureEnginePythonDeps, enginePythonPath } from "./deps";
import { logMain } from "./logger";

/**
 * 内置引擎监听端口（1.x gateway 沿用同一端口，用户无缝升级）。
 * dev / 测试可用 ``KSTOCK_ENGINE_PORT`` 覆盖，避免与本机遗留进程抢端口。
 */
export const ENGINE_PORT = Number.parseInt(process.env.KSTOCK_ENGINE_PORT ?? "", 10) || 18001;

const ENGINE_HOSTS = ["localhost", "127.0.0.1", "::1"];

/** 启动参数：kstock profile + 固定端口 + 不自动开浏览器。 */
const ENGINE_ARGS = ["--profile", "kstock", "--port", String(ENGINE_PORT), "--no-open"];

/** 用户数据根目录（四库 db / 报告 / 日志）。 */
export function appDataDirectory(): string {
  return join(homedir(), ".kstock");
}

/** 引擎 home（profiles / auth / settings）。 */
export function qilinHomeDirectory(): string {
  return join(appDataDirectory(), "qilin-home");
}

/** KStock 插件包根目录：dev 为仓库 kstock/；打包态为 resources/engine/plugins。 */
function pluginPackagesRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "engine", "plugins")
    : resolve(app.getAppPath(), "..", "..", "kstock");
}

/**
 * 确保 kstock profile 存在且插件链接指向当前安装位置（首启引导 + 迁移修复）。
 *
 * profile = 清单（bundles 叠层 + link 依赖）+ node_modules 相对符号链接；
 * 两层 patch 都是空数组——全部 KStock 定制在 @kstock/web 的 bundle patch 里，
 * 因此可以纯程序化创建。已存在的 profile 只刷新指向失效的链接（例如仓库
 * 移动 / 版本升级换插件目录），不碰用户的账户与会话数据。
 *
 * @returns profile 目录。
 */
export function ensureKstockProfile(): string {
  const profileDir = join(qilinHomeDirectory(), "profiles", "kstock");
  const manifestPath = join(profileDir, "package.json");
  const pluginRoot = pluginPackagesRoot();
  const packages: Array<[string, string]> = [
    ["@kstock/accounts-local", "accounts"],
    ["@kstock/client-brand", "client-brand"],
    ["@kstock/client-presets", "presets-ui"],
    ["@kstock/client-datasources", "datasources-ui"],
    ["@kstock/quant", "quant"],
    ["@kstock/quant-strategies", "quant-strategies"],
    ["@kstock/quant-factors", "quant-factors"],
    ["@kstock/quant-selections", "quant-selections"],
    ["@kstock/quant-reports", "quant-reports"],
    ["@kstock/web", "web"],
  ];

  const dependencies = Object.fromEntries(
    packages.map(([name, dir]) => [name, `link:${join(pluginRoot, dir)}`]),
  );
  const manifest = {
    name: "qilin-profile-kstock",
    private: true,
    dependencies,
    qilin: {
      profile: {
        bundles: ["@qilin/base", "@qilin/web-app", "@kstock/web"],
        patchReload: "live",
      },
    },
  };

  if (!existsSync(manifestPath)) {
    mkdirSync(profileDir, { recursive: true });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    logMain(`已创建 kstock profile：${profileDir}（插件根 ${pluginRoot}）`);
  } else {
    // 包集演进（例如新增 @kstock/accounts-local）：依赖缺失或指向失效时补写
    // 清单，不碰用户其余数据。
    try {
      const existing = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        dependencies?: Record<string, string>;
      };
      const deps = existing.dependencies ?? {};
      const stale = packages.some(([name, dir]) => deps[name] !== `link:${join(pluginRoot, dir)}`);
      if (stale) {
        existing.dependencies = dependencies;
        writeFileSync(manifestPath, `${JSON.stringify(existing, null, 2)}\n`);
        logMain("kstock profile 包集已更新（补齐 @kstock 插件依赖）");
      }
    } catch (error) {
      logMain(`kstock profile 清单读取失败，保留原样：${String(error)}`);
    }
  }

  // node_modules/@kstock/<包名尾段> → 插件包目录（相对链接，指向失效时重建）。
  // 链接名必须取包名尾段（如 @kstock/accounts-local → accounts-local），
  // 不能用源目录名（accounts）——Loader 按行里的包名解析，名不一致 =
  // "failed to import"，该插件整面（登录/注册/会话门）静默失效。
  const modulesDir = join(profileDir, "node_modules", "@kstock");
  mkdirSync(modulesDir, { recursive: true });
  for (const [name, dir] of packages) {
    const segment = name.split("/")[1] ?? dir;
    const linkPath = join(modulesDir, segment);
    const target = join(pluginRoot, dir);
    if (!existsSync(join(target, "package.json"))) continue;
    const stale =
      !existsSync(linkPath) ||
      !existsSync(join(linkPath, "package.json")) ||
      (lstatSync(linkPath).isSymbolicLink() &&
        resolve(dirname(linkPath), readlinkSync(linkPath)) !== target);
    if (!stale) continue;
    rmSync(linkPath, { force: true });
    symlinkSync(target, linkPath, "dir");
    // 清理按目录名误建的旧链接（与包名尾段不一致时）。
    if (segment !== dir) rmSync(join(modulesDir, dir), { force: true });
  }
  return profileDir;
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
 * 端口探测。引擎默认绑定 loopback；Windows 上可能优先解析为 IPv6 ::1。
 * 同时探测三个主机名，避免把已就绪的引擎判成超时。
 */
export async function portAlive(port: number): Promise<boolean> {
  const results = await Promise.all(
    ENGINE_HOSTS.map((host) => tryConnect(host, port)),
  );
  return results.some(Boolean);
}

/**
 * 判定端口上的监听者是否为 2.0 引擎。
 *
 * 旧版 KStock（1.x）的 PyInstaller gateway 与本引擎同占 18001，匿名请求
 * 一律 401 JSON（uvicorn）；2.0 引擎则对自家静态资源
 * ``/kstock/kstock-logo.svg`` 匿名返回 200 + image/svg+xml。据此区分
 * 「可复用的外部引擎实例」与「端口被遗留进程占用」——后者必须显式报错，
 * 否则窗口会把旧网关的 401 文本当页面加载（2.0 内测「落地页全乱」即此因）。
 */
async function portHasKstockEngine(port: number): Promise<boolean> {
  for (const host of ["127.0.0.1", "[::1]"]) {
    try {
      const response = await fetch(`http://${host}:${port}/kstock/kstock-logo.svg`, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok && (response.headers.get("content-type") ?? "").includes("svg")) {
        return true;
      }
    } catch {
      // 探测失败换下一个主机名。
    }
  }
  return false;
}

/** 从引擎 stdout 行里提取启动 token URL（``.../workspace?token=...``）。 */
export function parseTokenUrl(line: string): string | null {
  const match = line.match(/https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)\/workspace\?token=([A-Za-z0-9._-]+)/);
  return match ? match[0] : null;
}

/** 引擎子进程启动规格。 */
interface EngineLaunchSpec {
  command: string;
  args: string[];
  cwd: string;
  /** 追加到进程环境的力量值（ELECTRON_RUN_AS_NODE 等）。 */
  env: Record<string, string>;
  /** 用于错误信息与启动日志的人可读描述。 */
  label: string;
}

/** KStock agent preset 目录：dev 为仓库 kstock/presets；打包态为 resources/engine/presets。 */
function presetsDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "engine", "presets")
    : resolve(app.getAppPath(), "..", "..", "kstock", "presets");
}

/**
 * 1.x 数据源凭据迁移：老版把 TUSHARE_TOKEN / IWENCAI_API_KEY 等存在
 * ``~/.kstock/config/secrets.env``，新版引擎环境不含它们会导致数据源显示
 * 未配置、相关技能不可用。启动引擎前把老文件里的 KEY=VALUE 并入环境
 * （已在环境中的键不覆盖，显式设置优先）。解析失败的行安静跳过。
 */
function legacySecretsEnvironment(): Record<string, string> {
  const secretsPath = join(appDataDirectory(), "config", "secrets.env");
  if (!existsSync(secretsPath)) return {};
  const secrets: Record<string, string> = {};
  try {
    for (const line of readFileSync(secretsPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed === "" || trimmed.startsWith("#")) continue;
      const equals = trimmed.indexOf("=");
      if (equals <= 0) continue;
      const key = trimmed.slice(0, equals).trim();
      if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) continue;
      let value = trimmed.slice(equals + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value !== "") secrets[key] = value;
    }
  } catch (error) {
    logMain(`secrets.env 读取失败，跳过数据源凭据迁移：${String(error)}`);
    return {};
  }
  return secrets;
}

/**
 * 解析引擎启动方式，按优先级：
 *
 * 1. 打包态 ``resources/engine/kstock-engine(.exe)``（electron-builder
 *    extraResources 注入；build-engine-bundle.sh 产物，文件名固定）。
 * 2. 开发态 ``<repo>/dist-exe/kstock-engine(.exe)``（同一构建脚本的本地产物）。
 * 3. dev 兜底：系统 Node（≥22.5）直接跑上游 CLI 源码（vendor/qilin），
 *    无需先构建引擎单文件。
 *
 * 打包态任何路径缺失都抛错指引重装；dev 态兜底失败指引跑引擎构建。
 */
function resolveEngineLaunch(): EngineLaunchSpec {
  const exeName = platform() === "win32" ? "kstock-engine.exe" : "kstock-engine";
  const pythonPath = enginePythonPath();
  const baseEnv = {
    QILIN_HOME: qilinHomeDirectory(),
    KSTOCK_APP_DATA_DIR: appDataDirectory(),
    KSTOCK_PRESETS_DIR: presetsDirectory(),
    // 引擎技能的 Python 依赖层（~/.kstock/py-deps，deps.ts 引导安装）。
    ...(pythonPath === undefined ? {} : { PYTHONPATH: pythonPath }),
    // 1.x 迁移：老 secrets.env 的数据源凭据注入引擎环境（不覆盖已有键）。
    ...legacySecretsEnvironment(),
  };

  const bundled = join(process.resourcesPath, "engine", exeName);
  if (existsSync(bundled)) {
    return {
      command: bundled,
      args: ENGINE_ARGS,
      cwd: dirname(bundled),
      env: baseEnv,
      label: "bundled engine (single-file exe)",
    };
  }

  // 开发态：apps/desktop → ../../dist-exe（与 scripts/build-engine-bundle.sh 产物路径一致）
  const repoRoot = resolve(app.getAppPath(), "..", "..");
  const devExe = join(repoRoot, "dist-exe", exeName);
  if (existsSync(devExe)) {
    return {
      command: devExe,
      args: ENGINE_ARGS,
      cwd: dirname(devExe),
      env: baseEnv,
      label: "dev engine (single-file exe)",
    };
  }

  if (!app.isPackaged) {
    const engineRepo = join(repoRoot, "vendor", "qilin");
    const cliEntry = join(engineRepo, "apps", "cli", "src", "bin.ts");
    if (!existsSync(cliEntry)) {
      throw new Error(
        `dev 引擎入口缺失：${cliEntry}（请确认 vendor/qilin 快照完整，或先执行引擎单文件构建）`,
      );
    }
    return {
      // dev 兜底用系统 Node（≥22.5，需 node:sqlite 支撑量化存储插件）。
      // 打包态引擎 exe 自带 Node 24，无此外部依赖。不用 Electron 自带
      // Node：其对 pnpm 符号链接布局的 ESM 解析有兼容问题（实测 commander
      // 解析失败），且上游 CLI 本就按自身工具链运行。
      command: platform() === "win32" ? "node.exe" : "node",
      args: ["--import", "tsx/esm", "apps/cli/src/bin.ts", ...ENGINE_ARGS],
      cwd: engineRepo,
      env: baseEnv,
      label: "dev engine (system node + tsx, vendor/qilin)",
    };
  }

  throw new Error(
    `内置引擎缺失：${bundled}（打包态请重装 KStock；dev 态请执行 bash scripts/build-engine-bundle.sh 或确认 vendor/qilin 存在）`,
  );
}

/** 引擎日志 fd 缓存：首次打开覆盖写，本次进程内追加。 */
let engineLogFdCache: number | null = null;

function engineLogFd(): number {
  const logsDir = join(appDataDirectory(), "logs");
  mkdirSync(logsDir, { recursive: true });
  if (engineLogFdCache === null) {
    engineLogFdCache = openSync(join(logsDir, "desktop-engine.log"), "w");
  }
  return engineLogFdCache;
}

/** 终止整个进程树（SIGTERM，允许 graceful shutdown）。 */
function killProcessTree(pid: number): void {
  if (pid <= 0) return;
  if (platform() === "win32") {
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
  if (pid <= 0 || platform() === "win32") return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // 进程已退出或信号失败，忽略。
  }
}

export interface EngineStatus {
  port: number;
  running: boolean;
  childAlive: boolean;
}

/** 内置引擎进程管理器（单例，由主进程持有）。 */
export class EngineProcess {
  private child: ChildProcess | null = null;

  private childAlive(): boolean {
    return (
      this.child !== null &&
      !this.child.killed &&
      this.child.exitCode === null &&
      this.child.signalCode === null
    );
  }

  /**
   * 启动引擎并返回主窗口应加载的地址。
   *
   * 始终返回不带 token 的 /workspace：KStock 是账户门产品，未登录用户由
   * 引擎会话门 302 到 KStock 落地页走注册/登录（引擎 stdout 的 token URL
   * 是上游本地信任机制，装进窗口会绕过账户门直进工作台）。token 行仍
   * 作为「引擎就绪」信号等待，但只用于日志诊断。
   */
  async ensureStarted(): Promise<string> {
    const workspaceUrl = `http://127.0.0.1:${ENGINE_PORT}/workspace`;

    // 首启引导 / 修复 profile 插件链接（幂等；已有链接且有效时零改动）。
    try {
      ensureKstockProfile();
    } catch (err) {
      logMain(`profile 引导失败（继续尝试启动）: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (await portAlive(ENGINE_PORT)) {
      if (await portHasKstockEngine(ENGINE_PORT)) {
        // 已有引擎在跑（本进程重启场景 engine.restart 已先 kill；这里只可能是外部实例）。
        logMain(`端口 ${ENGINE_PORT} 已有引擎监听，跳过拉起（外部实例）`);
        return workspaceUrl;
      }
      throw new Error(
        `端口 ${ENGINE_PORT} 已被非 KStock 2.0 引擎的进程占用（最常见：旧版 KStock.app 仍在运行，` +
          `其 1.x gateway 常驻此端口；也可能是其他程序）。请先退出占用进程（旧版请整个退出 KStock.app）后重试。`,
      );
    }

    // 干净环境首次启动的 Python 依赖引导（探针通过/已装则零开销跳过）。
    await ensureEnginePythonDeps();

    const launch = resolveEngineLaunch();
    const logFd = engineLogFd();
    appendFileSync(logFd, `\n=== starting engine ===\n[launcher] mode=${launch.label} command=${launch.command} args=${JSON.stringify(launch.args)} cwd=${launch.cwd}\n`);

    const child = spawn(launch.command, launch.args, {
      env: { ...process.env, ...launch.env },
      cwd: launch.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      // Unix：独立进程组以便 kill(-pid) 整树终止。
      detached: platform() !== "win32",
      windowsHide: true,
    });
    logMain(`引擎已拉起（${launch.label}），等待就绪…`);

    let tokenUrl: string | null = null;
    const capture = (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      appendFileSync(logFd, text);
      if (tokenUrl === null) {
        for (const line of text.split("\n")) {
          const parsed = parseTokenUrl(line);
          if (parsed) {
            tokenUrl = parsed;
            break;
          }
        }
      }
    };
    child.stdout?.on("data", capture);
    child.stderr?.on("data", capture);
    child.on("exit", () => {
      if (this.child === child) this.child = null;
    });

    // 等待端口就绪并拿到 token（引擎冷启动含 profile 组装，留足缓冲）。
    for (let i = 0; i < 120; i += 1) {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(
          `引擎在监听端口前退出（code=${child.exitCode}, signal=${child.signalCode}）；` +
            `请查看日志：${join(appDataDirectory(), "logs", "desktop-engine.log")}`,
        );
      }
      if (tokenUrl !== null && (await portAlive(ENGINE_PORT))) {
        this.child = child;
        logMain(`引擎已就绪：${workspaceUrl}（token 引导已忽略，走账户门）`);
        return workspaceUrl;
      }
      // 每 5s 打点：启动卡住时终端能看到 token/端口各自的状态。
      if (i > 0 && i % 10 === 0) {
        logMain(`等待引擎就绪… ${(i * 0.5).toFixed(0)}s（token ${tokenUrl !== null ? "已捕获" : "未捕获"}）`);
      }
      await sleep(500);
    }
    this.child = child;
    if (tokenUrl !== null) {
      // 端口探测 60s 未过但 token 已出现：大概率是探测面问题而非引擎问题，
      // 直接放行（引擎自身已声明就绪）。
      logMain(`引擎 token 已就绪但端口探测 60s 未通过，直接放行：${workspaceUrl}`);
      return workspaceUrl;
    }
    throw new Error(
      `引擎启动超时，端口 ${ENGINE_PORT} 未就绪；请查看日志：` +
        `${join(appDataDirectory(), "logs", "desktop-engine.log")}`,
    );
  }

  /** 重启引擎，返回新的引导地址（旧进程整树终止后再拉起）。 */
  async restart(): Promise<string> {
    await this.killAndWait();
    return this.ensureStarted();
  }

  /**
   * 终止引擎进程树并等待真正退出（SIGTERM → 超时 SIGKILL 兜底）。
   * 用于应用退出与更新安装前：防止引擎残留占用端口 / 安装器文件替换失败。
   */
  async killAndWait(timeoutMs = 5000): Promise<void> {
    const child = this.child;
    if (!child || child.exitCode !== null || child.signalCode !== null) {
      this.child = null;
      return;
    }
    const pid = child.pid ?? 0;

    const exited = new Promise<void>((resolveExit) => {
      child.once("exit", () => resolveExit());
    });

    killProcessTree(pid);

    const timer = new Promise<void>((resolveTimer) => setTimeout(resolveTimer, timeoutMs));
    await Promise.race([exited, timer]);

    if (child.exitCode === null && child.signalCode === null) {
      forceKill(pid);
      await new Promise<void>((resolveKill) => setTimeout(resolveKill, 300));
    }
    this.child = null;
  }

  /** 当前状态。 */
  async status(): Promise<EngineStatus> {
    return {
      port: ENGINE_PORT,
      running: await portAlive(ENGINE_PORT),
      childAlive: this.childAlive(),
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
