/**
 * 量化工作区设置分区：新闻/选股库联动任务（解读按钮）的目标工作区。
 *
 * 交互为主按钮「选择目录…」——经注入的 pick()（uiWorkspace.pickDirectory
 * 宿主原生 OS 目录对话框，取消返回 null）选中后立即保存，无手输路径；
 * 已配置时提供「清除」回退「跟当前会话」语义。数据经静态控制器
 * （同源 fetch /kstock-api/quant-workspace）写回，保存即时生效——
 * 客户端 sendRouted 每次发送前读取，无需重启引擎。
 */

import { useEffect, useState } from 'react'
import { Button } from '@qilin/client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@qilin/client-ui-slots'

type QuantWorkspaceKey =
  | 'title' | 'desc' | 'current' | 'notConfigured'
  | 'pick' | 'picking' | 'clear' | 'clearing'
  | 'saved' | 'cleared' | 'pickFailed' | 'cancelled'

/** 服务端视图（未配置时 path=null）。 */
interface QuantWorkspaceView {
  path: string | null
}

/** 分区注入面。 */
export interface QuantWorkspaceSectionInjected {
  /** 拉取当前配置。 */
  load: () => Promise<QuantWorkspaceView | { error: string }>
  /** 保存工作区路径（null=清除，回退「跟当前会话」语义）。 */
  save: (path: string | null) => Promise<QuantWorkspaceView | { error: string }>
  /** 宿主原生目录选择（取消返回 null）。 */
  pick: () => Promise<string | null>
}

/** 分区 props（设置壳 owner 只给 close）。 */
export type QuantWorkspaceSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.kstockQuantWorkspace'>
  & InjectFace<QuantWorkspaceSectionInjected>

/** 样式：一次性幂等注入（独立于数据源分区的样式位）。 */
const STYLE_ID = 'kstock-qws-style'
const STYLE_CSS = `
.kstock-qws{display:flex;flex-direction:column;gap:12px}
.kstock-qws-head p{margin:4px 0 0;font-size:13px;opacity:.75}
.kstock-qws-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.kstock-qws-note{font-size:13px;margin:0}
.kstock-qws-ok{color:#22c55e}
.kstock-qws-err{color:#ef4444}
.kstock-qws-code{font-family:ui-monospace,monospace;font-size:12px}
`

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLE_CSS
  document.head.appendChild(style)
}

async function apiGet(): Promise<QuantWorkspaceView | { error: string }> {
  try {
    const response = await fetch('/kstock-api/quant-workspace', { headers: { accept: 'application/json' } })
    if (!response.ok) return { error: `HTTP ${response.status}` }
    return (await response.json()) as QuantWorkspaceView
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

async function apiPut(path: string | null): Promise<QuantWorkspaceView | { error: string }> {
  try {
    const response = await fetch('/kstock-api/quant-workspace', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => null)
      return { error: (detail as { detail?: string } | null)?.detail ?? `HTTP ${response.status}` }
    }
    return (await response.json()) as QuantWorkspaceView
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/** 静态控制器：与组件生命周期解耦（目录选择由注册侧注入）。 */
const controller = {
  load: apiGet,
  save: apiPut,
}

/**
 * 渲染量化工作区分区。
 * @param props - 注入面 + 设置壳 owner props。
 * @returns 分区内容。
 */
export function QuantWorkspaceSection({ load, save, pick, t }: QuantWorkspaceSectionProps) {
  const [current, setCurrent] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState<'pick' | 'clear' | null>(null)

  useEffect(() => {
    ensureStyle()
    void load().then((result) => {
      if ('path' in result) {
        setCurrent(result.path)
        setStatus('ready')
      } else {
        setNote({ ok: false, text: result.error })
        setStatus('error')
      }
    })
  }, [load])

  /** 选择目录 → 立即保存（取消无副作用）。 */
  const onPick = (): void => {
    setBusy('pick'); setNote(null)
    void pick().then((picked) => {
      if (picked === null) {
        // 用户取消系统对话框：静默回位，不动现有配置。
        setBusy(null); setNote({ ok: false, text: t('cancelled') })
        return
      }
      void save(picked).then((result) => {
        setBusy(null)
        if ('path' in result) {
          setCurrent(result.path)
          setNote({ ok: true, text: t('saved') })
        } else {
          setNote({ ok: false, text: result.error })
        }
      })
    }).catch((error: unknown) => {
      setBusy(null)
      setNote({ ok: false, text: error instanceof Error ? error.message : t('pickFailed') })
    })
  }

  /** 清除配置 → 回退「跟当前会话」语义。 */
  const onClear = (): void => {
    setBusy('clear'); setNote(null)
    void save(null).then((result) => {
      setBusy(null)
      if ('path' in result) {
        setCurrent(null)
        setNote({ ok: true, text: t('cleared') })
      } else {
        setNote({ ok: false, text: result.error })
      }
    })
  }

  if (status === 'loading') return null

  return (
    <div className="kstock-qws">
      <div className="kstock-qws-head">
        <h3>{t('title')}</h3>
        <p>{t('desc')}</p>
        <p className="kstock-qws-note">
          {t('current')}：
          {current === null ? t('notConfigured') : <code className="kstock-qws-code">{current}</code>}
        </p>
      </div>
      <div className="kstock-qws-row">
        <Button disabled={busy !== null} onClick={onPick}>
          {busy === 'pick' ? t('picking') : t('pick')}
        </Button>
        {current !== null && (
          <Button variant="ghost" disabled={busy !== null} onClick={onClear}>
            {busy === 'clear' ? t('clearing') : t('clear')}
          </Button>
        )}
        {note !== null && (
          <p className={`kstock-qws-note ${note.ok ? 'kstock-qws-ok' : 'kstock-qws-err'}`}>{note.text}</p>
        )}
      </div>
    </div>
  )
}

// 静态控制器挂到组件上（注册侧 inject 闭包引用）。
QuantWorkspaceSection.load = controller.load
QuantWorkspaceSection.save = controller.save
