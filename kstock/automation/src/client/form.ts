/** Pure form/presentation helpers for the Automations panel. Kept free of
 * React so unit tests drive them directly.
 */

import type {
  AutomationSchedule,
  ModelCatalogProviderGroup,
  RunView,
  RunStatus,
} from './protocol.ts'

/** Common IANA zones offered as quick picks; free text is always allowed. */
export const COMMON_ZONES: readonly string[] = [
  'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Singapore', 'Asia/Tokyo',
  'Asia/Seoul', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'Europe/Berlin',
  'Europe/Paris', 'Europe/Moscow', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo', 'Australia/Sydney',
  'Pacific/Auckland', 'UTC',
]

export interface Translate {
  (key: string, params?: Record<string, unknown>): string
}

/** Editor form state (raw strings until save-time validation). */
export interface EditorForm {
  name: string
  prompt: string
  /** Registered workspace id the new rule binds to. */
  workspaceId: string
  scheduleKind: 'once' | 'interval' | 'daily' | 'weekly'
  onceAt: string
  everyMinutes: string
  wallTime: string
  weekdays: number[]
  timeZone: string
  permission: 'read-only' | 'workspace-write'
  followModel: boolean
  provider: string
  model: string
  effort: string
}

/** Fresh form pre-filled for "in about an hour". */
export function emptyForm(nowIso: string, workspaceId = ''): EditorForm {
  return {
    name: '',
    prompt: '',
    workspaceId,
    scheduleKind: 'daily',
    onceAt: localInputValue(new Date(Date.parse(nowIso) + 3_600_000)),
    everyMinutes: '30',
    wallTime: '09:30',
    weekdays: [1, 2, 3, 4, 5],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
    permission: 'read-only',
    followModel: true,
    provider: '',
    model: '',
    effort: '',
  }
}

/** ISO instant → datetime-local input value (browser-local). */
export function localInputValue(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Form → wire schedule; returns a validation message when invalid. */
export function formToSchedule(form: EditorForm, lang: 'zh' | 'en'):
  | { readonly schedule: AutomationSchedule; readonly timeZone: string }
  | string {
  switch (form.scheduleKind) {
    case 'once': {
      if (form.onceAt.trim() === '') return lang === 'zh' ? '请填写执行时刻' : 'Set the run time'
      const parsed = Date.parse(form.onceAt.trim())
      if (Number.isNaN(parsed)) return lang === 'zh' ? '执行时刻不是有效时间' : 'The run time is not a valid instant'
      return { schedule: { kind: 'once', at: new Date(parsed).toISOString() }, timeZone: '' }
    }
    case 'interval': {
      const minutes = Number(form.everyMinutes)
      if (!Number.isSafeInteger(minutes) || minutes < 5) {
        return lang === 'zh' ? '间隔须为整数且 ≥ 5 分钟' : 'Interval must be an integer ≥ 5 minutes'
      }
      return { schedule: { kind: 'interval', everyMinutes: minutes }, timeZone: '' }
    }
    case 'daily':
      if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(form.wallTime)) {
        return lang === 'zh' ? '时间格式须为 HH:mm' : 'Time must be HH:mm'
      }
      return { schedule: { kind: 'daily', time: form.wallTime }, timeZone: form.timeZone }
    case 'weekly':
      if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(form.wallTime)) {
        return lang === 'zh' ? '时间格式须为 HH:mm' : 'Time must be HH:mm'
      }
      if (form.weekdays.length === 0) return lang === 'zh' ? '至少选择一个星期' : 'Pick at least one weekday'
      return {
        schedule: { kind: 'weekly', time: form.wallTime, weekdays: [...form.weekdays].sort((a, b) => a - b) },
        timeZone: form.timeZone,
      }
    // no default — exhaustive over the four kinds
  }
}

/** Model target from the form: null = follow global. */
export function formToModelTarget(form: EditorForm): { provider: string; model: string; reasoningEffort: string | null } | null {
  if (form.followModel) return null
  const provider = form.provider.trim()
  const model = form.model.trim()
  if (provider === '' || model === '') return null
  const effort = form.effort.trim()
  return { provider, model, reasoningEffort: effort === '' ? null : effort }
}

/** Local display of an ISO instant. */
export function formatWhen(iso: string | undefined): string {
  if (iso === undefined || iso === '') return '—'
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return iso
  const date = new Date(parsed)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Human duration between two instants. */
export function formatDuration(
  startedAt: string | undefined,
  finishedAt: string | undefined,
  lang: 'zh' | 'en',
): string {
  if (startedAt === undefined || finishedAt === undefined) return '—'
  const ms = Date.parse(finishedAt) - Date.parse(startedAt)
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return lang === 'zh' ? `${seconds} 秒` : `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return lang === 'zh' ? `${minutes} 分 ${seconds % 60} 秒` : `${minutes}m ${seconds % 60}s`
  return lang === 'zh'
    ? `${Math.floor(minutes / 60)} 时 ${minutes % 60} 分`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function statusLabel(status: RunStatus, t: Translate): string {
  switch (status) {
    case 'queued': return t('statusQueued')
    case 'running': return t('statusRunning')
    case 'succeeded': return t('statusSucceeded')
    case 'failed': return t('statusFailed')
    case 'skipped': return t('statusSkipped')
    case 'cancelled': return t('statusCancelled')
    // no default — exhaustive
  }
}

export function statusClass(status: RunStatus): string {
  return `kyl-status kyl-status-${status}`
}

/** Sort runs newest-first with a stable tie-break. */
export function sortRunsDesc(runs: readonly RunView[]): RunView[] {
  return [...runs].sort((a, b) => Date.parse(b.scheduledFor) - Date.parse(a.scheduledFor)
    || Date.parse(b.finishedAt ?? '') - Date.parse(a.finishedAt ?? ''))
}

/** Model groups without failed provider entries. */
export function catalogGroups(catalog: { groups: readonly ModelCatalogProviderGroup[] }): readonly ModelCatalogProviderGroup[] {
  return catalog.groups
}
