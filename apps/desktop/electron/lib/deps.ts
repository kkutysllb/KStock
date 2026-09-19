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
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

/** 引擎 PYTHONPATH：py-deps 前置（目录存在时），拼接既有值；无则 undefined。 */
export function enginePythonPath(): string | undefined {
  const parts = [pythonDepsDirectory(), process.env.PYTHONPATH].filter(
    (value): value is string => typeof value === "string" && value !== "",
  );
  return parts.length > 0 ? parts.join(":") : undefined;
}

/** 探针/安装共用的子进程环境（PYTHONPATH 含 py-deps）。 */
function pythonEnv(): NodeJS.ProcessEnv {
  const path = enginePythonPath();
  return path === undefined ? { ...process.env } : { ...process.env, PYTHONPATH: path };
}

/** 解析可用的 python 解释器（python3 优先，Windows 回落 python）。 */
function resolvePythonBin(): string | null {
  for (const bin of ["python3", "python"]) {
    const probe = spawnSync(bin, ["--version"], { encoding: "utf8", timeout: 15_000 });
    if (probe.status === 0) return bin;
  }
  return null;
}

/** pythonX.Y（marker 的版本键，解释器升级后自动重装）。 */
function pythonVersionKey(bin: string): string | null {
  const probe = spawnSync(bin, ["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  const match = (probe.stdout ?? "").trim().match(/^\d+\.\d+$/);
  return match === null ? null : match[0];
}

/** import 探针：全部依赖可导入返回 true。 */
function dependenciesImportable(bin: string): boolean {
  const script = `import ${DEPENDENCIES.map((d) => d.module).join(", ")}`;
  const probe = spawnSync(bin, ["-c", script], { encoding: "utf8", timeout: 120_000, env: pythonEnv() });
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
  const bin = resolvePythonBin();
  if (bin === null) {
    logMain("Python 依赖引导：未找到 python3/python，技能引擎将按无数据降级（请安装 Python 3.9+）");
    return;
  }
  const versionKey = pythonVersionKey(bin);
  const depsDir = pythonDepsDirectory();
  const marker = versionKey === null ? null : join(depsDir, `.ready-${versionKey}`);
  if (marker !== null && existsSync(marker)) return;

  if (dependenciesImportable(bin)) {
    mkdirSync(depsDir, { recursive: true });
    if (marker !== null) writeFileSync(marker, `${new Date().toISOString()}\n`);
    logMain(`Python 依赖引导：环境已有全部依赖（${bin}），无需安装`);
    return;
  }

  const pip = spawnSync(bin, ["-m", "pip", "--version"], { encoding: "utf8", timeout: 30_000 });
  if (pip.status !== 0) {
    logMain(
      `Python 依赖引导：${bin} 缺 pip（python3 -m pip 不可用）。请安装 pip 后重启；` +
        "技能引擎在此之前按无数据降级",
    );
    return;
  }

  logMain(`Python 依赖引导：首次安装引擎依赖到 ${depsDir}（约 1-3 分钟，仅此一次）…`);
  const packages = DEPENDENCIES.map((d) => d.pip);
  const install = spawnSync(bin, ["-m", "pip", "install", "--target", depsDir, "--upgrade", ...packages], {
    encoding: "utf8",
    timeout: 10 * 60_000,
    env: pythonEnv(),
  });
  if (install.status !== 0) {
    logMain(
      `Python 依赖引导：安装失败（exit ${install.status}）——${(install.stderr ?? install.stdout ?? "").slice(-400)}`,
    );
    return;
  }
  if (!dependenciesImportable(bin)) {
    logMain("Python 依赖引导：安装后探针仍未通过，请查看上方日志；技能引擎按无数据降级");
    return;
  }
  if (marker !== null) writeFileSync(marker, `${new Date().toISOString()}\n`);
  logMain("Python 依赖引导：依赖就绪（marker 已写入，后续启动零开销）");
}
