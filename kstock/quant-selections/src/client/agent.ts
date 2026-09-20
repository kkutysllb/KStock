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
