/**
 * 数据源凭据配置面（设置页「数据源」的后端）。
 *
 * 凭据落 `~/.kstock/config/secrets.env`（1.x 同一文件）：Electron 壳在启动
 * 引擎前把该文件并入引擎环境（不覆盖已有键），技能脚本经 bash 继承——
 * 因此运行时修改凭据需重启引擎生效，本模块的写入口负责原子合并并如实
 * 返回 restart_required。
 */

import { existsSync, readFileSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { StoreError } from './store.ts'

/** 受管数据源：id →（展示名，环境变量名）。 */
export const DATA_SOURCES: readonly (readonly [id: string, label: string, envName: string])[] = [
  ['tushare', 'Tushare Pro', 'TUSHARE_TOKEN'],
  ['iwencai', '同花顺问财', 'IWENCAI_API_KEY'],
]

/** 单个数据源的状态视图（不含明文凭据）。 */
export interface DataSourceView {
  readonly id: string
  readonly label: string
  readonly env_name: string
  /** 引擎当前环境已含该凭据（技能脚本可用）。 */
  readonly configured: boolean
  /** secrets.env 中已持久化（重启后仍生效）。 */
  readonly persisted: boolean
  /** 脱敏预览（如 `sk-1****xy`）；无值时为 null。 */
  readonly masked: string | null
}

/** GET 视图。 */
export interface DataSourcesView {
  readonly sources: readonly DataSourceView[]
}

/** PUT 视图：更新后的状态 + 生效提示。 */
export interface SaveResult extends DataSourcesView {
  readonly restart_required: boolean
}

function secretsPath(dataRoot: string): string {
  return join(dataRoot, 'config', 'secrets.env')
}

/** 解析 secrets.env 为保序键值表（保留注释/空行结构以最小 diff 写回）。 */
function parseSecrets(text: string): { lines: string[]; values: Map<string, string> } {
  const lines = text.split(/\r?\n/)
  const values = new Map<string, string>()
  for (const line of lines) {
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim())
    if (match !== null) values.set(match[1]!, match[2]!.trim().replace(/^["']|["']$/g, ''))
  }
  return { lines, values }
}

function mask(value: string): string | null {
  if (value === '') return null
  if (value.length <= 6) return `${value.slice(0, 1)}****`
  return `${value.slice(0, 3)}****${value.slice(-2)}`
}

function view(dataRoot: string, env: NodeJS.ProcessEnv): DataSourcesView {
  const persisted = existsSync(secretsPath(dataRoot))
    ? parseSecrets(readFileSync(secretsPath(dataRoot), 'utf8')).values
    : new Map<string, string>()
  return {
    sources: DATA_SOURCES.map(([id, label, envName]) => {
      const value = env[envName] ?? persisted.get(envName) ?? ''
      return {
        id,
        label,
        env_name: envName,
        configured: Boolean(env[envName]),
        persisted: persisted.has(envName),
        masked: mask(value),
      }
    }),
  }
}

/** GET /kstock-api/data-sources。 */
export function dataSourcesView(dataRoot: string): DataSourcesView {
  return view(dataRoot, process.env)
}

/**
 * PUT /kstock-api/data-sources：合并写入 secrets.env。
 *
 * values 为「环境变量名 → 新值」表；空串表示清除该键；不在受管清单内的
 * 键拒绝（防止把任意环境变量写进文件）。保留文件中的注释与未知键。
 */
export async function saveDataSources(dataRoot: string, values: unknown): Promise<SaveResult> {
  if (typeof values !== 'object' || values === null) {
    throw new StoreError(422, 'values 必须是「环境变量名 → 值」对象')
  }
  const managed = new Set(DATA_SOURCES.map(([, , envName]) => envName))
  const input = new Map<string, string>()
  for (const [key, raw] of Object.entries(values as Record<string, unknown>)) {
    if (!managed.has(key)) throw new StoreError(422, `不受管理的数据源键：${key}`)
    if (typeof raw !== 'string') throw new StoreError(422, `${key} 的值必须是字符串`)
    input.set(key, raw.trim())
  }
  if (input.size === 0) throw new StoreError(422, 'values 为空')

  const path = secretsPath(dataRoot)
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : ''
  const { lines } = parseSecrets(existing)

  const written = new Set<string>()
  const output: string[] = []
  for (const line of lines) {
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/.exec(line.trim())
    const key = match?.[1]
    if (key === undefined || !managed.has(key) || !input.has(key)) {
      output.push(line)
      continue
    }
    written.add(key)
    const next = input.get(key)!
    if (next !== '') output.push(`${key}=${next}`)
    // 空串 = 清除该键：不输出该行。
  }
  for (const [key, value] of input) {
    if (!written.has(key) && value !== '') output.push(`${key}=${value}`)
  }
  const text = `${output.join('\n').replace(/\n*$/, '')}\n`
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, text, 'utf8')
  await rename(tmp, path)

  // 引擎环境不热更：合并进文件的新值要等壳下次启动并入。
  const merged = { ...process.env }
  for (const [key, value] of input) {
    if (value === '') delete merged[key]
    else merged[key] = value
  }
  return { ...view(dataRoot, merged), restart_required: true }
}
