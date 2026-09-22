/** Orchestration service: durable definitions and runs, the dispatch clock,
 * the execution pool, and recovery semantics. Tick planning lives in
 * `scheduler.ts`, execution in `executor.ts`; this file owns lifecycle and
 * transitions only.
 */
import type { Context } from '@deepseek-ai/cordis';
import { validateUpdateInput, type AutomationView, type RunView, type ValidCreateInput } from './domain.ts';
import { type AutomationConfig, type AutomationDefinition, type AutomationId, type AutomationRun } from './types.ts';
export declare class ServiceError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface SnapshotResult {
    readonly workspace?: {
        readonly id: string;
        readonly title: string;
        readonly cwd: string;
        readonly registered: boolean;
    };
    /** Every registered workspace (the editor's 工作区 picker). */
    readonly workspaces?: readonly {
        readonly id: string;
        readonly title: string;
        readonly cwd: string;
    }[];
    readonly automations?: readonly AutomationView[];
    readonly runs?: readonly RunView[];
    readonly policy?: {
        readonly runTimeoutMinutes: number;
        readonly misfireGraceMinutes: number;
        readonly historyLimit: number;
    };
    readonly serverNow?: string;
}
export declare class AutomationService {
    private readonly ctx;
    private readonly store;
    private readonly config;
    private readonly clock;
    private timer;
    private running;
    private alive;
    private disposed;
    private readonly queue;
    private readonly inFlight;
    /** Abort signal for in-flight executions; tripped by dispose so plugin
     * deactivation stops burning agent tokens instead of running to timeout. */
    private readonly runAbort;
    /** Execution promise registry so dispose can drain in-flight runs before
     * the store closes (their terminal writes must not hit a closed domain). */
    private readonly executions;
    private constructor();
    /** Open durable storage and return the unstarted service. */
    static open(ctx: Context, rawConfig: Partial<AutomationConfig> | undefined, clock?: () => number): Promise<AutomationService>;
    /** Recovery semantics + clock start. Idempotent. */
    start(): void;
    /** Stop the clock, abort in-flight executions, fail active records, close storage. */
    dispose(): Promise<void>;
    /** Crash recovery: durable queued/running records become failed(host_interrupted). */
    private recover;
    private tick;
    /** Immediate recheck after a mutation or external signal. */
    requestTick(): void;
    private recordSkipped;
    /** A run record without execution facts (skipped occurrence). */
    private makeRun;
    /** Dispatch queued runs while capacity and per-automation exclusivity allow. */
    private pump;
    private execute;
    private executeInner;
    /** Terminal transition for a run that never started executing. */
    private terminalWithoutDispatch;
    /** A registered workspace by id (the Web panel's picker validates here). */
    registeredWorkspace(id: string): {
        readonly path: string;
        readonly title: string;
    } | undefined;
    /** Register a server-side directory as a workspace (管理页「新建工作区」).
     * The path must be an absolute, existing directory on the engine host —
     * never client-invented write targets; the registry derives id/title. */
    registerWorkspace(path: string): Promise<{
        readonly id: string;
        readonly title: string;
        readonly path: string;
    }>;
    /** Resolve (registering if needed) the workspace bound to a session cwd. */
    resolveWorkspace(cwd: string): Promise<{
        readonly id: string;
        readonly title: string;
        readonly path: string;
    }>;
    /** Create one definition from validated input. */
    create(input: ValidCreateInput): Promise<AutomationDefinition>;
    /** Update a definition; bumps the revision so history stays attributable. */
    update(id: AutomationId, input: ReturnType<typeof validateUpdateInput>): Promise<AutomationDefinition>;
    /** Pause / resume / delete. Deleting retains run records. */
    mutate(id: AutomationId, mutation: 'pause' | 'resume' | 'delete'): Promise<void>;
    /** Queue one manual occurrence with the same boundary. */
    runNow(id: AutomationId): Promise<AutomationRun>;
    private queueRun;
    /** Pinned triple or the live global selection, never a mix of the two. */
    private resolveSelection;
    private requireDefinition;
    /** Full panel snapshot. With a live source session, `workspace` carries the
     * session's own workspace (and the create form defaults to it); without
     * one the panel runs standalone — automations list across all workspaces
     * and the create form requires an explicit 工作区 selection. */
    snapshot(params: {
        readonly sessionId?: string;
        readonly lang: 'zh' | 'en';
    }): Promise<SnapshotResult>;
    /** Bounded recent runs for one automation (Agent tool surface). */
    listRuns(automationId: AutomationId, limit?: number): readonly AutomationRun[];
    /** The creating/owning cwd for a live session, when resolvable. */
    cwdForSession(sessionId: string | undefined): string | undefined;
    /** The agent preset composing the caller's live session, when present. */
    agentPresetForSession(sessionId: string | undefined): string | undefined;
    /** Current revision of one definition (optimistic-concurrency check). */
    revisionOf(id: AutomationId): number;
    /** One definition, or undefined. */
    definitionOf(id: AutomationId): AutomationDefinition | undefined;
    /** Workspace-scoped definition views (Agent tool surface). */
    automationsForCwd(cwd: string, lang?: 'zh' | 'en'): readonly AutomationView[];
    /** Wire view of one definition with next-run and last-run facts. */
    toView(definition: AutomationDefinition, lang: 'zh' | 'en'): AutomationView;
    private nextRunAtOf;
}
