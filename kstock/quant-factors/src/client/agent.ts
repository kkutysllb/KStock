/**
 * 因子库 → 会话联动桥（§27-F2 检验「解读」按钮）。
 *
 * 与新闻/选股库面板同款形态：index.tsx 在 apply() 里 bindAgentBridge()
 * 注入 quant-ui 共享实现 buildTaskRouterBridge；面板组件经
 * TaskTargetMenu 弹出目标选择（按 factor 类型记忆上次落点）。
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

/** 检验「解读」提示词：带因子名/假设/核心检验指标上下文。 */
export function interpretFactorPrompt(input: {
  factorName: string
  hypothesis?: string
  version: number
  universe?: string
  range?: string
  icMean?: number | string
  ir?: number | string
  icPositivePct?: number | string
  longShortSpread?: number | string
  nPeriods?: number | string
}): string {
  const hypothesis = input.hypothesis !== undefined && input.hypothesis !== ''
    ? `（假设：${input.hypothesis}）` : ''
  const parts: string[] = []
  if (input.icMean !== undefined && String(input.icMean) !== '') parts.push(`IC 均值 ${input.icMean}`)
  if (input.ir !== undefined && String(input.ir) !== '') parts.push(`IR ${input.ir}`)
  if (input.icPositivePct !== undefined && String(input.icPositivePct) !== '') parts.push(`IC>0 占比 ${input.icPositivePct}%`)
  if (input.longShortSpread !== undefined && String(input.longShortSpread) !== '') parts.push(`多空分层差 ${input.longShortSpread}%`)
  if (input.nPeriods !== undefined && String(input.nPeriods) !== '') parts.push(`${input.nPeriods} 期`)
  const stats = parts.length > 0 ? `，最近检验：${parts.join(' / ')}` : ''
  const range = input.range !== undefined && input.range !== '' && input.range !== '—' ? `，区间 ${input.range}` : ''
  return `因子库「${input.factorName}」v${input.version}${hypothesis}${stats}${range}：`
    + `请解读该因子的有效性——IC/IR 水平在同类因子里处于什么位置、分层单调性如何、`
    + `多空收益来源与可能的风格暴露、失效风险（拥挤度/市场环境切换）与后续跟踪建议。`
    + `当前会话若未挂载 factor-research 技能，用网页检索补充并标注来源，禁止编造数值；`
    + `数据缺失诚实标注「无数据」，不构成投资建议。`
}
