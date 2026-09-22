/**
 * 选股库 → 会话联动桥（P2 命中清单「解读」按钮用，§26-10 升级为目标路由）。
 *
 * 与财经新闻面板（@kstock/client-news）同款形态：index.tsx 在 apply()
 * 里 bindAgentBridge() 注入 TaskRouterBridge——workspace 目标经
 * uiWorkspace.connectWorkspace 落地（复用/新建 blank 会话并挂进工作区
 * 分组，修复裸 create({cwd}) 的「未分组」），current 目标走当前会话
 * 作用域 conversation.send()。面板组件经 TaskTargetMenu 弹出目标选择，
 * 按任务类型记忆上次落点。
 */

import type { TaskRouterBridge } from '@kstock/quant-ui'

let agentBridge: TaskRouterBridge | null = null

export function bindAgentBridge(bridge: TaskRouterBridge): void {
  agentBridge = bridge
}

/** 面板组件取桥（未绑定返回 null，按钮静默降级）。 */
export function getAgentBridge(): TaskRouterBridge | null {
  return agentBridge
}

/** 命中清单「解读」提示词：带方案名 / 排名 / 综合分 / 陷阱提示上下文。 */
export function interpretPickPrompt(input: {
  selectionName: string
  version: number
  rank?: number | string
  name: string
  code: string
  score?: number | string
  dvTtm?: number | string
  trap?: string
}): string {
  const rank = input.rank !== undefined && String(input.rank) !== '' ? `排名第 ${input.rank} 的` : ''
  const score = input.score !== undefined && String(input.score) !== '' ? `，综合分 ${input.score}` : ''
  const dv = typeof input.dvTtm === 'number' && Number.isFinite(input.dvTtm)
    ? `，股息率(TTM) ${input.dvTtm.toFixed(2)}%`
    : ''
  const trap = input.trap !== undefined && input.trap !== '' && input.trap !== '—'
    ? `（股息陷阱提示：${input.trap}）`
    : ''
  return `选股库「${input.selectionName}」v${input.version} 命中清单中${rank}${input.name}`
    + `（${input.code}${score}${dv}）${trap}：请做个股快速分析——公司基本面要点`
    + ` + 当前估值水平（含近一年历史分位）+ 作为高股息标的的分红可持续性`
    + ` + 近期催化与风险，最后一句话结论。当前会话若未挂载 stock-analysis/`
    + `估值引擎技能，用网页检索补充并标注数据来源，禁止编造数值。`
    + `数据缺失诚实标注「无数据」，不构成投资建议。`
}

/** 选股口径迭代方向（时间线「从此口径改进…」方向 chips）。 */
export const SELECTION_ITERATE_DIRECTIONS = [
  '收紧口径（提高门槛/减 TopN，命中更少更精）',
  '放宽口径（降低门槛/加 TopN，扩大样本）',
  '调整因子权重（改变排序逻辑）',
  '增加/替换闸门条件（估值/分红/质量）',
  '换选股因子组合（换排序主因子）',
] as const

/**
 * 口径迭代改进提示词：基线口径全文 + 同期对照约束 + 新版本入库。
 * 选股特有约束：run 是某 trade_date 的市场快照——新版本必须与基线
 * 同 trade_date/universe 运行，隔离时间变量，命中差异才可归因于口径。
 */
export function buildSelectionIteratePrompt(input: {
  selectionName: string
  selectionId: string
  version: number
  criteria: Record<string, unknown>
  direction: string
  customNote?: string
  lastRun?: { tradeDate: string; universe: string; hitCount: number | null; consensusCount: number | null }
}): string {
  const criteriaJson = JSON.stringify(input.criteria, null, 2)
  const run = input.lastRun
  const baseline = run !== undefined
    ? `
基线运行：v${input.version} 最近一次运行为 trade_date=${run.tradeDate || '（未记录）'}、universe=${run.universe || '（未记录）'}、命中 ${run.hitCount ?? '—'} / 共振 ${run.consensusCount ?? '—'}。`
    : ''
  const custom = input.customNote !== undefined && input.customNote.trim() !== ''
    ? `
用户补充要求：${input.customNote.trim()}` : ''
  return `请在选股库「${input.selectionName}」（${input.selectionId}）v${input.version} 的口径基础上做改进研究：${input.direction}。${custom}${baseline}
`
    + `1) 基线口径 JSON（以此为基础演化，保持同结构）：
`
    + `   ${criteriaJson}
`
    + `2) 产出新口径：按改进方向调整 gates_params/factors 权重/top_n 等字段，输出同结构的完整口径 JSON；`
    + `change_note 写清相对 v${input.version} 的改动点与预期影响。
`
    + `3) 入库新版本：POST /kstock-api/selections/${input.selectionId}/versions（body {criteria: 新口径 JSON, change_note}）。
`
    + `4) 对照运行${run !== undefined && run.tradeDate !== '' ? `（关键：trade_date 用 ${run.tradeDate}、universe 用 ${run.universe || '同基线'}——与基线同时点，命中差异才可归因于口径改动）` : '（trade_date/universe 尽量与基线最近一次运行一致，隔离时间变量）'}：
`
    + `   POST /kstock-api/selections/${input.selectionId}/runs（body {version: 新版本号, trade_date, universe, rules, metrics, report, picks}，字段口径参照该方案既有运行）。
`
    + `5) 诚实对比：列出相对基线命中清单新增/剔除的股票（算重合度），说明口径改动是否达到预期——负结果也是研究资产。`
    + `归档后在选股库面板勾选新旧两个 run 用「跨期命中对比」复核。禁止编造数据。`
}
