/** Agent management tools for automations. Registered into an eligible root
 * Agent's scoped tool runtime, so only Agents that received them see them; a
 * run Agent's executor-level guard denies recursive management anyway.
 *
 * Every mutating tool (create/update/run_now/delete) is escalated for human
 * approval by the plugin's `tools/pre-execute` hook (see index.ts); reads and
 * the pause-only update are exempt.
 */
import { type AutomationService } from './service.ts';
import type { AutomationSchedule, ModelTarget } from './types.ts';
/** Tools that expand unattended future work or destroy durable state. */
export declare const MUTATING_TOOLS: ReadonlySet<string>;
/** Bound snapshot of the caller identity a tool may bind to. */
export interface ToolCaller {
    readonly cwd?: string | undefined;
    readonly sessionId?: string | undefined;
}
export declare function callerFrom(exec: unknown): ToolCaller;
/** Bounded definition line for model-facing results. */
export declare function definitionSummary(definition: {
    readonly id: string;
    readonly revision: number;
    readonly name: string;
    readonly status: string;
    readonly schedule: AutomationSchedule;
    readonly timeZone: string;
    readonly target: {
        readonly permission: string;
        readonly modelTarget: ModelTarget | null;
    };
}): string;
/** Bounded run line for model-facing results. */
export declare function runSummary(run: {
    readonly id: string;
    readonly automationName: string;
    readonly status: string;
    readonly trigger: string;
    readonly scheduledFor: string;
    readonly sessionId?: string | undefined;
    readonly summary?: string | undefined;
    readonly error?: {
        readonly code: string;
        readonly message: string;
    } | undefined;
    readonly skipReason?: string | undefined;
}): string;
export interface AutomationToolDef {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
    readonly output: {
        readonly schema: Record<string, unknown>;
        render(args: unknown, value: unknown): readonly {
            readonly type: 'text';
            readonly text: string;
        }[];
    };
    readonly timeoutMs: number;
    execute(args: unknown, exec: unknown): Promise<unknown>;
}
/** The six management verbs as tool definitions. */
export declare function automationToolDefs(service: AutomationService): readonly AutomationToolDef[];
export type ToolEnvelope = {
    readonly ok: true;
    readonly value: unknown;
} | {
    readonly ok: false;
    readonly error: {
        readonly code: string;
        readonly message: string;
    };
};
