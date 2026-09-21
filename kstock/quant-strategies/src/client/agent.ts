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
