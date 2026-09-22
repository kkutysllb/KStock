/** RPC runtime for the Automations panel: one bounded snapshot state source
 * plus mutation helpers that refresh on completion. Immutable snapshot +
 * listener set — the view wraps it in React state via useSyncExternalStore.
 */
import { type AutomationSnapshot, type ClientRpc, type CreateAutomationInput, type UpdateAutomationInput } from './protocol.ts';
export declare const RPC_CHANNEL = "/dsh-kylin-automation";
export type PanelPhase = 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
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
    refresh(): Promise<void>;
    currentSessionId(): string | undefined;
    create(input: CreateAutomationInput): Promise<string>;
    update(automationId: string, expectedRevision: number, input: UpdateAutomationInput): Promise<void>;
    mutate(automationId: string, mutation: 'pause' | 'resume' | 'delete'): Promise<void>;
    runNow(automationId: string): Promise<string>;
}
export interface AutomationsRuntimeDeps {
    readonly rpc: ClientRpc;
    readonly sessionId: () => string | undefined;
    readonly lang: () => 'zh' | 'en';
}
/** One observable panel state; identity stays stable for the plugin fiber. */
export declare function createAutomationsRuntime(deps: AutomationsRuntimeDeps): AutomationsRuntime;
