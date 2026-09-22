/** Durable persistence over the storage-domain form: automation definitions,
 * run records, and per-automation dispatch cursors. The spec's zod schemas are
 * the durable boundary; the store adds CRUD orchestration and retention.
 */
import z from 'zod';
import type { Domain } from '@deepseek-ai/dsh-storage-domain';
import type { AutomationConfig, AutomationDefinition, AutomationId, AutomationRun, RunId } from './types.ts';
export declare const automationDefinitionSchema: z.ZodType<AutomationDefinition>;
export declare const automationRunSchema: z.ZodType<AutomationRun>;
/** Domain layout. Name matches the storage unit-name pattern; `single` keeps
 * every table in one validated document per unit. The spec is the plain
 * declaration object (`defineDomain`/`domainTable` are validation identity
 * helpers, inlined here to keep the bundle free of `@deepseek-ai/*` runtime
 * imports); the framework facility validates the same invariants at open. */
export declare const automationDomainSpec: {
    readonly name: "kylin_automation";
    readonly version: 1;
    readonly tables: {
        readonly automations: {
            readonly valueSchema: z.ZodType<AutomationDefinition, unknown, z.core.$ZodTypeInternals<AutomationDefinition, unknown>>;
        };
        readonly runs: {
            readonly valueSchema: z.ZodType<AutomationRun, unknown, z.core.$ZodTypeInternals<AutomationRun, unknown>>;
        };
        readonly cursors: {
            readonly valueSchema: z.ZodObject<{
                lastOccurrence: z.ZodString;
            }, z.core.$strip>;
        };
    };
};
export interface OpenedAutomationDomain extends Domain<typeof automationDomainSpec> {
}
/** Typed CRUD over the opened domain plus retention and recovery queries. */
export declare class AutomationStore {
    private readonly domain;
    private constructor();
    /** Open the durable domain. The caller owns the handle (ctx.effect disposer). */
    static open(facility: {
        open<S extends import('@deepseek-ai/dsh-storage-domain').DomainSpec>(spec: S): Promise<Domain<S>>;
    }): Promise<AutomationStore>;
    close(): Promise<void>;
    automations(): AutomationDefinition[];
    automation(id: AutomationId): AutomationDefinition | undefined;
    putAutomation(definition: AutomationDefinition): Promise<void>;
    deleteAutomation(id: AutomationId): Promise<boolean>;
    private automationTable;
    run(id: RunId): AutomationRun | undefined;
    /** Runs of one automation, newest first. */
    runsOf(automationId: AutomationId): AutomationRun[];
    /** All runs in stored order (diagnostics + recovery). */
    allRuns(): AutomationRun[];
    /** Active (queued or running) runs of one automation. */
    activeRunsOf(automationId: AutomationId): AutomationRun[];
    /** Whether this exact scheduled occurrence was already recorded. */
    hasOccurrence(automationId: AutomationId, key: string): boolean;
    putRun(run: AutomationRun): Promise<void>;
    /** Atomic terminal-state transition (queued/running → terminal). */
    updateRun(id: RunId, patch: (current: AutomationRun) => AutomationRun): Promise<AutomationRun>;
    /** Enforce per-automation terminal-run retention. Active records are never pruned. */
    pruneRetention(automationId: AutomationId, historyLimit: number): Promise<void>;
    private runTable;
    cursor(id: AutomationId): number | undefined;
    /** Monotonic cursor advance; concurrent advances never regress. */
    advanceCursor(id: AutomationId, occurrenceMs: number): Promise<void>;
    private cursorTable;
}
/** Validate + default the cordis config values at apply time. */
export declare function resolveConfig(raw: Partial<AutomationConfig> | undefined, defaults: AutomationConfig): AutomationConfig;
