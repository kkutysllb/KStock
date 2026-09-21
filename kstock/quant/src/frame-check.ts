/**
 * 内嵌浏览器可嵌性预检（X-Frame-Options / CSP frame-ancestors 响应头判据）。
 *
 * 右栏内嵌浏览器是 iframe 直连目标 URL。Chromium 对 XFO / frame-ancestors
 * 拒绝渲染的响应照常触发 iframe load 事件，且被拒 frame 与成功的跨源加载
 * 在客户端不可区分（contentDocument 同为 null）——拒绝嵌入的站点在内嵌
 * 浏览器里表现为无提示白屏。唯一可靠判据是响应头：宿主侧（Node，无 CORS
 * 限制）HEAD 目标 URL，读 x-frame-options 与 content-security-policy 的
 * frame-ancestors 指令。
 *
 * 降级口径一律宽松（宁可偶尔白屏，不错杀可嵌站点）：网络失败、超时、
 * 无相关响应头均按可嵌入返回；仅明确的 deny / sameorigin /
 * frame-ancestors 白名单（不含通配 *）判不可嵌。
 *
 * @module @kstock/quant/frame-check
 */

const HEAD_TIMEOUT_MS = 5_000

/** 部分公开接口拒绝非常规 UA，带浏览器 UA（与 news.ts 同口径）。 */
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

/** 可嵌性判定结果。 */
export interface FrameCheckResult {
  embeddable: boolean
  /** 不可嵌原因（诊断用）：x-frame-options / frame-ancestors / scheme。 */
  reason?: 'x-frame-options' | 'frame-ancestors' | 'scheme'
}

/**
 * 预检一个 URL 能否在右栏内嵌浏览器（iframe）中呈现。
 * @param rawUrl - 目标链接（会话消息 / 新闻卡片外链）。
 * @returns 可嵌性判定；非 http(s) 协议、明确拒绝头 → 不可嵌。
 */
export async function frameCheck(rawUrl: string): Promise<FrameCheckResult> {
  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    return { embeddable: false, reason: 'scheme' }
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return { embeddable: false, reason: 'scheme' }
  }
  try {
    // HEAD 拿头即可；不少站点对 HEAD 返回 405/403，但响应头仍在，
    // fetch 对 4xx 正常 resolve——只有网络层失败才走宽松降级。
    const response = await fetch(target, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
      headers: { 'user-agent': BROWSER_UA },
    })
    return classifyEmbedHeaders(response.headers)
  } catch {
    return { embeddable: true }
  }
}

/**
 * 按响应头判可嵌性。
 * @param headers - HEAD 响应头（重复头由 Headers 合并为逗号分隔）。
 * @returns 判定结果；无相关头 → 可嵌。
 */
function classifyEmbedHeaders(headers: Headers): FrameCheckResult {
  const xfo = (headers.get('x-frame-options') ?? '').toLowerCase()
  // ALLOW-FROM 已废弃且从未被 Chromium 实现，按无限制处理。
  if (xfo.includes('deny') || xfo.includes('sameorigin')) {
    return { embeddable: false, reason: 'x-frame-options' }
  }
  const csp = (headers.get('content-security-policy') ?? '').toLowerCase()
  for (const directive of csp.split(';')) {
    const trimmed = directive.trim()
    if (!trimmed.startsWith('frame-ancestors')) continue
    const sources = trimmed.slice('frame-ancestors'.length).trim().split(/\s+/).filter(Boolean)
    // 引擎 iframe origin 不在任何站点白名单内：'none'/'self'/具体域名
    // 一律不可嵌；仅显式通配 * 视为可嵌。
    if (sources.length > 0 && !sources.includes('*')) {
      return { embeddable: false, reason: 'frame-ancestors' }
    }
  }
  return { embeddable: true }
}
