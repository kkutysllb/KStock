/**
 * @kstock/quant-ui — KStock 量化客户端共享件（barrel）。
 *
 * 四个量化库客户端插件（@kstock/quant-strategies / -factors / -selections /
 * -reports）经 tsdown 把本包源码内联进各自的 client bundle；数据层统一走
 * 同源 `/kstock-api/*`（由 @kstock/quant 宿主半端提供路由）。
 * @module @kstock/quant-ui
 */

import cssText from './quant.css?raw'

export * from './api.ts'
export * from './task-target.tsx'
export * from './bits.tsx'
export * from './icons.tsx'

/** ksq-* 样式全文（quant.css 原文）。 */
export const quantCssText: string = cssText

/**
 * 客户端 ctx 的最小结构面。刻意不 type-import @qilin/kylin——那会把
 * vendor cordis 源码拖进 tsc 程序（上游自身的类型链不经此路径），
 * 运行时注入的 slots 服务按上游契约（inject/register 两段式）调用。
 */
export interface QuantClientContext {
  effect(fn: () => void, name?: string): unknown
  slots: {
    inject(slot: string, contribute: () => unknown): unknown
    register(options: Record<string, unknown>, component: unknown): unknown
  }
}

/** 样式注入标记（幂等：五个客户端插件共用一份）。 */
const STYLE_ID = 'kstock-quant-pages'

/**
 * 样式版本：各插件把 quant.css 源码内联进自己的 bundle，构建时间不一，
 * 旧副本可能先注入抢占幂等位（first-inject-wins）——版本不匹配即撤旧
 * 换新，保证最终落页的是最新构建的样式副本。改 quant.css 时同步抬版本。
 */
const STYLE_VERSION = '2026-09-21.4-chan4'

/** 把 ksq 样式注入 <head>（幂等 + 版本淘汰旧副本）。 */
export function injectQuantStyles(): void {
  const existing = document.querySelector(`style[data-kstock="${STYLE_ID}"]`)
  if (existing !== null && existing.getAttribute('data-version') === STYLE_VERSION) return
  existing?.remove()
  const tag = document.createElement('style')
  tag.dataset.kstock = STYLE_ID
  tag.setAttribute('data-version', STYLE_VERSION)
  tag.textContent = quantCssText
  document.head.appendChild(tag)
}
