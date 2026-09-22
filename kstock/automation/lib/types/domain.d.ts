/** Input validation, invariants, and wire-view projection for durable
 * automations. Runtime-only (no zod): the persistence boundary schemas live in
 * `store.ts`, and this module validates the same facts for create/update
 * traffic from either the Web RPC or the Agent tools.
 */
import { type AutomationDefinition, type AutomationPermission, type AutomationSchedule, type ModelTarget, type RunStatus, type RunTrigger } from './types.ts';
export declare class ValidationError extends Error {
    readonly field?: string | undefined;
    constructor(message: string, field?: string | undefined);
}
/** Absolute-posix-path guard shared by host-side callers. */
export declare function requireAbsolutePath(value: unknown, field: string): string;
/** Validate one friendly schedule payload (already plain JSON). */
export declare function validateSchedule(raw: unknown, field?: string): AutomationSchedule;
/** Validate a pinned model target triple; `null` ("follow global") is decided
 * by the callers, never represented as an empty triple here. */
export declare function validateModelTarget(raw: unknown, field?: string): ModelTarget;
/** Normalize a possibly-empty zone value: '' stays '' (instant-based). */
export declare function validateTimeZone(raw: unknown, schedule: AutomationSchedule, field?: string): string;
/** Input accepted by create; every field is already validated. */
export interface ValidCreateInput {
    readonly name: string;
    readonly prompt: string;
    readonly schedule: AutomationSchedule;
    readonly timeZone: string;
    readonly workspaceId: string;
    readonly cwd: string;
    readonly agentPreset: string;
    readonly permission: AutomationPermission;
    readonly modelTarget: ModelTarget | null;
}
/** Validate a create payload (Web RPC and `automation_create` share this). */
export declare function validateCreateInput(raw: unknown): ValidCreateInput;
/** Validate a partial update payload; `undefined` keys mean "unchanged". */
export interface ValidUpdateInput {
    readonly name?: string;
    readonly prompt?: string;
    readonly schedule?: AutomationSchedule;
    readonly timeZone?: string;
    readonly status?: 'active' | 'paused';
    readonly permission?: AutomationPermission;
    readonly modelTarget?: ModelTarget | null;
}
export declare function validateUpdateInput(raw: unknown): ValidUpdateInput;
/** Zone/schedule pairing rule applied where both the current definition and
 * the update are known: a daily/weekly schedule requires a valid IANA zone. */
export declare function resolveZone(currentZone: string, updateZone: string | undefined, schedule: AutomationSchedule): string;
/** Deterministic dispatch key: one recorded occurrence can never run twice. */
export declare function occurrenceKey(automationId: string, scheduledForMs: number): string;
/** Bound a run summary to the durable record size. */
export declare function boundSummary(value: string): string | undefined;
/** Wire view of one definition with its freshest run facts resolved. */
export interface AutomationView {
    readonly id: string;
    readonly revision: number;
    readonly name: string;
    readonly prompt: string;
    readonly status: 'active' | 'paused';
    readonly schedule: AutomationSchedule;
    readonly scheduleSummary: string;
    readonly timeZone: string;
    readonly permission: AutomationPermission;
    readonly workspaceId: string;
    readonly cwd: string;
    readonly agentPreset: string;
    readonly model: {
        readonly provider: string;
        readonly model: string;
        readonly reasoningEffort: string | null;
    } | null;
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
/** Project a definition to its wire view. */
export declare function toAutomationView(definition: AutomationDefinition, options: {
    readonly lang: 'zh' | 'en';
    readonly nextRunAt?: string;
    readonly lastRun?: {
        readonly id: string;
        readonly scheduledFor: string;
        readonly status: RunStatus;
        readonly summary?: string;
    };
}): AutomationView;
