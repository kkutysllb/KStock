/** Host RPC adapter for the Automation Web client over the Connection
 * generic-channel registry (`/dsh-kylin-automation`). The connection service
 * owns the Host/Origin fence and browser authentication; this adapter only
 * validates payloads and maps service failures into the result envelope.
 */

import { validateCreateInput, validateUpdateInput, ValidationError } from './domain.ts'
import { ServiceError, type AutomationService } from './service.ts'

export const RPC_CHANNEL = '/dsh-kylin-automation'

/** Bounded body shapes keep every handler total. */
const MAX_STRING = 20_000
const MAX_ID = 120

export type RpcResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

function ok<T>(value: T): RpcResult<T> {
  return { ok: true, value }
}

function fail(code: string, message: string): RpcResult<never> {
  return { ok: false, error: { code, message } }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`${label} must be an object`, label)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, label: string, max = MAX_STRING): string {
  if (typeof value !== 'string') throw new ValidationError(`${label} must be a string`, label)
  if (value.length > max) throw new ValidationError(`${label} exceeds ${max} chars`, label)
  return value
}

function optionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : string(value, label)
}

function boundedNumber(value: unknown, label: string, min: number, max: number, fallback: number): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new ValidationError(`${label} must be an integer ${min}..${max}`, label)
  }
  return value
}

function toErrorResult(error: unknown, aborted: boolean): RpcResult<never> {
  if (aborted) return fail('aborted', 'The request was aborted.')
  if (error instanceof ValidationError) return fail('invalid', error.message)
  if (error instanceof ServiceError) return fail(error.code, error.message)
  return fail('internal', error instanceof Error ? error.message : String(error))
}

/** Register the `/dsh-kylin-automation` channel on the caller's injected
 * webServer, replicating the Connection transport semantics: the same
 * Host/Origin + browser-auth fence (`connection.requestRejection`), the same
 * client-request/server-response envelopes, and a bounded buffered body.
 * (The vendored `connection.rpc.handle()` evaluates its route effect on the
 * connection plugin's own fiber, whose inject list cannot gain `webServer`
 * from a third-party patch row — direct registration is the supported path.) */
export function registerAutomationRpc(
  ctx: import('@deepseek-ai/cordis').Context,
  service: AutomationService,
): () => void {
  return ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: RPC_CHANNEL,
    handler: (req, res) => { void serveRpcRequest(ctx, service, req, res) },
  }), 'dsh-kylin-automation: rpc channel') as unknown as () => void
}

/** JSON body limit for RPC payloads (bounded like the connection's fence). */
const RPC_BODY_LIMIT_BYTES = 4 * 1024 * 1024

async function serveRpcRequest(
  ctx: import('@deepseek-ai/cordis').Context,
  service: AutomationService,
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
): Promise<void> {
  const reply = (status: number, payload: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json', connection: 'close' })
    res.end(JSON.stringify(payload))
  }
  // The same Host/Origin + persistent browser-auth fence the /api route uses.
  const rejection = ctx.connection.requestRejection(req as never)
  if (rejection !== undefined) {
    res.writeHead(rejection)
    res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
    return
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'text/plain' })
    res.end('method not allowed')
    return
  }
  const url = new URL(req.url ?? '/', 'http://dsh.internal')
  const endpoint = url.pathname === RPC_CHANNEL ? '' : url.pathname.startsWith(`${RPC_CHANNEL}/`)
    ? url.pathname.slice(RPC_CHANNEL.length + 1)
    : undefined
  if (endpoint === undefined || !/^[A-Za-z0-9_$.:-]+$/.test(endpoint)) {
    reply(404, { type: 'server-response', rpcId: 'invalid-request', result: fail('not-found', 'unknown endpoint') })
    return
  }
  const contentType = String(req.headers['content-type'] ?? '').split(';')[0]?.trim().toLowerCase()
  if (contentType !== 'application/json') {
    reply(415, { type: 'server-response', rpcId: 'invalid-request', result: fail('invalid', 'content type must be application/json') })
    return
  }
  const declared = req.headers['content-length']
  if (declared !== undefined && Number(declared) > RPC_BODY_LIMIT_BYTES) {
    res.writeHead(413, { connection: 'close' })
    res.end()
    return
  }
  let raw = ''
  const abort = new AbortController()
  res.on('close', () => { if (!res.writableEnded) abort.abort() })
  try {
    let received = 0
    for await (const chunk of req) {
      received += (chunk as Buffer).byteLength
      if (received > RPC_BODY_LIMIT_BYTES) throw new Error('body too large')
      raw += String(chunk)
    }
  } catch {
    res.writeHead(400, { connection: 'close' })
    res.end('body read failure')
    req.destroy()
    return
  }
  let envelope: { type?: unknown; rpcId?: unknown; method?: unknown; payload?: unknown }
  try {
    envelope = JSON.parse(raw) as typeof envelope
  } catch {
    reply(400, { type: 'server-response', rpcId: 'invalid-request', result: fail('invalid', 'body is not JSON') })
    return
  }
  if (envelope?.type !== 'client-request' || typeof envelope.rpcId !== 'string'
    || typeof envelope.method !== 'string') {
    reply(200, {
      type: 'server-response',
      rpcId: typeof envelope?.rpcId === 'string' ? envelope.rpcId : 'invalid-request',
      result: fail('invalid', 'invalid client-request message'),
    })
    return
  }
  if (envelope.method !== endpoint) {
    reply(200, {
      type: 'server-response',
      rpcId: envelope.rpcId,
      result: fail('invalid', `method ${JSON.stringify(envelope.method)} does not match endpoint ${JSON.stringify(endpoint)}`),
    })
    return
  }
  const result = await handleAutomationRpc(service, envelope.method, envelope.payload, abort.signal)
  reply(200, { type: 'server-response', rpcId: envelope.rpcId, result })
}

/** One endpoint dispatch — exported for direct unit tests. */
export async function handleAutomationRpc(
  service: AutomationService,
  endpoint: string,
  payload: unknown,
  signal: AbortSignal,
): Promise<RpcResult<unknown>> {
  try {
    signal.throwIfAborted()
    const body = record(payload, 'payload')
    switch (endpoint) {
      case 'snapshot': {
        const sessionId = optionalString(body.sessionId, 'sessionId')
        const lang = body.lang === 'en' ? 'en' as const : 'zh' as const
        return ok(await service.snapshot({
          ...(sessionId === undefined ? {} : { sessionId }),
          lang,
        }))
      }
      case 'create': {
        const input = record(body.input, 'input')
        const sessionId = optionalString(body.sessionId, 'sessionId')
        // The Web panel may pick any registered workspace; the cwd always
        // resolves from the server-side registry record (never client text).
        const requestedWorkspaceId = optionalString(body.workspaceId, 'workspaceId')
        let workspace: { readonly id: string; readonly path: string }
        if (requestedWorkspaceId !== undefined) {
          const registered = service.registeredWorkspace(requestedWorkspaceId)
          if (registered === undefined) {
            return fail('invalid', `工作区不存在 (unknown workspace) ${JSON.stringify(requestedWorkspaceId)}`)
          }
          workspace = { id: requestedWorkspaceId, path: registered.path }
        } else {
          const cwd = service.cwdForSession(sessionId)
          if (cwd === undefined) throw new ServiceError('no-session', '需要活跃会话才能定位工作区 (a live source session is required)')
          signal.throwIfAborted()
          const resolved = await service.resolveWorkspace(cwd)
          workspace = { id: resolved.id, path: resolved.path }
        }
        const agentPreset = optionalString(body.agentPreset, 'agentPreset') ?? service.agentPresetForSession(sessionId) ?? 'standard'
        const definition = await service.create(validateCreateInput({
          ...input,
          workspaceId: workspace.id,
          cwd: workspace.path,
          agentPreset,
        }))
        return ok({ id: definition.id, revision: definition.revision })
      }
      case 'update': {
        const automationId = string(body.automationId, 'automationId', MAX_ID)
        const input = validateUpdateInput(body.input)
        if (typeof body.expectedRevision === 'number'
          && service.revisionOf(automationId) !== body.expectedRevision) {
          return fail('revision-conflict', '定义已被其他修改更新，请刷新后重试 (the definition changed; refresh and retry)')
        }
        const definition = await service.update(automationId, input)
        return ok({ id: definition.id, revision: definition.revision })
      }
      case 'mutate': {
        const automationId = string(body.automationId, 'automationId', MAX_ID)
        const mutation = body.mutation
        if (mutation !== 'pause' && mutation !== 'resume' && mutation !== 'delete') {
          return fail('invalid', 'mutation must be pause | resume | delete')
        }
        await service.mutate(automationId, mutation)
        return ok({ id: automationId, mutation })
      }
      case 'register-workspace': {
        const path = string(body.path, 'path', 1024)
        if (!path.startsWith('/')) return fail('invalid', '工作区路径必须是绝对路径')
        const workspace = await service.registerWorkspace(path)
        return ok(workspace)
      }
      case 'delete-run': {
        const automationId = string(body.automationId, 'automationId', MAX_ID)
        const runId = string(body.runId, 'runId', MAX_ID)
        await service.deleteRun(automationId, runId)
        return ok({ id: runId })
      }
      case 'clear-runs': {
        const automationId = string(body.automationId, 'automationId', MAX_ID)
        const cleared = await service.clearRuns(automationId)
        return ok({ cleared })
      }
      case 'run-now': {
        const automationId = string(body.automationId, 'automationId', MAX_ID)
        const run = await service.runNow(automationId)
        return ok({ runId: run.id, scheduledFor: run.scheduledFor })
      }
      case 'runs': {
        const automationId = string(body.automationId, 'automationId', MAX_ID)
        const limit = boundedNumber(body.limit, 'limit', 1, 100, 20)
        return ok({ runs: service.listRuns(automationId, limit) })
      }
      case 'ping':
        return ok({ pong: true, at: new Date().toISOString() })
      default:
        return fail('not-found', `unknown endpoint ${JSON.stringify(endpoint)}`)
    }
  } catch (error: unknown) {
    return toErrorResult(error, signal.aborted)
  }
}
