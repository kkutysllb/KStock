/**
 * 选股库 → 会话联动桥（P2 命中清单「解读」按钮用）。
 *
 * 与财经新闻面板（@kstock/client-news）同款形态：index.tsx 在 apply()
 * 里 bindAgentBridge({send, gotoConversation})——send 走 sessions 作用域
 * 的 conversation.send()（官方排队回合通道），gotoConversation 经
 * layout.selectPanel(null) 回对话主面板（上游 openSession 同款约定）。
 * 面板组件只依赖模块级单例，React 树不感知注入细节。
 */

/** 会话联动桥（由客户端插件入口绑定）。 */
export interface AgentBridge {
  send(prompt: string): Promise<void>
  gotoConversation(): void
}

let agentBridge: AgentBridge | null = null

export function bindAgentBridge(bridge: AgentBridge): void {
  agentBridge = bridge
}

/** 面板组件取桥（未绑定返回 null，按钮静默降级）。 */
export function getAgentBridge(): AgentBridge | null {
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
    + ` + 近期催化与风险，最后一句话结论。数据缺失诚实标注「无数据」，不构成投资建议。`
}
