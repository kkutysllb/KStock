/** RPC runtime for the Automations panel: one bounded snapshot state source
 * plus mutation helpers that refresh on completion. Immutable snapshot +
 * listener set — the view wraps it in React state via useSyncExternalStore.
 */
import { type AutomationSnapshot, type ClientRpc, type CreateAutomationInput, type UpdateAutomationInput } from './protocol.ts';
export declare const RPC_CHANNEL = "/dsh-kylin-automation";
export type PanelPhase = 'idle' | 'loading' | 'ready' | 'error';
export interface PanelState {
    readonly phase: PanelPhase;
    readonly snapshot?: AutomationSnapshot;
    readonly error?: string;
    readonly refreshedAt?: number;
}
export interface Translate {
    (key: string, params?: Record<string, unknown>): string;
}
export interface AutomationsRuntime {
    readonly source: {
        getSnapshot(): PanelState;
        subscribe(listener: () => void): () => void;
    };
    /** Transient user-facing notice line (bridge failures, destructive results).
     * Panel chrome — not panel data — so it lives outside the main snapshot. */
    readonly notice: {
        getSnapshot(): string | undefined;
        subscribe(listener: () => void): () => void;
    };
    pushNotice(text: string): void;
    dismissNotice(): void;
    refresh(): Promise<void>;
    currentSessionId(): string | undefined;
    create(input: CreateAutomationInput): Promise<string>;
    update(automationId: string, expectedRevision: number, input: UpdateAutomationInput): Promise<void>;
    mutate(automationId: string, mutation: 'pause' | 'resume' | 'delete'): Promise<void>;
    runNow(automationId: string): Promise<string>;
    /** 注册服务器上已存在的目录为新工作区（管理页「新建工作区」）。 */
    registerWorkspace(path: string): Promise<{
        readonly id: string;
        readonly title: string;
    }>;
    /** 历史管理：删除一条终态运行记录。 */
    deleteRun(automationId: string, runId: string): Promise<void>;
    /** 历史管理：清空某任务的全部终态运行记录，返回清除条数。 */
    clearRuns(automationId: string): Promise<number>;
}
export interface AutomationsRuntimeDeps {
    readonly rpc: ClientRpc;
    readonly sessionId: () => string | undefined;
    readonly lang: () => 'zh' | 'en';
}
/** One observable panel state; identity stays stable for the plugin fiber. */
export declare function createAutomationsRuntime(deps: AutomationsRuntimeDeps): AutomationsRuntime;
