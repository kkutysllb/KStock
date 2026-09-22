/** Client entry: sidebar menu entry (official `sidebar.panellist` list slot) +
 * the independent main panel (official `main` keyed slot). The shell owns the
 * button, tooltip, active state, and panel switching; this plugin contributes
 * the glyph and the page — no DOM-hacked entries, no routing hacks.
 *
 * Contract: this bundle is consumed through the client module table (esbuild
 * CJS output wrapped by the build script in window.__ModuleLoader__.load),
 * `exports.inject` names the Cordis client services, and `exports.apply(ctx)`
 * registers everything inside ctx.effect-managed lifecycles.
 */

import { AutomationsView } from './AutomationsView.tsx'
import type { ClientContext } from './contracts.ts'
import { dictionaries, NS, zh } from './locales.ts'
import type { ModelCatalog, ModelCatalogProviderGroup } from './protocol.ts'
import { createAutomationsRuntime, type AutomationsRuntime } from './runtime.ts'
import { installStyles } from './styles.ts'

export const name = 'dsh-kylin-automation'

/** Services this client plugin composes against; each is provided by a
 * dsh.client.inject package row in the roster. */
export const inject = [
  'slots',
  'locale',
  'sessions',
  /** ui-workspace client plugin: openSession navigation + host directory
   * chooser (cordis Service 'uiWorkspace'). Load-order hint only — the service
   * itself is soft-probed at call time. */
  'uiWorkspace',
  'layout',
  'connection',
  'remote',
  /** Remote namespaces are fail-closed services: the session namespace must be
   * injected by name before `ctx.remote.session` is readable. */
  'remote.session',
] as const

/** Main panel id — shared by the panellist entry and the keyed main entry. */
const PANEL_ID = 'kyl-automations'

/** Browser language probe for localized durations. */
function browserLang(): 'zh' | 'en' {
  try {
    const languages = navigator.languages ?? [navigator.language]
    return (languages[0] ?? 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en'
  } catch {
    return 'zh'
  }
}

/** Normalize the model-catalog remote response into the wire projection.
 * Malformed entries are dropped, never surfaced as load failures. */
function normalizeCatalog(value: unknown): ModelCatalog {
  if (typeof value !== 'object' || value === null) return { groups: [], failures: [] }
  const root = value as { groups?: unknown }
  const groups: { id: string; name: string; models: ModelCatalog['groups'][number]['models'] }[] = []
  if (!Array.isArray(root.groups)) return { groups: groups as ModelCatalog['groups'], failures: [] }
  for (const rawGroup of root.groups) {
    if (typeof rawGroup !== 'object' || rawGroup === null) continue
    const group = rawGroup as Record<string, unknown>
    const groupId = typeof group['id'] === 'string' ? group['id'] : undefined
    const groupName = typeof group['name'] === 'string' ? group['name'] : groupId
    const models = Array.isArray(group['models']) ? group['models'] : undefined
    if (groupId === undefined || groupName === undefined || models === undefined) continue
    groups.push({
      id: groupId,
      name: groupName,
      models: models.flatMap((model) => {
        if (typeof model !== 'object' || model === null) return []
        const item = model as Record<string, unknown>
        const modelId = typeof item['id'] === 'string' ? item['id'] : undefined
        const modelName = typeof item['name'] === 'string' ? item['name'] : modelId
        if (modelId === undefined || modelName === undefined) return []
        const reasoningRaw = item['reasoning']
        const reasoning = typeof reasoningRaw === 'object' && reasoningRaw !== null
          ? reasoningRaw as { efforts?: unknown; defaultEffort?: unknown }
          : undefined
        return [{
          id: modelId,
          name: modelName,
          reasoning: reasoning !== undefined && Array.isArray(reasoning.efforts)
            ? {
                efforts: reasoning.efforts.flatMap((effort: unknown) => {
                  if (typeof effort !== 'object' || effort === null) return []
                  const record = effort as Record<string, unknown>
                  return typeof record['id'] === 'string'
                    ? [{
                        id: record['id'],
                        name: typeof record['name'] === 'string' ? record['name'] : record['id'],
                      }]
                    : []
                }),
                ...(typeof reasoning.defaultEffort === 'string' ? { defaultEffort: reasoning.defaultEffort } : {}),
              }
            : undefined,
        }]
      }),
    })
  }
  return { groups: groups as ModelCatalog['groups'], failures: [] }
}

/** Client plugin entry. */
export function apply(ctx: ClientContext): void {
  const disposeStyles = installStyles()

  // Dictionaries first: the bound translator falls back to zh entries.
  const localeService = ctx.locale
  if (localeService?.register !== undefined) {
    ctx.effect(() => localeService.register(NS, { zh: { ...zh }, en: { ...dictionaries.en } }), 'kyl-automation: dictionaries')
  }
  const t = localeService?.bind !== undefined
    ? localeService.bind(NS)
    : ((key: string, params?: Record<string, unknown>): string => {
      const template = zh[key as keyof typeof zh] ?? key
      if (params === undefined) return template
      return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
        String(params[name] ?? `{${name}}`))
    })

  let runtimeRef: AutomationsRuntime | undefined
  const runtime = createAutomationsRuntime({
    rpc: {
      call: (channel, endpoint, payload) => {
        if (ctx.connection?.rpc === undefined) {
          return Promise.reject(new Error('定时任务通道不可用 (the automation channel is unavailable)'))
        }
        return ctx.connection.rpc.call(channel, endpoint, payload)
      },
    },
    sessionId: () => {
      try {
        return ctx.sessions?.list.getSnapshot().current
      } catch {
        return undefined
      }
    },
    lang: browserLang,
  })
  runtimeRef = runtime

  const lang = browserLang()

  const backToConversation = (): void => {
    try { ctx.layout?.selectPanel(null) } catch { /* layout service absent */ }
  }

  const openSession = (sessionId: string): void => {
    void (async () => {
      try {
        await ctx.sessions?.refresh()
      } catch { /* keep opening regardless */ }
      // Official navigation path: the ui-workspace Service owns view selection
      // (ISessions deliberately has no open — "navigation belongs to the view
      // owner"). Failures surface as a panel notice, never as console silence.
      const workspace = ctx.uiWorkspace
      if (workspace?.openSession === undefined) {
        runtimeRef?.pushNotice(t('openSessionUnavailable'))
        return
      }
      try {
        workspace.openSession(sessionId)
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        runtimeRef?.pushNotice(`${t('openSessionUnavailable')} (${detail})`)
        return
      }
      backToConversation()
    })()
  }

  /** Directory picker chain: the desktop bridge global (qilin:// windows) is
   * preferred exactly like the host's own picker flow; every other window —
   * including http-loaded desktop shells — falls back to the host-side OS
   * chooser via uiWorkspace. When neither exists the error THROWS so the
   * editor shows it inline instead of the click doing nothing. */
  const pickDirectory = async (): Promise<string | null> => {
    const global = globalThis as { __QILIN_DIRECTORY_PICKER__?: { pick: () => Promise<string | null> } }
    if (typeof global.__QILIN_DIRECTORY_PICKER__?.pick === 'function') {
      try {
        const picked = await global.__QILIN_DIRECTORY_PICKER__.pick()
        // Desktop bridge present: null/empty means the user cancelled.
        return picked !== null && picked !== '' ? picked : null
      } catch (error) {
        if (ctx.uiWorkspace?.pickDirectory === undefined) throw error
        // Desktop bridge broke — fall through to the host chooser.
      }
    }
    if (ctx.uiWorkspace?.pickDirectory !== undefined) {
      return await ctx.uiWorkspace.pickDirectory()
    }
    throw new Error(t('pickerUnavailable'))
  }

  const loadModelCatalog = async (): Promise<ModelCatalog> => {
    const remoteSession = ctx.remote?.session
    if (remoteSession?.modelCatalog === undefined) {
      throw new Error('模型目录不可用 (the model catalog is unavailable)')
    }
    // The Typert Remote answers in the {ok, value}/{ok, error} envelope.
    const response = await remoteSession.modelCatalog() as { ok?: unknown; value?: unknown; error?: { code?: unknown; message?: unknown } }
    if (response?.ok !== true) {
      const message = typeof response?.error?.message === 'string' ? response.error.message : String(response?.error?.code ?? 'unknown')
      throw new Error(`模型目录加载失败 (the model catalog failed to load): ${message}`)
    }
    return normalizeCatalog(response.value)
  }

  // ── sidebar menu entry + independent main panel (official slots) ──────────
  if (ctx.slots?.inject !== undefined) {
    try {
      ctx.slots.inject('sidebar.panellist', () => {
        const disposeIcon = ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: 120,
          label: () => t('nav'),
          locale: NS,
        }, PanelIcon)
        const disposePanel = ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
        }, function AutomationsMount(): ReturnType<typeof AutomationsView> {
          return (
            <AutomationsView
              t={t}
              runtime={runtimeRef!}
              lang={lang}
              openSession={openSession}
              backToConversation={backToConversation}
              loadModelCatalog={loadModelCatalog}
              pickDirectory={pickDirectory}
            />
          )
        })
        return () => {
          disposePanel()
          disposeIcon()
        }
      })
    } catch (error) {
      // Hosts without these slots stay usable through the Agent tools only.
      console.warn('[dsh-kylin-automation] sidebar/main slot registration skipped:', error)
    }
  }

  ctx.effect(() => disposeStyles, 'kyl-automation: styles')
}

/** Sidebar glyph: clock + rays (schedule dispatch). */
function PanelIcon(props: { size?: number }): React.ReactElement {
  const size = props.size ?? 18
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.9}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      <circle cx='12' cy='12.5' r='8' />
      <path d='M12 8.5v4.2l2.9 1.7' />
      <path d='M5 3.5 3.4 5.1' />
      <path d='M19 3.5l1.6 1.6' />
      <path d='M12 2.5h.01' />
    </svg>
  )
}

export { createAutomationsRuntime } from './runtime.ts'
