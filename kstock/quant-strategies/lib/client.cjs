window.__ModuleLoader__.load({
	id: "@kstock/quant-strategies",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region ../quant-ui/src/quant.css?raw
		var quant_default = "/* KStock 量化工作台面板样式（@kstock/quant 客户端半端）。\n *\n * 全部类名以 ksq- 前缀隔离；颜色走引擎 dsw 别名 token（随明暗主题\n * 自动切换），强调色沿用 KStock 品牌绿。由客户端 bundle 以 ?raw 内联，\n * apply() 时注入 <style data-kstock=\"quant-pages\">。 */\n\n.ksq-page {\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-bg-base) 88%, transparent);\n}\n\n/* ── 顶部：标题 + 库切换 tab ─────────────────────────────── */\n\n.ksq-topbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  padding: 14px 22px 0;\n  flex: none;\n}\n\n.ksq-title {\n  display: flex;\n  align-items: baseline;\n  gap: 10px;\n  min-width: 0;\n}\n\n.ksq-title strong {\n  font-size: 17px;\n  letter-spacing: 0.2px;\n}\n\n.ksq-title span {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.ksq-topbar-actions {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex: none;\n}\n\n.ksq-count {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.ksq-tabs {\n  display: flex;\n  gap: 4px;\n  padding: 10px 22px 0;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-tab {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  padding: 8px 14px 10px;\n  cursor: pointer;\n  border-bottom: 2px solid transparent;\n  margin-bottom: -1px;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-tab:hover { color: var(--dsw-alias-label-primary); }\n\n.ksq-tab.active {\n  color: var(--dsw-alias-label-primary);\n  border-bottom-color: var(--dsw-alias-brand-primary);\n  font-weight: 600;\n}\n\n/* ── 通用控件 ─────────────────────────────────────────────── */\n\n.ksq-iconbtn {\n  appearance: none;\n  border: 1px solid transparent;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  width: 28px;\n  height: 28px;\n  border-radius: 7px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n\n.ksq-iconbtn:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.ksq-iconbtn:disabled { opacity: 0.5; cursor: default; }\n.ksq-iconbtn.danger:hover { color: #e64646; }\n\n.ksq-btn {\n  appearance: none;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  padding: 5px 12px;\n  border-radius: 7px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }\n\n.ksq-linkbtn {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-link);\n  font-size: 12px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 0;\n}\n\n.ksq-linkbtn:hover { text-decoration: underline; }\n\n.ksq-search {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 8px;\n  padding: 6px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  min-width: 260px;\n}\n\n.ksq-search input {\n  border: none;\n  outline: none;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  flex: 1;\n}\n\n.ksq-search input::placeholder { color: var(--dsw-alias-label-tertiary); }\n\n.ksq-spin { animation: ksq-rotate 0.9s linear infinite; }\n\n@keyframes ksq-rotate {\n  to { transform: rotate(360deg); }\n}\n\n.ksq-error {\n  margin: 10px 22px 0;\n  padding: 8px 12px;\n  border: 1px solid rgba(230, 70, 70, 0.4);\n  border-radius: 8px;\n  background: rgba(230, 70, 70, 0.08);\n  color: #e64646;\n  font-size: 12.5px;\n}\n\n.ksq-loading {\n  margin: 24px 22px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n}\n\n.ksq-empty {\n  margin: 40px auto;\n  max-width: 420px;\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  font-size: 13px;\n}\n\n.ksq-empty strong { color: var(--dsw-alias-label-secondary); font-size: 14px; }\n\n.ksq-mono {\n  font-family: ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace;\n  font-size: 0.92em;\n}\n\n/* 数值语义色 */\n.ksq-up { color: #31c7a2; }\n.ksq-down { color: #e64646; }\n.ksq-warn { color: #e8a33d; }\n\n/* ── 数据表 ─────────────────────────────────────────────── */\n\n.ksq-table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 12.5px;\n}\n\n.ksq-table th {\n  text-align: left;\n  font-weight: 500;\n  color: var(--dsw-alias-label-tertiary);\n  padding: 6px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  white-space: nowrap;\n}\n\n.ksq-table td {\n  padding: 7px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  color: var(--dsw-alias-label-primary);\n  white-space: nowrap;\n}\n\n.ksq-table td.num { text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-table tr.selected td { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-table input[type=\"checkbox\"] { accent-color: var(--dsw-alias-brand-primary); }\n\n/* 长文本单元格裁剪（agent 写入的股票池/口径描述可达数百字，nowrap 下会把\n   操作列挤出视口）：max-width + ellipsis，全文走 title 悬浮。 */\n.ksq-table td.ksq-cell-clip {\n  max-width: 230px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* 表格横向滚动兜底：窗口再窄操作列（报告/看板）也始终可达，不整页溢出。 */\n.ksq-table-wrap { overflow-x: auto; }\n.ksq-table-wrap .ksq-table { min-width: 640px; }\n\n/* ── 内容区骨架 ─────────────────────────────────────────── */\n\n.ksq-body {\n  flex: 1;\n  overflow: auto;\n  padding: 14px 22px 26px;\n}\n\n.ksq-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-bottom: 14px;\n}\n\n/* ── 策略/因子/选股：列表 + 详情双栏 ────────────────────── */\n\n.ksq-split {\n  display: grid;\n  grid-template-columns: 264px 1fr;\n  gap: 16px;\n  align-items: start;\n}\n\n.ksq-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  position: sticky;\n  top: 0;\n}\n\n.ksq-list-item {\n  appearance: none;\n  text-align: left;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 10px;\n  padding: 9px 12px;\n  cursor: pointer;\n  color: var(--dsw-alias-label-primary);\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.ksq-list-item:hover { border-color: var(--dsw-alias-border-l2); }\n\n.ksq-list-item.active {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-1));\n}\n\n.ksq-item-name {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  font-size: 13px;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.ksq-item-name > span.ksq-name-text {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dot {\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  flex: none;\n}\n\n.ksq-dot.tone-live { background: #31c7a2; }\n.ksq-dot.tone-idle { background: #8f98a2; }\n.ksq-dot.tone-bad { background: #e64646; }\n\n.ksq-item-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-chip {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 999px;\n  padding: 0 7px;\n  font-size: 11px;\n  line-height: 18px;\n}\n\n.ksq-badge {\n  border-radius: 5px;\n  padding: 1px 7px;\n  font-size: 11px;\n  line-height: 18px;\n  flex: none;\n}\n\n.ksq-badge.tone-live {\n  color: #31c7a2;\n  background: rgba(49, 199, 162, 0.12);\n}\n\n.ksq-badge.tone-idle {\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-3);\n}\n\n.ksq-badge.tone-bad {\n  color: #e64646;\n  background: rgba(230, 70, 70, 0.1);\n}\n\n.ksq-detail { min-width: 0; display: flex; flex-direction: column; gap: 14px; }\n\n.ksq-hint {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12.5px;\n  margin: 6px 0;\n}\n\n.ksq-identity { border-bottom: 1px solid var(--dsw-alias-border-l3); padding-bottom: 10px; }\n\n.ksq-identity-head {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.ksq-identity-head h2 { font-size: 16px; margin: 0; }\n\n.ksq-hypothesis {\n  margin: 6px 0 4px;\n  font-size: 12.5px;\n  color: var(--dsw-alias-label-secondary);\n  line-height: 1.6;\n}\n\n.ksq-section-title {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n  margin: 4px 0 8px;\n}\n\n/* 版本时间线 */\n.ksq-versions { display: flex; flex-direction: column; gap: 8px; padding-left: 14px; }\n\n.ksq-version {\n  position: relative;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 9px 12px;\n}\n\n.ksq-version.latest { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); }\n\n.ksq-version::before {\n  content: \"\";\n  position: absolute;\n  left: -11px;\n  top: 16px;\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-version.latest::before { background: var(--dsw-alias-brand-primary); }\n\n.ksq-version-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 12.5px;\n}\n\n.ksq-version-note {\n  margin: 5px 0 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* 对比块 */\n.ksq-compare {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-compare h3 { font-size: 13px; margin: 0 0 8px; }\n\n.ksq-note {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  margin: 4px 0;\n}\n\n.ksq-chart { margin-top: 10px; }\n\n.ksq-chart h4 {\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n  margin: 0 0 6px;\n}\n\n.ksq-chart svg { max-width: 100%; height: auto; }\n\n/* 选股 criteria 摘要 */\n.ksq-criteria {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 8px 10px;\n  margin: 6px 0 0;\n  white-space: pre-wrap;\n  word-break: break-word;\n  max-height: 160px;\n  overflow: auto;\n}\n\n/* 选股 picks 表 */\n.ksq-picks-meta { display: flex; gap: 14px; font-size: 12px; color: var(--dsw-alias-label-tertiary); margin: 6px 0; }\n\n/* ── 报告库 ─────────────────────────────────────────────── */\n\n.ksq-report-group { margin-bottom: 16px; }\n\n.ksq-report-heading {\n  appearance: none;\n  border: none;\n  background: transparent;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  cursor: pointer;\n  padding: 4px 0 8px;\n  width: 100%;\n}\n\n.ksq-report-heading h2 { font-size: 13px; margin: 0; font-weight: 600; color: var(--dsw-alias-label-primary); }\n.ksq-report-heading span { color: var(--dsw-alias-label-tertiary); font-size: 12px; }\n\n.ksq-report-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));\n  gap: 10px;\n}\n\n.ksq-report-card {\n  display: flex;\n  gap: 12px;\n  align-items: flex-start;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-report-icon {\n  flex: none;\n  width: 34px;\n  height: 34px;\n  border-radius: 9px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);\n}\n\n.ksq-report-copy { flex: 1; min-width: 0; }\n\n.ksq-report-copy h3 {\n  margin: 0 0 4px;\n  font-size: 13.5px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-report-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px 12px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-report-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex: none; }\n\n/* 报告预览浮层 */\n.ksq-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 80;\n  background: rgba(3, 13, 11, 0.72);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 40px;\n}\n\n.ksq-dialog {\n  width: min(1080px, 100%);\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  border-radius: 14px;\n  overflow: hidden;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-dialog-bar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 14px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-dialog-bar strong {\n  font-size: 13px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dialog iframe {\n  flex: 1;\n  border: none;\n  background: #fff;\n}\n\n/* 确认弹窗 */\n.ksq-confirm {\n  width: min(420px, 100%);\n  height: auto;\n  border-radius: 14px;\n  padding: 18px;\n  gap: 10px;\n}\n\n.ksq-confirm h3 { margin: 0; font-size: 15px; }\n.ksq-confirm p { margin: 0; font-size: 12.5px; color: var(--dsw-alias-label-secondary); line-height: 1.6; }\n\n.ksq-confirm-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  margin-top: 8px;\n}\n\n.ksq-btn.danger {\n  color: #fff;\n  background: #c0392b;\n  border-color: #c0392b;\n}\n\n.ksq-btn.danger:hover { background: #a93226; }\n\n/* 复制成功提示 */\n.ksq-toast {\n  position: fixed;\n  bottom: 28px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 90;\n  /* 自洽深色药丸：不依赖宿主 toast token（--dsw-alias-toast-bg 在宿主不存在，\n     回退 bg-overlay 是遮罩 scrim 色——黑条不可读）。深底浅字双主题通用。 */\n  background: rgba(3, 13, 11, 0.92);\n  color: #e8edef;\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  font-size: 12.5px;\n  border-radius: 999px;\n  padding: 8px 16px;\n  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);\n}\n\n/* ── 财经新闻面板（@kstock/client-news）────────────────────────── */\n\n.ksq-news-list {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  padding-bottom: 8px;\n}\n\n.ksq-news-item {\n  position: relative;\n  padding: 12px 16px 12px 20px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  overflow: hidden;\n  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;\n}\n\n/* 左侧品牌色细轨：常亮 55%，hover 点满。 */\n.ksq-news-item::before {\n  content: '';\n  position: absolute;\n  left: 0;\n  top: 0;\n  bottom: 0;\n  width: 3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 100%, transparent);\n  opacity: .45;\n  transition: opacity .15s ease;\n}\n\n.ksq-news-item:hover {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, var(--dsw-alias-border-l2));\n  transform: translateY(-1px);\n  box-shadow: 0 4px 16px color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n}\n\n.ksq-news-item:hover::before {\n  opacity: 1;\n}\n\n.ksq-news-meta {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-source {\n  padding: 1.5px 8px;\n  border-radius: 99px;\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: .3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent);\n  color: var(--dsw-alias-brand-primary);\n  white-space: nowrap;\n}\n\n.ksq-news-dot {\n  width: 3px;\n  height: 3px;\n  border-radius: 50%;\n  background: currentColor;\n  opacity: .55;\n  flex: none;\n}\n\n.ksq-news-time {\n  margin-left: auto;\n  white-space: nowrap;\n}\n\n.ksq-news-title {\n  font-size: 14px;\n  font-weight: 600;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  text-decoration: none;\n}\n\na.ksq-news-title:hover {\n  color: var(--dsw-alias-link);\n}\n\n.ksq-news-summary {\n  margin: 0;\n  font-size: 12.5px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n\n.ksq-news-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 22px 0;\n  flex: none;\n}\n\n.ksq-news-toolbar .ksq-tabs { margin-bottom: 0; }\n\n.ksq-news-toolbar-right {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  min-width: 0;\n}\n\n.ksq-news-toolbar-right .ksq-search { margin-bottom: 0; flex: 1; min-width: 220px; max-width: 460px; }\n\n.ksq-news-watchedit {\n  padding: 8px 22px 0;\n  flex: none;\n}\n\n.ksq-news-watchedit input {\n  width: 100%;\n  box-sizing: border-box;\n  padding: 7px 12px;\n  border-radius: 8px;\n  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, var(--dsw-alias-border-l2));\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n}\n\n/* 双栏：主列表 + 统计侧栏（窄面板时侧栏隐藏）。 */\n.ksq-news-split {\n  display: flex;\n  gap: 20px;\n  align-items: flex-start;\n  width: 100%;\n  max-width: 1360px;\n  margin: 0 auto;\n}\n\n.ksq-news-main {\n  flex: 1;\n  min-width: 0;\n}\n\n.ksq-news-item.read { opacity: .58; }\n.ksq-news-item.read:hover { opacity: 1; }\n\n.ksq-news-item.watched {\n  border-color: color-mix(in srgb, #f59e0b 45%, var(--dsw-alias-border-l2));\n  background: color-mix(in srgb, #f59e0b 5%, var(--dsw-alias-bg-layer-2));\n}\n\n.ksq-news-item.watched::before {\n  background: #f59e0b;\n}\n\n.ksq-news-watchflag {\n  padding: 1px 7px;\n  border-radius: 99px;\n  font-size: 10.5px;\n  font-weight: 600;\n  letter-spacing: .5px;\n  color: #f59e0b;\n  background: color-mix(in srgb, #f59e0b 16%, transparent);\n}\n\n.ksq-news-stocks {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-stocktag {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  padding: 2px 9px;\n  border-radius: 6px;\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n  transition: border-color .12s ease, background .12s ease;\n}\n\n.ksq-news-stocktag:hover {\n  border-color: var(--dsw-alias-brand-primary);\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);\n}\n\n.ksq-news-actions {\n  display: flex;\n  justify-content: flex-end;\n  font-size: 12.5px;\n}\n\n/* 统计侧栏 */\n.ksq-news-stats {\n  flex: none;\n  width: 220px;\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  position: sticky;\n  top: 0;\n}\n\n@media (max-width: 980px) {\n  .ksq-news-stats { display: none; }\n  .ksq-news-split { display: block; }\n}\n\n.ksq-news-stats-block {\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  padding: 12px 14px;\n}\n\n.ksq-news-stats-head {\n  font-size: 13px;\n  font-weight: 600;\n  margin-bottom: 10px;\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n}\n\n.ksq-news-stats-head span {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-stats-empty {\n  margin: 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-trending {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-trendword {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 2.5px 9px;\n  border-radius: 99px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-news-trendword:hover {\n  color: var(--dsw-alias-brand-primary);\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.ksq-news-trendword em {\n  font-style: normal;\n  font-size: 10.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-freq {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: 50px;\n}\n\n.ksq-news-freq-bar {\n  flex: 1;\n  min-width: 3px;\n  border-radius: 2px 2px 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n}\n\n.ksq-news-freq-bar:hover {\n  background: var(--dsw-alias-brand-primary);\n}\n\n/* ── 联动任务目标选择菜单（§26-10，新闻/选股库共用）────────────── */\n\n.ksq-target-overlay { z-index: 95; padding: 40px; background: rgba(3, 13, 11, 0.45); }\n\n.ksq-target-menu {\n  width: min(480px, 100%);\n  max-height: min(70vh, 560px);\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  padding: 12px;\n  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);\n}\n\n.ksq-target-head {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  padding: 4px 8px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  margin-bottom: 6px;\n}\n\n.ksq-target-item {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  padding: 9px 10px;\n  border: none;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  text-align: left;\n  cursor: pointer;\n  font-size: 13px;\n}\n\n.ksq-target-item:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }\n.ksq-target-item:disabled { opacity: 0.55; cursor: default; }\n.ksq-target-item.last { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }\n\n.ksq-target-name { font-weight: 500; flex: none; }\n.ksq-target-path {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-target-error { color: #e64646; font-size: 12.5px; margin: 4px 8px; }\n.ksq-target-cancel { align-self: flex-end; margin-top: 4px; }\n\n/* ── 选股库：口径芯片（P4）+ 命中趋势（P3）────────────────────── */\n\n.ksq-chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0 2px; }\n.ksq-chips .ksq-chip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }\n\n.ksq-trend {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 8px 10px;\n  margin: 6px 0 10px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-trend-label {\n  flex: none;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-trend-bars {\n  flex: 1;\n  display: flex;\n  align-items: flex-end;\n  justify-content: flex-start;\n  gap: 4px;\n  height: 44px;\n  min-width: 0;\n}\n\n.ksq-trend-col {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: 100%;\n  cursor: default;\n}\n\n.ksq-trend-bar {\n  width: 9px;\n  min-height: 3px;\n  border-radius: 2px 2px 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 60%, transparent);\n}\n\n.ksq-trend-bar:hover { background: var(--dsw-alias-brand-primary); }\n\n.ksq-trend-bar.consensus { background: #31c7a2; }\n.ksq-trend-bar.consensus:hover { background: #22a06b; }\n\n/* ── 因子库：跨因子概览（F3，IC 均值零轴双向横条）──────────────── */\n\n.ksq-factors-overview {\n  display: flex;\n  align-items: flex-start;\n  gap: 10px;\n  padding: 10px 12px;\n  margin-bottom: 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-fo-rows { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }\n\n.ksq-fo-row {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  padding: 3px 6px;\n  border: none;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  text-align: left;\n  cursor: pointer;\n  font-size: 12px;\n}\n\n.ksq-fo-row:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-fo-row.active { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); }\n\n.ksq-fo-name {\n  flex: none;\n  width: 128px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-weight: 500;\n}\n\n.ksq-fo-bar {\n  flex: 1;\n  position: relative;\n  height: 10px;\n  min-width: 0;\n}\n\n/* 零轴：容器中缝 1px 基线；正值条从中线向右，负值向左。 */\n.ksq-fo-bar::before {\n  content: '';\n  position: absolute;\n  left: 50%;\n  top: -2px;\n  bottom: -2px;\n  width: 1px;\n  background: var(--dsw-alias-border-l3);\n}\n\n.ksq-fo-fill {\n  position: absolute;\n  top: 1px;\n  bottom: 1px;\n  border-radius: 2px;\n}\n\n.ksq-fo-fill.up { background: #31c7a2; }\n.ksq-fo-fill.down { background: #e64646; }\n\n.ksq-fo-value { flex: none; width: 52px; text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-fo-ir { flex: none; width: 64px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }\n\n/* ── 策略库：调仓记录（§28-5，按日折叠）────────────────────────── */\n\n.ksq-rebalances {\n  max-height: 380px;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 6px;\n}\n\n.ksq-rebalance { border-bottom: 1px solid var(--dsw-alias-border-l3); }\n.ksq-rebalance:last-child { border-bottom: none; }\n\n.ksq-rebalance summary {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 5px 8px;\n  cursor: pointer;\n  font-size: 12.5px;\n  list-style: none;\n  border-radius: 6px;\n}\n\n.ksq-rebalance summary::-webkit-details-marker { display: none; }\n.ksq-rebalance summary::before { content: '\\25B8'; color: var(--dsw-alias-label-tertiary); transition: transform 0.12s; }\n.ksq-rebalance[open] summary::before { transform: rotate(90deg); }\n.ksq-rebalance summary:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }\n\n.ksq-rebalance-body { padding: 6px 10px 10px 22px; display: flex; flex-direction: column; gap: 6px; }\n\n.ksq-rebalance-dayhead { display: flex; justify-content: flex-end; }\n.ksq-rebalance-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\n@media (max-width: 720px) { .ksq-rebalance-cols { grid-template-columns: 1fr; } }\n.ksq-rebalance-side p { margin: 0 0 4px; font-size: 12px; font-weight: 500; }\n.ksq-rebalance-side .ksq-table { font-size: 11.5px; }\n";
		//#endregion
		//#region ../quant-ui/src/api.ts
		/**
		* 量化四库的客户端数据层：同源 fetch `/kstock-api/*`。
		*
		* 形状与 1.x `apps/desktop/src/lib/*Client.ts` 保持一致（服务端路由由
		* @kstock/quant 宿主半端提供，路径从 `/api/v1/kstock/*` 换成
		* `/kstock-api/*`）。错误统一抛 `KsqError`（带 HTTP 状态码）。
		*/
		/** 归一化的接口错误（detail 文案来自服务端）。 */
		var KsqError = class extends Error {
			status;
			constructor(status, message) {
				super(message);
				this.status = status;
			}
		};
		async function request(path, init) {
			const response = await fetch(path, init);
			if (!response.ok) {
				let detail = `请求失败（${response.status}）`;
				try {
					const body = await response.json();
					if (typeof body.detail === "string") detail = body.detail;
				} catch {}
				throw new KsqError(response.status, detail);
			}
			return await response.json();
		}
		function get(path) {
			return request(path);
		}
		const listStrategies = () => get("/kstock-api/strategies");
		const listStrategyVersions = (id) => get(`/kstock-api/strategies/${encodeURIComponent(id)}/versions`);
		const listStrategyRuns = (id) => get(`/kstock-api/strategies/${encodeURIComponent(id)}/runs`);
		const compareStrategyRuns = (id, runIds) => get(`/kstock-api/strategies/${encodeURIComponent(id)}/compare?runs=${runIds.map(encodeURIComponent).join(",")}`);
		const getStrategyRunEquity = (id, runId) => get(`/kstock-api/strategies/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/equity`);
		const getStrategyRunTrades = (id, runId) => get(`/kstock-api/strategies/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/trades`);
		async function fetchReportHtml(reportId) {
			const response = await fetch(`/kstock-api/reports/${encodeURIComponent(reportId)}/content`);
			if (!response.ok) throw new KsqError(response.status, `报告加载失败（${response.status}）`);
			return response.text();
		}
		/** 报告 HTML 的 blob 预览地址。显式带 utf-8 charset——blob 文档不继承响应头，缺失时中文会被按 windows-1252 解码。 */
		function reportBlobUrl(html) {
			return URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
		}
		//#endregion
		//#region ../quant-ui/src/task-target.tsx
		/**
		* 联动任务目标选择菜单（新闻「解读」/ 选股库「解读」共用，§26-10）。
		*
		* 点击解读类按钮不再静默路由：弹出本菜单让用户选任务归属——
		* - 「跟随当前会话」：现状语义（当前会话直接发；无会话默认建）。
		* - 已注册 workspace 列表（GlobalStandardProps 的 useWorkspaces hook）：
		*   connectWorkspace 复用/新建 blank 会话且自动挂进工作区分组——
		*   修复裸 create({cwd}) 会话落「未分组」、产物散落根目录的问题。
		* - 「浏览选择目录…」：宿主原生目录对话框；新目录先 workspaces.create
		*   注册再连接（注册后才会在工作区分组里收纳会话）。
		* 按任务类型（news / pick）分别记忆上次选择，下次菜单首项即默认；
		* 单击任意项 = 发送 + 记忆 + 关闭。
		*/
		/**
		* 标准路由桥实现（面板共用：新闻/选股库/因子库）。current=当前会话
		* （无则默认建）；workspace=connectWorkspace（复用/新建 blank 会话并挂
		* 进工作区分组——修复裸 create({cwd}) 的「未分组」与产物散落）。
		*/
		function buildTaskRouterBridge(deps) {
			return {
				send: async (target, text) => {
					const sessions = deps.sessions;
					if (sessions === void 0) throw new Error("会话服务不可用");
					let id;
					if (target.kind === "workspace") {
						const uiWorkspace = deps.uiWorkspace;
						if (uiWorkspace === void 0) throw new Error("工作区服务不可用");
						id = await uiWorkspace.connectWorkspace(target.workspaceId);
						sessions.open(id);
					} else {
						id = sessions.list.getSnapshot().current;
						if (id === void 0) {
							id = await sessions.create();
							sessions.open(id);
						}
					}
					const conversation = sessions.scope(id)?.get("conversation");
					if (conversation === void 0) throw new Error("会话作用域不可用（conversation 服务缺席）");
					await conversation.send(text);
				},
				pickDirectory: () => {
					if (deps.uiWorkspace === void 0) return Promise.reject(/* @__PURE__ */ new Error("工作区服务不可用"));
					return deps.uiWorkspace.pickDirectory();
				},
				registerWorkspace: async (path) => {
					if (deps.workspaces === void 0) throw new Error("工作区注册服务不可用");
					return await deps.workspaces.create({ path });
				},
				gotoConversation: () => deps.layout?.selectPanel(null)
			};
		}
		/** 按任务类型记忆上次选择（news / pick 各记各的，互不覆盖）。 */
		function loadMemory(taskKind) {
			try {
				const raw = localStorage.getItem(`kstock-task-route-${taskKind}`);
				if (raw === null) return null;
				const parsed = JSON.parse(raw);
				if (parsed.kind === "current") return parsed;
				if (parsed.kind === "workspace" && typeof parsed.workspaceId === "string") return parsed;
			} catch {}
			return null;
		}
		function saveMemory(taskKind, target) {
			try {
				localStorage.setItem(`kstock-task-route-${taskKind}`, JSON.stringify(target));
			} catch {}
		}
		/** 读设置页「量化工作区」统一配置（无记忆时的默认目标；不可达返回 null）。 */
		async function fetchDefaultPath() {
			try {
				const response = await fetch("/kstock-api/quant-workspace");
				if (!response.ok) return null;
				const data = await response.json();
				return typeof data.path === "string" && data.path.trim() !== "" ? data.path : null;
			} catch {
				return null;
			}
		}
		const sameDir = (a, b) => {
			const norm = (p) => p.replace(/\/+$/, "") || "/";
			return norm(a) === norm(b);
		};
		const targetKey = (target) => target === null ? "" : target.kind === "current" ? "current" : `ws:${target.workspaceId}`;
		/**
		* 内层：useWorkspaces 恒存在（由外层 TaskTargetMenu 保证），hook 无条件
		* 调用——Rules of Hooks 合规（禁在 useMemo 回调/条件分支里调 hook，
		* 实测会炸 Minified React error #311）。
		*/
		function MenuBody({ useWorkspaces, ...rest }) {
			const items = useWorkspaces((snapshot) => snapshot.items ?? []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuView, {
				...rest,
				items
			});
		}
		/**
		* 目标选择菜单外壳（零 hook）：useWorkspaces 缺席时降级渲染空列表，
		* 存在时挂 MenuBody。分支发生在内层组件挂载之前——不同组件各自持有
		* 稳定的 hooks 链，不会触发 hooks 数量漂移。
		*/
		function TaskTargetMenu(props) {
			const { useWorkspaces, ...rest } = props;
			if (useWorkspaces === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuView, {
				...rest,
				items: []
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(MenuBody, {
				...rest,
				useWorkspaces
			});
		}
		/** 目标选择菜单纯展示层：全部 hooks 无条件调用（items 由上层解析）。 */
		function MenuView({ items, taskKind, title, prompt, bridge, onClose }) {
			const [memory] = (0, react.useState)(() => loadMemory(taskKind));
			const [defaultPath, setDefaultPath] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				fetchDefaultPath().then(setDefaultPath);
			}, []);
			const orderedItems = (0, react.useMemo)(() => {
				const list = [...items];
				if (memory?.kind === "workspace") {
					const index = list.findIndex((item) => item.workspaceId === memory.workspaceId);
					if (index > 0) list.unshift(...list.splice(index, 1));
				} else if (defaultPath !== null) {
					const index = list.findIndex((item) => sameDir(item.path, defaultPath));
					if (index > 0) list.unshift(...list.splice(index, 1));
				}
				return list;
			}, [
				items,
				memory,
				defaultPath
			]);
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onClose();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [onClose]);
			const dispatch = (key, run) => {
				if (busy !== null) return;
				setBusy(key);
				setError(null);
				run().then(() => {
					bridge.gotoConversation();
					onClose();
				}).catch((err) => {
					setBusy(null);
					setError(err instanceof Error ? err.message : "发送失败");
				});
			};
			const sendTo = (target) => {
				saveMemory(taskKind, target);
				dispatch(targetKey(target), () => bridge.send(target, prompt));
			};
			const browse = () => {
				dispatch("browse", async () => {
					const picked = await bridge.pickDirectory();
					if (picked === null) {
						onClose();
						return;
					}
					const view = await bridge.registerWorkspace(picked);
					sendTo({
						kind: "workspace",
						workspaceId: view.workspaceId,
						path: view.path
					});
				});
			};
			const lastKey = targetKey(memory);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "ksq-overlay ksq-target-overlay",
				role: "dialog",
				"aria-modal": "true",
				"aria-label": title,
				onClick: onClose,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ksq-target-menu",
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-target-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: title }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-item-meta",
								children: items.length > 0 ? "选择任务归属的工作区（记住本次选择）" : "未获取到工作区列表"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: `ksq-target-item ${lastKey === "current" ? "last" : ""}`,
							disabled: busy !== null,
							onClick: () => sendTo({ kind: "current" }),
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-target-name",
								children: "跟随当前会话"
							}), lastKey === "current" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-badge tone-live",
								children: "上次"
							})]
						}),
						orderedItems.map((workspace) => {
							const key = `ws:${workspace.workspaceId}`;
							const isLast = lastKey === key;
							const isDefault = !isLast && lastKey === "" && defaultPath !== null && sameDir(workspace.path, defaultPath);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: `ksq-target-item ${isLast ? "last" : ""}`,
								disabled: busy !== null,
								onClick: () => sendTo({
									kind: "workspace",
									workspaceId: workspace.workspaceId,
									path: workspace.path
								}),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "ksq-target-name",
										children: workspace.title || workspace.path.split("/").filter(Boolean).pop() || workspace.path
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "ksq-target-path",
										children: workspace.path
									}),
									isLast && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "ksq-badge tone-live",
										children: "上次"
									}),
									isDefault && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "ksq-badge tone-idle",
										children: "默认"
									})
								]
							}, workspace.workspaceId);
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "ksq-target-item",
							disabled: busy !== null,
							onClick: browse,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-target-name",
								children: busy === "browse" ? "选择中…" : "浏览选择目录…"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-target-path",
								children: "新目录将注册为工作区后再发送"
							})]
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "ksq-target-error",
							children: error
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ksq-linkbtn ksq-target-cancel",
							onClick: onClose,
							children: "取消（Esc）"
						})
					]
				})
			});
		}
		//#endregion
		//#region ../quant-ui/src/icons.tsx
		function Svg({ size = 16, className, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				className,
				"aria-hidden": "true",
				children
			});
		}
		/** 侧栏入口：K 线蜡烛。 */
		function IconCandles(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M7 6v12" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "5",
						y: "9",
						width: "4",
						height: "6",
						rx: "0.5"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M17 4v14" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "15",
						y: "8",
						width: "4",
						height: "5",
						rx: "0.5"
					})
				]
			});
		}
		function IconRefresh(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 3v6h-6" })]
			});
		}
		function IconGitBranch(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "6",
						cy: "6",
						r: "2.5"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "6",
						cy: "18",
						r: "2.5"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "18",
						cy: "8",
						r: "2.5"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M6 8.5v7" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18 10.5a8 8 0 0 1-8 5.5" })
				]
			});
		}
		function IconPlay(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, {
				...props,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M7 4.5v15l12-7.5z",
					fill: "currentColor",
					stroke: "none"
				})
			});
		}
		function IconCopy(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "9",
					y: "9",
					width: "12",
					height: "12",
					rx: "2"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })]
			});
		}
		function IconClose(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, {
				...props,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18 6 6 18M6 6l12 12" })
			});
		}
		//#endregion
		//#region ../quant-ui/src/bits.tsx
		/**
		* 量化面板共享小件：状态文案、通用折线叠加图、确认弹窗、复制提示。
		* 视觉基调与 1.x 组件一致（语义着色/时间线/浮层），类名换 ksq- 前缀。
		*/
		function formatDateTime(iso) {
			if (!iso) return "—";
			const date = new Date(iso);
			if (Number.isNaN(date.getTime())) return iso;
			return date.toLocaleString("zh-CN", { hour12: false });
		}
		/** 数值语义着色：收益/夏普为正绿、负红；回撤放大转警示红。 */
		function metricClass(key, value) {
			if (typeof value !== "number") return "";
			if (key === "max_drawdown_pct") return value < -20 ? "ksq-down" : value < 0 ? "ksq-warn" : "";
			if (key === "total_return_pct" || key === "annual_return_pct" || key === "sharpe_ratio") return value > 0 ? "ksq-up" : value < 0 ? "ksq-down" : "";
			return "";
		}
		function metric(run, key) {
			const value = run.metrics?.[key];
			if (typeof value === "number") return String(Math.round(value * 100) / 100);
			return "—";
		}
		function statusBadge(status) {
			return {
				researching: {
					label: "研究中",
					tone: "live"
				},
				watching: {
					label: "观察中",
					tone: "live"
				},
				adopted: {
					label: "已采用",
					tone: "live"
				},
				paused: {
					label: "已暂停",
					tone: "idle"
				},
				rejected: {
					label: "已否定",
					tone: "bad"
				}
			}[status] ?? {
				label: status,
				tone: "idle"
			};
		}
		function ErrorLine({ message }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "ksq-error",
				role: "alert",
				children: message
			});
		}
		function Loading({ text }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
				className: "ksq-loading",
				children: text
			});
		}
		/** 刷新按钮（title + 可旋转）。 */
		function RefreshButton({ refreshing, onClick, label }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: "ksq-iconbtn",
				onClick,
				disabled: refreshing,
				"aria-label": label,
				title: label,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconRefresh, {
					size: 15,
					className: refreshing ? "ksq-spin" : void 0
				})
			});
		}
		/** 复制到剪贴板 + 底部提示（1.x 的「预填输入框」在引擎 UI 里改为复制交付）。 */
		function useCopyPrompt() {
			const [toast, setToast] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (toast === null) return;
				const timer = window.setTimeout(() => setToast(null), 2200);
				return () => window.clearTimeout(timer);
			}, [toast]);
			return {
				toast,
				copy: (text) => {
					navigator.clipboard?.writeText(text).then(() => setToast("已复制提示词，粘贴到对话输入框即可让 agent 执行"), () => setToast("复制失败，请手动选择文本"));
				}
			};
		}
		function CopyToast({ text }) {
			if (text === null) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "ksq-toast",
				role: "status",
				children: text
			});
		}
		const RUN_COLORS = [
			"#e8a33d",
			"#5ab0ff",
			"#22a06b",
			"#c792ea",
			"#e64646",
			"#8ee6c8"
		];
		/**
		* SVG hover 交互层（三图表共用）：把鼠标屏幕坐标换算为绘图区索引
		* （viewBox 缩放换算），越界置 null。
		*/
		function useSvgHover(width, padLeft, plotRight, maxIndex) {
			const [hover, setHover] = (0, react.useState)(null);
			const onMove = (event) => {
				const rect = event.currentTarget.getBoundingClientRect();
				if (rect.width === 0) return;
				const ratio = ((event.clientX - rect.left) / rect.width * width - padLeft) / (plotRight - padLeft);
				if (ratio < 0 || ratio > 1) {
					setHover(null);
					return;
				}
				setHover(Math.min(maxIndex, Math.max(0, Math.round(ratio * maxIndex))));
			};
			return {
				hover,
				onMove,
				onLeave: () => {
					setHover(null);
				}
			};
		}
		/** hover tooltip 的半透明底板 + 文本行（动态宽度，防溢出钳位）。 */
		function HoverTooltip({ x, y, lines }) {
			const widest = Math.max(...lines.map((line) => line.length)) * 6.2 + 12;
			const boxH = lines.length * 13 + 8;
			const boxX = Math.min(x, 560 - widest - 4);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
				pointerEvents: "none",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: boxX,
					y,
					width: widest,
					height: boxH,
					rx: "4",
					fill: "rgba(3,13,11,0.82)"
				}), lines.map((line, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
					x: boxX + 6,
					y: y + 15 + index * 13,
					fontSize: "10.5",
					fill: "#e8edef",
					children: line
				}, line))]
			});
		}
		/** 通用多序列折线叠加图（策略净值 / 因子累计 IC 共用，自绘 SVG；
		* hover 十字线 + 圆点 + tooltip，dates 可选提供 x 轴日期标签）。 */
		function LineOverlay({ series, baseline, title, dates }) {
			const drawable = series.filter((item) => item.values.length >= 2);
			if (drawable.length === 0) return null;
			const width = 560;
			const height = 240;
			const padLeft = 46;
			const padBottom = 26;
			const plotRight = width - 12;
			const maxLen = Math.max(...drawable.map((item) => item.values.length));
			const all = drawable.flatMap((item) => item.values);
			const min = Math.min(...all, baseline ?? Infinity);
			const max = Math.max(...all, baseline ?? -Infinity);
			const span = max - min || 1;
			const x = (index, length) => padLeft + index / Math.max(1, length - 1) * (plotRight - padLeft);
			const y = (value) => 14 + (1 - (value - min) / span) * (height - padBottom - 14);
			const { hover, onMove, onLeave } = useSvgHover(width, padLeft, plotRight, maxLen - 1);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: `0 0 ${width} ${height}`,
				role: "img",
				"aria-label": title,
				onMouseMove: onMove,
				onMouseLeave: onLeave,
				children: [
					baseline !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						x1: padLeft,
						y1: y(baseline),
						x2: plotRight,
						y2: y(baseline),
						stroke: "var(--dsw-alias-border-l2)",
						strokeDasharray: "3,3"
					}),
					baseline !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
						x: padLeft - 6,
						y: y(baseline) + 4,
						fontSize: "10",
						textAnchor: "end",
						fill: "var(--dsw-alias-label-tertiary)",
						children: baseline.toFixed(2)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
						x: padLeft - 6,
						y: y(max) + 4,
						fontSize: "10",
						textAnchor: "end",
						fill: "var(--dsw-alias-label-tertiary)",
						children: max.toFixed(2)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
						x: padLeft - 6,
						y: y(min) + 4,
						fontSize: "10",
						textAnchor: "end",
						fill: "var(--dsw-alias-label-tertiary)",
						children: min.toFixed(2)
					}),
					drawable.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", {
						points: item.values.map((value, index) => `${x(index, item.values.length)},${y(value)}`).join(" "),
						fill: "none",
						stroke: item.color,
						strokeWidth: "2"
					}, item.label)),
					hover !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
						pointerEvents: "none",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
								x1: x(hover, maxLen),
								y1: 10,
								x2: x(hover, maxLen),
								y2: height - padBottom,
								stroke: "var(--dsw-alias-border-l2)"
							}),
							drawable.map((item) => {
								const index = Math.min(hover, item.values.length - 1);
								const value = item.values[index];
								if (value === void 0) return null;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: x(index, item.values.length),
									cy: y(value),
									r: "3",
									fill: item.color
								}, `pt-${item.label}`);
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(HoverTooltip, {
								x: plotRight - 180,
								y: 12,
								lines: [dates?.[hover] ?? `#${hover + 1}`, ...drawable.map((item) => {
									const value = item.values[Math.min(hover, item.values.length - 1)];
									return `${item.label}: ${value === void 0 ? "—" : value.toFixed(4)}`;
								})]
							})
						]
					}),
					drawable.map((item, row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: padLeft + row * 120,
						y: height - 14,
						width: "10",
						height: "10",
						fill: item.color
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
						x: padLeft + row * 120 + 15,
						y: height - 5,
						fontSize: "11",
						fill: "var(--dsw-alias-label-secondary)",
						children: [
							item.label,
							"（",
							item.values.length === maxLen ? `${item.values.length}pt` : `${item.values.length}/${maxLen}pt`,
							"）"
						]
					})] }, `legend-${item.label}`))
				]
			});
		}
		/** 全屏预览浮层（报告 HTML iframe）。 */
		function PreviewDialog({ title, onClose, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "ksq-overlay",
				role: "dialog",
				"aria-modal": "true",
				"aria-label": title,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ksq-dialog",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-dialog-bar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: title }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "ksq-btn",
							onClick: onClose,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconClose, { size: 13 }), " 关闭"]
						})]
					}), children]
				})
			});
		}
		/**
		* 回撤副图（underwater）：输入归一化净值序列，相对 running max 的回撤
		* 百分比向下填充（0 线在顶，红区向下）。回测详情标配——回撤发生在哪、
		* 持续多久、修复耗时一眼可读。
		*/
		function DrawdownChart({ values, title, dates }) {
			if (values.length < 2) return null;
			let peak = -Infinity;
			const dd = values.map((value) => {
				peak = Math.max(peak, value);
				return peak > 0 ? (value - peak) / peak * 100 : 0;
			});
			const min = Math.min(...dd, -.001);
			const width = 560;
			const height = 96;
			const padLeft = 46;
			const plotRight = width - 12;
			const x = (index) => padLeft + index / Math.max(1, values.length - 1) * (plotRight - padLeft);
			const y = (value) => 6 + value / min * (height - 22);
			const line = dd.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
			const area = `${line} L${x(dd.length - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`;
			const { hover, onMove, onLeave } = useSvgHover(width, padLeft, plotRight, dd.length - 1);
			const hoverValue = hover !== null ? dd[hover] : null;
			if (hoverValue === void 0) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: `0 0 ${width} ${height}`,
				role: "img",
				"aria-label": title,
				onMouseMove: onMove,
				onMouseLeave: onLeave,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: area,
						fill: "rgba(230, 70, 70, 0.28)"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: line,
						fill: "none",
						stroke: "#e64646",
						strokeWidth: "1"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						x1: padLeft,
						y1: y(0),
						x2: plotRight,
						y2: y(0),
						stroke: "var(--dsw-alias-border-l2)"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
						x: padLeft - 6,
						y: y(0) + 4,
						fontSize: "10",
						textAnchor: "end",
						fill: "var(--dsw-alias-label-tertiary)",
						children: "0%"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
						x: padLeft - 6,
						y: height - 8,
						fontSize: "10",
						textAnchor: "end",
						fill: "var(--dsw-alias-label-tertiary)",
						children: [min.toFixed(1), "%"]
					}),
					hover !== null && hoverValue !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
						pointerEvents: "none",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
							x1: x(hover),
							y1: y(0),
							x2: x(hover),
							y2: height - 18,
							stroke: "var(--dsw-alias-border-l2)"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HoverTooltip, {
							x: plotRight - 150,
							y: 4,
							lines: [dates?.[hover] ?? `#${hover + 1}`, `回撤 ${hoverValue.toFixed(2)}%`]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
						x: padLeft,
						y: height - 2,
						fontSize: "9.5",
						fill: "var(--dsw-alias-label-tertiary)",
						children: [
							"最大回撤 ",
							min.toFixed(2),
							"%（图内重算，供交叉校验）"
						]
					})
				]
			});
		}
		/**
		* 每笔交易盈亏柱：0 轴按对称界居中，正绿负红。卖出笔 realized_pnl
		* 序列的分布/连亏段/单笔极值直观呈现。
		*/
		function PnlBars({ values, title, labels }) {
			if (values.length === 0) return null;
			const width = 560;
			const height = 110;
			const padLeft = 46;
			const plotRight = width - 12;
			const maxAbs = Math.max(...values.map((v) => Math.abs(v)), 1e-4);
			const zeroY = 48;
			const scale = (height - 26) / 2 / maxAbs;
			const slot = (plotRight - padLeft) / values.length;
			const barW = Math.max(1, slot * .8);
			const { hover, onMove, onLeave } = useSvgHover(width, padLeft, plotRight, values.length - 1);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: `0 0 ${width} ${height}`,
				role: "img",
				"aria-label": title,
				onMouseMove: onMove,
				onMouseLeave: onLeave,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						x1: padLeft,
						y1: zeroY,
						x2: plotRight,
						y2: zeroY,
						stroke: "var(--dsw-alias-border-l2)"
					}),
					values.map((value, index) => {
						const h = Math.max(1, Math.abs(value) * scale);
						const y = value >= 0 ? zeroY - h : zeroY;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
							x: padLeft + index * slot,
							y,
							width: barW,
							height: h,
							fill: value >= 0 ? "#31c7a2" : "#e64646",
							opacity: hover === index ? 1 : .85
						}, index);
					}),
					hover !== null && values[hover] !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						x1: padLeft + hover * slot + barW / 2,
						y1: 4,
						x2: padLeft + hover * slot + barW / 2,
						y2: height - 20,
						stroke: "var(--dsw-alias-border-l2)"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
						x: padLeft - 6,
						y: 52,
						fontSize: "10",
						textAnchor: "end",
						fill: "var(--dsw-alias-label-tertiary)",
						children: "0"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
						x: padLeft - 6,
						y: 12,
						fontSize: "10",
						textAnchor: "end",
						fill: "#31c7a2",
						children: ["+", maxAbs >= 1e3 ? `${(maxAbs / 1e3).toFixed(1)}k` : maxAbs.toFixed(0)]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
						x: padLeft - 6,
						y: height - 22,
						fontSize: "10",
						textAnchor: "end",
						fill: "#e64646",
						children: ["-", maxAbs >= 1e3 ? `${(maxAbs / 1e3).toFixed(1)}k` : maxAbs.toFixed(0)]
					}),
					hover !== null && values[hover] !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HoverTooltip, {
						x: plotRight - 150,
						y: 4,
						lines: [labels?.[hover] ?? `第 ${hover + 1} 笔`, `盈亏 ${values[hover].toLocaleString()}`]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
						x: padLeft,
						y: height - 2,
						fontSize: "9.5",
						fill: "var(--dsw-alias-label-tertiary)",
						children: [values.length, " 笔平仓（按时间序，绿盈红亏）"]
					})
				]
			});
		}
		//#endregion
		//#region ../quant-ui/src/index.ts
		/**
		* @kstock/quant-ui — KStock 量化客户端共享件（barrel）。
		*
		* 四个量化库客户端插件（@kstock/quant-strategies / -factors / -selections /
		* -reports）经 tsdown 把本包源码内联进各自的 client bundle；数据层统一走
		* 同源 `/kstock-api/*`（由 @kstock/quant 宿主半端提供路由）。
		* @module @kstock/quant-ui
		*/
		/** ksq-* 样式全文（quant.css 原文）。 */
		const quantCssText = quant_default;
		/** 样式注入标记（幂等：五个客户端插件共用一份）。 */
		const STYLE_ID = "kstock-quant-pages";
		/**
		* 样式版本：各插件把 quant.css 源码内联进自己的 bundle，构建时间不一，
		* 旧副本可能先注入抢占幂等位（first-inject-wins）——版本不匹配即撤旧
		* 换新，保证最终落页的是最新构建的样式副本。改 quant.css 时同步抬版本。
		*/
		const STYLE_VERSION = "2026-09-20.12-sel8";
		/** 把 ksq 样式注入 <head>（幂等 + 版本淘汰旧副本）。 */
		function injectQuantStyles() {
			const existing = document.querySelector(`style[data-kstock="${STYLE_ID}"]`);
			if (existing !== null && existing.getAttribute("data-version") === STYLE_VERSION) return;
			existing?.remove();
			const tag = document.createElement("style");
			tag.dataset.kstock = STYLE_ID;
			tag.setAttribute("data-version", STYLE_VERSION);
			tag.textContent = quantCssText;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region src/client/agent.ts
		let agentBridge = null;
		function bindAgentBridge(bridge) {
			agentBridge = bridge;
		}
		/** 面板组件取桥（未绑定返回 null，按钮静默降级）。 */
		function getAgentBridge() {
			return agentBridge;
		}
		/** 回测「解读」提示词：带策略名/假设/六指标上下文。 */
		function interpretStrategyPrompt(input) {
			const hypothesis = input.hypothesis !== void 0 && input.hypothesis !== "" ? `（假设：${input.hypothesis}）` : "";
			const parts = [];
			if (input.totalReturnPct !== void 0) parts.push(`总收益 ${input.totalReturnPct}%`);
			if (input.annualReturnPct !== void 0) parts.push(`年化 ${input.annualReturnPct}%`);
			if (input.sharpe !== void 0) parts.push(`夏普 ${input.sharpe}`);
			if (input.maxDrawdownPct !== void 0) parts.push(`最大回撤 ${input.maxDrawdownPct}%`);
			if (input.winRatePct !== void 0) parts.push(`胜率 ${input.winRatePct}%`);
			if (input.tradeCount !== void 0) parts.push(`${input.tradeCount} 笔`);
			const stats = parts.length > 0 ? `，最近回测：${parts.join(" / ")}` : "";
			const range = input.range !== void 0 && input.range !== "" ? `，区间 ${input.range}` : "";
			return `策略库「${input.strategyName}」v${input.version}${hypothesis}${stats}${range}：请解读该回测结果——收益风险比在同类策略的水平、最大回撤的成因与修复空间、交易频率与费率敏感性、过拟合风险（参数敏感性/样本内偏差）与实盘跟踪建议。当前会话若未挂载 strategy-research 技能，用网页检索补充并标注来源，禁止编造数值；数据缺失诚实标注「无数据」，不构成投资建议。`;
		}
		//#endregion
		//#region src/client/section.tsx
		/**
		* 策略库面板：列表 + 版本时间线 + 回测运行 + 跨版本对比（净值叠加）。
		* 移植自 1.x components/StrategiesLibrary.tsx；「重跑本版本」由预填
		* 输入框改为复制提示词（引擎 UI 的对话输入框不归本插件管）。
		*/
		/** 净值数据归一化：兼容 [{date,equity}] 与 {dates,values} 形态，统一为 1 起点。 */
		function normalizeEquity(raw) {
			let values = [];
			if (Array.isArray(raw)) if (raw.every((item) => typeof item === "object" && item !== null && typeof item.equity === "number")) values = raw.map((item) => item.equity);
			else values = raw.filter((item) => typeof item === "number");
			else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
				const record = raw;
				const candidate = Array.isArray(record.values) ? record.values : record.equity_values;
				if (Array.isArray(candidate)) values = candidate.filter((v) => typeof v === "number");
			}
			const base = values[0];
			if (!Number.isFinite(base) || base <= 0) return values;
			return values.map((value) => value / base);
		}
		const METRIC_KEYS = [
			["total_return_pct", "总收益 %"],
			["annual_return_pct", "年化 %"],
			["sharpe_ratio", "夏普"],
			["max_drawdown_pct", "最大回撤 %"],
			["win_rate_pct", "胜率 %"],
			["trade_count", "交易次数"]
		];
		/** 空态引导：让 agent 把最近一次策略回测结果归档进策略库的复制提示词。 */
		const INGEST_PROMPT = "请把本工作区最近一次策略回测任务的结果归档进 KStock 策略库（引擎 http://127.0.0.1:18001，不可达则跳过并明说）。三步：1) POST /kstock-api/strategies，body {name: 策略名, hypothesis: 一句话策略逻辑假设}；2) POST /kstock-api/strategies/{strategy_id}/versions，body {code: 策略信号/回测核心代码全文, params: 参数 JSON, change_note}；3) POST /kstock-api/strategies/{strategy_id}/runs，body {version, data_start, data_end, rules: {universe, benchmark, report_id 报告库看板链}, metrics: {total_return_pct, annual_return_pct, sharpe_ratio, max_drawdown_pct, win_rate_pct, trade_count}, equity: 净值序列 JSON, trades: 交易清单 JSON}。多策略对比研究则每策略独立建资产，禁止整体跳过。数据取自工作区 data/ 与 reports/ 下的真实产物，禁止编造。";
		/** run 的 rules.report_id（阶段五看板建链）。 */
		function runReportId(run) {
			const value = run?.rules?.report_id;
			return typeof value === "string" && value !== "" ? value : null;
		}
		/** trades 附件归一（防御式）：兼容顶层数组与 {trades, positions} 容器；
		* positions 键（阶段五精确口径，逐日持仓快照）存在时用快照差分调仓，
		* 否则从买卖流水累计推导。 */
		function tradesArtifact(raw) {
			const container = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {};
			const rows = (Array.isArray(raw) ? raw : Array.isArray(container.trades) ? container.trades : []).filter((item) => typeof item === "object" && item !== null).map((item) => ({
				date: typeof item.date === "string" ? item.date : "",
				code: typeof item.code === "string" ? item.code : "",
				action: typeof item.action === "string" ? item.action.toLowerCase() : "",
				quantity: typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 0,
				price: typeof item.price === "number" && Number.isFinite(item.price) ? item.price : null,
				pnl: typeof item.realized_pnl === "number" && Number.isFinite(item.realized_pnl) ? item.realized_pnl : null
			})).filter((row) => row.date !== "" && row.code !== "");
			const closes = rows.filter((row) => row.pnl !== null && row.pnl !== 0);
			let rebalances = [];
			let precise = false;
			if (Array.isArray(container.positions) && container.positions.length > 0) {
				precise = true;
				const snapshots = container.positions.filter((item) => typeof item === "object" && item !== null).map((item) => ({
					date: typeof item.date === "string" ? item.date : "",
					holdings: (Array.isArray(item.holdings) ? item.holdings : []).filter((h) => typeof h === "object" && h !== null).map((h) => ({
						code: typeof h.code === "string" ? h.code : "",
						quantity: typeof h.quantity === "number" ? h.quantity : 0
					})).filter((h) => h.code !== "" && h.quantity > 0)
				})).filter((snap) => snap.date !== "").sort((a, b) => a.date.localeCompare(b.date));
				let prev = /* @__PURE__ */ new Map();
				for (const snap of snapshots) {
					const current = new Map(snap.holdings.map((h) => [h.code, h.quantity]));
					const buys = [...current].filter(([code, qty]) => qty > (prev.get(code) ?? 0)).map(([code, qty]) => ({
						code,
						quantity: qty - (prev.get(code) ?? 0)
					}));
					const sells = [...prev].filter(([code, qty]) => qty > (current.get(code) ?? 0)).map(([code, qty]) => ({
						code,
						quantity: qty - (current.get(code) ?? 0)
					}));
					rebalances.push({
						date: snap.date,
						buys,
						sells,
						holdings: [...current].map(([code, quantity]) => ({
							code,
							quantity
						})).sort((a, b) => b.quantity - a.quantity)
					});
					prev = current;
				}
			} else {
				const byDate = /* @__PURE__ */ new Map();
				for (const row of rows) {
					const bucket = byDate.get(row.date) ?? [];
					bucket.push(row);
					byDate.set(row.date, bucket);
				}
				const holding = /* @__PURE__ */ new Map();
				for (const date of [...byDate.keys()].sort()) {
					const dayRows = byDate.get(date) ?? [];
					const buys = [];
					const sells = [];
					for (const row of dayRows) {
						const delta = row.action === "sell" ? -row.quantity : row.quantity;
						holding.set(row.code, (holding.get(row.code) ?? 0) + delta);
						if (row.action === "sell") sells.push({
							code: row.code,
							quantity: row.quantity
						});
						else buys.push({
							code: row.code,
							quantity: row.quantity
						});
					}
					const holdings = [...holding].filter(([, quantity]) => quantity > 0).map(([code, quantity]) => ({
						code,
						quantity
					})).sort((a, b) => b.quantity - a.quantity);
					rebalances.push({
						date,
						buys,
						sells,
						holdings
					});
				}
			}
			return {
				rows,
				pnlSeries: closes.map((row) => row.pnl),
				pnlLabels: closes.map((row) => `${row.date} ${row.code}`),
				total: rows.length,
				closes: closes.length,
				maxWin: closes.length > 0 ? Math.max(...closes.map((row) => row.pnl)) : 0,
				maxLoss: closes.length > 0 ? Math.min(...closes.map((row) => row.pnl)) : 0,
				totalPnl: closes.reduce((sum, row) => sum + row.pnl, 0),
				rebalances,
				precise
			};
		}
		/** 导出 CSV 到本地（BOM 头保证 Excel 中文不乱码；逗号转义）。 */
		function exportCsv(filename, header, rows) {
			const escape = (cell) => /[",\n]/.test(cell) ? `"${cell.replaceAll("\"", "\"\"")}"` : cell;
			const content = "﻿" + [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
			const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			link.click();
			URL.revokeObjectURL(url);
		}
		/** equity 附件的日期轴（[{date, equity}] 形态时提供，纯数值形态为空）。 */
		function equityDates(raw) {
			if (!Array.isArray(raw)) return void 0;
			const dates = raw.filter((item) => typeof item === "object" && item !== null && typeof item.date === "string").map((item) => item.date);
			return dates.length === raw.length ? dates : void 0;
		}
		function StrategiesSection({ useWorkspaces } = {}) {
			const [strategies, setStrategies] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [selectedId, setSelectedId] = (0, react.useState)(null);
			const [versions, setVersions] = (0, react.useState)([]);
			const [runs, setRuns] = (0, react.useState)([]);
			const [detailLoading, setDetailLoading] = (0, react.useState)(false);
			const [compareIds, setCompareIds] = (0, react.useState)([]);
			const [comparison, setComparison] = (0, react.useState)(null);
			const [equities, setEquities] = (0, react.useState)([]);
			const [refreshing, setRefreshing] = (0, react.useState)(false);
			const [reportView, setReportView] = (0, react.useState)(null);
			const [pendingInterpret, setPendingInterpret] = (0, react.useState)(null);
			const [detailView, setDetailView] = (0, react.useState)(null);
			const { copy, toast } = useCopyPrompt();
			const reload = (0, react.useCallback)(async () => {
				setError(null);
				try {
					setStrategies(await listStrategies());
				} catch (err) {
					setError(err instanceof Error ? err.message : "加载策略库失败");
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				reload();
			}, [reload]);
			/** 列表 + 选中策略的版本/回测详情一起重拉（agent 刚入库新 run 时靠它看到）。 */
			const refresh = (0, react.useCallback)(async () => {
				setRefreshing(true);
				setError(null);
				try {
					const list = await listStrategies();
					setStrategies(list);
					if (selectedId) {
						const [versionList, runList] = await Promise.all([listStrategyVersions(selectedId), listStrategyRuns(selectedId)]);
						setVersions(versionList);
						setRuns(runList);
					}
				} catch (err) {
					setError(err instanceof Error ? err.message : "刷新策略库失败");
				} finally {
					setRefreshing(false);
				}
			}, [selectedId]);
			const selected = strategies.find((item) => item.strategy_id === selectedId) ?? null;
			(0, react.useEffect)(() => {
				if (!selectedId) return;
				setDetailLoading(true);
				setCompareIds([]);
				setComparison(null);
				setEquities([]);
				closeReportView();
				setPendingInterpret(null);
				setDetailView(null);
				setError(null);
				let active = true;
				(async () => {
					try {
						const [versionList, runList] = await Promise.all([listStrategyVersions(selectedId), listStrategyRuns(selectedId)]);
						if (!active) return;
						setVersions(versionList);
						setRuns(runList);
					} catch (err) {
						if (active) setError(err instanceof Error ? err.message : "加载策略详情失败");
					} finally {
						if (active) setDetailLoading(false);
					}
				})();
				return () => {
					active = false;
				};
			}, [selectedId]);
			const toggleCompare = (runId) => {
				setCompareIds((current) => current.includes(runId) ? current.filter((id) => id !== runId) : current.length >= 4 ? current : [...current, runId]);
			};
			(0, react.useEffect)(() => {
				if (!selectedId || compareIds.length < 2) {
					setComparison(null);
					setEquities([]);
					return;
				}
				let active = true;
				(async () => {
					try {
						const [result, ...curves] = await Promise.all([compareStrategyRuns(selectedId, compareIds), ...compareIds.map((runId) => getStrategyRunEquity(selectedId, runId).catch(() => null))]);
						if (!active) return;
						setComparison(result);
						setEquities(curves.filter((item) => item !== null));
					} catch (err) {
						if (active) setError(err instanceof Error ? err.message : "对比加载失败");
					}
				})();
				return () => {
					active = false;
				};
			}, [selectedId, compareIds]);
			/** 重跑提示词：新体系无 KStock MCP 工具，改为引导 agent 经 /kstock-api 入库。 */
			const rerunPrompt = (version) => `请重跑策略库中的「${selected?.name ?? ""}」（${selectedId}）：策略代码与参数采用 v${version.version} 版本（change_note：${version.change_note || "无"}），数据区间与交易规则参照该版本最近一次回测（无历史记录则用近 2 年日线 + 默认 A 股规则）。跑完后把结果入库：POST /kstock-api/strategies/${selectedId}/runs，version=${version.version}，附 data_start/data_end/rules（含 report_id 看板链）/metrics（total_return_pct/annual_return_pct/sharpe_ratio/max_drawdown_pct/win_rate_pct/trade_count）/equity/trades。`;
			/** 关闭报告视图并释放 blob URL。 */
			const closeReportView = (0, react.useCallback)(() => {
				setReportView((current) => {
					if (current?.htmlUrl) URL.revokeObjectURL(current.htmlUrl);
					return null;
				});
			}, []);
			/** 看板直嵌（rules.report_id → 报告库 HTML iframe），无链明示。 */
			const showReport = (0, react.useCallback)(async (runId) => {
				if (reportView?.runId === runId) {
					closeReportView();
					return;
				}
				const reportId = runReportId(runs.find((item) => item.run_id === runId));
				closeReportView();
				if (reportId === null) {
					setError("该 run 未链接报告看板（rules 缺 report_id）");
					return;
				}
				try {
					const html = await fetchReportHtml(reportId);
					setReportView({
						runId,
						htmlUrl: reportBlobUrl(html)
					});
				} catch {
					setError("看板加载失败（报告可能已删除）");
				}
			}, [
				reportView,
				runs,
				closeReportView
			]);
			/** 展开单 run 回测详情（L1+L2）：净值 + 回撤副图 + 盈亏柱 + 摘要。 */
			const toggleDetail = (0, react.useCallback)(async (runId) => {
				if (!selectedId) return;
				if (detailView?.runId === runId) {
					setDetailView(null);
					return;
				}
				setDetailView({
					runId,
					equity: null,
					trades: null
				});
				const [equity, trades] = await Promise.all([getStrategyRunEquity(selectedId, runId).catch(() => null), getStrategyRunTrades(selectedId, runId).catch(() => null)]);
				setDetailView({
					runId,
					equity,
					trades
				});
			}, [selectedId, detailView]);
			/** 回测「解读」（§28）：先弹目标选择菜单（strategy 类型记忆）。 */
			const askInterpret = (0, react.useCallback)((run) => {
				if (selected === null) return;
				if (getAgentBridge() === null) {
					setError("会话联动不可用（sessions/layout 服务缺席）");
					return;
				}
				const num = (value) => typeof value === "number" && Number.isFinite(value) ? value : void 0;
				setPendingInterpret(interpretStrategyPrompt({
					strategyName: selected.name,
					hypothesis: selected.hypothesis,
					version: run.version,
					range: run.data_start !== "" && run.data_end !== "" ? `${run.data_start} ~ ${run.data_end}` : "",
					totalReturnPct: num(run.metrics?.total_return_pct),
					annualReturnPct: num(run.metrics?.annual_return_pct),
					sharpe: num(run.metrics?.sharpe_ratio),
					maxDrawdownPct: num(run.metrics?.max_drawdown_pct),
					winRatePct: num(run.metrics?.win_rate_pct),
					tradeCount: num(run.metrics?.trade_count)
				}));
			}, [selected]);
			const equitySeries = (0, react.useMemo)(() => equities.map((item, index) => ({
				label: `v${item.version}`,
				values: normalizeEquity(item.equity),
				color: RUN_COLORS[index % RUN_COLORS.length]
			})), [equities]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-body",
				"aria-label": "策略库",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-toolbar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "ksq-count",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconGitBranch, { size: 13 }),
								" ",
								strategies.length,
								" 个策略"
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RefreshButton, {
							refreshing,
							onClick: () => void refresh(),
							label: "刷新策略库"
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorLine, { message: error }),
					loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { text: "加载策略库…" }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-split",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("aside", {
							className: "ksq-list",
							children: strategies.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "ksq-hint",
								children: "暂无策略。用右侧提示词把最近一次回测结果入库。"
							}) : strategies.map((strategy) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: `ksq-list-item ${strategy.strategy_id === selectedId ? "active" : ""}`,
								onClick: () => setSelectedId(strategy.strategy_id),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "ksq-item-name",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `ksq-dot tone-${statusBadge(strategy.status).tone}`,
										"aria-hidden": "true"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "ksq-name-text",
										children: strategy.name
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "ksq-item-meta",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
											"v",
											strategy.current_version,
											" · ",
											statusBadge(strategy.status).label
										] }),
										strategy.latest_run && typeof strategy.latest_run.metrics?.total_return_pct === "number" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: `ksq-chip ${metricClass("total_return_pct", strategy.latest_run.metrics.total_return_pct)}`,
											children: [
												"收益 ",
												metric(strategy.latest_run, "total_return_pct"),
												"%"
											]
										}),
										strategy.latest_run && typeof strategy.latest_run.metrics?.max_drawdown_pct === "number" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: `ksq-chip ${metricClass("max_drawdown_pct", strategy.latest_run.metrics.max_drawdown_pct)}`,
											children: [
												"回撤 ",
												metric(strategy.latest_run, "max_drawdown_pct"),
												"%"
											]
										})
									]
								})]
							}, strategy.strategy_id))
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
							className: "ksq-detail",
							children: !selected ? strategies.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ksq-empty",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "策略库还是空的" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "策略回测任务的产物目前只落在工作区文件（data/ 与 reports/）里。归档进策略库后，这里会出现可回看净值叠加、跨版本对比、重跑的策略资产。" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: "ksq-linkbtn",
										type: "button",
										onClick: () => copy(INGEST_PROMPT),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCopy, { size: 11 }), " 复制「把最近一次回测结果入库」提示词"]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "ksq-item-meta",
										children: "粘贴到对话发送即可；后续回测任务会按 strategy-backtest-theme 阶段五自动归档。"
									})
								]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "ksq-hint",
								children: "从左侧选择一个策略查看版本时间线与回测对比。"
							}) : detailLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { text: "加载策略详情…" }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
									className: "ksq-identity",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "ksq-identity-head",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: selected.name }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: `ksq-badge tone-${statusBadge(selected.status).tone}`,
												children: statusBadge(selected.status).label
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "ksq-hypothesis",
											children: selected.hypothesis || "（未写投资假设）"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
											className: "ksq-item-meta ksq-mono",
											children: [
												selected.strategy_id,
												" · 当前 v",
												selected.current_version,
												" · 更新于 ",
												formatDateTime(selected.updated_at)
											]
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", {
									className: "ksq-section-title",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconGitBranch, { size: 14 }), " 版本时间线"]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ksq-versions",
									children: versions.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "ksq-hint",
										children: "尚无版本。"
									}) : versions.slice().reverse().map((version) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: `ksq-version ${version.version === selected.current_version ? "latest" : ""}`,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "ksq-version-head",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", { children: ["v", version.version] }),
													version.version === selected.current_version && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "ksq-badge tone-live",
														children: "最新"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "ksq-item-meta",
														children: [
															formatDateTime(version.created_at),
															" · ",
															Math.round(version.code_bytes / 1024),
															"KB · sha ",
															version.code_sha256.slice(0, 8)
														]
													})
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "ksq-version-note",
												children: version.change_note || "（无变更说明）"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												className: "ksq-linkbtn",
												type: "button",
												onClick: () => copy(rerunPrompt(version)),
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPlay, { size: 11 }),
													" ",
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCopy, { size: 11 }),
													" 复制重跑提示词"
												]
											})
										]
									}, version.version))
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "ksq-section-title",
									children: "回测运行（勾选 2-4 个对比）"
								}), runs.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "ksq-hint",
									children: "尚无回测运行记录。"
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
									className: "ksq-table",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "对比" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "run" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "版本" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "区间" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "总收益 %" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "夏普" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "回撤 %" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "交易" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "时间" }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "详情 / 看板 / 解读" })
									] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: runs.map((run) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
										className: compareIds.includes(run.run_id) ? "selected" : "",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: compareIds.includes(run.run_id),
												onChange: () => toggleCompare(run.run_id),
												"aria-label": `对比 run ${run.run_id}`
											}) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
												className: "ksq-mono",
												title: run.run_id,
												children: run.run_id.slice(5, 13)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: ["v", run.version] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [
												run.data_start || "?",
												" ~ ",
												run.data_end || "?"
											] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
												className: `num ${metricClass("total_return_pct", run.metrics?.total_return_pct)}`,
												children: metric(run, "total_return_pct")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
												className: `num ${metricClass("sharpe_ratio", run.metrics?.sharpe_ratio)}`,
												children: metric(run, "sharpe_ratio")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
												className: `num ${metricClass("max_drawdown_pct", run.metrics?.max_drawdown_pct)}`,
												children: metric(run, "max_drawdown_pct")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
												className: "num",
												children: metric(run, "trade_count")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: formatDateTime(run.created_at) }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "ksq-linkbtn",
													type: "button",
													onClick: () => void toggleDetail(run.run_id),
													children: detailView?.runId === run.run_id ? "收起" : "详情"
												}),
												runReportId(run) !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [" ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "ksq-linkbtn",
													type: "button",
													onClick: () => void showReport(run.run_id),
													children: reportView?.runId === run.run_id ? "收起" : "看板"
												})] }),
												" ",
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "ksq-linkbtn",
													type: "button",
													onClick: () => askInterpret(run),
													children: "解读"
												})
											] })
										]
									}, run.run_id)) })]
								})] }),
								detailView !== null && (() => {
									const run = runs.find((item) => item.run_id === detailView.runId);
									if (run === void 0) return null;
									const rawEquity = detailView.equity?.equity;
									const nav = normalizeEquity(rawEquity ?? []);
									const dates = equityDates(rawEquity);
									const digest = tradesArtifact(detailView.trades?.trades);
									const range = run.data_start !== "" && run.data_end !== "" ? `${run.data_start} ~ ${run.data_end}` : "—";
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "ksq-compare",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: [
												"回测详情（",
												run.run_id.slice(5, 13),
												" · v",
												run.version,
												" · ",
												range,
												"）",
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "ksq-linkbtn",
													type: "button",
													onClick: () => setDetailView(null),
													children: "收起"
												})
											] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("table", {
												className: "ksq-table",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tr", { children: METRIC_KEYS.map(([key, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [
													label,
													"：",
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
														className: `num ${metricClass(key, run.metrics?.[key])}`,
														children: metric(run, key)
													})
												] }, key)) }) })
											}),
											nav.length >= 2 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "ksq-chart",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "策略净值（归一化，1 起点 · 悬停查看逐日数值）" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LineOverlay, {
													series: [{
														label: `v${run.version} 净值`,
														values: nav,
														color: RUN_COLORS[0]
													}],
													baseline: 1,
													title: "策略净值曲线",
													dates
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "ksq-chart",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "回撤（underwater · 悬停查看逐日回撤）" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DrawdownChart, {
													values: nav,
													title: "回撤副图",
													dates
												})]
											})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "ksq-note",
												children: "该 run 未存净值附件（record_run 未附 equity），无法绘制曲线。"
											}),
											digest.pnlSeries.length >= 2 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "ksq-chart",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h4", { children: ["每笔平仓盈亏（悬浮查看笔明细）", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													className: "ksq-linkbtn",
													type: "button",
													onClick: () => exportCsv(`交易流水-${selected?.name ?? "strategy"}-${run.run_id.slice(5, 13)}.csv`, [
														"日期",
														"代码",
														"方向",
														"价格",
														"数量",
														"已实现盈亏"
													], digest.rows.map((row) => [
														row.date,
														row.code,
														row.action,
														row.price !== null ? String(row.price) : "",
														String(row.quantity),
														row.pnl !== null ? String(row.pnl) : ""
													])),
													children: "导出流水 CSV"
												})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PnlBars, {
													values: digest.pnlSeries,
													title: "每笔平仓盈亏柱",
													labels: digest.pnlLabels
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
												className: "ksq-item-meta",
												children: [
													"交易 ",
													digest.total,
													" 笔 · 平仓 ",
													digest.closes,
													" 笔 · 单笔最大盈 ",
													digest.maxWin.toLocaleString(),
													" / 亏 ",
													digest.maxLoss.toLocaleString(),
													" · 累计已实现 ",
													digest.totalPnl.toLocaleString()
												]
											})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "ksq-note",
												children: "该 run 未存交易清单附件（record_run 未附 trades），无法绘制盈亏分布。"
											}),
											digest.rebalances.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "ksq-chart",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h4", { children: [
													"调仓记录（",
													digest.rebalances.length,
													" 个交易日",
													digest.precise ? " · 快照精确口径" : " · 流水推导口径",
													"）",
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														className: "ksq-linkbtn",
														type: "button",
														onClick: () => exportCsv(`调仓记录-${selected?.name ?? "strategy"}-${run.run_id.slice(5, 13)}.csv`, [
															"日期",
															"类型",
															"代码",
															"数量"
														], digest.rebalances.flatMap((day) => [
															...day.buys.map((item) => [
																day.date,
																"换入",
																item.code,
																String(item.quantity)
															]),
															...day.sells.map((item) => [
																day.date,
																"换出",
																item.code,
																String(item.quantity)
															]),
															...day.holdings.map((item) => [
																day.date,
																"持仓",
																item.code,
																String(item.quantity)
															])
														])),
														children: "导出 CSV"
													})
												] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "ksq-rebalances",
													children: digest.rebalances.slice().reverse().map((day) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
														className: "ksq-rebalance",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "ksq-mono",
																children: day.date
															}),
															day.buys.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "ksq-up",
																children: ["入 ", day.buys.length]
															}),
															day.sells.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "ksq-down",
																children: ["出 ", day.sells.length]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "ksq-item-meta",
																children: ["持仓 ", day.holdings.length]
															})
														] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: "ksq-rebalance-body",
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: "ksq-rebalance-dayhead",
																	children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
																		className: "ksq-linkbtn",
																		type: "button",
																		onClick: () => exportCsv(`调仓-${selected?.name ?? "strategy"}-${day.date}.csv`, [
																			"类型",
																			"代码",
																			"数量"
																		], [
																			...day.buys.map((item) => [
																				"换入",
																				item.code,
																				String(item.quantity)
																			]),
																			...day.sells.map((item) => [
																				"换出",
																				item.code,
																				String(item.quantity)
																			]),
																			...day.holdings.map((item) => [
																				"持仓",
																				item.code,
																				String(item.quantity)
																			])
																		]),
																		children: "导出本日 CSV"
																	})
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: "ksq-rebalance-cols",
																	children: [day.buys.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																		className: "ksq-rebalance-side",
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
																			className: "ksq-up",
																			children: [
																				"换入 ",
																				day.buys.length,
																				" 只"
																			]
																		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
																			className: "ksq-table",
																			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "代码" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "数量" })] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: day.buys.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
																				className: "ksq-mono",
																				children: item.code
																			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
																				className: "num",
																				children: item.quantity.toLocaleString()
																			})] }, `b-${item.code}`)) })]
																		})]
																	}), day.sells.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																		className: "ksq-rebalance-side",
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
																			className: "ksq-down",
																			children: [
																				"换出 ",
																				day.sells.length,
																				" 只"
																			]
																		}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
																			className: "ksq-table",
																			children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "代码" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "数量" })] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: day.sells.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
																				className: "ksq-mono",
																				children: item.code
																			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
																				className: "num",
																				children: item.quantity.toLocaleString()
																			})] }, `s-${item.code}`)) })]
																		})]
																	})]
																}),
																/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
																	className: "ksq-item-meta",
																	children: [
																		"日终持仓 ",
																		day.holdings.length,
																		" 只"
																	]
																}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: "ksq-table-wrap",
																	children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
																		className: "ksq-table",
																		children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "持仓代码" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "数量" })] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: day.holdings.map((item) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
																			className: "ksq-mono",
																			children: item.code
																		}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
																			className: "num",
																			children: item.quantity.toLocaleString()
																		})] }, item.code)) })]
																	})
																})] })
															]
														})]
													}, day.date))
												})]
											})
										]
									});
								})(),
								comparison && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-compare",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: ["版本对比", comparison.comparable ? "（同口径，可严格对比）" : "（口径不一致，仅供参考）"] }),
										!comparison.comparable && comparison.notes.map((note) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "ksq-note",
											children: note
										}, note)),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
											className: "ksq-table",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "指标" }), comparison.runs.map((run) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("th", {
												className: "ksq-mono",
												children: [
													"v",
													run.version,
													" · ",
													run.run_id.slice(5, 13)
												]
											}, run.run_id))] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: METRIC_KEYS.map(([key, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: label }), comparison.runs.map((run) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
												className: `num ${metricClass(key, run.metrics?.[key])}`,
												children: metric(run, key)
											}, run.run_id))] }, key)) })]
										}),
										equitySeries.length >= 2 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "ksq-chart",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", { children: "净值曲线叠加（归一化）" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LineOverlay, {
												series: equitySeries,
												baseline: 1,
												title: "版本净值曲线叠加对比"
											})]
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "ksq-note",
											children: "所选运行缺少净值数据（record_run 未存 equity），无法叠加曲线。"
										})
									]
								})
							] })
						})]
					}),
					reportView !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreviewDialog, {
						title: "策略回测看板",
						onClose: closeReportView,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
							title: "策略回测看板",
							src: reportView.htmlUrl,
							sandbox: "allow-scripts"
						})
					}),
					pendingInterpret !== null && getAgentBridge() !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TaskTargetMenu, {
						taskKind: "strategy",
						title: "策略解读发送到…",
						prompt: pendingInterpret,
						bridge: getAgentBridge(),
						useWorkspaces,
						onClose: () => setPendingInterpret(null)
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CopyToast, { text: toast })
				]
			});
		}
		//#endregion
		//#region src/client/page.tsx
		function StrategiesPage({ useWorkspaces } = {}) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-page",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", {
					className: "ksq-topbar",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-title",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "策略库" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "策略研究资产沉淀：版本时间线与回测对比" })]
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StrategiesSection, { useWorkspaces })]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* ${pkg} — KStock 量化库客户端插件。
		*
		* 注册 `main` keyed 面板（键 kstock-quant-strategies）+ `sidebar.panellist` 导航入口
		* （同 id，侧栏自动接线 ctx.layout.selectPanel）；ksq 样式经
		* @kstock/quant-ui 幂等注入（四个量化库插件共用一份）。
		*
		* 研究联动（§28）：回测 run「解读」按钮先弹 TaskTargetMenu 选任务归属
		* （跟随当前会话/已注册子工作区/浏览注册新目录），按 strategy 类型记忆；
		* 路由桥为 quant-ui 共享实现 buildTaskRouterBridge。
		*/
		/** 面板键：main slot 与侧栏入口共用。 */
		const PANEL_KEY = "kstock-quant-strategies";
		/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
		function NavIcon({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCandles, { size: size ?? 18 });
		}
		/** 必需服务：slot 注册表 + 会话作用域 + 面板切换 + 工作区面。 */
		const inject = [
			"slots",
			"sessions",
			"layout",
			"uiWorkspace",
			"workspaces"
		];
		/** 客户端插件体。 */
		function apply(ctx) {
			ctx.effect(() => {
				injectQuantStyles();
				bindAgentBridge(buildTaskRouterBridge(ctx));
				ctx.slots.inject("main", () => ctx.slots.register({
					name: "main",
					key: PANEL_KEY
				}, StrategiesPage));
				ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
					name: "sidebar.panellist",
					id: PANEL_KEY,
					order: 100,
					label: "策略库"
				}, NavIcon));
			}, "kstock-quant-strategies: panel + nav");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.cjs.map