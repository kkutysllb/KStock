/** Automations panel — the independent main-panel page behind the sidebar
 * entry. One RPC-backed state source, a visibility-gated poll, and a local
 * editor overlay. Presentation only: every write goes through the runtime.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  COMMON_ZONES,
  type EditorForm,
  emptyForm,
  formatDuration,
  formatWhen,
  formToModelTarget,
  formToSchedule,
  localInputValue,
  sortRunsDesc,
  statusClass,
  statusLabel,
  type Translate,
} from './form.ts'
import type {
  AutomationView,
  ModelCatalog,
  ModelCatalogProviderGroup,
  RunView,
} from './protocol.ts'
import type { AutomationsRuntime } from './runtime.ts'

export interface AutomationsViewProps {
  readonly t: Translate
  readonly runtime: AutomationsRuntime
  /** Browser language for localized durations (server already localizes summaries). */
  readonly lang: 'zh' | 'en'
  /** Navigate to a run's result Session in the conversation surface. */
  readonly openSession: (sessionId: string) => void
  /** Return to the Conversation main panel. */
  readonly backToConversation: () => void
  /** Optional model catalog loader for the pinned-model editor. */
  readonly loadModelCatalog?: (() => Promise<ModelCatalog>) | undefined
}

interface EditorState {
  readonly open: boolean
  readonly mode: 'create' | 'edit'
  readonly automationId?: string
  readonly form: EditorForm
}

const POLL_MS = 3_000

const WEEKDAY_KEYS: readonly string[] = ['weekdayMo', 'weekdayTu', 'weekdayWe', 'weekdayTh', 'weekdayFr', 'weekdaySa', 'weekdaySu']

/** The full panel. */
export function AutomationsView(props: AutomationsViewProps): React.ReactElement {
  const { t, runtime, lang, openSession, backToConversation, loadModelCatalog } = props
  const state = useSyncExternalStore(runtime.source.subscribe, runtime.source.getSnapshot)
  const [editor, setEditor] = useState<EditorState>({ open: false, mode: 'create', form: emptyForm(new Date().toISOString()) })
  // Workspace filter across the whole registry ('' = 全部工作区).
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('')
  const [notice, setNotice] = useState<string | undefined>(undefined)

  // Visibility-gated poll: hidden tabs pause reads; returning refreshes at once.
  useEffect(() => {
    let stopped = false
    const poll = (): void => { if (!stopped) void runtime.refresh().catch(() => undefined) }
    poll()
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') poll()
    }, POLL_MS)
    const onVisible = (): void => { poll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [runtime])

  const snapshot = state.snapshot
  const automations = useMemo(
    () => (snapshot?.automations ?? []).filter(view => workspaceFilter === '' || view.workspaceId === workspaceFilter),
    [snapshot, workspaceFilter],
  )
  const runs = useMemo(
    () => sortRunsDesc(snapshot?.runs ?? []).filter(run => {
      if (workspaceFilter === '') return true
      const owner = snapshot?.automations?.find(view => view.id === run.automationId)
      return owner !== undefined && (workspaceFilter === '' || owner.workspaceId === workspaceFilter)
    }),
    [snapshot, workspaceFilter],
  )

  const closeEditor = (): void => {
    setEditor({ open: false, mode: 'create', form: emptyForm(new Date().toISOString()) })
  }
  const openCreate = (): void => {
    const defaultWorkspace = workspace?.registered === true && workspace.id !== ''
      ? workspace.id
      : snapshot?.workspaces?.[0]?.id ?? ''
    setEditor({
      open: true,
      mode: 'create',
      form: emptyForm(snapshot?.serverNow ?? new Date().toISOString(), defaultWorkspace),
    })
  }
  const openEdit = (automation: AutomationView): void => {
    setEditor({ open: true, mode: 'edit', automationId: automation.id, form: automationToForm(automation) })
  }

  const submitEditor = async (): Promise<void> => {
    const scheduleResult = formToSchedule(editor.form, lang)
    if (typeof scheduleResult === 'string') return
    try {
      if (editor.mode === 'create') {
        await runtime.create({
          name: editor.form.name.trim(),
          prompt: editor.form.prompt,
          workspaceId: editor.form.workspaceId,
          schedule: scheduleResult.schedule,
          timeZone: scheduleResult.timeZone,
          permission: editor.form.permission,
          modelTarget: formToModelTarget(editor.form),
        })
        setNotice(t('createdHint'))
      } else if (editor.automationId !== undefined) {
        const current = automations.find(item => item.id === editor.automationId)
        await runtime.update(editor.automationId, current?.revision ?? 1, {
          name: editor.form.name.trim(),
          prompt: editor.form.prompt,
          schedule: scheduleResult.schedule,
          timeZone: scheduleResult.timeZone,
          permission: editor.form.permission,
          modelTarget: formToModelTarget(editor.form),
        })
      }
      closeEditor()
      await runtime.refresh()
    } catch (error: unknown) {
      // Editor errors surface inline; mutations never silently resubmit.
      console.warn('[dsh-kylin-automation] editor submit failed:', error)
    }
  }

  const mutate = async (id: string, mutation: 'pause' | 'resume' | 'delete'): Promise<void> => {
    if (mutation === 'delete' && !window.confirm(t('deleteConfirm'))) return
    try {
      await runtime.mutate(id, mutation)
      if (editor.open && editor.automationId === id && mutation === 'delete') closeEditor()
      await runtime.refresh()
    } catch (error: unknown) {
      setNotice(`${t('updateFailed')}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const runNow = async (id: string): Promise<void> => {
    try {
      await runtime.runNow(id)
      setNotice(t('runQueued'))
    } catch (error: unknown) {
      setNotice(`${t('updateFailed')}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (snapshot?.unavailable !== undefined) {
    return (
      <div className='kyl-panel' data-panel='automations'>
        <PanelHeader t={t} onBack={backToConversation} />
        <div className='kyl-empty'>
          <div className='kyl-empty-title'>{t('noSession')}</div>
          <div className='kyl-empty-hint'>{t('subtitle')}</div>
        </div>
      </div>
    )
  }
  if (state.phase === 'error' && snapshot === undefined) {
    return (
      <div className='kyl-panel' data-panel='automations'>
        <PanelHeader t={t} onBack={backToConversation} />
        <div className='kyl-empty'>
          <div className='kyl-empty-hint'>{state.error ?? t('unavailable')}</div>
          <button type='button' className='kyl-btn' onClick={() => { void runtime.refresh() }}>{t('refresh')}</button>
        </div>
      </div>
    )
  }

  const workspace = snapshot?.workspace
  const policy = snapshot?.policy

  return (
    <div className='kyl-panel' data-panel='automations'>
      <PanelHeader t={t} onBack={backToConversation} />
      <div className='kyl-toolbar'>
        <div className='kyl-scope'>
          <select
            className='kyl-input kyl-select-inline'
            value={workspaceFilter}
            title={workspace?.cwd}
            onChange={event => setWorkspaceFilter(event.target.value)}
          >
            <option value=''>{t('allWorkspaces')}</option>
            {(snapshot?.workspaces ?? []).map(item => (
              <option key={item.id} value={item.id}>{item.title}</option>
            ))}
          </select>
          {workspaceFilter === '' && workspace !== undefined && (
            <span className='kyl-chip'>{t('workspace')}: {workspace.title}</span>
          )}
          {policy !== undefined && (
            <span className='kyl-chip kyl-chip-muted'>
              {t('policyHint', { timeout: policy.runTimeoutMinutes, grace: policy.misfireGraceMinutes })}
            </span>
          )}
        </div>
        <div className='kyl-actions'>
          <button type='button' className='kyl-btn' onClick={() => { void runtime.refresh() }}>{t('refresh')}</button>
          <button type='button' className='kyl-btn kyl-btn-primary' onClick={openCreate}>{t('newTask')}</button>
        </div>
      </div>
      {notice !== undefined && (
        <div className='kyl-notice' role='status' onClick={() => setNotice(undefined)}>{notice}</div>
      )}
      <div className='kyl-body'>
        <section className='kyl-section'>
          <h2 className='kyl-section-title'>{t('listTitle')} <span className='kyl-count'>{automations.length}</span></h2>
          {automations.length === 0
            ? (
              <div className='kyl-empty'>
                <div className='kyl-empty-title'>{t('emptyTitle')}</div>
                <div className='kyl-empty-hint'>{t('emptyHint')}</div>
              </div>
            )
            : (
              <ul className='kyl-cards'>
                {automations.map(automation => (
                  <AutomationCard
                    key={automation.id}
                    automation={automation}
                    t={t}
                    onRunNow={() => { void runNow(automation.id) }}
                    onToggle={() => { void mutate(automation.id, automation.status === 'active' ? 'pause' : 'resume') }}
                    onEdit={() => openEdit(automation)}
                    onDelete={() => { void mutate(automation.id, 'delete') }}
                  />
                ))}
              </ul>
            )}
        </section>
        <section className='kyl-section'>
          <h2 className='kyl-section-title'>{t('runsTitle')}</h2>
          {runs.length === 0
            ? <div className='kyl-empty-hint'>{t('runsEmpty')}</div>
            : (
              <ul className='kyl-runs'>
                {runs.map(run => (
                  <RunRow key={run.id} run={run} t={t} lang={lang} onOpenSession={openSession} />
                ))}
              </ul>
            )}
        </section>
      </div>
      {editor.open && (
        <AutomationEditor
          t={t}
          mode={editor.mode}
          form={editor.form}
          workspaces={snapshot?.workspaces}
          currentCwd={workspace?.cwd}
          loadModelCatalog={loadModelCatalog}
          onChange={form => setEditor(current => ({ ...current, form }))}
          onSubmit={() => { void submitEditor() }}
          onCancel={closeEditor}
        />
      )}
    </div>
  )
}

function PanelHeader(props: { readonly t: Translate; readonly onBack: () => void }): React.ReactElement {
  return (
    <header className='kyl-header'>
      <div>
        <h1 className='kyl-title'>{props.t('title')}</h1>
        <p className='kyl-subtitle'>{props.t('subtitle')}</p>
      </div>
      <button type='button' className='kyl-btn kyl-btn-ghost' onClick={props.onBack}>← {props.t('backToList')}</button>
    </header>
  )
}

function AutomationCard(props: {
  readonly automation: AutomationView
  readonly t: Translate
  readonly onRunNow: () => void
  readonly onToggle: () => void
  readonly onEdit: () => void
  readonly onDelete: () => void
}): React.ReactElement {
  const { automation, t } = props
  const active = automation.status === 'active'
  return (
    <li className='kyl-card' data-status={automation.status}>
      <div className='kyl-card-head'>
        <span className='kyl-badge' data-active={active || undefined}>
          {active ? t('active') : t('paused')}
        </span>
        <span className='kyl-card-name' title={automation.prompt}>{automation.name}</span>
        <span className='kyl-chip kyl-chip-muted'>{t('revision')} {automation.revision}</span>
        <span className='kyl-chip' data-permission={automation.permission}>
          {automation.permission === 'read-only' ? t('permissionReadOnly') : t('permissionWorkspaceWrite')}
        </span>
        <span className='kyl-chip kyl-chip-muted'>
          {automation.model === null ? t('modelGlobal') : `${automation.model.provider}/${automation.model.model}`}
        </span>
      </div>
      <div className='kyl-card-schedule'>{automation.scheduleSummary}</div>
      <div className='kyl-card-facts'>
        <span>{t('nextRun')}: {formatWhen(automation.nextRunAt)}</span>
        <span>{t('lastRun')}: {formatWhen(automation.lastRunAt)}</span>
        {automation.lastRunStatus !== undefined && (
          <span className={statusClass(automation.lastRunStatus)}>{statusLabel(automation.lastRunStatus, t)}</span>
        )}
      </div>
      {automation.lastRunSummary !== undefined && (
        <div className='kyl-card-summary'>{automation.lastRunSummary.slice(0, 200)}</div>
      )}
      <div className='kyl-card-actions'>
        <button type='button' className='kyl-btn' onClick={props.onRunNow}>{t('runNow')}</button>
        <button type='button' className='kyl-btn' onClick={props.onToggle}>
          {active ? t('pause') : t('resume')}
        </button>
        <button type='button' className='kyl-btn' onClick={props.onEdit}>{t('editTask')}</button>
        <button type='button' className='kyl-btn kyl-btn-danger' onClick={props.onDelete}>{t('delete')}</button>
      </div>
    </li>
  )
}

function RunRow(props: {
  readonly run: RunView
  readonly t: Translate
  readonly lang: 'zh' | 'en'
  readonly onOpenSession: (sessionId: string) => void
}): React.ReactElement {
  const { run, t, lang } = props
  return (
    <li className='kyl-run'>
      <div className='kyl-run-head'>
        <span className={statusClass(run.status)}>{statusLabel(run.status, t)}</span>
        <span className='kyl-run-name'>{run.automationName}</span>
        <span className='kyl-chip kyl-chip-muted'>
          {run.trigger === 'manual' ? t('triggerManual') : t('triggerSchedule')}
        </span>
        <span className='kyl-run-when'>{formatWhen(run.scheduledFor)}</span>
        {run.startedAt !== undefined && run.finishedAt !== undefined && (
          <span className='kyl-chip kyl-chip-muted'>
            {t('duration')} {formatDuration(run.startedAt, run.finishedAt, lang)}
          </span>
        )}
        {run.sessionId !== undefined && (
          <button
            type='button'
            className='kyl-btn kyl-btn-ghost'
            onClick={() => { if (run.sessionId !== undefined) props.onOpenSession(run.sessionId) }}
          >
            {t('openSession')}
          </button>
        )}
      </div>
      {run.skipReason !== undefined && (
        <div className='kyl-run-note'>
          {t('statusSkipped')} · {run.skipReason === 'overlap' ? t('skipOverlap') : t('skipMisfire')}
        </div>
      )}
      {run.error !== undefined && <div className='kyl-run-error'>{run.error.code}: {run.error.message}</div>}
      {run.summary !== undefined && <div className='kyl-run-summary'>{run.summary.slice(0, 400)}</div>}
    </li>
  )
}

function AutomationEditor(props: {
  readonly t: Translate
  readonly mode: 'create' | 'edit'
  readonly form: EditorForm
  readonly workspaces?: readonly { readonly id: string; readonly title: string; readonly cwd: string }[] | undefined
  readonly currentCwd?: string | undefined
  readonly loadModelCatalog?: (() => Promise<ModelCatalog>) | undefined
  readonly onChange: (form: EditorForm) => void
  readonly onSubmit: () => void
  readonly onCancel: () => void
}): React.ReactElement {
  const { t, form, onChange } = props
  const [catalog, setCatalog] = useState<readonly ModelCatalogProviderGroup[] | undefined>(undefined)
  const [catalogNote, setCatalogNote] = useState<string>('idle')
  useEffect(() => {
    if (form.followModel || catalog !== undefined) return
    if (props.loadModelCatalog === undefined) {
      setCatalogNote('loader-missing')
      return
    }
    void props.loadModelCatalog()
      .then(loaded => {
        setCatalog(loaded.groups)
        setCatalogNote(`loaded:${loaded.groups.length}`)
      })
      .catch((error: unknown) => {
        setCatalogNote(`error:${error instanceof Error ? error.message.slice(0, 120) : String(error).slice(0, 120)}`)
        setCatalog([])
      })
  }, [form.followModel, catalog, props.loadModelCatalog])

  const providerModels = catalog?.find(group => group.id === form.provider)?.models ?? []
  const modelMeta = providerModels.find(model => model.id === form.model)

  return (
    <div className='kyl-editor-scrim' role='presentation' onClick={props.onCancel}>
      <div
        className='kyl-editor'
        role='dialog'
        data-catalog={catalogNote}
        aria-label={props.mode === 'create' ? t('createTitle') : t('editTitle')}
        onClick={event => { event.stopPropagation() }}
      >
        <h2 className='kyl-editor-title'>{props.mode === 'create' ? t('createTitle') : t('editTitle')}</h2>
        {props.workspaces !== undefined && props.mode === 'create' && (
          <label className='kyl-field'>
            <span className='kyl-field-label'>{t('workspaceLabel')}</span>
            <select
              className='kyl-input'
              value={form.workspaceId}
              onChange={event => onChange({ ...form, workspaceId: event.target.value })}
            >
              <option value=''>{t('workspaceRequired')}</option>
              {props.workspaces.map(item => (
                <option key={item.id} value={item.id}>{item.title} · {item.cwd}</option>
              ))}
            </select>
          </label>
        )}
        {props.mode === 'edit' && props.workspaces !== undefined && (
          <div className='kyl-field'>
            <span className='kyl-field-label'>{t('workspaceLabel')}</span>
            <span className='kyl-chip kyl-chip-muted'>
              {props.workspaces.find(item => item.id === form.workspaceId)?.title
                ?? props.workspaces.find(item => item.cwd === props.currentCwd)?.title
                ?? t('workspaceRequired')}
            </span>
          </div>
        )}
        <label className='kyl-field'>
          <span className='kyl-field-label'>{t('nameLabel')}</span>
          <input
            className='kyl-input'
            value={form.name}
            placeholder={t('namePlaceholder')}
            onChange={event => onChange({ ...form, name: event.target.value })}
          />
        </label>
        <label className='kyl-field'>
          <span className='kyl-field-label'>{t('promptLabel')}</span>
          <textarea
            className='kyl-input kyl-textarea'
            rows={6}
            value={form.prompt}
            placeholder={t('promptPlaceholder')}
            onChange={event => onChange({ ...form, prompt: event.target.value })}
          />
        </label>
        <div className='kyl-field-row'>
          <label className='kyl-field'>
            <span className='kyl-field-label'>{t('scheduleLabel')}</span>
            <select
              className='kyl-input'
              value={form.scheduleKind}
              onChange={event => onChange({ ...form, scheduleKind: event.target.value as EditorForm['scheduleKind'] })}
            >
              <option value='once'>{t('scheduleOnce')}</option>
              <option value='interval'>{t('scheduleInterval')}</option>
              <option value='daily'>{t('scheduleDaily')}</option>
              <option value='weekly'>{t('scheduleWeekly')}</option>
            </select>
          </label>
          {form.scheduleKind === 'once' && (
            <label className='kyl-field'>
              <span className='kyl-field-label'>{t('onceAt')}</span>
              <input
                className='kyl-input'
                type='datetime-local'
                value={form.onceAt}
                onChange={event => onChange({ ...form, onceAt: event.target.value })}
              />
            </label>
          )}
          {form.scheduleKind === 'interval' && (
            <label className='kyl-field'>
              <span className='kyl-field-label'>{t('everyMinutes')}</span>
              <input
                className='kyl-input'
                type='number'
                min={5}
                value={form.everyMinutes}
                onChange={event => onChange({ ...form, everyMinutes: event.target.value })}
              />
            </label>
          )}
          {(form.scheduleKind === 'daily' || form.scheduleKind === 'weekly') && (
            <label className='kyl-field'>
              <span className='kyl-field-label'>{form.scheduleKind === 'daily' ? t('dailyTime') : t('weeklyTime')}</span>
              <input
                className='kyl-input'
                type='time'
                value={form.wallTime}
                onChange={event => onChange({ ...form, wallTime: event.target.value })}
              />
            </label>
          )}
        </div>
        {form.scheduleKind === 'weekly' && (
          <div className='kyl-field'>
            <span className='kyl-field-label'>{t('weekdays')}</span>
            <div className='kyl-weekdays'>
              {WEEKDAY_LABELS.map((label, index) => {
                const day = index + 1
                return (
                  <button
                    key={day}
                    type='button'
                    className='kyl-weekday'
                    data-on={form.weekdays.includes(day) || undefined}
                    onClick={() => {
                      onChange({
                        ...form,
                        weekdays: form.weekdays.includes(day)
                          ? form.weekdays.filter(item => item !== day)
                          : [...form.weekdays, day],
                      })
                    }}
                  >
                    {t(label)}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {(form.scheduleKind === 'daily' || form.scheduleKind === 'weekly') && (
          <label className='kyl-field'>
            <span className='kyl-field-label'>{t('timeZoneLabel')}</span>
            <input
              className='kyl-input'
              list='kyl-zone-list'
              value={form.timeZone}
              onChange={event => onChange({ ...form, timeZone: event.target.value })}
            />
            <datalist id='kyl-zone-list'>
              {COMMON_ZONES.map((zone: string) => <option key={zone} value={zone} />)}
            </datalist>
          </label>
        )}
        <div className='kyl-field-row'>
          <span className='kyl-field-label'>{t('permissionLabel')}</span>
          <div className='kyl-permissions'>
            <button
              type='button'
              className='kyl-perm'
              data-on={form.permission === 'read-only' || undefined}
              onClick={() => onChange({ ...form, permission: 'read-only' })}
            >
              {t('permissionReadOnly')}
              <small>{t('permissionReadOnlyHint')}</small>
            </button>
            <button
              type='button'
              className='kyl-perm'
              data-on={form.permission === 'workspace-write' || undefined}
              onClick={() => onChange({ ...form, permission: 'workspace-write' })}
            >
              {t('permissionWorkspaceWrite')}
              <small>{t('permissionWorkspaceWriteHint')}</small>
            </button>
          </div>
        </div>
        <div className='kyl-field-row'>
          <span className='kyl-field-label'>{t('modelLabel')}</span>
          <div className='kyl-model-picker'>
            <label className='kyl-radio'>
              <input type='radio' checked={form.followModel} onChange={() => onChange({ ...form, followModel: true })} />
              {t('modelFollow')}
            </label>
            <label className='kyl-radio'>
              <input type='radio' checked={!form.followModel} onChange={() => onChange({ ...form, followModel: false })} />
              {t('modelPin')}
            </label>
            {!form.followModel && (
              <div className='kyl-model-fields'>
                <label className='kyl-field'>
                  <span className='kyl-field-label'>{t('providerLabel')}</span>
                  <select
                    className='kyl-input'
                    value={form.provider}
                    onChange={event => onChange({ ...form, provider: event.target.value, model: '', effort: '' })}
                  >
                    <option value=''>—</option>
                    {(catalog ?? []).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </label>
                <label className='kyl-field'>
                  <span className='kyl-field-label'>{t('modelIdLabel')}</span>
                  <select
                    className='kyl-input'
                    value={form.model}
                    onChange={event => onChange({ ...form, model: event.target.value, effort: '' })}
                  >
                    <option value=''>—</option>
                    {providerModels.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                  </select>
                </label>
                <label className='kyl-field'>
                  <span className='kyl-field-label'>{t('effortLabel')}</span>
                  <select
                    className='kyl-input'
                    value={form.effort}
                    onChange={event => onChange({ ...form, effort: event.target.value })}
                  >
                    <option value=''>{t('effortDefault')}</option>
                    {(modelMeta?.reasoning?.efforts ?? []).map(effort => (
                      <option key={effort.id} value={effort.id}>{effort.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        </div>
        <div className='kyl-editor-actions'>
          <button type='button' className='kyl-btn' onClick={props.onCancel}>{t('cancel')}</button>
          <button type='button' className='kyl-btn kyl-btn-primary' onClick={props.onSubmit}>{t('save')}</button>
        </div>
      </div>
    </div>
  )
}

const WEEKDAY_LABELS: readonly string[] = [
  'weekdayMo', 'weekdayTu', 'weekdayWe', 'weekdayTh', 'weekdayFr', 'weekdaySa', 'weekdaySu',
]

/** Definition → editor form. */
function automationToForm(automation: AutomationView): EditorForm {
  return {
    name: automation.name,
    prompt: automation.prompt,
    workspaceId: '',
    scheduleKind: automation.schedule.kind,
    onceAt: automation.schedule.at !== undefined
      ? localInputValue(new Date(Date.parse(automation.schedule.at)))
      : '',
    everyMinutes: String(automation.schedule.everyMinutes ?? 30),
    wallTime: automation.schedule.time ?? '09:30',
    weekdays: [...(automation.schedule.weekdays ?? [])],
    timeZone: automation.timeZone !== '' ? automation.timeZone : Intl.DateTimeFormat().resolvedOptions().timeZone,
    permission: automation.permission,
    followModel: automation.model === null,
    provider: automation.model?.provider ?? '',
    model: automation.model?.model ?? '',
    effort: automation.model?.reasoningEffort ?? '',
  }
}
