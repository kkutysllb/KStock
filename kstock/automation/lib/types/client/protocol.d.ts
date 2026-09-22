/** JSON contract shared conceptually with the dsh-kylin-automation Host RPC
 * adapter. Self-contained: no host-module imports, so the client bundle stays
 * free of host-only dependencies.
 */
export type ScheduleKind = 'once' | 'interval' | 'daily' | 'weekly';
export type AutomationStatus = 'active' | 'paused';
export type AutomationPermission = 'read-only' | 'workspace-write';
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled';
export type RunTrigger = 'schedule' | 'manual';
export interface ModelTarget {
    readonly provider: string;
    readonly model: string;
    readonly reasoningEffort: string | null;
}
export interface AutomationSchedule {
    readonly kind: ScheduleKind;
    /** once: ISO instant */
    readonly at?: string;
    /** interval: integer ≥ 5 */
    readonly everyMinutes?: number;
    /** interval anchor (ISO instant) */
    readonly anchor?: string;
    /** daily/weekly: HH:mm */
    readonly time?: string;
    /** weekly: 1..7, Monday first */
    readonly weekdays?: number[];
}
export interface AutomationView {
    readonly id: string;
    readonly revision: number;
    readonly name: string;
    readonly prompt: string;
    readonly status: AutomationStatus;
    readonly schedule: AutomationSchedule;
    readonly scheduleSummary: string;
    readonly timeZone: string;
    readonly permission: AutomationPermission;
    readonly workspaceId: string;
    readonly cwd: string;
    readonly agentPreset: string;
    readonly model: ModelTarget | null;
    readonly nextRunAt?: string;
    readonly lastRunAt?: string;
    readonly lastRunStatus?: RunStatus;
    readonly lastRunId?: string;
    readonly lastRunSummary?: string;
    readonly createdAt: string;
    readonly updatedAt: string;
}
export interface RunView {
    readonly id: string;
    readonly automationId: string;
    readonly automationName: string;
    readonly revision: number;
    readonly trigger: RunTrigger;
    readonly status: RunStatus;
    readonly scheduledFor: string;
    readonly startedAt?: string;
    readonly finishedAt?: string;
    readonly sessionId?: string;
    readonly summary?: string;
    readonly skipReason?: string;
    readonly error?: {
        readonly code: string;
        readonly message: string;
    };
}
export interface WorkspaceInfo {
    readonly id: string;
    readonly title: string;
    readonly cwd: string;
}
export interface AutomationSnapshot {
    readonly unavailable?: string;
    readonly workspace?: {
        readonly id: string;
        readonly title: string;
        readonly cwd: string;
        readonly registered: boolean;
    };
    /** Every registered workspace (the editor's 工作区 picker). */
    readonly workspaces?: readonly WorkspaceInfo[];
    readonly automations?: readonly AutomationView[];
    readonly runs?: readonly RunView[];
    readonly policy?: {
        readonly runTimeoutMinutes: number;
        readonly misfireGraceMinutes: number;
        readonly historyLimit: number;
    };
    readonly serverNow?: string;
}
export interface CreateAutomationInput {
    readonly name: string;
    readonly prompt: string;
    /** The registered workspace this rule binds to (Web panel picker). */
    readonly workspaceId?: string;
    readonly schedule: AutomationSchedule;
    readonly timeZone: string;
    readonly permission: AutomationPermission;
    readonly modelTarget: ModelTarget | null;
    readonly agentPreset?: string;
}
export interface UpdateAutomationInput {
    readonly name?: string;
    readonly prompt?: string;
    readonly schedule?: AutomationSchedule;
    readonly timeZone?: string;
    readonly status?: AutomationStatus;
    readonly permission?: AutomationPermission;
    readonly modelTarget?: ModelTarget | null;
}
export type RpcResult<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
    };
};
/** Fail closed on a rejected request or a malformed envelope. */
export declare function unwrapRpcResult<T>(value: unknown): T;
/** RPC caller face (the injected connection service). */
export interface ClientRpc {
    call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<unknown>;
}
/** Model catalog facts (ctx.remote.session.modelCatalog projection). */
export interface ModelCatalogModel {
    readonly id: string;
    readonly name: string;
    readonly reasoning?: {
        readonly efforts: readonly {
            readonly id: string;
            readonly name: string;
        }[];
        readonly defaultEffort?: string;
    } | undefined;
}
export interface ModelCatalogProviderGroup {
    readonly id: string;
    readonly name: string;
    readonly models: readonly ModelCatalogModel[];
}
export interface ModelCatalog {
    readonly groups: readonly ModelCatalogProviderGroup[];
    readonly failures: readonly unknown[];
}
/** Run-status presentation order and zh labels. */
export declare const RUN_STATUS_ORDER: readonly RunStatus[];
