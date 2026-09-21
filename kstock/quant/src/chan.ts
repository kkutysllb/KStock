/**
 * 缠论研究面板的引擎桥（§29-C1）：`POST /kstock-api/chan-analyze`。
 *
 * 面板直连 stock-analysis 技能的 analyze_stock_chan 引擎（spawnSync 秒级，
 * 实测 241 根日 K 全结构即时出）——不经过 agent 会话，交互式选股选级别。
 * 技能脚本按 preset 随行目录解析（KSTOCK_PRESETS_DIR → 各 preset 的
 * skills/stock-analysis）；PYTHONPATH/TUSHARE_TOKEN 继承引擎进程环境
 * （壳侧已注入）。60 秒结果缓存防连点（tushare 限速友好）。
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { StoreError } from './store.ts'

/** 引擎支持的级别白名单（与 analyze_stock_chan --level 一致）。 */
const LEVELS = ['5min', '15min', '30min', '60min', '90min', '120min', 'daily', 'weekly', 'monthly'] as const

/** 缠论引擎脚本解析：KSTOCK_PRESETS_DIR 下各 preset 的随行技能目录。 */
let cachedScript: string | null | undefined
function resolveChanScript(): string | null {
  if (cachedScript !== undefined) return cachedScript
  const roots = [
    process.env.KSTOCK_PRESETS_DIR,
    join(process.cwd(), 'kstock', 'presets'),
  ].filter((value): value is string => typeof value === 'string' && value !== '')
  const presets = ['standard', 'chan-theory-expert', 'stock-analysis']
  for (const root of roots) {
    for (const preset of presets) {
      const script = join(root, preset, 'skills', 'stock-analysis', 'scripts', 'analyze_stock_chan.py')
      if (existsSync(script)) {
        cachedScript = script
        return script
      }
    }
  }
  cachedScript = null
  return null
}

/** python 解释器解析（与壳侧 resolvePythonLauncher 同序）。 */
function resolvePython(): { bin: string; prefix: string[] } | null {
  for (const candidate of [
    { bin: 'python3', prefix: [] },
    { bin: 'python', prefix: [] },
    { bin: 'py', prefix: ['-3'] },
  ]) {
    const probe = spawnSync(candidate.bin, [...candidate.prefix, '--version'], { encoding: 'utf8', timeout: 15_000 })
    if (probe.status === 0) return candidate
  }
  return null
}

/** 60 秒结果缓存（key: stock|level）。 */
const cache = new Map<string, { at: number; data: Record<string, unknown> }>()
const CACHE_TTL = 60_000

/**
 * 缠论单股分析：spawnSync 引擎 → 原样 JSON 返回（面板消费 chart_data /
 * morphology / dynamics / trend_analysis / trading_advice / signal_scores）。
 */
export function analyzeChan(input: { stock?: unknown; level?: unknown }): Record<string, unknown> {
  const stock = typeof input.stock === 'string' ? input.stock.trim() : ''
  if (stock === '' || stock.length > 24) throw new StoreError(422, 'stock 参数无效（代码或名称）')
  const level = typeof input.level === 'string' && (LEVELS as readonly string[]).includes(input.level)
    ? input.level
    : 'daily'

  const cacheKey = `${stock}|${level}`
  const hit = cache.get(cacheKey)
  if (hit !== undefined && Date.now() - hit.at < CACHE_TTL) return hit.data

  const script = resolveChanScript()
  if (script === null) throw new StoreError(503, '缠论引擎脚本未找到（技能目录缺失，请检查安装）')
  const python = resolvePython()
  if (python === null) throw new StoreError(503, 'Python 解释器不可用')

  const started = Date.now()
  const run = spawnSync(
    python.bin,
    [...python.prefix, script, '--stock', stock, '--level', level, '--json'],
    { encoding: 'utf8', timeout: 90_000, env: process.env, maxBuffer: 16 * 1024 * 1024 },
  )
  if (run.status !== 0) {
    const detail = (run.stderr ?? run.stdout ?? '').trim().split('\n').filter(Boolean).slice(-3).join(' | ').slice(0, 300)
    throw new StoreError(502, `缠论引擎执行失败（${Math.round((Date.now() - started) / 1000)}s）：${detail || '无输出'}`)
  }
  let data: Record<string, unknown>
  try {
    data = JSON.parse(run.stdout) as Record<string, unknown>
  } catch {
    throw new StoreError(502, '缠论引擎输出解析失败（非 JSON）')
  }
  cache.set(cacheKey, { at: Date.now(), data })
  return data
}
