/** Cordis Host plugin for durable standalone DSH automations (麒麟定时任务).
 *
 * Owns: durable definitions + run history (storage domain), the dispatch
 * clock, the fresh-Agent executor, the Web RPC channel, agent-scoped
 * management tools, and the capability announcement section. Does not patch
 * DSH core; every integration rides published services and events.
 *
 * Deployment note (KCoder packaged harness): no `@deepseek-ai/*` runtime
 * imports — services arrive via the `inject` names, config arrives as the
 * plain patch-row object, and the service factory clamps it.
 */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-kylin-automation";
export declare const inject: readonly ["storageDomain", "agents", "workspaceRegistry", "agentDefaultModel", "agentPresets", "sessionTitle", "connection", "webServer", "systemPrompt", "sessions"];
/** Plugin configuration (patch-row `config` values are read defensively). */
export interface Config {
    readonly maxConcurrentRuns?: number;
    readonly runTimeoutMinutes?: number;
    readonly misfireGraceMinutes?: number;
    readonly historyLimit?: number;
}
/** A pause-only update does not expand unattended work; everything else does. */
export declare function needsHumanApproval(exec: {
    readonly name: string;
    readonly arguments?: unknown;
    readonly signal: AbortSignal;
}, mountedAgent: boolean): boolean;
export declare function humanApprovalReason(toolName: string): string;
/** Mount one host-wide authority and agent-scoped management tools. */
export declare function apply(ctx: Context, rawConfig: Config): Promise<void>;
