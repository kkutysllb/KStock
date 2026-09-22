/** RPC runtime for the Automations panel: one bounded snapshot state source
 * plus mutation helpers that refresh on completion. Immutable snapshot +
 * listener set — the view wraps it in React state via useSyncExternalStore.
 */

import {
  unwrapRpcResult,
  type AutomationSnapshot,
  type ClientRpc,
  type CreateAutomationInput,
  type UpdateAutomationInput,
} from './protocol.ts'

export const RPC_CHANNEL = '/dsh-kylin-automation'

export type PanelPhase = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable'

export interface PanelState {
  readonly phase: PanelPhase
  readonly snapshot?: AutomationSnapshot
  readonly error?: string
  readonly refreshedAt?: number
}

export interface Translate {
  (key: string, params?: Record<string, unknown>): string
}

export interface AutomationsRuntime {
  readonly source: {
    getSnapshot(): PanelState
    subscribe(listener: () => void): () => void
  }
  refresh(): Promise<void>
  currentSessionId(): string | undefined
  create(input: CreateAutomationInput): Promise<string>
  update(automationId: string, expectedRevision: number, input: UpdateAutomationInput): Promise<void>
  mutate(automationId: string, mutation: 'pause' | 'resume' | 'delete'): Promise<void>
  runNow(automationId: string): Promise<string>
}

export interface AutomationsRuntimeDeps {
  readonly rpc: ClientRpc
  readonly sessionId: () => string | undefined
  readonly lang: () => 'zh' | 'en'
}

/** One observable panel state; identity stays stable for the plugin fiber. */
export function createAutomationsRuntime(deps: AutomationsRuntimeDeps): AutomationsRuntime {
  let state: PanelState = { phase: 'idle' }
  let refreshPromise: Promise<void> | undefined
  const listeners = new Set<() => void>()
  const publish = (next: PanelState): void => {
    state = next
    for (const listener of [...listeners]) listener()
  }
  const source = {
    getSnapshot: (): PanelState => state,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }

  const refresh = async (): Promise<void> => {
    if (refreshPromise !== undefined) return refreshPromise
    const previous = state.snapshot
    publish(previous === undefined
      ? { phase: 'loading' }
      : { phase: 'loading', snapshot: previous, ...(state.refreshedAt === undefined ? {} : { refreshedAt: state.refreshedAt }) })
    refreshPromise = (async () => {
      try {
        const sessionId = deps.sessionId()
        const response = await deps.rpc.call(RPC_CHANNEL, 'snapshot', {
          ...(sessionId === undefined ? {} : { sessionId }),
          lang: deps.lang(),
        })
        const snapshot = unwrapRpcResult<AutomationSnapshot>(response)
        publish({
          phase: snapshot.unavailable !== undefined ? 'unavailable' : 'ready',
          snapshot,
          refreshedAt: Date.now(),
        })
      } catch (error) {
        publish({
          phase: 'error',
          ...(previous === undefined ? {} : { snapshot: previous }),
          error: error instanceof Error ? error.message : String(error),
          ...(state.refreshedAt === undefined ? {} : { refreshedAt: state.refreshedAt }),
        })
      } finally {
        refreshPromise = undefined
      }
    })()
    return refreshPromise
  }

  const mutateThenRefresh = async (endpoint: string, payload: unknown): Promise<void> => {
    await deps.rpc.call(RPC_CHANNEL, endpoint, payload)
    // A poll may have started before the mutation completed; settle it, then
    // require a post-mutation snapshot instead of accepting stale data.
    const pending = refreshPromise
    if (pending !== undefined) await pending.catch(() => undefined)
    await refresh()
  }

  return {
    source,
    refresh,
    currentSessionId: deps.sessionId,
    async create(input) {
      const sessionId = deps.sessionId()
      const value = unwrapRpcResult<{ id: string; revision: number }>(
        await deps.rpc.call(RPC_CHANNEL, 'create', { sessionId, input }),
      )
      await refresh()
      return value.id
    },
    async update(automationId, expectedRevision, input) {
      const sessionId = deps.sessionId()
      await mutateThenRefresh('update', { sessionId, automationId, expectedRevision, input })
    },
    async mutate(automationId, mutation) {
      const sessionId = deps.sessionId()
      await mutateThenRefresh('mutate', { sessionId, automationId, mutation })
    },
    async runNow(automationId) {
      const sessionId = deps.sessionId()
      const value = unwrapRpcResult<{ runId: string }>(
        await deps.rpc.call(RPC_CHANNEL, 'run-now', { sessionId, automationId }),
      )
      await refresh()
      return value.runId
    },
  }
}
