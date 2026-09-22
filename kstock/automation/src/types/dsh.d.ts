/** Minimal compile-time declarations for the DSH Host capabilities this plugin
 * injects at runtime. The Host provides every `@deepseek-ai/*` module; these
 * ambient declarations mirror the framework's own Context merges (verified
 * against kcoder 0.1.6-alpha.1 sources) so the plugin can typecheck and build
 * without a workspace link into the harness checkout.
 *
 * Scope discipline: only members this plugin touches, each shaped from the
 * framework source. Tightening later is mechanical.
 */

// ── agent registry ───────────────────────────────────────────────────────────

declare module '@deepseek-ai/dsh-agent' {
  export interface Agent {
    readonly id: string
    readonly session: import('@deepseek-ai/dsh-session').Session
    readonly ctx: import('@deepseek-ai/cordis').Context
    followup(message: unknown): void
    whenIdle(): Promise<void>
    cancel(request: { kind: string; reason: string }): void
  }
  export interface ModelSelection {
    provider: string
    model: string
    reasoningEffort?: string
  }
  export interface AgentOptions {
    provider?: string
    model?: string
    maxTokens?: number
  }
  /** Install a creation-time model selection onto an unpublished agent scope. */
  export function installModelSelection(agentCtx: unknown, selection: {
    current: ModelSelection | undefined
    assembled: ModelSelection | undefined
  }): () => void
  export interface AgentRegistry {
    create(options: {
      sessionId: import('@deepseek-ai/dsh-session').SessionId
      parentAgent?: import('@deepseek-ai/dsh-agent').Agent
      meta?: {
        cwd?: string
        agentPreset?: string
        parentSession?: import('@deepseek-ai/dsh-session').SessionId
        isSeeded?: boolean
        origin?: 'subagent'
        delegationDepth?: number
      }
      agentOptions?: AgentOptions
      signal?: AbortSignal
      setup?: (agentCtx: import('@deepseek-ai/cordis').Context, agent: Agent) => unknown
    }): Promise<{ readonly agent: Agent; dispose(): Promise<void> }>
    /** Run an operation with initiator attribution suppressed. */
    withoutInitiator<T>(operation: () => T): T
    /** Live root agents. */
    roots(): readonly Agent[]
    /** Live agent by session id (agents and sessions share one identity). */
    get(id: string): Agent | undefined
  }
}

// ── session store ────────────────────────────────────────────────────────────

declare module '@deepseek-ai/dsh-session' {
  export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
  export type SessionId = string & { readonly __sessionId: unique symbol }
  export function SessionId(value: string): SessionId
  export interface SessionEventLike {
    readonly seq: number
    readonly type: string
    readonly data: Record<string, any>
  }
  export interface Session {
    readonly id: SessionId
    readonly seq: number
    /** Immutable creation metadata (absolute cwd, composing agent preset). */
    readonly header: { readonly cwd?: string; readonly agentPreset?: string }
    snapshotEvents(fromSeq: number): readonly SessionEventLike[]
    append(type: string, data: unknown): unknown
  }
  export interface SessionStore {
    get(id: string): Session | undefined
    /** Await the `session/flush` durability checkpoint for one session. */
    flush(session: Session): Promise<boolean>
  }
}

// ── workspace registry ───────────────────────────────────────────────────────

declare module '@deepseek-ai/dsh-workspace' {
  export type WorkspaceId = string & { readonly __workspaceId: unique symbol }
  export function WorkspaceId(value: string): WorkspaceId
  export interface Workspace {
    readonly id: WorkspaceId
    readonly path: string
    readonly title: string
    readonly sessionIds: readonly SessionId[]
    attachSession(sessionId: SessionId): Promise<void>
    detachSession(sessionId: SessionId): Promise<void>
    status(): Promise<'ok' | 'missing-dir'>
  }
  export interface WorkspaceRegistry {
    create(path: string, title?: string): Promise<Workspace>
    get(id: WorkspaceId): Workspace | undefined
    list(): readonly Workspace[]
  }
}

// ── model / presets / permissions / title ────────────────────────────────────

declare module '@deepseek-ai/dsh-agent-default-model' {
  export interface AgentDefaultModel {
    currentSelection(): import('@deepseek-ai/dsh-agent').ModelSelection
  }
}

declare module '@deepseek-ai/dsh-agent-presets' {
  export interface AgentPreset {
    readonly id: string
  }
  export interface AgentPresets {
    resolve(id: string): Promise<AgentPreset>
    mount(agentCtx: unknown, id: string): Promise<void>
    standingKeyFor(id: string): Promise<string>
  }
}

declare module '@deepseek-ai/dsh-permission-presets' {
  export interface PermissionPresets {
    resolve(id: string): unknown
    set(session: unknown, id: string): void
    available(): readonly string[]
  }
}

declare module '@deepseek-ai/dsh-session-title' {
  export interface SessionTitle {
    rename(session: import('@deepseek-ai/dsh-session').Session, title: string): void
  }
}

// ── settings (unused in v0.1; kept for the config surface contract) ──────────

declare module '@deepseek-ai/dsh-settings' {
  export interface SettingsService {
    register(ns: string, schema: unknown, options?: { readonly base?: Record<string, unknown> }): {
      readonly get: () => unknown
      readonly update: (value: unknown) => Promise<unknown>
    }
  }
}

// ── storage domain ───────────────────────────────────────────────────────────

declare module '@deepseek-ai/dsh-storage-domain' {
  import type { ZodType } from 'zod'
  export interface DomainTableSpec<K extends string = string, V = unknown> {
    readonly valueSchema: ZodType<V>
    readonly __key?: K
  }
  export interface DomainGlobalSpec<G> {
    readonly schema: ZodType<G>
    readonly initial: G
  }
  export interface DomainSpec {
    readonly name: string
    readonly version: number
    readonly layout?: 'single' | 'per-record'
    readonly compatibleVersions?: readonly number[]
    readonly invalidRecords?: 'backup-and-skip'
    readonly global?: DomainGlobalSpec<unknown>
    readonly tables: Record<string, DomainTableSpec>
  }
  export function defineDomain<S extends DomainSpec>(spec: S): S
  export function domainTable<K extends string, V>(schema: ZodType<V>): DomainTableSpec<K, V>
  export interface KvTable<K extends string, V> {
    get(key: K): V | undefined
    entries(): IterableIterator<[K, V]>
    keys(): IterableIterator<K>
    readonly size: number
    put(key: K, value: V): Promise<void>
    delete(key: K): Promise<boolean>
    update(key: K, fn: (current: V) => V): Promise<V>
  }
  export interface DomainGlobal<G> {
    get(): G
    set(value: G): Promise<void>
  }
  export interface Domain<S extends DomainSpec> {
    readonly global: S extends { readonly global: DomainGlobalSpec<infer G> } ? DomainGlobal<G> : never
    table<N extends keyof S['tables'] & string>(
      name: N,
    ): KvTable<string, S['tables'][N] extends DomainTableSpec<string, infer V> ? V : never>
    close(): Promise<void>
  }
  export interface StorageDomainFacility {
    open<S extends DomainSpec>(spec: S): Promise<Domain<S>>
  }
}

// ── connection (host half) ───────────────────────────────────────────────────

declare module '@deepseek-ai/dsh-client-connection' {
  export type ConnectionRpcHandler = (
    endpoint: string,
    payload: unknown,
    signal: AbortSignal,
  ) => Promise<unknown>
  export interface ConnectionRpc {
    handle(channel: string, handler: ConnectionRpcHandler): () => Promise<void>
  }
  export interface ConnectionHandle {
    readonly rpc: ConnectionRpc
    /** The Host/Origin + persistent browser-auth fence verdict for one request. */
    requestRejection(request: unknown): number | undefined
  }
}

// ── tools ────────────────────────────────────────────────────────────────────

declare module '@deepseek-ai/dsh-tools' {
  /** Tool-guard input shape used by the unattended capability allowlist. */
  export interface ToolGuardInput {
    readonly name: string
    readonly arguments?: unknown
    readonly signal: AbortSignal
  }
  export interface ToolExecution {
    readonly name: string
    readonly arguments?: unknown
    readonly signal: AbortSignal
    readonly agent?: { readonly id?: string }
  }
  export interface ToolGuardInput {
    readonly name: string
    readonly arguments?: unknown
    readonly signal: AbortSignal
  }
  export interface ToolRuntime {
    register(definition: {
      name: string
      description: string
      parameters: Record<string, unknown>
      output: {
        schema: Record<string, unknown>
        render(args: unknown, value: unknown): readonly { type: string; text?: string }[]
      }
      timeoutMs?: number
      execute(args: unknown, exec: unknown): Promise<unknown>
    }): () => void
    guard(guard: (exec: ToolGuardInput) => string | undefined): () => void
  }
}

// ── system prompt ────────────────────────────────────────────────────────────

declare module '@deepseek-ai/dsh-system-prompt' {
  export interface SystemPromptService {
    section(section: { name: string; order: number; text: string }): () => void
  }
}

// ── llm ──────────────────────────────────────────────────────────────────────

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    /** Scheduled automation input admitted into one fresh root Session. */
    automation: {
      readonly kind: 'automation'
      readonly automationId: string
      readonly runId: string
      readonly scheduledFor: string
      readonly trigger: 'schedule' | 'manual'
      readonly form: 'notice'
      readonly summary: string
    }
  }
  export function createUserMessage(value: {
    content: readonly { type: 'text'; text: string }[]
    source: unknown
  }): unknown
}

// ── policy helpers ───────────────────────────────────────────────────────────

declare module '@deepseek-ai/dsh-sandbox-policy' {
  export function setSandboxMode(session: unknown, mode: 'read-only' | 'workspace-write'): void
}

declare module '@deepseek-ai/dsh-user-approval' {
  export function setApprovalPolicy(session: unknown, policy: 'ask' | 'never'): void
}

// ── the host Context merge every plugin composes against ─────────────────────

declare module '@deepseek-ai/cordis' {
  export interface Context {
    /** Present on Agent-scoped contexts: the scoped Agent under composition. */
    readonly agent?: import('@deepseek-ai/dsh-agent').Agent
    readonly agents: import('@deepseek-ai/dsh-agent').AgentRegistry
    readonly sessions: import('@deepseek-ai/dsh-session').SessionStore
    readonly workspaceRegistry: import('@deepseek-ai/dsh-workspace').WorkspaceRegistry
    readonly agentDefaultModel: import('@deepseek-ai/dsh-agent-default-model').AgentDefaultModel
    readonly agentPresets: import('@deepseek-ai/dsh-agent-presets').AgentPresets
    readonly permissionPresets: import('@deepseek-ai/dsh-permission-presets').PermissionPresets
    readonly sessionTitle: import('@deepseek-ai/dsh-session-title').SessionTitle
    readonly settings: import('@deepseek-ai/dsh-settings').SettingsService
    readonly storageDomain: import('@deepseek-ai/dsh-storage-domain').StorageDomainFacility
    readonly connection: import('@deepseek-ai/dsh-client-connection').ConnectionHandle
    /** HTTP route registration (`@deepseek-ai/dsh-host-webserver`). */
    readonly webServer: {
      register(route: {
        kind: 'exact' | 'prefix'
        path: string
        handler(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): unknown
      }): () => void
    }
    readonly tools: import('@deepseek-ai/dsh-tools').ToolRuntime
    readonly systemPrompt: import('@deepseek-ai/dsh-system-prompt').SystemPromptService
    readonly logger: {
      info(message: string): void
      warn(message: string): void
      error(message: string): void
    }
    /** The Loader row service when running under the composition Loader. */
    readonly loader?: { await(): Promise<void> }
    effect<T>(factory: () => T | Promise<T>, label?: string): T
    on(name: string, listener: (...args: any[]) => any): () => void
    get(name: string): unknown
    serial(carrier: unknown, name: string, payload: unknown): Promise<unknown>
  }
}

declare module '@deepseek-ai/schemastery' {
  const z: any
  export default z
}
