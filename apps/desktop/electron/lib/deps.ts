/**
 * 引擎 Python 依赖引导（§8.5 干净环境软降级的解法）。
 *
 * 技能引擎脚本跑在系统 python3 上，干净机器缺 pandas/numpy/tushare 等。
 * 方案：首次（或解释器版本变化后）`pip install --target` 到
 * ``~/.kstock/py-deps``，引擎子进程 PYTHONPATH 前置该目录——pip 按当前
 * 解释器解析兼容 wheel，免打包 wheels 的 cp-tag 矩阵。
 *
 * 快路径：探针（import 全表）通过 → 写 marker，此后零开销跳过；
 * 开发机已有用户级安装时探针直接通过，同样零动作。
 * ``KSTOCK_SKIP_DEP_BOOTSTRAP=1`` 显式跳过（自管依赖）。
 * 任何失败只记日志不抛错——技能侧按「无数据」口径诚实降级，
 * 不阻塞应用启动。
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";
import { appDataDirectory } from "./engine";
import { logMain } from "./logger";

/** 技能引擎的 Python 依赖全集（import 名 → pip 包名）。 */
const DEPENDENCIES: ReadonlyArray<{ module: string; pip: string }> = [
  { module: "pandas", pip: "pandas" },
  { module: "numpy", pip: "numpy" },
  { module: "requests", pip: "requests" },
  { module: "dotenv", pip: "python-dotenv" },
  { module: "tushare", pip: "tushare" },
  { module: "matplotlib", pip: "matplotlib" },
];

/** 引擎依赖安装目录：~/.kstock/py-deps（随数据目录走，打包态同样成立）。 */
export function pythonDepsDirectory(): string {
  return join(appDataDirectory(), "py-deps");
}

/** 引擎 PYTHONPATH：py-deps 前置（目录存在时），拼接既有值；无则 undefined。
 * 分隔符平台相关（Windows ';'，Unix ':'）——写死 ':' 在 Windows 上会把
 * 整串拼成一个非法路径，依赖层整体失效。 */
export function enginePythonPath(): string | undefined {
  const parts = [pythonDepsDirectory(), process.env.PYTHONPATH].filter(
    (value): value is string => typeof value === "string" && value !== "",
  );
  if (parts.length === 0) return undefined;
  return parts.join(platform() === "win32" ? ";" : ":");
}

/** 探针/安装共用的子进程环境（PYTHONPATH 含 py-deps）。 */
function pythonEnv(): NodeJS.ProcessEnv {
  const path = enginePythonPath();
  return path === undefined ? { ...process.env } : { ...process.env, PYTHONPATH: path };
}

/** python 启动器：bin + 固定前缀参数（py 启动器需 -3 指定大版本）。 */
interface PythonLauncher {
  bin: string;
  prefix: string[];
}

/**
 * 解析可用的 python 解释器：python3 → python → py -3。
 * py 启动器兜底覆盖 Windows python.org 安装器的默认形态（只装 py
 * launcher、PATH 不加 python/python3，非常常见）。
 */
function resolvePythonLauncher(): PythonLauncher | null {
  const candidates: PythonLauncher[] = [
    { bin: "python3", prefix: [] },
    { bin: "python", prefix: [] },
    { bin: "py", prefix: ["-3"] },
  ];
  for (const candidate of candidates) {
    const probe = spawnSync(candidate.bin, [...candidate.prefix, "--version"], {
      encoding: "utf8",
      timeout: 15_000,
    });
    if (probe.status === 0) return candidate;
  }
  return null;
}

/** pythonX.Y（marker 的版本键，解释器升级后自动重装）。 */
function pythonVersionKey(launcher: PythonLauncher): string | null {
  const probe = spawnSync(
    launcher.bin,
    [...launcher.prefix, "-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"],
    {
      encoding: "utf8",
      timeout: 15_000,
    },
  );
  const match = (probe.stdout ?? "").trim().match(/^\d+\.\d+$/);
  return match === null ? null : match[0];
}

/** import 探针：全部依赖可导入返回 true。
 *
 * `-s` 隔离 user-site：PYTHONPATH（py-deps）照常生效，但用户站点包
 * 不再泄漏进探针——否则 user-site 里恰好装过 numpy 会让「py-deps 未
 * 安装/ABI 错位」被误探通过、写出假 marker（3.9/3.14 错位实录根因）。
 */
function dependenciesImportable(launcher: PythonLauncher): boolean {
  const script = `import ${DEPENDENCIES.map((d) => d.module).join(", ")}`;
  const probe = spawnSync(launcher.bin, [...launcher.prefix, "-s", "-c", script], {
    encoding: "utf8",
    timeout: 120_000,
    env: pythonEnv(),
  });
  return probe.status === 0;
}

/**
 * 引擎启动前的依赖引导（幂等；永不抛错）。
 * marker 命中 → 探针通过 → pip 安装 → 复测写 marker，四级递进。
 */
export async function ensureEnginePythonDeps(): Promise<void> {
  if (process.env.KSTOCK_SKIP_DEP_BOOTSTRAP === "1") {
    logMain("Python 依赖引导：KSTOCK_SKIP_DEP_BOOTSTRAP=1，跳过");
    return;
  }
  const launcher = resolvePythonLauncher();
  if (launcher === null) {
    logMain("Python 依赖引导：未找到 python3/python/py，技能引擎将按无数据降级（请安装 Python 3.9+）");
    return;
  }
  const binLabel = [launcher.bin, ...launcher.prefix].join(" ");
  const versionKey = pythonVersionKey(launcher);
  const depsDir = pythonDepsDirectory();
  const marker = versionKey === null ? null : join(depsDir, `.ready-${versionKey}`);
  // 解释器版本 pin：marker 只证明「装过」，pin 证明「用当前解释器装的」。
  // py-deps 是 pip --target 的扁平目录，多解释器先后安装会留下混 ABI 的
  // .so（3.9/3.14 错位实录：marker 命中跳过探针，二进制包全挂）。
  // pin 与当前版本不一致 → marker 作废，重走探针/安装（--upgrade 覆盖）。
  const pinPath = join(depsDir, ".python-version-pin");
  let pinMatches = false;
  if (existsSync(pinPath)) {
    try {
      pinMatches = readFileSync(pinPath, "utf8").trim() === versionKey;
    } catch {
      pinMatches = false;
    }
  }
  if (marker !== null && existsSync(marker) && pinMatches) return;
  if (marker !== null && existsSync(marker) && !pinMatches) {
    logMain(
      `Python 依赖引导：marker 与解释器 pin 不一致（当前 ${versionKey ?? "?"}），` +
        "py-deps 可能是其他 Python 版本安装的（ABI 错位）——重新探针并按需重装…",
    );
  }

  if (dependenciesImportable(launcher)) {
    mkdirSync(depsDir, { recursive: true });
    if (marker !== null) writeFileSync(marker, `${new Date().toISOString()}\n`);
    if (versionKey !== null) writeFileSync(pinPath, `${versionKey}\n`);
    logMain(`Python 依赖引导：环境已有全部依赖（${binLabel}），无需安装`);
    return;
  }

  const pip = spawnSync(launcher.bin, [...launcher.prefix, "-m", "pip", "--version"], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (pip.status !== 0) {
    logMain(
      `Python 依赖引导：${binLabel} 缺 pip（-m pip 不可用）。请安装 pip 后重启；` +
        "技能引擎在此之前按无数据降级",
    );
    return;
  }

  logMain(`Python 依赖引导：首次安装引擎依赖到 ${depsDir}（约 1-3 分钟，仅此一次）…`);
  const packages = DEPENDENCIES.map((d) => d.pip);
  const startedAt = Date.now();
  const install = spawnSync(
    launcher.bin,
    [...launcher.prefix, "-m", "pip", "install", "--target", depsDir, "--upgrade", ...packages],
    {
      encoding: "utf8",
      timeout: 10 * 60_000,
      env: pythonEnv(),
    },
  );
  if (install.status !== 0) {
    // status null = 被信号杀（多半是 10 分钟超时，慢网络装 pandas/
    // numpy/matplotlib 可能超）或 spawn 失败——把 signal/error 说清楚，
    // 别只给一个「exit null」（Windows 实机反馈无法定位）。
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const detail =
      install.error?.message ?? (install.stderr ?? install.stdout ?? "").trim().slice(-400);
    logMain(
      `Python 依赖引导：安装失败（exit ${install.status}` +
        `${install.signal === null ? "" : `, signal ${install.signal}`}, 耗时 ${elapsed}s` +
        `）——${detail === "" ? "无输出（若为超时请重跑，已装包会续传）" : detail}`,
    );
    return;
  }
  if (!dependenciesImportable(launcher)) {
    logMain("Python 依赖引导：安装后探针仍未通过，请查看上方日志；技能引擎按无数据降级");
    return;
  }
  if (marker !== null) writeFileSync(marker, `${new Date().toISOString()}\n`);
  if (versionKey !== null) writeFileSync(pinPath, `${versionKey}\n`);
  logMain("Python 依赖引导：依赖就绪（marker + 解释器 pin 已写入，后续启动零开销）");
}
