/**
 * 联动任务目标选择菜单（新闻「解读」/ 选股库「解读」共用，§26-10）。
 *
 * 点击解读类按钮不再静默路由：弹出本菜单让用户选任务归属——
 * - 「跟随当前会话」：现状语义（当前会话直接发；无会话默认建）。
 * - 已注册 workspace 列表（GlobalStandardProps 的 useWorkspaces hook）：
 *   connectWorkspace 复用/新建 blank 会话且自动挂进工作区分组——
 *   修复裸 create({cwd}) 会话落「未分组」、产物散落根目录的问题。
 * - 「浏览选择目录…」：宿主原生目录对话框；新目录先 workspaces.create
 *   注册再连接（注册后才会在工作区分组里收纳会话）。
 * 按任务类型（news / pick）分别记忆上次选择，下次菜单首项即默认；
 * 单击任意项 = 发送 + 记忆 + 关闭。
 */

import { useEffect, useMemo, useState } from 'react'
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

/** 任务目标：跟随当前会话 / 已注册工作区 / 浏览新目录（菜单内部项）。 */
export type TaskTarget =
  | { kind: 'current' }
  | { kind: 'workspace'; workspaceId: string; path?: string }

/** 路由桥（面板 index.tsx 注入；sessions/uiWorkspace/workspaces 的最小面）。 */
export interface TaskRouterBridge {
  /** 按目标发送：current=当前会话语义；workspace=connectWorkspace 后发送。 */
  send(target: TaskTarget, text: string): Promise<void>
  /** 宿主原生目录选择（取消返回 null）。 */
  pickDirectory(): Promise<string | null>
  /** 注册目录为 workspace（已注册则幂等返回现有视图）。 */
  registerWorkspace(path: string): Promise<{ workspaceId: string; path: string }>
  /** 发送完成后切回对话页。 */
  gotoConversation(): void
}

/** 面板 ctx 的服务依赖面（各 index.tsx 的最小结构面并集）。 */
export interface TaskRouterDeps {
  sessions?: SessionsFace
  layout?: { selectPanel(panelId: string | null): void }
  uiWorkspace?: {
    pickDirectory(): Promise<string | null>
    connectWorkspace(workspaceId: string): Promise<string>
  }
  workspaces?: {
    create(input: { path: string }): Promise<{ workspaceId: string; path: string }>
  }
}

/**
 * 标准路由桥实现（面板共用：新闻/选股库/因子库）。current=当前会话
 * （无则默认建）；workspace=connectWorkspace（复用/新建 blank 会话并挂
 * 进工作区分组——修复裸 create({cwd}) 的「未分组」与产物散落）。
 */
export function buildTaskRouterBridge(deps: TaskRouterDeps): TaskRouterBridge {
  return {
    send: async (target: TaskTarget, text: string): Promise<void> => {
      const sessions = deps.sessions
      if (sessions === undefined) throw new Error('会话服务不可用')
      let id: string | undefined
      if (target.kind === 'workspace') {
        const uiWorkspace = deps.uiWorkspace
        if (uiWorkspace === undefined) throw new Error('工作区服务不可用')
        id = await uiWorkspace.connectWorkspace(target.workspaceId)
        sessions.open(id)
      } else {
        id = sessions.list.getSnapshot().current
        if (id === undefined) {
          id = await sessions.create()
          sessions.open(id)
        }
      }
      const scoped = sessions.scope(id)
      const conversation = scoped?.get('conversation') as
        | { send(prompt: string): Promise<void> }
        | undefined
      if (conversation === undefined) throw new Error('会话作用域不可用（conversation 服务缺席）')
      await conversation.send(text)
    },
    pickDirectory: (): Promise<string | null> => {
      if (deps.uiWorkspace === undefined) return Promise.reject(new Error('工作区服务不可用'))
      return deps.uiWorkspace.pickDirectory()
    },
    registerWorkspace: async (path: string) => {
      if (deps.workspaces === undefined) throw new Error('工作区注册服务不可用')
      return await deps.workspaces.create({ path })
    },
    gotoConversation: () => deps.layout?.selectPanel(null),
  }
}

/** useWorkspaces hook 的最小结构面（GlobalStandardProps 注入，防御式可选）。 */
export type UseWorkspaces = (selector: (snapshot: { items?: Array<{ workspaceId: string; path: string; title?: string; sessionIds?: readonly string[] }> }) => unknown) => unknown

/** 按任务类型记忆上次选择（news / pick 各记各的，互不覆盖）。 */
function loadMemory(taskKind: string): TaskTarget | null {
  try {
    const raw = localStorage.getItem(`kstock-task-route-${taskKind}`)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as TaskTarget
    if (parsed.kind === 'current') return parsed
    if (parsed.kind === 'workspace' && typeof parsed.workspaceId === 'string') return parsed
  } catch { /* 损坏记忆视为无 */ }
  return null
}

function saveMemory(taskKind: string, target: TaskTarget): void {
  try {
    localStorage.setItem(`kstock-task-route-${taskKind}`, JSON.stringify(target))
  } catch { /* 私隐模式等写入失败静默 */ }
}

/** 读设置页「量化工作区」统一配置（无记忆时的默认目标；不可达返回 null）。 */
async function fetchDefaultPath(): Promise<string | null> {
  try {
    const response = await fetch('/kstock-api/quant-workspace')
    if (!response.ok) return null
    const data = (await response.json()) as { path?: unknown }
    return typeof data.path === 'string' && data.path.trim() !== '' ? data.path : null
  } catch {
    return null
  }
}

const sameDir = (a: string, b: string): boolean => {
  const norm = (p: string) => p.replace(/\/+$/, '') || '/'
  return norm(a) === norm(b)
}

const targetKey = (target: TaskTarget | null): string =>
  target === null ? '' : target.kind === 'current' ? 'current' : `ws:${target.workspaceId}`

export interface TaskTargetMenuProps {
  /** 任务类型记忆键（'news' | 'pick' | 自定义）。 */
  taskKind: string
  /** 菜单标题（如「新闻解读发送到…」）。 */
  title: string
  /** 待发送提示词。 */
  prompt: string
  /** 路由桥。 */
  bridge: TaskRouterBridge
  /** useWorkspaces hook（GlobalStandardProps；缺席时菜单降级两项）。 */
  useWorkspaces?: UseWorkspaces
  /** 完成/失败/取消后回调（组件自毁）。 */
  onClose: () => void
}

/**
 * 内层：useWorkspaces 恒存在（由外层 TaskTargetMenu 保证），hook 无条件
 * 调用——Rules of Hooks 合规（禁在 useMemo 回调/条件分支里调 hook，
 * 实测会炸 Minified React error #311）。
 */
function MenuBody({ useWorkspaces, ...rest }: TaskTargetMenuProps & { useWorkspaces: UseWorkspaces }): React.ReactElement {
  const items = useWorkspaces(snapshot => snapshot.items ?? []) as Array<{
    workspaceId: string
    path: string
    title?: string
    sessionIds?: readonly string[]
  }>
  return <MenuView {...rest} items={items} />
}

/**
 * 目标选择菜单外壳（零 hook）：useWorkspaces 缺席时降级渲染空列表，
 * 存在时挂 MenuBody。分支发生在内层组件挂载之前——不同组件各自持有
 * 稳定的 hooks 链，不会触发 hooks 数量漂移。
 */
export function TaskTargetMenu(props: TaskTargetMenuProps): React.ReactElement {
  const { useWorkspaces, ...rest } = props
  if (useWorkspaces === undefined) {
    return <MenuView {...rest} items={[]} />
  }
  return <MenuBody {...rest} useWorkspaces={useWorkspaces} />
}

/** 目标选择菜单纯展示层：全部 hooks 无条件调用（items 由上层解析）。 */
function MenuView({ items, taskKind, title, prompt, bridge, onClose }: Omit<TaskTargetMenuProps, 'useWorkspaces'> & {
  items: Array<{ workspaceId: string; path: string; title?: string; sessionIds?: readonly string[] }>
}) {
  const [memory] = useState<TaskTarget | null>(() => loadMemory(taskKind))
  const [defaultPath, setDefaultPath] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchDefaultPath().then(setDefaultPath)
  }, [])

  // 排序：上次选择 > 统一配置匹配的工作区（默认）> 其余。
  const orderedItems = useMemo(() => {
    const list = [...items]
    if (memory?.kind === 'workspace') {
      const index = list.findIndex(item => item.workspaceId === memory.workspaceId)
      if (index > 0) list.unshift(...list.splice(index, 1))
    } else if (defaultPath !== null) {
      const index = list.findIndex(item => sameDir(item.path, defaultPath))
      if (index > 0) list.unshift(...list.splice(index, 1))
    }
    return list
  }, [items, memory, defaultPath])

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const dispatch = (key: string, run: () => Promise<void>): void => {
    if (busy !== null) return
    setBusy(key)
    setError(null)
    run()
      .then(() => { bridge.gotoConversation(); onClose() })
      .catch((err: unknown) => { setBusy(null); setError(err instanceof Error ? err.message : '发送失败') })
  }

  const sendTo = (target: TaskTarget): void => {
    saveMemory(taskKind, target)
    void dispatch(targetKey(target), () => bridge.send(target, prompt))
  }

  const browse = (): void => {
    void dispatch('browse', async () => {
      const picked = await bridge.pickDirectory()
      if (picked === null) {
        // 用户取消：不发送不记忆，静默关闭菜单。
        onClose()
        return
      }
      const view = await bridge.registerWorkspace(picked)
      sendTo({ kind: 'workspace', workspaceId: view.workspaceId, path: view.path })
    })
  }

  const lastKey = targetKey(memory)

  return (
    <div className="ksq-overlay ksq-target-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="ksq-target-menu" onClick={event => event.stopPropagation()}>
        <div className="ksq-target-head">
          <strong>{title}</strong>
          <span className="ksq-item-meta">{items.length > 0 ? '选择任务归属的工作区（记住本次选择）' : '未获取到工作区列表'}</span>
        </div>
        <button
          type="button"
          className={`ksq-target-item ${lastKey === 'current' ? 'last' : ''}`}
          disabled={busy !== null}
          onClick={() => sendTo({ kind: 'current' })}
        >
          <span className="ksq-target-name">跟随当前会话</span>
          {lastKey === 'current' && <span className="ksq-badge tone-live">上次</span>}
        </button>
        {orderedItems.map(workspace => {
          const key = `ws:${workspace.workspaceId}`
          const isLast = lastKey === key
          const isDefault = !isLast && lastKey === '' && defaultPath !== null && sameDir(workspace.path, defaultPath)
          return (
            <button
              key={workspace.workspaceId}
              type="button"
              className={`ksq-target-item ${isLast ? 'last' : ''}`}
              disabled={busy !== null}
              onClick={() => sendTo({ kind: 'workspace', workspaceId: workspace.workspaceId, path: workspace.path })}
            >
              <span className="ksq-target-name">{workspace.title || workspace.path.split('/').filter(Boolean).pop() || workspace.path}</span>
              <span className="ksq-target-path">{workspace.path}</span>
              {isLast && <span className="ksq-badge tone-live">上次</span>}
              {isDefault && <span className="ksq-badge tone-idle">默认</span>}
            </button>
          )
        })}
        <button type="button" className="ksq-target-item" disabled={busy !== null} onClick={browse}>
          <span className="ksq-target-name">{busy === 'browse' ? '选择中…' : '浏览选择目录…'}</span>
          <span className="ksq-target-path">新目录将注册为工作区后再发送</span>
        </button>
        {error !== null && <p className="ksq-target-error">{error}</p>}
        <button type="button" className="ksq-linkbtn ksq-target-cancel" onClick={onClose}>取消（Esc）</button>
      </div>
    </div>
  )
}
