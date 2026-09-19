/**
 * KStock 角色 preset 选择芯片（新会话 hero 槽位）。
 *
 * 只列 6 个投研角色；standard 基座不在选项中（当前会话为基座时显示
 * 「通用·默认基座」占位）。会话启动后芯片禁用（host 拒绝换预设）。
 */

import { useEffect, useState } from 'react'
import type { SnapshotStore } from '@qilin/client-store'
import {
  IconChevronDownOutline14, IconAgentPresetOutline16, Menu, Toast, IconWarningOutline16,
} from '@qilin/client-ui-primitives'
import type { SeatState } from './seat-store.ts'
import { BASE_PRESET_ID } from './seat-store.ts'

/** 基座占位文案（当前会话运行隐形默认基座时）。 */
const BASE_LABEL = '通用 · 默认基座'

/** 芯片注入面（由注册侧闭包提供）。 */
export interface KStockPresetsSeatInjected {
  hooks: {
    /** 选择器快照（由槽位运行时绑定为 usePresetsSeat）。 */
    presetsSeat: SnapshotStore<SeatState>
  }
  /** 读取角色名册。 */
  load: () => Promise<void>
  /** 选择一个角色；返回拒绝原因（成功为 undefined）。 */
  select: (id: string) => Promise<string | undefined>
}

/** 芯片 props（注入面）。 */
export type KStockPresetsSeatProps = KStockPresetsSeatInjected

/** 样式：一次性幂等注入（与 @kstock/quant-ui 的 injectQuantStyles 同模式）。 */
const STYLE_ID = 'kstock-presets-seat-style'
const STYLE_CSS = `
.kstock-seat{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:8px;
  border:1px solid rgba(148,163,184,.35);background:rgba(148,163,184,.12);color:inherit;font-size:13px;
  cursor:pointer;transition:border-color .15s,background .15s}
.kstock-seat:hover:not(:disabled){border-color:rgba(148,163,184,.6);background:rgba(148,163,184,.2)}
.kstock-seat:disabled{opacity:.45;cursor:not-allowed}
.kstock-seat-label{max-width:11em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kstock-seat-item{display:flex;flex-direction:column;gap:2px;min-width:220px}
.kstock-seat-item-name{font-weight:600}
.kstock-seat-item-desc{font-size:12px;opacity:.7;line-height:1.4}
`
function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = STYLE_CSS
  document.head.appendChild(style)
}

/**
 * 渲染角色选择芯片。
 * @param props - 注入面（快照钩子 + 名册读取 + 选择）。
 * @returns 芯片，或名册不可用时的 null。
 */
export function KStockPresetsSeat({ load, select, usePresetsSeat }: KStockPresetsSeatProps) {
  const state = usePresetsSeat((snapshot: SeatState) => snapshot)
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    ensureStyle()
    void load()
  }, [load])

  if (state.status !== 'ready' && state.status !== 'error') return null
  const label = state.options.find((option) => option.id === state.current)?.name
    ?? (state.current === BASE_PRESET_ID ? BASE_LABEL : state.current)

  return (
    <>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={state.options.map((option) => ({
          id: option.id,
          label: (
            <span className="kstock-seat-item">
              <span className="kstock-seat-item-name">{option.name}</span>
              <span className="kstock-seat-item-desc">{option.description}</span>
            </span>
          ),
        }))}
        selectedId={state.current === BASE_PRESET_ID ? undefined : state.current}
        onSelect={(id: string) => {
          setOpen(false)
          void select(id).then((refusal) => {
            if (refusal !== undefined) setToast(refusal)
          })
        }}
        align="start"
        portal
        anchor={(
          <button
            type="button"
            className="kstock-seat"
            aria-haspopup="menu"
            aria-expanded={open}
            title={state.locked ? '会话已启动，角色在新建会话时选择' : '选择研究角色（新会话生效）'}
            disabled={state.busy || state.locked}
            onClick={() => { setOpen((value) => !value) }}
          >
            <IconAgentPresetOutline16 />
            <span className="kstock-seat-label">{label}</span>
            <IconChevronDownOutline14 />
          </button>
        )}
      />
      {toast !== null && (
        <Toast
          text={toast}
          icon={<IconWarningOutline16 />}
          holdMs={6000}
          anchor={document.querySelector<HTMLElement>('[data-composer-card]')}
          onDone={() => { setToast(null) }}
        />
      )}
    </>
  )
}
