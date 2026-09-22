/** Fresh-Agent execution boundary for one already-claimed automation run.
 *
 * Each dispatched occurrence receives a new Session and a fresh root Agent
 * that owns none of the creating conversation's history, inbox, grants, or
 * past approvals. Policy is installed before publication: two permission
 * modes only, `approval policy = never` (fail closed), and an explicit
 * capability allowlist enforced by an agent-scoped final guard.
 *
 * Deployment note (KCoder packaged harness): plugin bundles resolve their
 * imports through plain Node ESM, so this file must not import `@deepseek-ai/*`
 * at run time — the framework behaviors it needs (sandbox mode, approval
 * policy, prompt source message, pinned model selection) are inline replays of
 * the corresponding framework one-liners, verified against the same version.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SessionEventLike } from '@deepseek-ai/dsh-session';
import type { AutomationDefinition, AutomationRun, RunError } from './types.ts';
/** Coding-tool allowlist for unattended runs. Everything interactive
 * (questions, plans, goals, nested agents, recursive automation management,
 * background jobs) is denied here. */
export declare const UNATTENDED_TOOL_ALLOWLIST: ReadonlySet<string>;
/** Final scoped denial reason for one tool call, or `undefined` to allow. */
export declare function unattendedToolGuardReason(name: string, args: unknown): string | undefined;
export interface RunCompletion {
    readonly sessionId?: string;
    readonly status: 'succeeded' | 'failed' | 'cancelled';
    readonly summary?: string;
    readonly error?: RunError;
}
/** Last assistant text and the closed-turn reason of the interval this run owns. */
export declare function summarizeRun(events: readonly SessionEventLike[], firstSeq: number): {
    readonly text: string;
    readonly reason?: Record<string, any>;
};
/** Map a closed-turn reason to the durable run error. */
export declare function reasonToError(reason: Record<string, any> | undefined): RunError;
/** Resolved model selection for one run: pinned target or the live default. */
export declare function modelSelectionForRun(target: AutomationRun['target'], fallback: {
    provider: string;
    model: string;
    reasoningEffort?: string | undefined;
}): {
    provider: string;
    model: string;
    reasoningEffort?: string | undefined;
};
export interface ExecutorDeps {
    /** Host context (agents / workspaceRegistry / sessions / presets / …). */
    readonly ctx: Context;
    readonly runTimeoutMs: number;
    readonly signal?: AbortSignal;
    /** Test seam for wall-clock-dependent deadlines. */
    readonly setTimeoutImpl?: typeof setTimeout;
}
/**
 * Execute exactly one durable run in a fresh root Agent and Session. The new
 * Session owns no source-chat history or grant; sandbox mode, approval policy,
 * and the capability guard are installed before publication.
 */
export declare function executeAutomationRun(definition: AutomationDefinition, run: AutomationRun, deps: ExecutorDeps): Promise<RunCompletion>;
