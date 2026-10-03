/**
 * KStock 角色 preset 选择器的状态与远程交互。
 *
 * 与上游 seat-store 同语义的最小实现：名册读取（过滤到 KStock 角色集）→
 * 暂存选择 → blank 会话出现时经 `remote.agentPresets.select` 应用。砍掉了
 * 上游的 copy/delete/设置同步/引导动画（KStock 为固定角色集产品）。
 */

import type { SnapshotStore } from '@qilin/client-store'

/** KStock 角色 preset id 集（与 kstock/presets/skills.manifest.json 保持同步）。 */
export const KSTOCK_ROLE_PRESET_IDS = [
  'market-analysis', 'stock-analysis', 'stock-screener',
  'chan-theory-expert', 'strategy-research', 'factor-mining',
] as const

/** 默认基座（名册中存在但选择器不展示）。 */
export const BASE_PRESET_ID = 'standard'

/** 选择器展示的一个角色选项。 */
export interface RoleOption {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly broken: boolean
}

/** 选择器快照。 */
export interface SeatState {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly error: string | null
  readonly options: readonly RoleOption[]
  /** 当前会话的 preset id（standard 显示为通用基座文案）。 */
  readonly current: string
  /** 当前会话是否已启动（启动后 host 拒绝换预设，选择器禁用）。 */
  readonly locked: boolean
  readonly busy: boolean
}

interface SessionsListFace {
  getSnapshot(): { current?: string; byId: Record<string, SeatSessionFace> }
  subscribe(listener: () => void): () => void
}

interface SeatSessionFace {
  readonly id: string
  readonly blank: boolean
  readonly projectionValues?: { agentPreset?: unknown }
}

/** remote.agentPresets 的最小面（上行调用按值收发）。 */
interface AgentPresetsRemoteFace {
  list(): Promise<{ ok: true; value: { presets: readonly unknown[] } } | { ok: false; error: { message: string } }>
  select(sessionId: string, presetId: string): Promise<
    | { ok: true; value: string }
    | { ok: false; error: { message: string; details?: { reason?: unknown } } }
  >
}

/** @kstock/client-store createSnapshotStore 的最小面（按引用订阅）。 */
interface SnapshotStoreFace<T> {
  getSnapshot(): T
  set(value: T): void
  subscribe(listener: () => void): () => void
}

interface SeatScope {
  readonly sessions: { list: SessionsListFace }
  readonly remote: { agentPresets: AgentPresetsRemoteFace }
  /** ui-workspace 服务的 main-selection 面：会话「当前显示哪个」的权威源。
   * 注意 SessionListState 没有 current 字段——视图选择归 uiWorkspace 所有。 */
  readonly selection: {
    getSnapshot(): { sessionId?: string }
    subscribe(listener: () => void): () => void
  }
}

function createLocalStore<T>(initial: T): SnapshotStoreFace<T> & SnapshotStore<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => value,
    set: (next: T) => {
      value = next
      for (const listener of listeners) listener()
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  } as SnapshotStoreFace<T> & SnapshotStore<T>
}

function presetOf(session: SeatSessionFace | undefined): string | undefined {
  const value = session?.projectionValues?.agentPreset
  return typeof value === 'string' ? value : undefined
}

function asRosterEntry(raw: unknown): RoleOption | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const entry = raw as { id?: unknown; name?: unknown; description?: unknown; broken?: unknown }
  if (typeof entry.id !== 'string') return undefined
  return {
    id: entry.id,
    name: typeof entry.name === 'string' ? entry.name : entry.id,
    description: typeof entry.description === 'string' ? entry.description : '',
    broken: typeof entry.broken === 'string',
  }
}

/**
 * 角色选择器控制器：名册读取 + 暂存/应用。
 */
export class PresetsSeatController {
  readonly store: SnapshotStore<SeatState> = createLocalStore<SeatState>({
    status: 'idle', error: null, options: [], current: BASE_PRESET_ID, locked: false, busy: false,
  })
  private staged: string | undefined
  private disposed = false

  constructor(private readonly scope: SeatScope) {}

  private set(patch: Partial<SeatState>): void {
    const prev = this.store.getSnapshot()
    this.store.set({ ...prev, ...patch })
  }

  private currentSession(): SeatSessionFace | undefined {
    const sessionId = this.scope.selection.getSnapshot().sessionId
    if (sessionId === undefined) return undefined
    const state = this.scope.sessions.list.getSnapshot()
    return state.byId[sessionId]
  }

  private refreshCurrent(): void {
    const session = this.currentSession()
    this.set({
      // 有暂存时标签保持用户的选择（乐观显示），直到应用成功或被拒。
      current: this.staged ?? presetOf(session) ?? BASE_PRESET_ID,
      locked: session !== undefined && !session.blank,
    })
  }

  /** 读取名册并过滤到 KStock 角色集（standard 基座不进选项）。 */
  async load(): Promise<void> {
    if (this.disposed) return
    this.set({ status: 'loading' })
    const result = await this.scope.remote.agentPresets.list()
    if (this.disposed) return
    if (!result.ok) {
      this.set({ status: 'error', error: result.error.message })
      return
    }
    const options = result.value.presets
      .map(asRosterEntry)
      .filter((entry): entry is RoleOption =>
        entry !== undefined && (KSTOCK_ROLE_PRESET_IDS as readonly string[]).includes(entry.id))
      .sort((a, b) => {
        const ia = (KSTOCK_ROLE_PRESET_IDS as readonly string[]).indexOf(a.id)
        const ib = (KSTOCK_ROLE_PRESET_IDS as readonly string[]).indexOf(b.id)
        return ia - ib
      })
    this.set({ status: 'ready', error: null, options })
    this.refreshCurrent()
    void this.apply()
  }

  /** 暂存一个角色选择并立即尝试应用。返回拒绝原因（成功为 undefined）。 */
  async select(id: string): Promise<string | undefined> {
    if (this.store.getSnapshot().busy) return undefined
    this.staged = id
    // 乐观显示（上游 stage 同款）：标签立即跟随用户的选择；apply 失败时
    // 再回落到会话实际 preset 并经 toast 报原因。没有这一步，hero 上
    // （尚无会话或 RPC 未决）点击角色后标签原地不动，看起来像「选不上」。
    this.set({ current: id, error: null })
    return await this.apply('pick')
  }

  /**
   * 把暂存选择交给当前 blank 会话；无暂存时仅刷新展示状态。
   * 当前会话非 blank（hero 之下往往仍选中旧会话）时**保留暂存**，等下一个
   * blank 会话出现再应用——选择语义即「新会话生效」。
   * @param trigger - 'pick'（用户刚选，拒绝要回报）或其他（跟随会话变化）。
   */
  async apply(trigger?: 'pick'): Promise<string | undefined> {
    if (this.disposed) return undefined
    const staged = this.staged
    const session = this.currentSession()
    if (staged === undefined) {
      this.refreshCurrent()
      return undefined
    }
    if (session === undefined) return undefined
    if (presetOf(session) === staged) {
      // 会话已经是该角色（host 应用成功的回声）：消费暂存。
      this.staged = undefined
      this.refreshCurrent()
      return undefined
    }
    if (!session.blank) return undefined
    this.set({ busy: true })
    const result = await this.scope.remote.agentPresets.select(session.id, staged)
    if (this.disposed) return undefined
    this.staged = undefined
    if (!result.ok) {
      const reason = result.error.details !== undefined && typeof result.error.details.reason === 'string'
        ? result.error.details.reason
        : result.error.message
      this.set({ busy: false, error: reason })
      this.refreshCurrent()
      return trigger === 'pick' ? reason : undefined
    }
    this.set({ busy: false, error: null, current: result.value })
    return undefined
  }

  dispose(): void {
    this.disposed = true
  }
}
