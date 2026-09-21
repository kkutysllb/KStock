/**
 * 策略库 → 会话联动桥（§28 回测「解读」按钮）。
 *
 * 与新闻/选股库/因子库面板同款形态：index.tsx 在 apply() 里
 * bindAgentBridge() 注入 quant-ui 共享实现 buildTaskRouterBridge；
 * 面板组件经 TaskTargetMenu 弹出目标选择（strategy 类型独立记忆）。
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

/** 回测「解读」提示词：带策略名/假设/六指标上下文。 */
export function interpretStrategyPrompt(input: {
  strategyName: string
  hypothesis?: string
  version: number
  range?: string
  totalReturnPct?: number
  annualReturnPct?: number
  sharpe?: number
  maxDrawdownPct?: number
  winRatePct?: number
  tradeCount?: number
}): string {
  const hypothesis = input.hypothesis !== undefined && input.hypothesis !== ''
    ? `（假设：${input.hypothesis}）` : ''
  const parts: string[] = []
  if (input.totalReturnPct !== undefined) parts.push(`总收益 ${input.totalReturnPct}%`)
  if (input.annualReturnPct !== undefined) parts.push(`年化 ${input.annualReturnPct}%`)
  if (input.sharpe !== undefined) parts.push(`夏普 ${input.sharpe}`)
  if (input.maxDrawdownPct !== undefined) parts.push(`最大回撤 ${input.maxDrawdownPct}%`)
  if (input.winRatePct !== undefined) parts.push(`胜率 ${input.winRatePct}%`)
  if (input.tradeCount !== undefined) parts.push(`${input.tradeCount} 笔`)
  const stats = parts.length > 0 ? `，最近回测：${parts.join(' / ')}` : ''
  const range = input.range !== undefined && input.range !== '' ? `，区间 ${input.range}` : ''
  return `策略库「${input.strategyName}」v${input.version}${hypothesis}${stats}${range}：`
    + `请解读该回测结果——收益风险比在同类策略的水平、最大回撤的成因与修复空间、`
    + `交易频率与费率敏感性、过拟合风险（参数敏感性/样本内偏差）与实盘跟踪建议。`
    + `当前会话若未挂载 strategy-research 技能，用网页检索补充并标注来源，禁止编造数值；`
    + `数据缺失诚实标注「无数据」，不构成投资建议。`
}


/** 策略迭代改进的预设方向（版本时间线「从此版本改进」用）。 */
export const STRATEGY_ITERATE_DIRECTIONS = [
  '参数优化（网格扫描关键参数，找稳健区而非最优点）',
  '加风控（止损/止盈/仓位管理/回撤控制）',
  '换仓逻辑改进（信号过滤/确认机制/调仓频率）',
  '降低回撤（波动率目标/动态仓位/弱势空仓）',
  '交易成本敏感性（费率/滑点冲击下的稳健性）',
] as const

/** 迭代改进提示词：基线代码获取路径 + 同口径对比 + 新版本入库。 */
export function buildIteratePrompt(input: {
  strategyName: string
  strategyId: string
  version: number
  params?: Record<string, unknown>
  direction: string
  customNote?: string
  baseline?: string
}): string {
  const params = input.params !== undefined && Object.keys(input.params).length > 0
    ? `（基线参数：${JSON.stringify(input.params)}）` : ''
  const baseline = input.baseline !== undefined && input.baseline !== '' ? `
基线指标：${input.baseline}——改进以不劣化关键指标为底线。` : ''
  const custom = input.customNote !== undefined && input.customNote.trim() !== ''
    ? `
用户补充要求：${input.customNote.trim()}` : ''
  return `请在策略库「${input.strategyName}」（${input.strategyId}）v${input.version} 的基础上做改进研究：${input.direction}。${custom}
`
    + `1) 基线代码：优先用本工作区 scripts/ 下的既有策略代码；没有则取回库内版本：
`
    + `   curl -s http://127.0.0.1:18001/kstock-api/strategies/${input.strategyId}/versions/${input.version} `
    + `| python3 -c 'import json,sys;print(json.load(sys.stdin)["code"])' > scripts/strategy_v${input.version}.py${params}
`
    + `2) 改进实现后，与基线**同口径**重跑对比（同区间/基准/费率）${baseline}
`
    + `3) 入库迭代结果：POST /kstock-api/strategies/${input.strategyId}/versions（code=改进后代码全文，params 更新，`
    + `change_note 写清相对 v${input.version} 的改动点）→ POST runs（同口径 metrics 六键/equity/trades，`
    + `rules 带 report_id 新看板链）；面板会自动做跨版本净值对比。
`
    + `4) 若指标劣化，诚实报告对比结果不粉饰——负结果也是研究资产（可标 status=rejected 后再试它法）。`
}