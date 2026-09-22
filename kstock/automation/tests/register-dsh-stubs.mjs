/** Test loader hook: the Host provides every `@deepseek-ai/*` module at
 * runtime; unit tests substitute one shared stub module so pure-logic tests
 * run without the harness. Import order: this file, then tsx, then tests.
 */
import { registerHooks } from 'node:module'

const runtimeStub = new URL('./dsh-runtime-stub.mjs', import.meta.url).href
const runtimePackages = new Set([
  '@deepseek-ai/dsh-agent',
  '@deepseek-ai/dsh-agent-default-model',
  '@deepseek-ai/dsh-agent-presets',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-permission-presets',
  '@deepseek-ai/dsh-sandbox-policy',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-session-title',
  '@deepseek-ai/dsh-settings',
  '@deepseek-ai/dsh-storage-domain',
  '@deepseek-ai/dsh-system-prompt',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/dsh-user-approval',
  '@deepseek-ai/dsh-workspace',
  '@deepseek-ai/schemastery',
])

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (runtimePackages.has(specifier)) return { url: runtimeStub, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
