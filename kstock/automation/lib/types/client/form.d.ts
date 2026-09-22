/** Pure form/presentation helpers for the Automations panel. Kept free of
 * React so unit tests drive them directly.
 */
import type { AutomationSchedule, ModelCatalogProviderGroup, RunView, RunStatus } from './protocol.ts';
/** Common IANA zones offered as quick picks; free text is always allowed. */
export declare const COMMON_ZONES: readonly string[];
export interface Translate {
    (key: string, params?: Record<string, unknown>): string;
}
/** Editor form state (raw strings until save-time validation). */
export interface EditorForm {
    name: string;
    prompt: string;
    /** Registered workspace id the new rule binds to. */
    workspaceId: string;
    scheduleKind: 'once' | 'interval' | 'daily' | 'weekly';
    onceAt: string;
    everyMinutes: string;
    wallTime: string;
    weekdays: number[];
    timeZone: string;
    permission: 'read-only' | 'workspace-write';
    followModel: boolean;
    provider: string;
    model: string;
    effort: string;
}
/** Fresh form pre-filled for "in about an hour". */
export declare function emptyForm(nowIso: string, workspaceId?: string): EditorForm;
/** ISO instant → datetime-local input value (browser-local). */
export declare function localInputValue(date: Date): string;
/** Form → wire schedule; returns a validation message when invalid. */
export declare function formToSchedule(form: EditorForm, lang: 'zh' | 'en'): {
    readonly schedule: AutomationSchedule;
    readonly timeZone: string;
} | string;
/** Model target from the form: null = follow global. */
export declare function formToModelTarget(form: EditorForm): {
    provider: string;
    model: string;
    reasoningEffort: string | null;
} | null;
/** Local display of an ISO instant. */
export declare function formatWhen(iso: string | undefined): string;
/** Human duration between two instants. */
export declare function formatDuration(startedAt: string | undefined, finishedAt: string | undefined, lang: 'zh' | 'en'): string;
export declare function statusLabel(status: RunStatus, t: Translate): string;
export declare function statusClass(status: RunStatus): string;
/** Sort runs newest-first with a stable tie-break. */
export declare function sortRunsDesc(runs: readonly RunView[]): RunView[];
/** Model groups without failed provider entries. */
export declare function catalogGroups(catalog: {
    groups: readonly ModelCatalogProviderGroup[];
}): readonly ModelCatalogProviderGroup[];
