/**
 * 联动任务工作区智能路由（新闻「解读」/ 选股库「解读」共用）。
 *
 * 行为（B 方案，§26-9）：
 * - 未配置量化工作区（GET /kstock-api/quant-workspace → path=null 或接口
 *   不可达）→ 现状语义：发当前会话；无当前会话则默认 create()+open()。
 * - 已配置 → ① 当前会话 cwd 已在目标工作区：直接发（对话连续）；
 *   ② 否则找目标工作区的现有会话复用（优先 blank 空会话——host「同
 *   workspace 复用空会话」同款语义；否则最近更新会话，running 也复用
 *   ——conversation.send 走官方排队，连点不刷新会话）；③ 都没有 →
 *   create({cwd}) 冷启动。
 * - 路由后统一 sessions.open(id) 切过去 + gotoConversation() 显示对话页。
 */

/** sessions 服务的最小结构面（kylin-client-runner ISessions 的消费子集）。 */
export interface SessionsFace {
  list: {
    getSnapshot(): {
      current?: string
      byId?: Record<string, { cwd?: string; blank?: boolean; running?: boolean; updatedAt?: number }>
    }
  }
  create(opts?: { workspaceId?: string; cwd?: string; sessionId?: string }): Promise<string>
  open(id: string): void
  scope(id: string): { get(name: string): unknown } | undefined
}

/** 尾分隔符归一后的目录比较（不做 realpath——两端都是展示口径路径）。 */
function sameDir(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\/+$/, '') || '/'
  return norm(a) === norm(b)
}

/** 读量化工作区配置；不可达/未配置返回 null（回退现状语义）。 */
async function fetchQuantWorkspacePath(): Promise<string | null> {
  try {
    const response = await fetch('/kstock-api/quant-workspace')
    if (!response.ok) return null
    const data = (await response.json()) as { path?: unknown }
    return typeof data.path === 'string' && data.path.trim() !== '' ? data.path : null
  } catch {
    return null
  }
}

async function sendTo(sessions: SessionsFace, id: string, text: string): Promise<void> {
  const scoped = sessions.scope(id)
  const conversation = scoped?.get('conversation') as
    | { send(prompt: string): Promise<void> }
    | undefined
  if (conversation === undefined) throw new Error('会话作用域不可用（conversation 服务缺席）')
  await conversation.send(text)
}

/**
 * 智能路由发送：解析目标会话（见模块注释）→ conversation.send。
 * 调用方在 send 完成后自行 gotoConversation() 切回对话页。
 */
export async function sendRouted(sessions: SessionsFace | undefined, text: string): Promise<void> {
  if (sessions === undefined) throw new Error('会话服务不可用')
  const target = await fetchQuantWorkspacePath()
  const snapshot = sessions.list.getSnapshot()
  const current = snapshot.current

  // 未配置：现状语义（当前会话；无则默认工作区建会话）。
  if (target === null) {
    let id = current
    if (id === undefined) {
      id = await sessions.create()
      sessions.open(id)
    }
    await sendTo(sessions, id, text)
    return
  }

  // 已配置：当前会话已在对的工作区 → 直接发，保对话连续。
  if (current !== undefined) {
    const cwd = snapshot.byId?.[current]?.cwd
    if (cwd !== undefined && sameDir(cwd, target)) {
      await sendTo(sessions, current, text)
      return
    }
  }

  // 目标工作区现有会话复用：blank 优先，否则最近更新的会话（running 也
  // 复用——conversation.send 走官方排队，避免连点「解读」刷出一堆新会话）。
  const entries = Object.entries(snapshot.byId ?? {}).filter(
    ([, summary]) => summary.cwd !== undefined && sameDir(summary.cwd, target),
  )
  const blank = entries.find(([, summary]) => summary.blank === true)
  const picked =
    blank ??
    entries.sort(([, a], [, b]) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0]
  if (picked !== undefined) {
    sessions.open(picked[0])
    await sendTo(sessions, picked[0], text)
    return
  }

  // 冷启动：在目标工作区新建会话（preset 走运行时默认，KStock 引擎
  // profile 的 standard 预设含基础量化技能面）。
  const id = await sessions.create({ cwd: target })
  sessions.open(id)
  await sendTo(sessions, id, text)
}
