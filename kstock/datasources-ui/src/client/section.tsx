/**
 * 数据源设置分区组件：状态卡 + 脱敏录入 + 保存。
 *
 * 数据经静态控制器（同源 fetch /kstock-api/data-sources）拉取与写回，
 * 与组件生命周期解耦（设置页开合不丢已编辑内容）。
 */

import { useEffect, useState } from 'react'
import { Button, Tag } from '@qilin/client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@qilin/client-ui-slots'

/** 服务端 GET 视图（明文永不回传，仅 masked）。 */
interface DataSourceView {
  id: string
  label: string
  env_name: string
  configured: boolean
  persisted: boolean
  masked: string | null
}

/** 分区注入面。 */
export interface DataSourcesSectionInjected {
  /** 拉取状态视图。 */
  load: () => Promise<{ sources: readonly DataSourceView[] } | { error: string }>
  /** 保存「环境变量名 → 新值」（空串=清除）。 */
  save: (values: Record<string, string>) => Promise<{ restart_required: boolean } | { error: string }>
}

/** 分区 props（设置壳 owner 只给 close）。 */
export type DataSourcesSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.kstockDataSources'>
  & InjectFace<DataSourcesSectionInjected>

/** 样式：一次性幂等注入。 */
const STYLE_ID = 'kstock-datasources-style'
const STYLE_CSS = `
.kstock-ds{display:flex;flex-direction:column;gap:16px}
.kstock-ds-head p{margin:4px 0 0;font-size:13px;opacity:.75}
.kstock-ds-card{display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid rgba(148,163,184,.3);
  border-radius:10px}
.kstock-ds-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.kstock-ds-name{font-weight:600}
.kstock-ds-env{font-size:12px;opacity:.6;font-family:ui-monospace,monospace}
.kstock-ds-input{flex:1;min-width:220px;height:32px;padding:0 10px;border-radius:8px;
  border:1px solid rgba(148,163,184,.4);background:transparent;color:inherit;font-size:13px}
.kstock-ds-note{font-size:13px;margin:0}
.kstock-ds-ok{color:#22c55e}
.kstock-ds-err{color:#ef4444}
`

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLE_CSS
  document.head.appendChild(style)
}

async function apiGet(): Promise<{ sources: readonly DataSourceView[] } | { error: string }> {
  try {
    const response = await fetch('/kstock-api/data-sources', { headers: { accept: 'application/json' } })
    if (!response.ok) return { error: `HTTP ${response.status}` }
    return (await response.json()) as { sources: readonly DataSourceView[] }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

async function apiPut(values: Record<string, string>): Promise<{ restart_required: boolean } | { error: string }> {
  try {
    const response = await fetch('/kstock-api/data-sources', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ values }),
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => null)
      return { error: (detail as { detail?: string } | null)?.detail ?? `HTTP ${response.status}` }
    }
    return (await response.json()) as { restart_required: boolean }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/** 静态控制器：与组件生命周期解耦。 */
const controller = {
  load: apiGet,
  save: apiPut,
}

/**
 * 渲染数据源分区。
 * @param props - 注入面 + 设置壳 owner props。
 * @returns 分区内容。
 */
export function DataSourcesSection({ load, save, t }: DataSourcesSectionProps) {
  const [sources, setSources] = useState<readonly DataSourceView[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ensureStyle()
    void load().then((result) => {
      if ('sources' in result) {
        setSources(result.sources)
        setStatus('ready')
      } else {
        setNote({ ok: false, text: result.error })
        setStatus('error')
      }
    })
  }, [load])

  const dirty = sources.some((source) => (drafts[source.env_name] ?? '') !== '')

  const onSave = (): void => {
    const values: Record<string, string> = {}
    for (const source of sources) {
      const draft = drafts[source.env_name] ?? ''
      // 空输入 = 不动该键；显式勾选清除时传空串。
      if (draft !== '') values[source.env_name] = draft
      if (draft === '' && clearSet.has(source.env_name)) values[source.env_name] = ''
    }
    if (Object.keys(values).length === 0) return
    setBusy(true)
    void save(values).then((result) => {
      setBusy(false)
      if ('restart_required' in result) {
        setDrafts({})
        setClearSet(new Set())
        setNote({ ok: true, text: t('saved') })
        void load().then((next) => { if ('sources' in next) setSources(next.sources) })
      } else {
        setNote({ ok: false, text: `${t('saveFailed')}：${result.error}` })
      }
    })
  }

  const [clearSet, setClearSet] = useState<Set<string>>(new Set())

  return (
    <div className="kstock-ds">
      <div className="kstock-ds-head">
        <h3>{t('title')}</h3>
        <p>{t('desc')}</p>
      </div>
      {sources.map((source) => (
        <div className="kstock-ds-card" key={source.id}>
          <div className="kstock-ds-row">
            <span className="kstock-ds-name">{source.label}</span>
            <Tag>{source.configured ? t('configured') : t('notConfigured')}</Tag>
            {!source.persisted && source.configured && <Tag>{t('notPersisted')}</Tag>}
            <span className="kstock-ds-env">{t('envName')}：{source.env_name}{source.masked === null ? '' : `（${source.masked}）`}</span>
          </div>
          <div className="kstock-ds-row">
            <input
              className="kstock-ds-input"
              type="password"
              autoComplete="off"
              placeholder={t('tokenPlaceholder')}
              value={drafts[source.env_name] ?? ''}
              onChange={(event) => {
                setDrafts((prev) => ({ ...prev, [source.env_name]: event.target.value }))
                setClearSet((prev) => { const next = new Set(prev); next.delete(source.env_name); return next })
              }}
            />
            {source.persisted && (
              <Button
                variant="ghost"
                onClick={() => {
                  setClearSet((prev) => new Set(prev).add(source.env_name))
                  setDrafts((prev) => ({ ...prev, [source.env_name]: '' }))
                }}
              >{t('clear')}</Button>
            )}
          </div>
        </div>
      ))}
      <div className="kstock-ds-row">
        <Button disabled={!dirty || busy} onClick={onSave}>{busy ? t('saving') : t('save')}</Button>
        {note !== null && (
          <p className={`kstock-ds-note ${note.ok ? 'kstock-ds-ok' : 'kstock-ds-err'}`}>{note.text}</p>
        )}
      </div>
    </div>
  )
}

// 静态控制器挂到组件上（注册侧 inject 闭包引用）。
DataSourcesSection.load = controller.load
DataSourcesSection.save = controller.save
