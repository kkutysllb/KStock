/** Automations panel — the independent main-panel page behind the sidebar
 * entry. One RPC-backed state source, a visibility-gated poll, and a local
 * editor overlay. Presentation only: every write goes through the runtime.
 */
import { type Translate } from './form.ts';
import type { ModelCatalog } from './protocol.ts';
import type { AutomationsRuntime } from './runtime.ts';
export interface AutomationsViewProps {
    readonly t: Translate;
    readonly runtime: AutomationsRuntime;
    /** Browser language for localized durations (server already localizes summaries). */
    readonly lang: 'zh' | 'en';
    /** Navigate to a run's result Session in the conversation surface. */
    readonly openSession: (sessionId: string) => void;
    /** Return to the Conversation main panel. */
    readonly backToConversation: () => void;
    /** Optional model catalog loader for the pinned-model editor. */
    readonly loadModelCatalog?: (() => Promise<ModelCatalog>) | undefined;
}
/** The full panel. */
export declare function AutomationsView(props: AutomationsViewProps): React.ReactElement;
