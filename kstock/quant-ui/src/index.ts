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

/** 样式注入标记（幂等：四个客户端插件共用一份）。 */
const STYLE_ID = 'kstock-quant-pages'

/** 把 ksq 样式注入 <head>（幂等）。 */
export function injectQuantStyles(): void {
  if (document.querySelector(`style[data-kstock="${STYLE_ID}"]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.kstock = STYLE_ID
  tag.textContent = quantCssText
  document.head.appendChild(tag)
}
