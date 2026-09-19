/**
 * KStock 落地页脚本：K 线流渲染 + 引擎/数据源状态 + 财经快讯拉取（1.x LandingPage 行为）。
 * 快讯与数据源状态来自引擎内置的 KStock 公共接口（/kstock-api/*，匿名可达）；
 * 接口未就绪时保留空态，不阻塞登录入口。
 */

const LANDING_CANDLES = [
  { left: 2, top: 56, height: 11, delay: -0.2, direction: 'up' },
  { left: 6, top: 47, height: 18, delay: -1.1, direction: 'down' },
  { left: 10, top: 52, height: 9, delay: -2.4, direction: 'up' },
  { left: 14, top: 39, height: 23, delay: -0.8, direction: 'up' },
  { left: 18, top: 43, height: 15, delay: -1.8, direction: 'down' },
  { left: 22, top: 33, height: 20, delay: -2.7, direction: 'up' },
  { left: 26, top: 36, height: 11, delay: -0.5, direction: 'up' },
  { left: 30, top: 26, height: 24, delay: -2.1, direction: 'down' },
  { left: 34, top: 31, height: 14, delay: -1.4, direction: 'up' },
  { left: 38, top: 20, height: 25, delay: -2.9, direction: 'up' },
  { left: 42, top: 24, height: 13, delay: -0.9, direction: 'down' },
  { left: 46, top: 17, height: 20, delay: -1.7, direction: 'up' },
  { left: 50, top: 23, height: 10, delay: -2.5, direction: 'down' },
  { left: 54, top: 12, height: 24, delay: -0.7, direction: 'up' },
  { left: 58, top: 17, height: 12, delay: -2.2, direction: 'up' },
  { left: 62, top: 8, height: 22, delay: -1.3, direction: 'down' },
  { left: 66, top: 13, height: 14, delay: -2.8, direction: 'up' },
  { left: 70, top: 21, height: 19, delay: -0.4, direction: 'down' },
  { left: 74, top: 17, height: 11, delay: -1.9, direction: 'up' },
  { left: 78, top: 28, height: 20, delay: -2.6, direction: 'down' },
  { left: 82, top: 24, height: 12, delay: -1.0, direction: 'up' },
  { left: 86, top: 35, height: 23, delay: -2.0, direction: 'down' },
  { left: 90, top: 31, height: 13, delay: -0.6, direction: 'up' },
  { left: 94, top: 43, height: 19, delay: -2.3, direction: 'down' },
  { left: 98, top: 50, height: 12, delay: -1.5, direction: 'up' }
]

function renderKlineStream() {
  const stream = document.getElementById('kline-stream')
  if (!stream) return
  stream.innerHTML = LANDING_CANDLES.map((candle) => (
    `<span class="kline-candle ${candle.direction}" style="left:${candle.left}%;top:${candle.top}%;` +
    `height:${candle.height}%;animation-delay:${candle.delay}s"></span>`
  )).join('')
}

async function refreshEngineStatus() {
  const node = document.getElementById('engine-status')
  if (!node) return
  try {
    const response = await fetch('/api/auth/status', { headers: { accept: 'application/json' } })
    node.textContent = response.ok ? '已连接' : '连接中…'
  } catch {
    node.textContent = '连接中…'
  }
}

/** 数据源连接指示（Tushare / iWenCai）：1.x DataSourceIndicators 的静态移植。 */
async function refreshDataSourceIndicators() {
  const container = document.getElementById('data-source-indicators')
  if (!container) return
  let sources = []
  try {
    const response = await fetch('/kstock-api/data-source-status', { headers: { accept: 'application/json' } })
    if (response.ok) {
      const payload = await response.json()
      if (Array.isArray(payload?.sources)) sources = payload.sources
    }
  } catch {
    // 状态是增强信息，接口不可用按未链接渲染。
  }
  const statusById = new Map(sources.map((source) => [source.id, source]))
  container.innerHTML = ['tushare', 'iwencai'].map((id) => {
    const linked = Boolean(statusById.get(id)?.configured)
    const label = id === 'tushare' ? 'Tushare' : 'iWenCai'
    const state = linked ? '已链接' : '未链接'
    return `<span class="data-source-indicator${linked ? ' linked' : ''}">` +
      '<span class="data-source-indicator-dot" aria-hidden="true"></span>' +
      `<span>${label}</span><em>${state}</em></span>`
  }).join('')
}

async function refreshLandingNews() {
  const empty = document.getElementById('news-empty')
  const list = document.getElementById('news-list')
  if (!empty || !list) return
  try {
    const response = await fetch('/kstock-api/landing-news', { headers: { accept: 'application/json' } })
    if (!response.ok) throw new Error(String(response.status))
    const payload = await response.json()
    const items = Array.isArray(payload?.items) ? payload.items.slice(0, 10) : []
    if (items.length === 0) throw new Error('empty')
    const tickerItems = items.length > 1 ? [...items, ...items] : items
    list.innerHTML = tickerItems.map((item, index) => {
      // 外链只放行 http(s)（与壳层 windowOpenHandler 策略一致）。
      const href = typeof item.url === 'string' && /^https?:\/\//i.test(item.url)
      return `<a class="landing-news-item"${href ? ` href="${encodeURI(item.url)}" target="_blank" rel="noreferrer"` : ''}` +
        `${index >= items.length ? ' aria-hidden="true"' : ''}>` +
        `<span class="landing-news-index">${String((index % items.length) + 1).padStart(2, '0')}</span>` +
        `<span class="landing-news-title"></span>` +
        `<time></time></a>`
    }).join('')
    // 标题/时间来自外部数据源，用 textContent 注入防 XSS。
    const rendered = list.querySelectorAll('.landing-news-item')
    tickerItems.forEach((item, index) => {
      const titleNode = rendered[index]?.querySelector('.landing-news-title')
      const timeNode = rendered[index]?.querySelector('time')
      if (titleNode) titleNode.textContent = item.title ?? ''
      if (timeNode) timeNode.textContent = item.published_at || item.source || ''
    })
    empty.hidden = true
    list.hidden = false
  } catch {
    empty.hidden = false
    list.hidden = true
  }
}

function startLandingPage() {
  renderKlineStream()
  void refreshEngineStatus()
  void refreshDataSourceIndicators()
  void refreshLandingNews()
  window.setInterval(() => void refreshLandingNews(), 60_000)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startLandingPage)
} else {
  startLandingPage()
}
