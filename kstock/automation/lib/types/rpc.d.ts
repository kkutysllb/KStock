/** Host RPC adapter for the Automation Web client over the Connection
 * generic-channel registry (`/dsh-kylin-automation`). The connection service
 * owns the Host/Origin fence and browser authentication; this adapter only
 * validates payloads and maps service failures into the result envelope.
 */
import { type AutomationService } from './service.ts';
export declare const RPC_CHANNEL = "/dsh-kylin-automation";
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
/** Register the `/dsh-kylin-automation` channel on the caller's injected
 * webServer, replicating the Connection transport semantics: the same
 * Host/Origin + browser-auth fence (`connection.requestRejection`), the same
 * client-request/server-response envelopes, and a bounded buffered body.
 * (The vendored `connection.rpc.handle()` evaluates its route effect on the
 * connection plugin's own fiber, whose inject list cannot gain `webServer`
 * from a third-party patch row — direct registration is the supported path.) */
export declare function registerAutomationRpc(ctx: import('@deepseek-ai/cordis').Context, service: AutomationService): () => void;
/** One endpoint dispatch — exported for direct unit tests. */
export declare function handleAutomationRpc(service: AutomationService, endpoint: string, payload: unknown, signal: AbortSignal): Promise<RpcResult<unknown>>;
