/**
 * 引擎 Python 依赖体检（`GET /kstock-api/dependencies`）。
 *
 * 与壳侧 deps.ts 引导闭环：壳负责装（pip --target 到 ``<dataRoot>/py-deps``
 * 并前置 PYTHONPATH），本模块负责「现在到底缺什么」的机器可读视图——
 * python 解释器/pip 可用性、逐依赖 import 探针与版本、就绪 marker。
 * 探针用与引擎子进程一致的环境（PYTHONPATH 含 py-deps）。
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** 体检的依赖全集（import 名与展示名）。 */
const PROBE_MODULES = ["pandas", "numpy", "requests", "dotenv", "tushare", "matplotlib"] as const;

interface DependencyProbe {
  ok: boolean
  version: string | null
  error?: string
}

function probeEnvironment(depsDir: string): NodeJS.ProcessEnv {
  const existing = process.env.PYTHONPATH
  return existing === undefined
    ? { ...process.env, PYTHONPATH: depsDir }
    : { ...process.env, PYTHONPATH: `${depsDir}:${existing}` }
}

function resolvePythonBin(): { bin: string; version: string } | { bin: null; version: null } {
  for (const bin of ['python3', 'python']) {
    const probe = spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 15_000 })
    if (probe.status === 0) {
      const version = (probe.stdout ?? probe.stderr ?? '').trim().split(/\s+/).pop() ?? ''
      return { bin, version }
    }
  }
  return { bin: null, version: null }
}

/** 依赖体检视图：python/pip/逐依赖状态 + 引导层目录与 marker。 */
export function dependenciesView(dataRoot: string): Record<string, unknown> {
  const depsDir = join(dataRoot, 'py-deps')
  const env = probeEnvironment(depsDir)
  const python = resolvePythonBin()

  const pipOk = python.bin === null
    ? false
    : (spawnSync(python.bin, ['-m', 'pip', '--version'], { encoding: 'utf8', timeout: 30_000 }).status === 0)

  const deps: Record<string, DependencyProbe> = {}
  if (python.bin !== null) {
    for (const module of PROBE_MODULES) {
      const probe = spawnSync(
        python.bin,
        ['-c', `import ${module}; v = getattr(${module}, '__version__', ''); print(v)`],
        { encoding: 'utf8', timeout: 60_000, env },
      )
      if (probe.status === 0) {
        deps[module] = { ok: true, version: (probe.stdout ?? '').trim() || null }
      } else {
        deps[module] = { ok: false, version: null, error: (probe.stderr ?? '').trim().split('\n')[0] }
      }
    }
  }

  const marker = python.version === null
    ? null
    : join(depsDir, `.ready-${python.version.split('.').slice(0, 2).join('.')}`)

  return {
    python: { bin: python.bin, version: python.version, pip: pipOk },
    py_deps_dir: depsDir,
    py_deps_present: existsSync(depsDir),
    ready_marker: marker !== null && existsSync(marker),
    deps,
    install_hint: '缺失时由桌面壳启动引导自动安装（pip --target py-deps）；也可手动执行 '
      + 'python3 -m pip install --target ~/.kstock/py-deps pandas numpy tushare requests python-dotenv matplotlib',
  }
}
