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


/** 因子迭代改进的预设方向。 */
export const FACTOR_ITERATE_DIRECTIONS = [
  '变体扩展（窗口/频率/分组数敏感性网格）',
  '中性化处理（行业/市值中性，剔除风格暴露）',
  '因子组合（与库内其他因子正交化/加权合成）',
  '择时与拥挤度（什么时候该用这个因子）',
  '失效诊断（IC 衰减区间归因：风格切换/结构变化）',
] as const

/** 因子迭代改进提示词：基线代码获取 + 同口径复检 + 新版本入库。 */
export function buildFactorIteratePrompt(input: {
  factorName: string
  factorId: string
  version: number
  params?: Record<string, unknown>
  direction: string
  customNote?: string
  baseline?: string
}): string {
  const params = input.params !== undefined && Object.keys(input.params).length > 0
    ? `（基线参数：${JSON.stringify(input.params)}）` : ''
  const baseline = input.baseline !== undefined && input.baseline !== '' ? `
基线检验：${input.baseline}——迭代以 IC/IR 不劣化为底线。` : ''
  const custom = input.customNote !== undefined && input.customNote.trim() !== ''
    ? `
用户补充要求：${input.customNote.trim()}` : ''
  return `请在因子库「${input.factorName}」（${input.factorId}）v${input.version} 的基础上做迭代研究：${input.direction}。${custom}
`
    + `1) 基线代码：优先用本工作区 scripts/ 下的既有因子代码；没有则取回库内版本：
`
    + `   curl -s http://127.0.0.1:18001/kstock-api/factors/${input.factorId}/versions/${input.version} `
    + `| python3 -c 'import json,sys;print(json.load(sys.stdin)["code"])' > scripts/factor_v${input.version}.py${params}
`
    + `2) 迭代实现后，与基线**同口径**复检（同股票池/区间/分组）${baseline}
`
    + `3) 入库迭代结果：POST /kstock-api/factors/${input.factorId}/versions（code=迭代后代码全文，params 更新，`
    + `change_note 写清相对 v${input.version} 的改动点）→ POST runs（同口径 metrics 五键/ic_series/layers，`
    + `config 带 report_id 新看板链）；面板会自动做跨版本累计 IC 叠加对比。
`
    + `4) 若 IC/IR 劣化，诚实报告对比结果不粉饰——负结果也是研究资产。`
}