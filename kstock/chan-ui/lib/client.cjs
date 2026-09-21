window.__ModuleLoader__.load({
	id: "@kstock/client-chan",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region ../quant-ui/src/quant.css?raw
		var quant_default = "/* KStock 量化工作台面板样式（@kstock/quant 客户端半端）。\n *\n * 全部类名以 ksq- 前缀隔离；颜色走引擎 dsw 别名 token（随明暗主题\n * 自动切换），强调色沿用 KStock 品牌绿。由客户端 bundle 以 ?raw 内联，\n * apply() 时注入 <style data-kstock=\"quant-pages\">。 */\n\n.ksq-page {\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-bg-base) 88%, transparent);\n}\n\n/* ── 顶部：标题 + 库切换 tab ─────────────────────────────── */\n\n.ksq-topbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  padding: 14px 22px 0;\n  flex: none;\n}\n\n.ksq-title {\n  display: flex;\n  align-items: baseline;\n  gap: 10px;\n  min-width: 0;\n}\n\n.ksq-title strong {\n  font-size: 17px;\n  letter-spacing: 0.2px;\n}\n\n.ksq-title span {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.ksq-topbar-actions {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex: none;\n}\n\n.ksq-count {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.ksq-tabs {\n  display: flex;\n  gap: 4px;\n  padding: 10px 22px 0;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-tab {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  padding: 8px 14px 10px;\n  cursor: pointer;\n  border-bottom: 2px solid transparent;\n  margin-bottom: -1px;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-tab:hover { color: var(--dsw-alias-label-primary); }\n\n.ksq-tab.active {\n  color: var(--dsw-alias-label-primary);\n  border-bottom-color: var(--dsw-alias-brand-primary);\n  font-weight: 600;\n}\n\n/* ── 通用控件 ─────────────────────────────────────────────── */\n\n.ksq-iconbtn {\n  appearance: none;\n  border: 1px solid transparent;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  width: 28px;\n  height: 28px;\n  border-radius: 7px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n\n.ksq-iconbtn:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.ksq-iconbtn:disabled { opacity: 0.5; cursor: default; }\n.ksq-iconbtn.danger:hover { color: #e64646; }\n\n.ksq-btn {\n  appearance: none;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  padding: 5px 12px;\n  border-radius: 7px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }\n\n.ksq-linkbtn {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-link);\n  font-size: 12px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 0;\n}\n\n.ksq-linkbtn:hover { text-decoration: underline; }\n\n.ksq-search {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 8px;\n  padding: 6px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  min-width: 260px;\n}\n\n.ksq-search input {\n  border: none;\n  outline: none;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  flex: 1;\n}\n\n.ksq-search input::placeholder { color: var(--dsw-alias-label-tertiary); }\n\n.ksq-spin { animation: ksq-rotate 0.9s linear infinite; }\n\n@keyframes ksq-rotate {\n  to { transform: rotate(360deg); }\n}\n\n.ksq-error {\n  margin: 10px 22px 0;\n  padding: 8px 12px;\n  border: 1px solid rgba(230, 70, 70, 0.4);\n  border-radius: 8px;\n  background: rgba(230, 70, 70, 0.08);\n  color: #e64646;\n  font-size: 12.5px;\n}\n\n.ksq-loading {\n  margin: 24px 22px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n}\n\n.ksq-empty {\n  margin: 40px auto;\n  max-width: 420px;\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  font-size: 13px;\n}\n\n.ksq-empty strong { color: var(--dsw-alias-label-secondary); font-size: 14px; }\n\n.ksq-mono {\n  font-family: ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace;\n  font-size: 0.92em;\n}\n\n/* 数值语义色 */\n.ksq-up { color: #31c7a2; }\n.ksq-down { color: #e64646; }\n.ksq-warn { color: #e8a33d; }\n\n/* ── 数据表 ─────────────────────────────────────────────── */\n\n.ksq-table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 12.5px;\n}\n\n.ksq-table th {\n  text-align: left;\n  font-weight: 500;\n  color: var(--dsw-alias-label-tertiary);\n  padding: 6px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  white-space: nowrap;\n}\n\n.ksq-table td {\n  padding: 7px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  color: var(--dsw-alias-label-primary);\n  white-space: nowrap;\n}\n\n.ksq-table td.num { text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-table tr.selected td { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-table input[type=\"checkbox\"] { accent-color: var(--dsw-alias-brand-primary); }\n\n/* 长文本单元格裁剪（agent 写入的股票池/口径描述可达数百字，nowrap 下会把\n   操作列挤出视口）：max-width + ellipsis，全文走 title 悬浮。 */\n.ksq-table td.ksq-cell-clip {\n  max-width: 230px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* 表格横向滚动兜底：窗口再窄操作列（报告/看板）也始终可达，不整页溢出。 */\n.ksq-table-wrap { overflow-x: auto; }\n.ksq-table-wrap .ksq-table { min-width: 640px; }\n\n/* ── 内容区骨架 ─────────────────────────────────────────── */\n\n.ksq-body {\n  flex: 1;\n  overflow: auto;\n  padding: 14px 22px 26px;\n}\n\n.ksq-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-bottom: 14px;\n}\n\n/* ── 策略/因子/选股：列表 + 详情双栏 ────────────────────── */\n\n.ksq-split {\n  display: grid;\n  grid-template-columns: 264px 1fr;\n  gap: 16px;\n  align-items: start;\n}\n\n.ksq-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  position: sticky;\n  top: 0;\n}\n\n.ksq-list-item {\n  appearance: none;\n  text-align: left;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 10px;\n  padding: 9px 12px;\n  cursor: pointer;\n  color: var(--dsw-alias-label-primary);\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.ksq-list-item:hover { border-color: var(--dsw-alias-border-l2); }\n\n.ksq-list-item.active {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-1));\n}\n\n.ksq-item-name {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  font-size: 13px;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.ksq-item-name > span.ksq-name-text {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dot {\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  flex: none;\n}\n\n.ksq-dot.tone-live { background: #31c7a2; }\n.ksq-dot.tone-idle { background: #8f98a2; }\n.ksq-dot.tone-bad { background: #e64646; }\n\n.ksq-item-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-chip {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 999px;\n  padding: 0 7px;\n  font-size: 11px;\n  line-height: 18px;\n}\n\n.ksq-badge {\n  border-radius: 5px;\n  padding: 1px 7px;\n  font-size: 11px;\n  line-height: 18px;\n  flex: none;\n}\n\n.ksq-badge.tone-live {\n  color: #31c7a2;\n  background: rgba(49, 199, 162, 0.12);\n}\n\n.ksq-badge.tone-idle {\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-3);\n}\n\n.ksq-badge.tone-bad {\n  color: #e64646;\n  background: rgba(230, 70, 70, 0.1);\n}\n\n.ksq-detail { min-width: 0; display: flex; flex-direction: column; gap: 14px; }\n\n.ksq-hint {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12.5px;\n  margin: 6px 0;\n}\n\n.ksq-identity { border-bottom: 1px solid var(--dsw-alias-border-l3); padding-bottom: 10px; }\n\n.ksq-identity-head {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.ksq-identity-head h2 { font-size: 16px; margin: 0; }\n\n.ksq-hypothesis {\n  margin: 6px 0 4px;\n  font-size: 12.5px;\n  color: var(--dsw-alias-label-secondary);\n  line-height: 1.6;\n}\n\n.ksq-section-title {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n  margin: 4px 0 8px;\n}\n\n/* 版本时间线 */\n.ksq-versions { display: flex; flex-direction: column; gap: 8px; padding-left: 14px; }\n\n.ksq-version {\n  position: relative;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 9px 12px;\n}\n\n.ksq-version.latest { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); }\n\n.ksq-version::before {\n  content: \"\";\n  position: absolute;\n  left: -11px;\n  top: 16px;\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-version.latest::before { background: var(--dsw-alias-brand-primary); }\n\n.ksq-version-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 12.5px;\n}\n\n.ksq-version-note {\n  margin: 5px 0 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* 对比块 */\n.ksq-compare {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-compare h3 { font-size: 13px; margin: 0 0 8px; }\n\n.ksq-note {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  margin: 4px 0;\n}\n\n.ksq-chart { margin-top: 10px; }\n\n.ksq-chart h4 {\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n  margin: 0 0 6px;\n}\n\n.ksq-chart svg { max-width: 100%; height: auto; }\n\n/* 选股 criteria 摘要 */\n.ksq-criteria {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 8px 10px;\n  margin: 6px 0 0;\n  white-space: pre-wrap;\n  word-break: break-word;\n  max-height: 160px;\n  overflow: auto;\n}\n\n/* 选股 picks 表 */\n.ksq-picks-meta { display: flex; gap: 14px; font-size: 12px; color: var(--dsw-alias-label-tertiary); margin: 6px 0; }\n\n/* ── 报告库 ─────────────────────────────────────────────── */\n\n.ksq-report-group { margin-bottom: 16px; }\n\n.ksq-report-heading {\n  appearance: none;\n  border: none;\n  background: transparent;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  cursor: pointer;\n  padding: 4px 0 8px;\n  width: 100%;\n}\n\n.ksq-report-heading h2 { font-size: 13px; margin: 0; font-weight: 600; color: var(--dsw-alias-label-primary); }\n.ksq-report-heading span { color: var(--dsw-alias-label-tertiary); font-size: 12px; }\n\n.ksq-report-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));\n  gap: 10px;\n}\n\n.ksq-report-card {\n  display: flex;\n  gap: 12px;\n  align-items: flex-start;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-report-icon {\n  flex: none;\n  width: 34px;\n  height: 34px;\n  border-radius: 9px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);\n}\n\n.ksq-report-copy { flex: 1; min-width: 0; }\n\n.ksq-report-copy h3 {\n  margin: 0 0 4px;\n  font-size: 13.5px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-report-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px 12px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-report-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex: none; }\n\n/* 报告预览浮层 */\n.ksq-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 80;\n  background: rgba(3, 13, 11, 0.72);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 40px;\n}\n\n.ksq-dialog {\n  width: min(1080px, 100%);\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  border-radius: 14px;\n  overflow: hidden;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-dialog-bar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 14px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-dialog-bar strong {\n  font-size: 13px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dialog iframe {\n  flex: 1;\n  border: none;\n  background: #fff;\n}\n\n/* 确认弹窗 */\n.ksq-confirm {\n  width: min(420px, 100%);\n  height: auto;\n  border-radius: 14px;\n  padding: 18px;\n  gap: 10px;\n}\n\n.ksq-confirm h3 { margin: 0; font-size: 15px; }\n.ksq-confirm p { margin: 0; font-size: 12.5px; color: var(--dsw-alias-label-secondary); line-height: 1.6; }\n\n.ksq-confirm-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  margin-top: 8px;\n}\n\n.ksq-btn.danger {\n  color: #fff;\n  background: #c0392b;\n  border-color: #c0392b;\n}\n\n.ksq-btn.danger:hover { background: #a93226; }\n\n/* 复制成功提示 */\n.ksq-toast {\n  position: fixed;\n  bottom: 28px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 90;\n  /* 自洽深色药丸：不依赖宿主 toast token（--dsw-alias-toast-bg 在宿主不存在，\n     回退 bg-overlay 是遮罩 scrim 色——黑条不可读）。深底浅字双主题通用。 */\n  background: rgba(3, 13, 11, 0.92);\n  color: #e8edef;\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  font-size: 12.5px;\n  border-radius: 999px;\n  padding: 8px 16px;\n  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);\n}\n\n/* ── 财经新闻面板（@kstock/client-news）────────────────────────── */\n\n.ksq-news-list {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  padding-bottom: 8px;\n}\n\n.ksq-news-item {\n  position: relative;\n  padding: 12px 16px 12px 20px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  overflow: hidden;\n  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;\n}\n\n/* 左侧品牌色细轨：常亮 55%，hover 点满。 */\n.ksq-news-item::before {\n  content: '';\n  position: absolute;\n  left: 0;\n  top: 0;\n  bottom: 0;\n  width: 3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 100%, transparent);\n  opacity: .45;\n  transition: opacity .15s ease;\n}\n\n.ksq-news-item:hover {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, var(--dsw-alias-border-l2));\n  transform: translateY(-1px);\n  box-shadow: 0 4px 16px color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n}\n\n.ksq-news-item:hover::before {\n  opacity: 1;\n}\n\n.ksq-news-meta {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-source {\n  padding: 1.5px 8px;\n  border-radius: 99px;\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: .3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent);\n  color: var(--dsw-alias-brand-primary);\n  white-space: nowrap;\n}\n\n.ksq-news-dot {\n  width: 3px;\n  height: 3px;\n  border-radius: 50%;\n  background: currentColor;\n  opacity: .55;\n  flex: none;\n}\n\n.ksq-news-time {\n  margin-left: auto;\n  white-space: nowrap;\n}\n\n.ksq-news-title {\n  font-size: 14px;\n  font-weight: 600;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  text-decoration: none;\n}\n\na.ksq-news-title:hover {\n  color: var(--dsw-alias-link);\n}\n\n.ksq-news-summary {\n  margin: 0;\n  font-size: 12.5px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n\n.ksq-news-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 22px 0;\n  flex: none;\n}\n\n.ksq-news-toolbar .ksq-tabs { margin-bottom: 0; }\n\n.ksq-news-toolbar-right {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  min-width: 0;\n}\n\n.ksq-news-toolbar-right .ksq-search { margin-bottom: 0; flex: 1; min-width: 220px; max-width: 460px; }\n\n.ksq-news-watchedit {\n  padding: 8px 22px 0;\n  flex: none;\n}\n\n.ksq-news-watchedit input {\n  width: 100%;\n  box-sizing: border-box;\n  padding: 7px 12px;\n  border-radius: 8px;\n  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, var(--dsw-alias-border-l2));\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n}\n\n/* 双栏：主列表 + 统计侧栏（窄面板时侧栏隐藏）。 */\n.ksq-news-split {\n  display: flex;\n  gap: 20px;\n  align-items: flex-start;\n  width: 100%;\n  max-width: 1360px;\n  margin: 0 auto;\n}\n\n.ksq-news-main {\n  flex: 1;\n  min-width: 0;\n}\n\n.ksq-news-item.read { opacity: .58; }\n.ksq-news-item.read:hover { opacity: 1; }\n\n.ksq-news-item.watched {\n  border-color: color-mix(in srgb, #f59e0b 45%, var(--dsw-alias-border-l2));\n  background: color-mix(in srgb, #f59e0b 5%, var(--dsw-alias-bg-layer-2));\n}\n\n.ksq-news-item.watched::before {\n  background: #f59e0b;\n}\n\n.ksq-news-watchflag {\n  padding: 1px 7px;\n  border-radius: 99px;\n  font-size: 10.5px;\n  font-weight: 600;\n  letter-spacing: .5px;\n  color: #f59e0b;\n  background: color-mix(in srgb, #f59e0b 16%, transparent);\n}\n\n.ksq-news-stocks {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-stocktag {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  padding: 2px 9px;\n  border-radius: 6px;\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n  transition: border-color .12s ease, background .12s ease;\n}\n\n.ksq-news-stocktag:hover {\n  border-color: var(--dsw-alias-brand-primary);\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);\n}\n\n.ksq-news-actions {\n  display: flex;\n  justify-content: flex-end;\n  font-size: 12.5px;\n}\n\n/* 统计侧栏 */\n.ksq-news-stats {\n  flex: none;\n  width: 220px;\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  position: sticky;\n  top: 0;\n}\n\n@media (max-width: 980px) {\n  .ksq-news-stats { display: none; }\n  .ksq-news-split { display: block; }\n}\n\n.ksq-news-stats-block {\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  padding: 12px 14px;\n}\n\n.ksq-news-stats-head {\n  font-size: 13px;\n  font-weight: 600;\n  margin-bottom: 10px;\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n}\n\n.ksq-news-stats-head span {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-stats-empty {\n  margin: 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-trending {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-trendword {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 2.5px 9px;\n  border-radius: 99px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-news-trendword:hover {\n  color: var(--dsw-alias-brand-primary);\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.ksq-news-trendword em {\n  font-style: normal;\n  font-size: 10.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-freq {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: 50px;\n}\n\n.ksq-news-freq-bar {\n  flex: 1;\n  min-width: 3px;\n  border-radius: 2px 2px 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n}\n\n.ksq-news-freq-bar:hover {\n  background: var(--dsw-alias-brand-primary);\n}\n\n/* ── 联动任务目标选择菜单（§26-10，新闻/选股库共用）────────────── */\n\n.ksq-target-overlay { z-index: 95; padding: 40px; background: rgba(3, 13, 11, 0.45); }\n\n.ksq-target-menu {\n  width: min(480px, 100%);\n  max-height: min(70vh, 560px);\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  padding: 12px;\n  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);\n}\n\n.ksq-target-head {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  padding: 4px 8px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  margin-bottom: 6px;\n}\n\n.ksq-target-item {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  padding: 9px 10px;\n  border: none;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  text-align: left;\n  cursor: pointer;\n  font-size: 13px;\n}\n\n.ksq-target-item:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }\n.ksq-target-item:disabled { opacity: 0.55; cursor: default; }\n.ksq-target-item.last { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }\n\n.ksq-target-name { font-weight: 500; flex: none; }\n.ksq-target-path {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-target-error { color: #e64646; font-size: 12.5px; margin: 4px 8px; }\n.ksq-target-cancel { align-self: flex-end; margin-top: 4px; }\n\n/* ── 选股库：口径芯片（P4）+ 命中趋势（P3）────────────────────── */\n\n.ksq-chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0 2px; }\n.ksq-chips .ksq-chip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }\n\n.ksq-trend {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 8px 10px;\n  margin: 6px 0 10px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-trend-label {\n  flex: none;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-trend-bars {\n  flex: 1;\n  display: flex;\n  align-items: flex-end;\n  justify-content: flex-start;\n  gap: 4px;\n  height: 44px;\n  min-width: 0;\n}\n\n.ksq-trend-col {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: 100%;\n  cursor: default;\n}\n\n.ksq-trend-bar {\n  width: 9px;\n  min-height: 3px;\n  border-radius: 2px 2px 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 60%, transparent);\n}\n\n.ksq-trend-bar:hover { background: var(--dsw-alias-brand-primary); }\n\n.ksq-trend-bar.consensus { background: #31c7a2; }\n.ksq-trend-bar.consensus:hover { background: #22a06b; }\n\n/* ── 因子库：跨因子概览（F3，IC 均值零轴双向横条）──────────────── */\n\n.ksq-factors-overview {\n  display: flex;\n  align-items: flex-start;\n  gap: 10px;\n  padding: 10px 12px;\n  margin-bottom: 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-fo-rows { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }\n\n.ksq-fo-row {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  padding: 3px 6px;\n  border: none;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  text-align: left;\n  cursor: pointer;\n  font-size: 12px;\n}\n\n.ksq-fo-row:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-fo-row.active { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); }\n\n.ksq-fo-name {\n  flex: none;\n  width: 128px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-weight: 500;\n}\n\n.ksq-fo-bar {\n  flex: 1;\n  position: relative;\n  height: 10px;\n  min-width: 0;\n}\n\n/* 零轴：容器中缝 1px 基线；正值条从中线向右，负值向左。 */\n.ksq-fo-bar::before {\n  content: '';\n  position: absolute;\n  left: 50%;\n  top: -2px;\n  bottom: -2px;\n  width: 1px;\n  background: var(--dsw-alias-border-l3);\n}\n\n.ksq-fo-fill {\n  position: absolute;\n  top: 1px;\n  bottom: 1px;\n  border-radius: 2px;\n}\n\n.ksq-fo-fill.up { background: #31c7a2; }\n.ksq-fo-fill.down { background: #e64646; }\n\n.ksq-fo-value { flex: none; width: 52px; text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-fo-ir { flex: none; width: 64px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }\n\n/* ── 策略库：调仓记录（§28-5，按日折叠）────────────────────────── */\n\n.ksq-rebalances {\n  max-height: 380px;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 6px;\n}\n\n.ksq-rebalance { border-bottom: 1px solid var(--dsw-alias-border-l3); }\n.ksq-rebalance:last-child { border-bottom: none; }\n\n.ksq-rebalance summary {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 5px 8px;\n  cursor: pointer;\n  font-size: 12.5px;\n  list-style: none;\n  border-radius: 6px;\n}\n\n.ksq-rebalance summary::-webkit-details-marker { display: none; }\n.ksq-rebalance summary::before { content: '\\25B8'; color: var(--dsw-alias-label-tertiary); transition: transform 0.12s; }\n.ksq-rebalance[open] summary::before { transform: rotate(90deg); }\n.ksq-rebalance summary:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }\n\n.ksq-rebalance-body { padding: 6px 10px 10px 22px; display: flex; flex-direction: column; gap: 6px; }\n\n.ksq-rebalance-dayhead { display: flex; justify-content: flex-end; }\n\n/* ── 版本迭代面板（§28-10「从此版本改进」）────────────────────── */\n\n.ksq-iter {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  margin-top: 8px;\n  padding: 10px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 4%, transparent);\n}\n\n.ksq-iter-chip { cursor: pointer; background: transparent; }\n.ksq-iter-chip.active {\n  border-color: var(--dsw-alias-brand-primary);\n  color: var(--dsw-alias-brand-primary);\n  font-weight: 500;\n}\n\n.ksq-iter-input {\n  height: 30px;\n  padding: 0 10px;\n  border-radius: 8px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: transparent;\n  color: inherit;\n  font-size: 12.5px;\n}\n.ksq-rebalance-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\n@media (max-width: 720px) { .ksq-rebalance-cols { grid-template-columns: 1fr; } }\n.ksq-rebalance-side p { margin: 0 0 4px; font-size: 12px; font-weight: 500; }\n.ksq-rebalance-side .ksq-table { font-size: 11.5px; }\n\n\n/* ── 图表视觉比例锚定（viewBox 拉伸陷阱修复）──────────────────────\n   图表 SVG viewBox 固定宽（560/720），宽面板被拉伸 1.5-2x，字号视觉\n   翻倍显巨大。统一锚定 max-width：560 系 ≤660px（放大上限 1.18x）、\n   720 系（缠论 K 线）≤880px；height:auto 保持宽高比。 */\n.ksq-chart svg { max-width: 660px; height: auto; }\n.ksq-chan-chart svg { max-width: 880px; height: auto; display: block; }\n\n/* ── 缠论研究面板（§29-C1，@kstock/client-chan）────────────────── */\n\n.ksq-chan-input {\n  width: 260px;\n  height: 30px;\n  padding: 0 10px;\n  border-radius: 8px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: transparent;\n  color: inherit;\n  font-size: 12.5px;\n}\n\n.ksq-chan-select {\n  height: 30px;\n  padding: 0 6px;\n  border-radius: 8px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: transparent;\n  color: inherit;\n  font-size: 12.5px;\n}\n\n.ksq-chan-summary {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n  gap: 10px;\n  margin-top: 12px;\n}\n\n.ksq-chan-card {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  font-size: 12.5px;\n}\n\n.ksq-chan-card strong { font-size: 12px; color: var(--dsw-alias-label-tertiary); font-weight: 500; }\n.ksq-chan-card span { color: var(--dsw-alias-label-primary); }\n\n.ksq-chan-radar {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-chan-radar svg { width: 156px; flex: none; }\n.ksq-chan-radar-meta { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }\n\n.ksq-chan-signals {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-chan-signals strong { font-size: 12px; color: var(--dsw-alias-label-tertiary); font-weight: 500; }\n\n/* ── 缠论面板：左图右栏布局 + 右侧信息栏（§29-7）────────────────── */\n\n.ksq-chan-main {\n  display: flex;\n  gap: 14px;\n  align-items: flex-start;\n  margin-top: 12px;\n}\n\n.ksq-chan-chartwrap { flex: 1; min-width: 0; }\n.ksq-chan-chartwrap svg { width: 100%; max-width: 880px; height: auto; display: block; }\n\n.ksq-chan-side {\n  flex: none;\n  width: 268px;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n\n.ksq-chan-sidecard {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  font-size: 12.5px;\n}\n\n.ksq-chan-sidecard strong { font-size: 12px; color: var(--dsw-alias-label-tertiary); font-weight: 500; }\n\n.ksq-chan-levelrow em { font-style: normal; font-weight: 500; margin-right: 6px; }\n\n.ksq-chan-signal {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  padding: 4px 6px;\n  border: none;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  text-align: left;\n  cursor: pointer;\n}\n\n.ksq-chan-signal:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-chan-signal em { font-style: normal; font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: var(--dsw-alias-label-tertiary); flex: none; }\n.ksq-chan-signal span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.ksq-chan-signal b { font-weight: 500; font-variant-numeric: tabular-nums; }\n.ksq-chan-signal.up b { color: #e05656; }\n.ksq-chan-signal.down b { color: #2f9e77; }\n\n@media (max-width: 1080px) {\n  .ksq-chan-main { flex-direction: column; }\n  .ksq-chan-side { width: 100%; }\n}\n\n/* ── 缠论研究改版（三栏证据台）：证据链卡 · 共享件 ───────────────────── */\n.ksq-chanx-card {\n  background: var(--dsw-alias-surface-1, #101a16);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  padding: 10px 10px 8px;\n  display: flex; flex-direction: column; gap: 8px;\n}\n.ksq-chanx-card-hd { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }\n.ksq-chanx-card-hd strong { font-size: 12.5px; color: var(--dsw-alias-label-primary); }\n.ksq-chanx-card > button, .ksq-chanx-card > p { margin: 0; }\n.ksq-chanx-chain {\n  display: flex; flex-wrap: wrap; align-items: center; gap: 2px 6px;\n  padding: 7px 10px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;\n  background: linear-gradient(90deg, rgba(232,163,61,0.08), transparent 70%);\n  font-size: 12px;\n}\n.ksq-chanx-chain-node { display: inline-flex; align-items: center; gap: 6px; color: var(--dsw-alias-label-primary); }\n.ksq-chanx-chain-node em { font-style: normal; color: var(--dsw-alias-label-tertiary); }\n.ksq-chanx-badge {\n  display: inline-block; font-size: 11px; line-height: 1.6; padding: 0 7px;\n  border-radius: 99px; border: 1px solid var(--dsw-alias-border-l2);\n  color: var(--dsw-alias-label-secondary); white-space: nowrap;\n}\n.ksq-chanx-badge.up { color: #e05656; border-color: rgba(224,86,86,0.45); background: rgba(224,86,86,0.08); }\n.ksq-chanx-badge.down { color: #2f9e77; border-color: rgba(47,158,119,0.45); background: rgba(47,158,119,0.08); }\n.ksq-chanx-badge.zs { color: #c792ea; border-color: rgba(199,146,234,0.45); }\n.ksq-chanx-bar {\n  flex: 1; height: 8px; border-radius: 4px; overflow: hidden;\n  background: var(--dsw-alias-surface-2, #0d1613); display: inline-block;\n}\n.ksq-chanx-bar i { display: block; height: 100%; border-radius: 4px; }\n.ksq-chanx-bcrow, .ksq-chanx-bsrow, .ksq-chanx-zsrow {\n  text-align: left; border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px;\n  background: var(--dsw-alias-surface-2, #0d1613); padding: 7px 8px;\n  display: flex; flex-direction: column; gap: 5px; cursor: pointer; color: inherit;\n  font: inherit; width: 100%;\n}\n.ksq-chanx-bcrow:hover, .ksq-chanx-bsrow:hover, .ksq-chanx-zsrow:hover,\n.ksq-chanx-bcrow:focus-visible, .ksq-chanx-bsrow:focus-visible, .ksq-chanx-zsrow:focus-visible {\n  border-color: var(--dsw-alias-brand-primary);\n}\n.ksq-chanx-bcrow.valid { border-left: 3px solid #e64646; }\n.ksq-chanx-bsrow:disabled { cursor: default; opacity: 0.85; }\n.ksq-chanx-bcrow-hd, .ksq-chanx-bsrow-hd { display: flex; align-items: center; gap: 6px; justify-content: space-between; }\n.ksq-chanx-bsrow-hd b { margin-left: auto; }\n.ksq-chanx-areabars, .ksq-chanx-relbar { display: flex; align-items: center; gap: 6px; font-size: 11px; }\n.ksq-chanx-areabars .ksq-item-meta, .ksq-chanx-relbar .ksq-item-meta { flex: none; width: 34px; }\n.ksq-chanx-relbar b, .ksq-chanx-areabars b { font-weight: 500; font-variant-numeric: tabular-nums; flex: none; min-width: 34px; text-align: right; }\n.ksq-chanx-ok { font-size: 10px; color: #2f9e77; border: 1px solid rgba(47,158,119,0.4); border-radius: 3px; padding: 0 3px; flex: none; }\n.ksq-chanx-bcrow-ft { display: flex; gap: 10px; flex-wrap: wrap; }\n.ksq-chanx-why { font-size: 11px; color: var(--dsw-alias-label-tertiary); line-height: 1.5; }\n.ksq-chanx-zspos { display: flex; }\n@keyframes ksq-chanx-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }\n.ksq-chanx-hl { animation: ksq-chanx-pulse 1.1s ease-in-out 2; }\n\n/* 信息条涨跌专用语义色：与主图 A 股红涨绿跌蜡烛同向\n   （区别于通用 ksq-up 绿 / ksq-down 红——二者与蜡烛同屏语义相反）。 */\n.ksq-chanx-up { color: #e05656; }\n.ksq-chanx-down { color: #31c7a2; }\n\n/* ── 缠论研究改版：右栏状态（雷达/矩阵/折叠 chips）─────────────────── */\n.ksq-chanx-radarblock { display: flex; gap: 10px; align-items: flex-start; }\n.ksq-chanx-radarsvg { width: 156px; flex: none; }\n.ksq-chanx-radar-meta { display: flex; flex-direction: column; gap: 5px; font-size: 13px; min-width: 0; flex: 1; }\n.ksq-chanx-radar-meta strong { font-size: 14px; }\n.ksq-chanx-dims { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 8px; }\n.ksq-chanx-dims li { display: flex; justify-content: space-between; gap: 6px; font-size: 11px; }\n.ksq-chanx-dims li em { font-style: normal; color: var(--dsw-alias-label-tertiary); cursor: help; }\n.ksq-chanx-dims li b { font-weight: 500; font-variant-numeric: tabular-nums; }\n.ksq-chanx-matrix { width: 100%; border-collapse: collapse; font-size: 11.5px; }\n.ksq-chanx-matrix th { text-align: left; color: var(--dsw-alias-label-tertiary); font-weight: 400; padding: 2px 4px; border-bottom: 1px solid var(--dsw-alias-border-l2); }\n.ksq-chanx-matrix td { padding: 3px 4px; border-bottom: 1px solid var(--dsw-alias-border-l1, var(--dsw-alias-border-l2)); }\n.ksq-chanx-matrix tr.cur td:first-child { color: var(--dsw-alias-brand-primary); font-weight: 600; }\n.ksq-chanx-matrix tr.res-up td { background: rgba(224,86,86,0.07); }\n.ksq-chanx-matrix tr.res-down td { background: rgba(47,158,119,0.07); }\n.ksq-chanx-chips summary { cursor: pointer; font-size: 12px; color: var(--dsw-alias-label-tertiary); padding: 4px 0; }\n.ksq-chanx-chips .ksq-chips { padding: 4px 0 2px; }\n/* KeyLevelsCard 键值行专用类：禁止用 .ksq-chanx-card span 这类宽选择器——特异性 (0,1,1) 会压制 ksq-item-meta/ksq-chanx-ok/badge 等单类规则 */\n.ksq-chanx-kv { color: var(--dsw-alias-label-primary); font-size: 12px; }\n\n/* ── 缠论研究改版：三栏布局 + 窄屏 Tab ─────────────────────────────── */\n.ksq-chanx-grid {\n  display: grid; gap: 10px; align-items: start;\n  grid-template-columns: minmax(0, 1.55fr) minmax(280px, 330px) minmax(236px, 268px);\n}\n.ksq-chanx-grid.narrow { grid-template-columns: minmax(0, 1fr); }\n.ksq-chanx-chartcol-wrap { min-width: 0; }\n.ksq-chanx-chartcol { display: flex; flex-direction: column; gap: 6px; min-width: 0; }\n.ksq-chanx-chartcol svg { width: 100%; height: auto; display: block; }\n.ksq-chanx-infobar { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }\n.ksq-chanx-infobar b { font-size: 20px; font-variant-numeric: tabular-nums; }\n.ksq-chanx-infobar .ksq-item-meta { margin-left: auto; }\n.ksq-chanx-evi, .ksq-chanx-side2 { display: flex; flex-direction: column; gap: 8px; min-width: 0; }\n.ksq-chanx-tabpanel { border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; padding: 8px; }\n.ksq-chanx-tabs { display: flex; gap: 6px; margin-bottom: 8px; }\n.ksq-chanx-tab {\n  font: inherit; font-size: 12px; padding: 3px 12px; border-radius: 99px;\n  border: 1px solid var(--dsw-alias-border-l2); background: transparent;\n  color: var(--dsw-alias-label-tertiary); cursor: pointer;\n}\n.ksq-chanx-tab.on {\n  color: #0b120f; background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); font-weight: 600;\n}\n";
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
		* 打开/选中一律走 uiWorkspace.openSession（QiLin 3.0.2+ 引擎把会话
		* 导航从 sessions 服务移交视图拥有者，sessions.open 已删除）。
		*/
		function buildTaskRouterBridge(deps) {
			return {
				send: async (target, text) => {
					const sessions = deps.sessions;
					if (sessions === void 0) throw new Error("会话服务不可用");
					const uiWorkspace = deps.uiWorkspace;
					if (uiWorkspace === void 0) throw new Error("工作区导航服务不可用");
					let id;
					if (target.kind === "workspace") id = await uiWorkspace.connectWorkspace(target.workspaceId);
					else id = uiWorkspace.selection.getSnapshot().sessionId ?? await sessions.create();
					uiWorkspace.openSession(id);
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
		//#endregion
		//#region ../quant-ui/src/bits.tsx
		/**
		* 量化面板共享小件：状态文案、通用折线叠加图、确认弹窗、复制提示。
		* 视觉基调与 1.x 组件一致（语义着色/时间线/浮层），类名换 ksq- 前缀。
		*/
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
		const STYLE_VERSION = "2026-09-21.7-chan7";
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
		//#region src/client/derive.ts
		const asRec = (v) => typeof v === "object" && v !== null ? v : {};
		const asArr = (v) => Array.isArray(v) ? v : [];
		const asNum = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
		const asStr = (v) => typeof v === "string" ? v : "";
		const LEVEL_OPTIONS = [
			"5min",
			"15min",
			"30min",
			"60min",
			"90min",
			"120min",
			"daily",
			"weekly",
			"monthly"
		];
		/** 联立矩阵四行窗口：当前级别 + 低一档（若有）+ 高两档；边界向另一侧顺延。 */
		function matrixLevels(level) {
			const opts = LEVEL_OPTIONS;
			const idx = opts.indexOf(level);
			const cur = idx >= 0 ? idx : opts.indexOf("daily");
			const start = Math.max(0, Math.min(cur - 1, opts.length - 4));
			return opts.slice(start, start + 4);
		}
		/** 引擎 payload → 图表切片（宽松解析，字段缺失给安全默认）。 */
		function parseChart(payload) {
			const c = asRec(payload.chart_data);
			const dates = asArr(c.dates).map(asStr);
			const kline = asArr(c.kline).map((item) => {
				const k = asArr(item);
				return [
					Number(k[0]),
					Number(k[1]),
					Number(k[2]),
					Number(k[3])
				];
			});
			if (dates.length < 2 || kline.length !== dates.length) return null;
			return {
				dates,
				kline,
				volumes: asArr(c.volumes).map((v) => asNum(v) ?? 0),
				biLines: asArr(c.bi_lines).map((item) => {
					const r = asRec(item);
					return {
						start_time: asStr(r.start_time),
						end_time: asStr(r.end_time),
						start_price: asNum(r.start_price) ?? 0,
						end_price: asNum(r.end_price) ?? 0
					};
				}),
				segLines: asArr(c.seg_lines).map((item) => {
					const r = asRec(item);
					return {
						start_time: asStr(r.start_time),
						end_time: asStr(r.end_time),
						start_price: asNum(r.start_price) ?? 0,
						end_price: asNum(r.end_price) ?? 0
					};
				}),
				zhongshus: asArr(c.zhongshu_zones).map((item) => {
					const r = asRec(item);
					return {
						start_time: asStr(r.start_time),
						end_time: asStr(r.end_time),
						high: asNum(r.high) ?? 0,
						low: asNum(r.low) ?? 0,
						center: asNum(r.center) ?? 0,
						gg: asNum(r.gg) ?? void 0,
						dd: asNum(r.dd) ?? void 0,
						extendCount: asNum(r.extend_count) ?? void 0,
						zhongshuType: asStr(r.zhongshu_type) || void 0,
						stability: asNum(r.stability) ?? void 0
					};
				}),
				markers: asArr(c.markers).map((item) => {
					const r = asRec(item);
					return {
						time: asStr(r.time) || asStr(r.date),
						price: asNum(r.price) ?? 0,
						type: asStr(r.type) || void 0,
						label: asStr(r.label) || void 0,
						reliability: asNum(r.reliability) ?? void 0,
						strength: asNum(r.strength) ?? void 0,
						confirmedByHigher: r.confirmed_by_higher === true,
						confirmedByLower: r.confirmed_by_lower === true
					};
				}),
				macd: {
					dif: asArr(asRec(c.macd).dif).map(asNum),
					dea: asArr(asRec(c.macd).dea).map(asNum),
					hist: asArr(asRec(c.macd).hist).map(asNum)
				},
				fenxings: asArr(c.fenxings).map((item) => {
					const r = asRec(item);
					return {
						time: asStr(r.time),
						fenxingType: asStr(r.fenxing_type),
						price: asNum(r.price) ?? 0,
						strength: asNum(r.strength) ?? 0
					};
				}),
				backchis: asArr(c.backchis).map((item) => {
					const r = asRec(item);
					return {
						backchiType: asStr(r.backchi_type),
						valid: r.valid === true,
						currentStart: asStr(r.current_start),
						currentEnd: asStr(r.current_end),
						previousStart: asStr(r.previous_start),
						previousEnd: asStr(r.previous_end),
						currentMacdArea: asNum(r.current_macd_area) ?? void 0,
						previousMacdArea: asNum(r.previous_macd_area) ?? void 0,
						macdDivergence: asNum(r.macd_divergence) ?? void 0
					};
				})
			};
		}
		/** 时间 → 全局索引表：同时建全时间戳精确键与日期前缀兜底键。 */
		function dateIndexOf(dates) {
			const map = /* @__PURE__ */ new Map();
			dates.forEach((date, index) => {
				map.set(date, index);
				map.set(date.slice(0, 10), index);
			});
			return map;
		}
		/** 时间 → 索引：先按全时间戳精确匹配，再退日期前缀（分钟级同日多根时避免整日误吸附）。 */
		function resolveIndex(map, time) {
			return map.get(time) ?? map.get(time.slice(0, 10)) ?? -1;
		}
		/** 背驰类型关键词 → 方向（顶/底/未知=盘整类）。 */
		function backchiKind(backchiType) {
			const t = backchiType.toLowerCase();
			if (t.includes("top") || backchiType.includes("顶")) return "top";
			if (t.includes("bottom") || backchiType.includes("底")) return "bottom";
			return null;
		}
		/** 前段 vs 现段的价格极值对照：顶背驰看新高、底背驰看新低（动力学缺了形态对照就是半句话）。 */
		function backchiPriceRelation(chart, dateIndex, bc) {
			const range = (start, end) => {
				const i1 = resolveIndex(dateIndex, start);
				const i2 = resolveIndex(dateIndex, end);
				if (i1 < 0 || i2 < 0 || i2 < i1) return null;
				return chart.kline.slice(i1, i2 + 1);
			};
			const prev = range(bc.previousStart, bc.previousEnd);
			const cur = range(bc.currentStart, bc.currentEnd);
			if (prev === null || cur === null || prev.length === 0 || cur.length === 0) return null;
			const highs = (ks) => ks.reduce((m, k) => Math.max(m, k[3]), -Infinity);
			const lows = (ks) => ks.reduce((m, k) => Math.min(m, k[2]), Infinity);
			const kind = backchiKind(bc.backchiType);
			const prevHigh = highs(prev);
			const curHigh = highs(cur);
			const prevLow = lows(prev);
			const curLow = lows(cur);
			return {
				prevHigh,
				prevLow,
				curHigh,
				curLow,
				newExtreme: kind === "top" ? curHigh > prevHigh : kind === "bottom" ? curLow < prevLow : false,
				kind
			};
		}
		function zhongshuPosition(price, zs) {
			if (price === null) return null;
			const top = zs.gg ?? zs.high;
			const bottom = zs.dd ?? zs.low;
			if (price > top) return "above";
			if (price < bottom) return "below";
			return "inside";
		}
		/** 下一步推演：按现价相对中枢/震荡带位置给出规则文案（数字随区间动态嵌入）。 */
		function zhongshuForecast(price, zs) {
			const pos = zhongshuPosition(price, zs);
			const top = zs.gg ?? zs.high;
			const bottom = zs.dd ?? zs.low;
			const f = (v) => v.toFixed(2);
			if (pos === "above") return `已上破震荡上沿 GG ${f(top)}：回踩不破 ZG ${f(zs.high)} → 三买成立`;
			if (pos === "below") return `已跌破震荡下沿 DD ${f(bottom)}：反抽不回中枢 → 中枢下移/走势转弱`;
			if (price !== null && price > zs.high) return `中枢上沿区内：放量破 GG ${f(top)} → 三买观察`;
			if (price !== null && price < zs.low) return `中枢下沿区内：跌破 DD ${f(bottom)} → 防中枢下移`;
			return `中枢震荡中：关注 GG ${f(top)} / DD ${f(bottom)} 的突破方向`;
		}
		/** 引擎 type_cn（中文走势名）→ 方向；「多」「空」并存的复合措辞（如「多空分歧」）视为 flat。雷达级别共振与矩阵共用此单源。 */
		function typeCnDir(cn) {
			const up = cn.includes("上涨") || cn.includes("多");
			const down = cn.includes("下跌") || cn.includes("空");
			if (up && !down) return "up";
			if (down && !up) return "down";
			return "flat";
		}
		const clamp100 = (v) => Math.max(0, Math.min(100, v));
		/** 七维合成（详见规格 §4.2，每维 basis 说明计算依据；数据缺失 → null 退出总分）。 */
		function radarDims(payload, matrixRows) {
			const morph = asRec(payload.morphology);
			const trend = asRec(payload.trend_analysis);
			const c = asRec(payload.chart_data);
			const klines = asNum(morph.klines_count) ?? 0;
			const processed = asNum(morph.processed_klines_count) ?? 0;
			const bis = asNum(morph.bis_count) ?? 0;
			const segs = asNum(morph.segs_count) ?? 0;
			const fxs = asNum(morph.fenxings_count) ?? 0;
			const zsList = asArr(c.zhongshu_zones).map(asRec);
			const backchis = asArr(c.backchis).map(asRec);
			const dims = [];
			{
				const a = klines > 0 ? Math.min(1, processed / klines) : 0;
				const b = bis > 0 ? Math.min(1, fxs / (bis * 2)) : 0;
				const d = segs > 0 ? Math.min(1, bis / (segs * 3)) : bis > 0 ? .5 : 0;
				const value = klines > 0 && bis > 0 ? clamp100((a + b + d) / 3 * 100) : null;
				dims.push({
					key: "morph-integrity",
					label: "形态完整度",
					value,
					basis: `处理保留 ${processed}/${klines} · 分型/笔 ${fxs}/${bis} · 笔/段 ${bis}/${segs}`
				});
			}
			{
				const last = zsList.length > 0 ? zsList[zsList.length - 1] : null;
				const stab = last !== null ? asNum(last.stability) : null;
				dims.push({
					key: "zs-stability",
					label: "中枢稳定度",
					value: stab !== null ? clamp100(stab * 100) : null,
					basis: last !== null ? `最新中枢稳定度 ${stab ?? "—"}` : "本级别无中枢数据"
				});
			}
			{
				const strength = asNum(trend.trend_strength);
				dims.push({
					key: "trend-strength",
					label: "走势强度",
					value: strength !== null ? clamp100(strength * 100) : null,
					basis: `trend_strength=${strength ?? "—"}（${asStr(trend.type_cn) || "未判定"}）`
				});
			}
			{
				let adj = 0;
				let count = 0;
				for (const bc of backchis) {
					if (bc.valid !== true) continue;
					count += 1;
					const kind = backchiKind(asStr(bc.backchi_type));
					const div = Math.abs(asNum(bc.macd_divergence) ?? 0);
					const magnitude = Math.min(30, div * 200);
					adj += kind === "top" ? -magnitude : kind === "bottom" ? magnitude : 0;
				}
				dims.push({
					key: "backchi-pressure",
					label: "背驰压力",
					value: count > 0 ? clamp100(50 + adj) : null,
					basis: count > 0 ? `有效背驰 ${count} 处（顶=空方/底=多方），净调整 ${adj.toFixed(0)}` : "无有效背驰"
				});
			}
			{
				const latest = asArr(payload.latest_signals).map(asRec)[0] ?? null;
				const rel = latest !== null ? asNum(latest.reliability) : null;
				dims.push({
					key: "bs-quality",
					label: "买卖点质量",
					value: rel !== null ? clamp100(rel * 100) : null,
					basis: latest !== null ? `最新信号 ${asStr(latest.type)} 可靠度 ${rel ?? "—"}` : "近期无买卖点信号"
				});
			}
			{
				const dirs = matrixRows.filter((r) => r.status === "ok" && r.data !== void 0).map((r) => typeCnDir(asStr(asRec(r.data.trend_analysis).type_cn)));
				const directional = dirs.filter((d) => d !== "flat");
				if (directional.length >= 2) {
					const up = directional.filter((d) => d === "up").length;
					const majority = Math.max(up, directional.length - up);
					dims.push({
						key: "level-resonance",
						label: "级别共振",
						value: clamp100(majority / directional.length * 100),
						basis: `联立 ${directional.length}/${dirs.length} 行有方向，一致率 ${Math.round(majority / directional.length * 100)}%`
					});
				} else dims.push({
					key: "level-resonance",
					label: "级别共振",
					value: null,
					basis: "有方向级别的行不足 2 行"
				});
			}
			{
				const kline = asArr(c.kline).map(asArr);
				const vols = asArr(c.volumes).map((v) => asNum(v) ?? 0);
				const n = Math.min(20, kline.length, vols.length);
				if (n >= 6) {
					let up = 0;
					let down = 0;
					for (let i = kline.length - n; i < kline.length; i += 1) if (Number(kline[i]?.[1] ?? 0) >= Number(kline[i]?.[0] ?? 0)) up += vols[i] ?? 0;
					else down += vols[i] ?? 0;
					const bias = up + down > 0 ? (up - down) / (up + down) : 0;
					dims.push({
						key: "volume-fit",
						label: "量能配合",
						value: clamp100(50 + bias * 80),
						basis: `近 ${n} 根上涨量/下跌量偏移 ${(bias * 100).toFixed(0)}%（正=多头量占优）`
					});
				} else dims.push({
					key: "volume-fit",
					label: "量能配合",
					value: null,
					basis: "K 线/量数据不足"
				});
			}
			return dims;
		}
		function radarSummary(dims) {
			const values = dims.filter((d) => d.value !== null).map((d) => d.value);
			if (values.length === 0) return {
				score: null,
				direction: "neutral"
			};
			const score = values.reduce((a, b) => a + b, 0) / values.length;
			const direction = score >= 55 ? "bullish" : score <= 45 ? "bearish" : "neutral";
			return {
				score: Math.round(score * 10) / 10,
				direction
			};
		}
		/** 引擎买卖点 type（中文 str(BuySellPointType)，如「一类买点」）→ pointWhy/marker 查找键（'1buy' 等）；已是枚举形态时原样小写。 */
		function pointTypeKey(type) {
			const cls = type.includes("一") ? "1" : type.includes("二") ? "2" : type.includes("三") ? "3" : "";
			const side = type.includes("买") ? "buy" : type.includes("卖") ? "sell" : "";
			return cls !== "" && side !== "" ? `${cls}${side}` : type.toLowerCase();
		}
		/** 引擎 zhongshu_type（中文 str(ZhongShuType)，如「扩展中枢」）→ 徽章短标签；英文枚举值兼容。 */
		function zhongshuTypeLabel(raw) {
			if (raw !== void 0) {
				if (raw.includes("扩展") || raw === "extended") return "扩展";
				if (raw.includes("复杂") || raw === "complex") return "复杂";
				if (raw.includes("趋势") || raw === "trend") return "趋势";
				if (raw.includes("盘整") || raw === "consolidation") return "盘整";
			}
			return "普通";
		}
		/** 信号时间戳比较键：数值时间戳优先，其次 Date.parse 可解析字符串，均不可用退 -∞（排序中保持原有相对顺序）。 */
		const stampOf = (r) => {
			const n = asNum(r.timestamp);
			if (n !== null) return n;
			const p = Date.parse(asStr(r.timestamp));
			return Number.isNaN(p) ? -Infinity : p;
		};
		/** 合并买卖两侧按 timestamp 取最近 n 条（新→旧）——「最近 N 条信号」语义，修复拼接尾取导致单侧被淹没。 */
		function latestSignals(payload, n) {
			const dynamics = asRec(payload.dynamics);
			return [...asArr(dynamics.buy_points).map(asRec), ...asArr(dynamics.sell_points).map(asRec)].sort((a, b) => stampOf(b) - stampOf(a)).slice(0, Math.max(0, n));
		}
		/** 买卖点类型 → 缠论定义行（hasBackchi 时附背驰联动提示）。 */
		function pointWhy(pointType, hasBackchi) {
			const t = pointType.toLowerCase();
			const table = {
				"1buy": "下跌趋势 + 底背驰 → 一类买点（趋势力度衰竭的首个反转点）",
				"2buy": "一买后回调不创新低 → 二类买点（反转确认）",
				"3buy": "中枢上沿突破后回踩不回中枢 → 三类买点（中枢结束确认）",
				"1sell": "上涨趋势 + 顶背驰 → 一类卖点（趋势力度衰竭的首个反转点）",
				"2sell": "一卖后反抽不创新高 → 二类卖点（反转确认）",
				"3sell": "中枢下沿跌破后反抽不回中枢 → 三类卖点（中枢结束确认）"
			};
			const base = table[t.split(".")[0] ?? t] ?? table[pointType] ?? "缠论结构条件触发";
			return hasBackchi ? `${base} · 动力确认见背驰卡` : base;
		}
		const countCn = (n) => n <= 0 ? "无" : n === 1 ? "单" : n === 2 ? "两" : `${n}`;
		/** 推导总链：走势结构 → 背驰 → 买卖点 → 操作参考（缺环节以「—」占位）。 */
		function evidenceChain(payload, chart) {
			const trend = asRec(payload.trend_analysis);
			const morph = asRec(payload.morphology);
			const advice = asRec(payload.trading_advice);
			const typeCn = asStr(trend.type_cn);
			const zsCount = asNum(morph.zhongshus_count) ?? 0;
			const segs = [];
			segs.push(typeCn !== "" ? `${typeCn}${countCn(zsCount)}中枢` : "走势未判定");
			const backchis = chart?.backchis ?? [];
			const valid = backchis.filter((bc) => bc.valid);
			if (valid.length > 0) {
				const kind = backchiKind(valid[valid.length - 1].backchiType);
				segs.push(`末段${kind === "top" ? "顶" : kind === "bottom" ? "底" : "盘整"}背驰成立`);
			} else segs.push(backchis.length > 0 ? "背驰未确认" : "暂无背驰");
			const dynamics = asRec(payload.dynamics);
			const buys = asArr(dynamics.buy_points).map(asRec);
			const sells = asArr(dynamics.sell_points).map(asRec);
			const latest = [...buys, ...sells].reduce((acc, r) => acc === null || stampOf(r) > stampOf(acc) ? r : acc, null) ?? asArr(payload.latest_signals).map(asRec)[0] ?? null;
			if (latest !== null) {
				const higher = latest.confirmed_by_higher === true;
				segs.push(`${asStr(latest.type) || "信号"}${higher ? "·高级别✓" : "·待高级别确认"}`);
			} else segs.push("无买卖点");
			const action = asStr(advice.recommended_action);
			segs.push(action !== "" ? `参考：${action}` : "—");
			return segs;
		}
		//#endregion
		//#region src/client/chart.tsx
		/**
		* 缠论主图：K 线 + 笔/段/中枢/买卖点/背驰罩 + 量/MACD 副图。
		* 迁移自 page.tsx 并增强：顶部信息条（现价/涨跌/走势/中枢位置徽章）、
		* 买卖点可靠度环、卡片联动脉冲高亮、hover 结构上下文。
		* 交互保留：滚轮缩放（鼠标锚点）/ 拖拽平移 / 双击复位 / 十字线读值。
		*/
		const W = 720;
		const H_MAIN = 300;
		const H_VOL = 56;
		const PAD_L = 54;
		const PAD_R = 14;
		const H_MACD = 62;
		const H_TOTAL = 450;
		function ChanChart({ chart, payload, view, onViewChange, highlight }) {
			const { dates, kline, volumes } = chart;
			const total = dates.length;
			const svgRef = (0, react.useRef)(null);
			const setView = onViewChange;
			const [hover, setHover] = (0, react.useState)(null);
			const dragRef = (0, react.useRef)(null);
			const [dragging, setDragging] = (0, react.useState)(false);
			const clampView = (start, count) => {
				const c = Math.max(15, Math.min(total, Math.round(count)));
				return {
					start: Math.max(0, Math.min(total - c, Math.round(start))),
					count: c
				};
			};
			(0, react.useEffect)(() => {
				const el = svgRef.current;
				if (el === null) return;
				const onWheel = (event) => {
					event.preventDefault();
					const rect = el.getBoundingClientRect();
					if (rect.width === 0) return;
					const vx = (event.clientX - rect.left) / rect.width * W;
					const ratio = Math.max(0, Math.min(1, (vx - PAD_L) / (W - PAD_L - PAD_R)));
					setView((current) => {
						const anchor = current.start + ratio * current.count;
						const factor = event.deltaY < 0 ? 1 / 1.18 : 1.18;
						const newCount = current.count * factor;
						return clampView(anchor - ratio * newCount, newCount);
					});
				};
				el.addEventListener("wheel", onWheel, { passive: false });
				return () => {
					el.removeEventListener("wheel", onWheel);
				};
			}, [total, onViewChange]);
			const slot = (W - PAD_L - PAD_R) / view.count;
			const winEnd = view.start + view.count;
			const x = (index) => PAD_L + (index - view.start + .5) * slot;
			const dateIndex = dateIndexOf(dates);
			const indexOfTime = (time) => resolveIndex(dateIndex, time);
			const visK = kline.slice(view.start, winEnd);
			const zsVis = chart.zhongshus.filter((z) => {
				const i1 = indexOfTime(z.start_time);
				return indexOfTime(z.end_time) >= view.start && i1 <= winEnd;
			});
			const lows = visK.map((k) => k[2]).concat(zsVis.map((z) => z.low));
			const highs = visK.map((k) => k[3]).concat(zsVis.map((z) => z.high));
			const pMin = Math.min(...lows);
			const pSpan = Math.max(...highs) - pMin || 1;
			const vMax = Math.max(...volumes.slice(view.start, winEnd), 1);
			const yMain = (price) => 12 + (1 - (price - pMin) / pSpan) * (H_MAIN - 26);
			const yVol = (volume) => 304 + (1 - volume / vMax) * (H_VOL - 10);
			const vxOf = (event) => {
				const rect = svgRef.current?.getBoundingClientRect();
				if (rect === void 0 || rect.width === 0) return -1;
				return (event.clientX - rect.left) / rect.width * W;
			};
			const onPointerDown = (event) => {
				const vx = vxOf(event);
				if (vx < PAD_L) return;
				dragRef.current = {
					x: vx,
					start: view.start
				};
				setDragging(true);
				event.currentTarget.setPointerCapture(event.pointerId);
			};
			const onPointerMove = (event) => {
				const vx = vxOf(event);
				if (vx < 0) return;
				if (dragRef.current !== null) {
					const deltaIdx = -(vx - dragRef.current.x) / slot;
					setView(clampView(dragRef.current.start + deltaIdx, view.count));
					return;
				}
				const index = Math.floor((vx - PAD_L) / slot) + view.start;
				setHover(index >= view.start && index < winEnd ? index : null);
			};
			const endDrag = () => {
				dragRef.current = null;
				setDragging(false);
			};
			const hoverK = hover !== null ? kline[hover] ?? null : null;
			const hoverOpen = hoverK?.[0];
			const hoverClose = hoverK?.[1];
			const hoverPct = hoverOpen !== void 0 && hoverOpen > 0 && hoverClose !== void 0 ? (hoverClose - hoverOpen) / hoverOpen * 100 : null;
			const trend = asRec(payload.trend_analysis);
			const lastClose = kline.length > 0 ? kline[kline.length - 1][1] : null;
			const prevClose = kline.length > 1 ? kline[kline.length - 2][1] : null;
			const lastPct = lastClose !== null && prevClose !== null && prevClose > 0 ? (lastClose - prevClose) / prevClose * 100 : null;
			const lastZs = chart.zhongshus.length > 0 ? chart.zhongshus[chart.zhongshus.length - 1] : null;
			const zsPos = lastZs !== null ? zhongshuPosition(lastClose, lastZs) : null;
			const hoverContext = hover !== null ? (() => {
				const parts = [];
				const fx = chart.fenxings.find((f) => indexOfTime(f.time) === hover);
				if (fx !== void 0) parts.push(fx.fenxingType === "top" ? "顶分型" : "底分型");
				if (chart.biLines.some((b) => indexOfTime(b.end_time) === hover)) parts.push("笔端点");
				const mk = chart.markers.find((m) => indexOfTime(m.time) === hover);
				if (mk !== void 0) parts.push(`${mk.label ?? mk.type ?? "信号"}`);
				if (chart.zhongshus.some((z) => {
					const i1 = indexOfTime(z.start_time);
					const i2 = indexOfTime(z.end_time);
					return hover >= i1 && hover <= i2;
				})) parts.push("中枢内");
				return parts;
			})() : [];
			const hlClass = (kind, id) => highlight !== null && highlight.kind === kind && highlight.id === id ? "ksq-chanx-hl" : "";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-chanx-chartcol",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ksq-chanx-infobar",
					children: [
						lastClose !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
							className: lastPct !== null && lastPct >= 0 ? "ksq-chanx-up" : "ksq-chanx-down",
							children: lastClose.toFixed(2)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: lastPct !== null && lastPct >= 0 ? "ksq-chanx-up" : "ksq-chanx-down",
							children: lastPct !== null ? `${lastPct >= 0 ? "+" : ""}${lastPct.toFixed(2)}%` : ""
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "ksq-chanx-badge",
							children: asStr(trend.type_cn) || "走势未判定"
						}),
						zsPos !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: `ksq-chanx-badge ${zsPos === "above" ? "up" : zsPos === "below" ? "down" : ""}`,
							children: ["中枢", zsPos === "above" ? "上方" : zsPos === "below" ? "下方" : "震荡中"]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "ksq-item-meta",
							children: [
								asStr(payload.stock_name),
								" ",
								asStr(payload.stock_code),
								" · ",
								asStr(payload.time_level)
							]
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					ref: svgRef,
					viewBox: `0 0 ${W} ${H_TOTAL}`,
					role: "img",
					"aria-label": "缠论 K 线结构图",
					style: {
						cursor: dragging ? "grabbing" : "crosshair",
						touchAction: "none"
					},
					onPointerDown,
					onPointerMove,
					onPointerUp: endDrag,
					onPointerLeave: () => {
						endDrag();
						setHover(null);
					},
					onDoubleClick: () => {
						setView({
							start: 0,
							count: total
						});
						setHover(null);
					},
					children: [
						[
							0,
							.25,
							.5,
							.75,
							1
						].map((ratio) => {
							const price = pMin + pSpan * (1 - ratio);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
								x1: PAD_L,
								y1: yMain(price),
								x2: W - PAD_R,
								y2: yMain(price),
								stroke: "var(--dsw-alias-border-l3)",
								strokeDasharray: "2,4"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
								x: PAD_L - 6,
								y: yMain(price) + 3,
								fontSize: "10",
								textAnchor: "end",
								fill: "var(--dsw-alias-label-tertiary)",
								children: price.toFixed(2)
							})] }, `grid-${ratio}`);
						}),
						chart.backchis.map((bc, i) => {
							const x1 = indexOfTime(bc.previousStart);
							const x2 = indexOfTime(bc.currentEnd);
							if (x1 < 0 || x2 < x1 || x2 < view.start || x1 > winEnd) return null;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
								className: hlClass("backchi", i),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									x: x(x1) - slot / 2,
									y: 10,
									width: (x2 - x1 + 1) * slot,
									height: H_MAIN - 20,
									fill: bc.valid ? "url(#ksq-chanx-bcshade)" : "rgba(230,70,70,0.04)",
									stroke: bc.valid ? "#e64646" : "var(--dsw-alias-border-l2)",
									strokeWidth: "0.8",
									strokeDasharray: "3,4"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
									x: Math.max(56, x(x1) + 3),
									y: 22,
									fontSize: "9.5",
									fill: bc.valid ? "#e64646" : "var(--dsw-alias-label-tertiary)",
									children: bc.valid ? "背驰段对比" : "背驰未确认"
								})]
							}, `bc-${i}`);
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("defs", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("linearGradient", {
							id: "ksq-chanx-bcshade",
							x1: "0",
							y1: "0",
							x2: "0",
							y2: "1",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
								offset: "0%",
								stopColor: "rgba(230,70,70,0.16)"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
								offset: "100%",
								stopColor: "rgba(230,70,70,0.05)"
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("linearGradient", {
							id: "ksq-chanx-zsshade",
							x1: "0",
							y1: "0",
							x2: "0",
							y2: "1",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
								offset: "0%",
								stopColor: "rgba(199,146,234,0.20)"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
								offset: "100%",
								stopColor: "rgba(199,146,234,0.08)"
							})]
						})] }),
						chart.zhongshus.map((zone, i) => {
							const x1 = indexOfTime(zone.start_time);
							const x2 = indexOfTime(zone.end_time);
							if (x1 < 0 || x2 < x1 || x2 < view.start || x1 > winEnd) return null;
							const zoneW = (x2 - x1 + 1) * slot;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
								className: hlClass("zhongshu", i),
								children: [
									zone.gg !== void 0 && zone.dd !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
										x: x(x1) - slot / 2,
										y: yMain(zone.gg),
										width: zoneW,
										height: Math.max(2, yMain(zone.dd) - yMain(zone.gg)),
										fill: "none",
										stroke: "#c792ea",
										strokeWidth: "0.7",
										strokeDasharray: "2,4",
										opacity: "0.65"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
										x: x(x1) - slot / 2,
										y: yMain(zone.high),
										width: zoneW,
										height: Math.max(2, yMain(zone.low) - yMain(zone.high)),
										fill: "url(#ksq-chanx-zsshade)",
										stroke: "#c792ea",
										strokeDasharray: "4,3",
										rx: "2"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
										x1: x(x1) - slot / 2,
										y1: yMain(zone.center),
										x2: x(x2) + slot / 2,
										y2: yMain(zone.center),
										stroke: "#c792ea",
										strokeWidth: "1",
										strokeDasharray: "2,3"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
										x: Math.max(56, x(x1) + 2),
										y: yMain(zone.high) - 3,
										fontSize: "9.5",
										fill: "#c792ea",
										children: [
											"中枢 ",
											zone.low.toFixed(2),
											"~",
											zone.high.toFixed(2),
											zone.extendCount !== void 0 && zone.extendCount > 0 ? ` ·延伸${zone.extendCount}` : "",
											zone.stability !== void 0 ? ` ·稳定${zone.stability.toFixed(2)}` : ""
										]
									})
								]
							}, `zs-${i}`);
						}),
						visK.map((k, offset) => {
							const index = view.start + offset;
							const color = k[1] >= k[0] ? "#e05656" : "#2f9e77";
							const cx = x(index);
							const bodyTop = yMain(Math.max(k[0], k[1]));
							const bodyBottom = yMain(Math.min(k[0], k[1]));
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
								x1: cx,
								y1: yMain(k[3]),
								x2: cx,
								y2: yMain(k[2]),
								stroke: color,
								strokeWidth: Math.max(.6, slot * .12)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
								x: cx - Math.max(.8, slot * .32),
								y: bodyTop,
								width: Math.max(1.6, slot * .64),
								height: Math.max(1, bodyBottom - bodyTop),
								fill: color,
								opacity: hover === index ? 1 : .88
							})] }, `k-${index}`);
						}),
						chart.biLines.map((bi, i) => {
							const x1 = indexOfTime(bi.start_time);
							const x2 = indexOfTime(bi.end_time);
							if (x1 < 0 || x2 < 0 || x2 < view.start || x1 > winEnd) return null;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
								x1: x(x1),
								y1: yMain(bi.start_price),
								x2: x(x2),
								y2: yMain(bi.end_price),
								stroke: "#e8a33d",
								strokeWidth: "1.6",
								opacity: "0.85"
							}, `bi-${i}`);
						}),
						chart.segLines.map((seg, i) => {
							const x1 = indexOfTime(seg.start_time);
							const x2 = indexOfTime(seg.end_time);
							if (x1 < 0 || x2 < 0 || x2 < view.start || x1 > winEnd) return null;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
								x1: x(x1),
								y1: yMain(seg.start_price),
								x2: x(x2),
								y2: yMain(seg.end_price),
								stroke: "#5ab0ff",
								strokeWidth: "2.2",
								strokeDasharray: "7,4",
								opacity: "0.9"
							}, `seg-${i}`);
						}),
						chart.fenxings.map((fx, i) => {
							const index = indexOfTime(fx.time);
							if (index < 0 || index < view.start || index >= winEnd) return null;
							const isTop = fx.fenxingType === "top";
							const py = isTop ? yMain(chart.kline[index]?.[3] ?? fx.price) : yMain(chart.kline[index]?.[2] ?? fx.price);
							const dir = isTop ? 1 : -1;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
								opacity: view.count > 60 ? .45 : .9,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
									d: `M${x(index)},${py - dir * 5} l-4,${dir * 6} l8,0 Z`,
									fill: isTop ? "#e64646" : "#2f9e77"
								})
							}, `fx-${i}`);
						}),
						chart.markers.map((marker, i) => {
							const index = indexOfTime(marker.time);
							if (index < 0 || index < view.start || index >= winEnd) return null;
							const raw = marker.label ?? marker.type ?? "?";
							const isBuy = raw.toUpperCase().includes("BUY") || raw.includes("买");
							const cls = raw.match(/[123]/)?.[0] ?? "?";
							const label = `${isBuy ? "B" : "S"}${cls}`;
							const color = isBuy ? cls === "3" ? "#22a06b" : "#31c7a2" : cls === "3" ? "#c74040" : "#e64646";
							const rel = marker.reliability ?? null;
							const ringR = 11;
							const circ = 2 * Math.PI * ringR;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
								className: hlClass("point", i),
								children: [
									rel !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
										cx: x(index),
										cy: yMain(marker.price),
										r: ringR,
										fill: "none",
										stroke: color,
										strokeWidth: "1.6",
										strokeDasharray: `${(Math.max(0, Math.min(1, rel)) * circ).toFixed(1)} ${circ.toFixed(1)}`,
										transform: `rotate(-90 ${x(index)} ${yMain(marker.price)})`,
										opacity: "0.9"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
										cx: x(index),
										cy: yMain(marker.price),
										r: "8",
										fill: color,
										opacity: "0.95",
										stroke: "#fff",
										strokeWidth: "1"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
										x: x(index),
										y: yMain(marker.price) + 3,
										fontSize: "8.5",
										textAnchor: "middle",
										fill: "#fff",
										fontWeight: "700",
										children: label
									})
								]
							}, `mk-${i}`);
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
							x1: PAD_L,
							y1: 304,
							x2: W - PAD_R,
							y2: 304,
							stroke: "var(--dsw-alias-border-l3)"
						}),
						visK.map((k, offset) => {
							const volume = volumes[view.start + offset] ?? 0;
							const up = k[1] >= k[0];
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
								x: x(view.start + offset) - Math.max(.8, slot * .32),
								y: yVol(volume),
								width: Math.max(1.6, slot * .64),
								height: 350 - yVol(volume),
								fill: up ? "#e05656" : "#2f9e77",
								opacity: "0.55"
							}, `v-${view.start + offset}`);
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
							x: PAD_L - 6,
							y: 314,
							fontSize: "9",
							textAnchor: "end",
							fill: "var(--dsw-alias-label-tertiary)",
							children: "量"
						}),
						(() => {
							const yMacdTop = 362;
							const hMacd = H_MACD - 12;
							const windowHist = chart.macd.hist.slice(view.start, winEnd).map((v) => v ?? 0);
							const windowDif = chart.macd.dif.slice(view.start, winEnd).map((v) => v ?? 0);
							const windowDea = chart.macd.dea.slice(view.start, winEnd).map((v) => v ?? 0);
							const mAbs = Math.max(...windowHist, ...windowDif, ...windowDea, 1e-4);
							const yM = (value) => 387 - value / mAbs * (hMacd / 2 - 2);
							const zeroY = yM(0);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									x1: PAD_L,
									y1: yMacdTop - 2,
									x2: W - PAD_R,
									y2: yMacdTop - 2,
									stroke: "var(--dsw-alias-border-l3)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									x1: PAD_L,
									y1: zeroY,
									x2: W - PAD_R,
									y2: zeroY,
									stroke: "var(--dsw-alias-border-l2)",
									strokeDasharray: "2,3"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
									x: PAD_L - 6,
									y: zeroY + 3,
									fontSize: "9",
									textAnchor: "end",
									fill: "var(--dsw-alias-label-tertiary)",
									children: "0"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
									x: PAD_L - 6,
									y: 370,
									fontSize: "9",
									textAnchor: "end",
									fill: "var(--dsw-alias-label-tertiary)",
									children: mAbs.toFixed(2)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
									x: PAD_L - 6,
									y: 412,
									fontSize: "9",
									textAnchor: "end",
									fill: "var(--dsw-alias-label-tertiary)",
									children: ["-", mAbs.toFixed(2)]
								}),
								windowHist.map((value, offset) => {
									const index = view.start + offset;
									const h = Math.abs(yM(value) - zeroY);
									return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
										x: x(index) - Math.max(.8, slot * .3),
										y: value >= 0 ? zeroY - h : zeroY,
										width: Math.max(1.6, slot * .6),
										height: Math.max(.6, h),
										fill: value >= 0 ? "#e05656" : "#2f9e77",
										opacity: "0.6"
									}, `mh-${index}`);
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", {
									points: windowDif.map((value, offset) => `${x(view.start + offset)},${yM(value)}`).join(" "),
									fill: "none",
									stroke: "#e8a33d",
									strokeWidth: "1.1"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", {
									points: windowDea.map((value, offset) => `${x(view.start + offset)},${yM(value)}`).join(" "),
									fill: "none",
									stroke: "#5ab0ff",
									strokeWidth: "1.1"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
									x: 56,
									y: 372,
									fontSize: "9",
									fill: "#e8a33d",
									children: "DIF"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
									x: 78,
									y: 372,
									fontSize: "9",
									fill: "#5ab0ff",
									children: "DEA"
								})
							] });
						})(),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
							fontSize: "9.5",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
									x: PAD_L,
									y: H_TOTAL - 4,
									fill: "var(--dsw-alias-label-tertiary)",
									children: "红涨绿跌 ·"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									x1: 100,
									y1: H_TOTAL - 7,
									x2: 120,
									y2: H_TOTAL - 7,
									stroke: "#e8a33d",
									strokeWidth: "1.6"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
									x: 124,
									y: H_TOTAL - 4,
									fill: "var(--dsw-alias-label-tertiary)",
									children: "笔 ·"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									x1: 144,
									y1: H_TOTAL - 7,
									x2: 164,
									y2: H_TOTAL - 7,
									stroke: "#5ab0ff",
									strokeWidth: "2",
									strokeDasharray: "6,3"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
									x: 168,
									y: H_TOTAL - 4,
									fill: "var(--dsw-alias-label-tertiary)",
									children: "线段 ·"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
									x: 196,
									y: H_TOTAL - 12,
									width: "14",
									height: "8",
									fill: "rgba(199,146,234,0.2)",
									stroke: "#c792ea",
									strokeDasharray: "3,2"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
									x: 214,
									y: H_TOTAL - 4,
									fill: "var(--dsw-alias-label-tertiary)",
									children: "中枢 · 滚轮缩放 · 拖拽平移 · 双击复位"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
									x: W - PAD_R,
									y: H_TOTAL - 4,
									fontSize: "9",
									textAnchor: "end",
									fill: "var(--dsw-alias-label-tertiary)",
									children: [
										view.start + 1,
										"-",
										winEnd,
										"/",
										total
									]
								})
							]
						}),
						hover !== null && hoverOpen !== void 0 && hoverClose !== void 0 && hoverK !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
							pointerEvents: "none",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									x1: x(hover),
									y1: 8,
									x2: x(hover),
									y2: 352,
									stroke: "var(--dsw-alias-border-l2)"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									cx: x(hover),
									cy: yMain(hoverK[3] ?? hoverClose),
									r: "2.5",
									fill: "#e8edef"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
										x: W - 218,
										y: 8,
										width: "204",
										height: 58 + (hoverContext.length > 0 ? 14 : 0),
										rx: "4",
										fill: "rgba(3,13,11,0.84)"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
										x: W - 210,
										y: 22,
										fontSize: "10.5",
										fill: "#e8edef",
										children: dates[hover]?.slice(0, 10) ?? ""
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
										x: W - 210,
										y: 36,
										fontSize: "10",
										fill: "#e8edef",
										children: [
											"开 ",
											hoverOpen.toFixed(2),
											" 收 ",
											hoverClose.toFixed(2)
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
										x: W - 210,
										y: 49,
										fontSize: "10",
										fill: "#e8edef",
										children: [
											"低 ",
											hoverK[2]?.toFixed(2) ?? "—",
											" 高 ",
											hoverK[3]?.toFixed(2) ?? "—"
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
										x: W - 210,
										y: 61,
										fontSize: "10",
										fill: hoverPct !== null && hoverPct >= 0 ? "#e05656" : "#2f9e77",
										children: [
											"涨跌 ",
											hoverPct !== null ? `${hoverPct >= 0 ? "+" : ""}${hoverPct.toFixed(2)}%` : "—",
											" · 量 ",
											((volumes[hover] ?? 0) / 1e4).toFixed(1),
											"万手"
										]
									}),
									hoverContext.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("text", {
										x: W - 210,
										y: 74,
										fontSize: "9.5",
										fill: "#e8a33d",
										children: ["结构：", hoverContext.join(" · ")]
									})
								] })
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/evidence.tsx
		/**
		* 中栏「动力学×形态学」证据链：推导总链 + 背驰判定卡 + 买卖点证据链卡
		* + 中枢演化卡。全部可点击 → 主图定位并脉冲高亮（onFocus 回调上抛）。
		*/
		const backchiTypeCn = (raw) => {
			const kind = backchiKind(raw);
			if (kind === "top") return "顶背驰";
			if (kind === "bottom") return "底背驰";
			return "盘整背驰";
		};
		/** ⓪ 推导总链：segments 用 → 串起的一句话推理（derive.evidenceChain 产出）。 */
		function ChainStrip({ segments }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "ksq-chanx-chain",
				children: segments.map((seg, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "ksq-chanx-chain-node",
					children: [i > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", {
						"aria-hidden": true,
						children: "→"
					}), seg]
				}, i))
			});
		}
		/** ① 背驰判定卡：MACD 面积对比条 + 价格关系 + 结论徽章。 */
		function BackchiCard({ chart, onFocus }) {
			if (chart === null) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-chanx-card",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ksq-chanx-card-hd",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "① 背驰判定" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "ksq-item-meta",
						children: "动力学 · MACD 力度对比"
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "ksq-item-meta",
					children: "图表数据未就绪。"
				})]
			});
			const di = dateIndexOf(chart.dates);
			const items = chart.backchis.map((bc, i) => ({
				bc,
				i
			})).sort((a, b) => a.bc.valid === b.bc.valid ? a.i - b.i : a.bc.valid ? -1 : 1);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-chanx-card",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-chanx-card-hd",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "① 背驰判定" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "ksq-item-meta",
							children: "动力学 · MACD 力度对比"
						})]
					}),
					items.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "ksq-item-meta",
						children: "本级别暂无背驰记录（未出现可比较的同向段）。"
					}),
					items.map(({ bc, i }) => {
						const prevArea = bc.previousMacdArea ?? null;
						const curArea = bc.currentMacdArea ?? null;
						const max = Math.max(prevArea ?? 0, curArea ?? 0, 1e-4);
						const rel = backchiPriceRelation(chart, di, bc);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: `ksq-chanx-bcrow${bc.valid ? " valid" : ""}`,
							onClick: () => {
								const s = Math.max(0, resolveIndex(di, bc.previousStart));
								const e0 = resolveIndex(di, bc.currentEnd);
								onFocus({
									startIdx: s,
									endIdx: e0 >= 0 ? e0 : chart.dates.length - 1,
									hl: {
										kind: "backchi",
										id: i
									}
								});
							},
							title: `定位 ${bc.previousStart.slice(0, 10)} ~ ${bc.currentEnd.slice(0, 10)}`,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-chanx-bcrow-hd",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: `ksq-chanx-badge ${bc.valid ? backchiKind(bc.backchiType) === "top" ? "down" : "up" : ""}`,
										children: [
											backchiTypeCn(bc.backchiType),
											" · ",
											bc.valid ? "成立" : "未确认"
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "ksq-item-meta ksq-mono",
										children: bc.currentEnd.slice(0, 10)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-chanx-areabars",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "ksq-item-meta",
											children: "前段"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "ksq-chanx-bar",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: {
												width: `${(prevArea ?? 0) / max * 100}%`,
												background: "var(--dsw-alias-border-l2)"
											} })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
											className: "ksq-mono",
											children: prevArea !== null ? prevArea.toFixed(3) : "—"
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-chanx-areabars",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "ksq-item-meta",
											children: "现段"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "ksq-chanx-bar",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: {
												width: `${(curArea ?? 0) / max * 100}%`,
												background: "#e05656"
											} })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
											className: "ksq-mono",
											children: curArea !== null ? curArea.toFixed(3) : "—"
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-chanx-bcrow-ft",
									children: [bc.macdDivergence !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "ksq-item-meta",
										children: ["力度差 ", bc.macdDivergence.toFixed(3)]
									}), rel !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "ksq-item-meta",
										children: ["价格 ", rel.kind === "top" ? `${rel.prevHigh.toFixed(2)}→${rel.curHigh.toFixed(2)}${rel.newExtreme ? " 新高" : " 未新高"}` : rel.kind === "bottom" ? `${rel.prevLow.toFixed(2)}→${rel.curLow.toFixed(2)}${rel.newExtreme ? " 新低" : " 未新低"}` : "盘整区间对照"]
									})]
								})
							]
						}, i);
					})
				]
			});
		}
		/** ② 买卖点证据链卡：类型 + 可靠度条 + 级别确认 + 「为什么」定义行。 */
		function BSPointsCard({ payload, chart, onFocus }) {
			const di = chart !== null ? dateIndexOf(chart.dates) : null;
			const hasValidBackchi = (chart?.backchis ?? []).some((bc) => bc.valid);
			/** 动力学 type（中文「一类买点」/枚举 '1buy'）→ 图上 marker 索引（label=BUY_1 形态），找不到返回 -1。 */
			const markerIndexOf = (type, time) => {
				const m = /^(\d)(buy|sell)$/.exec(pointTypeKey(type));
				if (m === null) return -1;
				const side = m[2] === "buy" ? "BUY" : "SELL";
				return chart?.markers.findIndex((mk) => (mk.label ?? "").toUpperCase() === `${side}_${m[1]}` && mk.time.slice(0, 10) === time.slice(0, 10)) ?? -1;
			};
			const rows = latestSignals(payload, 6);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-chanx-card",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-chanx-card-hd",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "② 买卖点证据链" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "ksq-item-meta",
							children: "形态 × 动力联立"
						})]
					}),
					rows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "ksq-item-meta",
						children: "当前级别无买卖点信号。"
					}),
					rows.map((r) => {
						const time = asStr(r.timestamp);
						const price = asNum(r.price);
						const rel = asNum(r.reliability);
						const type = asStr(r.type);
						const isBuy = type.includes("buy") || type.includes("买");
						const idx = di !== null ? resolveIndex(di, time) : -1;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "ksq-chanx-bsrow",
							disabled: idx < 0,
							onClick: () => {
								if (idx >= 0) onFocus({
									startIdx: idx,
									endIdx: idx,
									hl: {
										kind: "point",
										id: markerIndexOf(type, time)
									}
								});
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-chanx-bsrow-hd",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: `ksq-chanx-badge ${isBuy ? "up" : "down"}`,
											children: type || "信号"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
											className: "ksq-mono",
											children: price !== null ? price.toFixed(2) : "—"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "ksq-item-meta ksq-mono",
											children: time.slice(0, 10)
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-chanx-relbar",
									title: `可靠度 ${rel ?? "—"}`,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "ksq-item-meta",
											children: "可靠度"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "ksq-chanx-bar",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: {
												width: `${(rel ?? 0) * 100}%`,
												background: isBuy ? "#31c7a2" : "#e64646"
											} })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
											className: "ksq-mono",
											children: rel !== null ? rel.toFixed(2) : "—"
										}),
										r.confirmed_by_higher === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "ksq-chanx-ok",
											title: "高级别确认",
											children: "高✓"
										}),
										r.confirmed_by_lower === true && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "ksq-chanx-ok",
											title: "低级别确认",
											children: "低✓"
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ksq-chanx-why",
									children: pointWhy(pointTypeKey(type), hasValidBackchi)
								})
							]
						}, `${time}-${type}`);
					})
				]
			});
		}
		/** ③ 中枢演化卡：类型/区间/延伸/稳定度 + 现价位置 + 推演。 */
		function ZhongshuCard({ chart, payload, onFocus }) {
			if (chart === null || chart.zhongshus.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-chanx-card",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ksq-chanx-card-hd",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "③ 中枢演化" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "ksq-item-meta",
						children: "形态学"
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: "ksq-item-meta",
					children: "本级别暂无中枢（笔/段尚未构成三段重叠区间）。"
				})]
			});
			const di = dateIndexOf(chart.dates);
			const zones = chart.zhongshus.slice(-2).reverse();
			const lastClose = chart.kline.length > 0 ? chart.kline[chart.kline.length - 1][1] : null;
			const trendCn = asStr(asRec(payload.trend_analysis).type_cn);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-chanx-card",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ksq-chanx-card-hd",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "③ 中枢演化" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "ksq-item-meta",
						children: trendCn || "形态学"
					})]
				}), zones.map((zs, i) => {
					const absIdx = chart.zhongshus.length - 1 - i;
					const pos = zhongshuPosition(lastClose, zs);
					const s = Math.max(0, resolveIndex(di, zs.start_time));
					const e0 = resolveIndex(di, zs.end_time);
					const e = e0 >= 0 ? e0 : chart.dates.length - 1;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "ksq-chanx-zsrow",
						onClick: () => onFocus({
							startIdx: s,
							endIdx: e,
							hl: {
								kind: "zhongshu",
								id: absIdx
							}
						}),
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ksq-chanx-bsrow-hd",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "ksq-chanx-badge zs",
									children: [
										zhongshuTypeLabel(zs.zhongshuType),
										"中枢",
										zs.extendCount !== void 0 && zs.extendCount > 0 ? ` ·延伸${zs.extendCount}` : ""
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("b", {
									className: "ksq-mono",
									children: [
										zs.low.toFixed(2),
										"~",
										zs.high.toFixed(2)
									]
								})]
							}),
							zs.stability !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ksq-chanx-relbar",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "ksq-item-meta",
										children: "稳定度"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "ksq-chanx-bar",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: {
											width: `${zs.stability * 100}%`,
											background: "#c792ea"
										} })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
										className: "ksq-mono",
										children: zs.stability.toFixed(2)
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "ksq-chanx-zspos",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: `ksq-chanx-badge ${pos === "above" ? "up" : pos === "below" ? "down" : ""}`,
									children: [
										"现价 ",
										lastClose !== null ? lastClose.toFixed(2) : "—",
										" · ",
										pos === "above" ? "中枢上方" : pos === "below" ? "中枢下方" : "震荡带内"
									]
								})
							}),
							absIdx === chart.zhongshus.length - 1 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "ksq-chanx-why",
								children: zhongshuForecast(lastClose, zs)
							})
						]
					}, absIdx);
				})]
			});
		}
		//#endregion
		//#region src/client/status.tsx
		/**
		* 右栏状态：缠论原生七维雷达（替换 czsc 七类）+ 多级别联立矩阵 +
		* 关键位/综合评估 + 折叠的信号明细 chips。
		*/
		/** 缠论原生雷达：七边形 + 维度值列表（title 悬浮显示计算依据）。 */
		function ChanRadar({ dims, summary }) {
			const cx = 78, cy = 72, r = 52;
			const angle = (i) => Math.PI * 2 * i / dims.length - Math.PI / 2;
			const point = (i, value) => [cx + Math.cos(angle(i)) * r * value, cy + Math.sin(angle(i)) * r * value];
			const polygon = dims.map((d, i) => point(i, d.value !== null ? Math.min(1, Math.max(.04, d.value / 100)) : .04).join(",")).join(" ");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-chanx-radarblock",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 156 144",
					role: "img",
					"aria-label": "缠论雷达",
					className: "ksq-chanx-radarsvg",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("title", { children: `缠论雷达 ${summary.score ?? "—"} 分（${summary.direction === "bullish" ? "偏多" : summary.direction === "bearish" ? "偏空" : "中性"}）` }),
						[
							.25,
							.5,
							.75,
							1
						].map((ring) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("polygon", {
							points: dims.map((_, i) => point(i, ring).join(",")).join(" "),
							fill: "none",
							stroke: "var(--dsw-alias-border-l3)",
							strokeWidth: "0.6"
						}, ring)),
						dims.map((d, i) => {
							const [px, py] = point(i, 1);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
								x1: cx,
								y1: cy,
								x2: px,
								y2: py,
								stroke: "var(--dsw-alias-border-l3)",
								strokeWidth: "0.6"
							}, d.key);
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polygon", {
							points: polygon,
							fill: "rgba(232,163,61,0.28)",
							stroke: "#e8a33d",
							strokeWidth: "1.4"
						}),
						dims.map((d, i) => {
							const [px, py] = point(i, 1.15);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
								x: px,
								y: py + 3,
								fontSize: "8.5",
								textAnchor: "middle",
								fill: d.value === null ? "var(--dsw-alias-label-tertiary)" : "var(--dsw-alias-label-secondary)",
								opacity: d.value === null ? .55 : 1,
								children: d.label
							}, `l-${d.key}`);
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ksq-chanx-radar-meta",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", {
							className: summary.direction === "bullish" ? "ksq-up" : summary.direction === "bearish" ? "ksq-down" : "",
							children: [
								summary.score !== null ? summary.score.toFixed(1) : "—",
								" 分 · ",
								summary.direction === "bullish" ? "偏多" : summary.direction === "bearish" ? "偏空" : "中性"
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: "ksq-chanx-dims",
							children: dims.map((d) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
								title: d.basis,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: d.label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
									className: d.value === null ? "" : d.value >= 55 ? "ksq-up" : d.value <= 45 ? "ksq-down" : "",
									children: d.value !== null ? d.value.toFixed(0) : "—"
								})]
							}, d.key))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "ksq-item-meta",
							children: "悬浮维度看计算依据；缺维退出总分"
						})
					]
				})]
			});
		}
		const dirCn = (data) => {
			const cn = asStr(asRec(data.trend_analysis).type_cn);
			const dir = typeCnDir(cn);
			return {
				cn: cn !== "" ? cn : "未判定",
				dir
			};
		};
		/** 多级别联立矩阵：四行级别 × 方向/买卖点/得分/背驰，多数方向高亮共振。 */
		function LevelMatrix({ rows }) {
			const dirs = rows.filter((r) => r.status === "ok" && r.data !== void 0).map((r) => dirCn(r.data).dir).filter((d) => d !== "flat");
			const up = dirs.filter((d) => d === "up").length;
			const down = dirs.length - up;
			const majority = dirs.length >= 2 ? up > down ? "up" : down > up ? "down" : null : null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-chanx-card",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-chanx-card-hd",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "多级别联立" }), majority !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: `ksq-chanx-badge ${majority === "up" ? "up" : "down"}`,
							children: ["共振", majority === "up" ? "偏多" : "偏空"]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
						className: "ksq-chanx-matrix",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "级别" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "方向" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "买卖点" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "分" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "背驰" })
						] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: rows.map((row) => {
							const current = row.current === true;
							if (row.status !== "ok" || row.data === void 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
								className: current ? "cur" : "",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [row.level, current ? " *" : ""] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									colSpan: 4,
									className: "ksq-item-meta",
									children: row.status === "loading" ? "加载中…" : row.status === "error" ? "加载失败" : "数据不足"
								})]
							}, row.level);
							const d = row.data;
							const { cn, dir } = dirCn(d);
							const dynamics = asRec(d.dynamics);
							const latestPoint = latestSignals(d, 1)[0];
							const score = asNum(asRec(d.signal_scores).final_score);
							const backchi = asNum(dynamics.backchi_count);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
								className: `${current ? "cur" : ""} ${majority !== null && dir === majority ? majority === "up" ? "res-up" : "res-down" : ""}`,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [row.level, current ? " *" : ""] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: dir === "up" ? "ksq-up" : dir === "down" ? "ksq-down" : "",
										children: cn
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: latestPoint !== void 0 ? asStr(latestPoint.type) || "—" : "—" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "ksq-mono",
										children: score !== null ? score.toFixed(0) : "—"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: "ksq-mono",
										children: backchi !== null ? String(backchi) : "—"
									})
								]
							}, row.level);
						}) })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "ksq-item-meta",
						children: "* 当前级别 · 同向行高亮 = 共振；分钟级依赖 tushare 配额"
					})
				]
			});
		}
		/** 关键位 + 综合评估（risk/confidence 此前未展示）。 */
		function KeyLevelsCard({ advice, lastZhongshu, assessment }) {
			const risk = asNum(assessment.risk_level);
			const confidence = asNum(assessment.confidence_score);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-chanx-card",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ksq-chanx-card-hd",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "关键位 / 评估" })
					}),
					lastZhongshu !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "ksq-chanx-kv",
						children: [
							"中枢 ",
							lastZhongshu.low.toFixed(2),
							" ~ ",
							lastZhongshu.high.toFixed(2),
							"（中轴 ",
							lastZhongshu.center.toFixed(2),
							"）"
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "ksq-item-meta",
						children: [
							"上沿压力 ",
							lastZhongshu.high.toFixed(2),
							" · 下沿支撑 ",
							lastZhongshu.low.toFixed(2)
						]
					})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "ksq-item-meta",
						children: "无中枢数据"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "ksq-chanx-kv",
						children: [
							"入场 ",
							asNum(advice.entry_price)?.toFixed(2) ?? "—",
							" · 止损 ",
							asNum(advice.stop_loss)?.toFixed(2) ?? "—",
							" · 目标 ",
							asNum(advice.take_profit)?.toFixed(2) ?? "—"
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-chanx-relbar",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-item-meta",
								children: "风险"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-chanx-bar",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: {
									width: `${(risk ?? 0) * 100}%`,
									background: "#e64646"
								} })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
								className: "ksq-mono",
								children: risk !== null ? risk.toFixed(2) : "—"
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-chanx-relbar",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-item-meta",
								children: "置信"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-chanx-bar",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("i", { style: {
									width: `${(confidence ?? 0) * 100}%`,
									background: "#5ab0ff"
								} })
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
								className: "ksq-mono",
								children: confidence !== null ? confidence.toFixed(2) : "—"
							})
						]
					})
				]
			});
		}
		/** 折叠的信号明细 chips（修复分类后的 czsc 评分详情，默认收起）。 */
		function SignalDetailsCollapsible({ scores }) {
			const details = asArr(scores.signal_details).map(asRec);
			if (details.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, {});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: "ksq-chanx-chips",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("summary", { children: [
					"信号明细（",
					details.length,
					"）"
				] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "ksq-chips",
					children: details.map((r, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "ksq-chip ksq-mono",
						children: [
							asStr(r.name),
							" ",
							asStr(r.value)
						]
					}, index))
				})]
			});
		}
		//#endregion
		//#region src/client/page.tsx
		/**
		* 缠论研究页（三栏证据台）：主图 + 中栏「动力学×形态学」证据链 + 右栏
		* 状态（缠论雷达/联立矩阵/关键位）。数据走宿主 POST /kstock-api/chan-analyze；
		* 深度解读走 TaskTargetMenu（chan 类型独立记忆落点）。
		*/
		/** 桥（index.tsx 注入；页面为 slot 组件拿不到 ctx，模块级单例传递）。 */
		let chanBridge = null;
		/** 深度解读提示词（与改版前一致，喂结构摘要 + 信号明细）。 */
		function interpretChanPrompt(payload, stock, level) {
			const morph = asRec(payload.morphology);
			const trend = asRec(payload.trend_analysis);
			const advice = asRec(payload.trading_advice);
			const scores = asRec(payload.signal_scores);
			const signals = asArr(scores.signal_details).slice(0, 10).map((item) => {
				const r = asRec(item);
				return `${asStr(r.name)}=${asStr(r.value)}`;
			});
			const zhongshus = asArr(asRec(payload.chart_data).zhongshu_zones).map((item) => {
				const r = asRec(item);
				return `${asNum(r.low)?.toFixed(2) ?? "?"}~${asNum(r.high)?.toFixed(2) ?? "?"}`;
			});
			return `缠论研究面板对 ${asStr(payload.stock_name) || stock}（${asStr(payload.stock_code)}，${level} 级）的结构分析：K线 ${asNum(morph.klines_count) ?? "?"} 根 → 分型 ${asNum(morph.fenxings_count) ?? "?"} / 笔 ${asNum(morph.bis_count) ?? "?"} / 段 ${asNum(morph.segs_count) ?? "?"} / 中枢 ${asNum(morph.zhongshus_count) ?? "?"}${zhongshus.length > 0 ? `（区间 ${zhongshus.join("、")}）` : ""}；走势 ${asStr(trend.type_cn) || asStr(trend.type)}（强度 ${asNum(trend.trend_strength) ?? "?"}），现价 ${asNum(trend.latest_price) ?? "?"}；买卖点 买 ${asNum(asRec(payload.dynamics).buy_points_count) ?? 0} / 卖 ${asNum(asRec(payload.dynamics).sell_points_count) ?? 0}，背驰 ${asNum(asRec(payload.dynamics).backchi_count) ?? 0} 处；操作参考 ${asStr(advice.recommended_action)}；信号评分 ${asNum(scores.final_score) ?? "?"}（${asStr(scores.direction)} / ${asStr(scores.strength)}），信号明细：${signals.length > 0 ? signals.join("；") : "无"}。请做缠论深度解读：当前级别在走势中的位置（趋势/盘整）、中枢演化方向、买卖点的级别联立确认（可再跑多级别）、背驰与动能结构、操作计划（入场/止损/目标位与级别匹配）与失效条件。可用 stock-analysis 技能的缠论引擎补充多级别分析；数据缺失诚实标注「无数据」，不构成投资建议。`;
		}
		/** 窄屏检测（<1100px 中栏并入右栏 Tab 化）。 */
		function useNarrow() {
			const [narrow, setNarrow] = (0, react.useState)(() => typeof window !== "undefined" && window.matchMedia("(max-width: 1100px)").matches);
			(0, react.useEffect)(() => {
				const mq = window.matchMedia("(max-width: 1100px)");
				const onChange = (event) => {
					setNarrow(event.matches);
				};
				mq.addEventListener("change", onChange);
				return () => {
					mq.removeEventListener("change", onChange);
				};
			}, []);
			return narrow;
		}
		/** 缠论研究页：三栏证据台（宽屏）/ 图上 + Tab 面板（窄屏）。 */
		function ChanPage({ useWorkspaces } = {}) {
			const [stock, setStock] = (0, react.useState)("");
			const [level, setLevel] = (0, react.useState)("daily");
			const [payload, setPayload] = (0, react.useState)(null);
			const [chart, setChart] = (0, react.useState)(null);
			const [view, setView] = (0, react.useState)({
				start: 0,
				count: 1
			});
			const [loading, setLoading] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [pendingAsk, setPendingAsk] = (0, react.useState)(null);
			const [matrix, setMatrix] = (0, react.useState)({});
			const [highlight, setHighlight] = (0, react.useState)(null);
			const [sideTab, setSideTab] = (0, react.useState)("evidence");
			const narrow = useNarrow();
			const hlTimer = (0, react.useRef)(null);
			const analyzeSeq = (0, react.useRef)(0);
			const matrixSeq = (0, react.useRef)(0);
			const analyze = (0, react.useCallback)(async (targetStock, targetLevel) => {
				if (targetStock.trim() === "") return;
				const my = ++analyzeSeq.current;
				setLoading(true);
				setError(null);
				try {
					const response = await fetch("/kstock-api/chan-analyze", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							stock: targetStock.trim(),
							level: targetLevel
						})
					});
					if (!response.ok) {
						const detail = await response.json().catch(() => null);
						throw new Error(detail?.detail ?? `分析失败（${response.status}）`);
					}
					const data = await response.json();
					if (my !== analyzeSeq.current) return;
					setPayload(data);
					const next = parseChart(data);
					setChart(next);
					setView({
						start: 0,
						count: Math.max(1, next?.dates.length ?? 1)
					});
					setHighlight(null);
				} catch (err) {
					if (my !== analyzeSeq.current) return;
					setError(err instanceof Error ? err.message : "分析失败");
					setPayload(null);
					setChart(null);
				} finally {
					if (my === analyzeSeq.current) setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				analyze("000001", "daily");
			}, [analyze]);
			const stockCode = payload !== null ? asStr(payload.stock_code) : "";
			(0, react.useEffect)(() => {
				if (stockCode === "") {
					setMatrix({});
					return;
				}
				const my = ++matrixSeq.current;
				const others = matrixLevels(level).filter((l) => l !== level);
				setMatrix(Object.fromEntries(others.map((l) => [l, "loading"])));
				for (const other of others) fetch("/kstock-api/chan-analyze", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						stock: stockCode,
						level: other
					})
				}).then(async (response) => {
					if (my !== matrixSeq.current) return;
					if (!response.ok) throw new Error("failed");
					const data = await response.json();
					if (my !== matrixSeq.current) return;
					const parsed = parseChart(data);
					if (parsed === null || parsed.dates.length < 30) throw new Error("insufficient");
					setMatrix((current) => ({
						...current,
						[other]: data
					}));
				}).catch((err) => {
					if (my !== matrixSeq.current) return;
					const kind = err instanceof Error && err.message === "insufficient" ? "empty" : "error";
					setMatrix((current) => ({
						...current,
						[other]: kind
					}));
				});
			}, [stockCode, level]);
			(0, react.useEffect)(() => () => {
				if (hlTimer.current !== null) window.clearTimeout(hlTimer.current);
			}, []);
			/** 卡片联动：视图聚焦到区间 + 脉冲高亮 2.4s 后自清。 */
			const onCardFocus = (0, react.useCallback)((focus) => {
				const total = chart?.dates.length ?? 0;
				if (total === 0) return;
				const span = Math.max(40, focus.endIdx - focus.startIdx + 24);
				const start = Math.max(0, Math.min(total - span, focus.startIdx - 12));
				setView({
					start,
					count: Math.min(span, total)
				});
				if (focus.hl.id >= 0) {
					setHighlight({
						kind: focus.hl.kind,
						id: focus.hl.id
					});
					if (hlTimer.current !== null) window.clearTimeout(hlTimer.current);
					hlTimer.current = window.setTimeout(() => {
						setHighlight(null);
					}, 2400);
				}
			}, [chart]);
			const morph = payload !== null ? asRec(payload.morphology) : {};
			const dynamics = payload !== null ? asRec(payload.dynamics) : {};
			const advice = payload !== null ? asRec(payload.trading_advice) : {};
			const scores = payload !== null ? asRec(payload.signal_scores) : {};
			const assessment = payload !== null ? asRec(payload.assessment) : {};
			const lastZhongshu = chart !== null && chart.zhongshus.length > 0 ? chart.zhongshus[chart.zhongshus.length - 1] ?? null : null;
			const matrixRows = matrixLevels(level).map((l) => {
				if (l === level) return {
					level: l,
					status: payload !== null ? "ok" : "loading",
					data: payload ?? void 0,
					current: true
				};
				const cell = matrix[l];
				if (cell === void 0) return {
					level: l,
					status: "empty"
				};
				if (cell === "loading") return {
					level: l,
					status: "loading"
				};
				if (cell === "empty") return {
					level: l,
					status: "empty"
				};
				if (cell === "error") return {
					level: l,
					status: "error"
				};
				return {
					level: l,
					status: "ok",
					data: cell
				};
			});
			const matrixBriefs = matrixRows.map((r) => r.status === "ok" && r.data !== void 0 ? {
				status: "ok",
				data: r.data
			} : { status: r.status === "loading" ? "loading" : "error" });
			const dims = payload !== null ? radarDims(payload, matrixBriefs) : [];
			const summary = radarSummary(dims);
			const evidenceColumn = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-chanx-evi",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChainStrip, { segments: payload !== null ? evidenceChain(payload, chart) : [] }),
					chart !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BackchiCard, {
						chart,
						onFocus: onCardFocus
					}),
					payload !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BSPointsCard, {
						payload,
						chart,
						onFocus: onCardFocus
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ZhongshuCard, {
						chart,
						payload: payload ?? {},
						onFocus: onCardFocus
					})
				]
			});
			const statusColumn = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-chanx-side2",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ksq-chanx-card",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChanRadar, {
							dims,
							summary
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LevelMatrix, { rows: matrixRows }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(KeyLevelsCard, {
						advice,
						lastZhongshu,
						assessment
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SignalDetailsCollapsible, { scores })
				]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-page",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", {
					className: "ksq-topbar",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-title",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "缠论研究" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "动力学 × 形态学 · 证据链 · 级别联立" })]
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ksq-body",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-toolbar",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "ksq-chan-input",
									value: stock,
									onChange: (event) => setStock(event.target.value),
									onKeyDown: (event) => {
										if (event.key === "Enter") analyze(stock, level);
									},
									placeholder: "代码或名称（600519 / 茅台 / 000001.SH）",
									spellCheck: false
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
									className: "ksq-chan-select",
									title: "分钟级（60/90/120min）依赖 tushare 分钟线配额，数据量可能不足而降级",
									value: level,
									onChange: (event) => {
										setLevel(event.target.value);
										if (payload !== null) analyze(stock || asStr(payload.stock_code), event.target.value);
									},
									children: LEVEL_OPTIONS.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
										value: option,
										children: option
									}, option))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "ksq-linkbtn",
									type: "button",
									disabled: loading || stock.trim() === "",
									onClick: () => void analyze(stock, level),
									children: loading ? "分析中…" : "分析"
								}),
								payload !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "ksq-count",
									children: [
										"笔 ",
										asNum(morph.bis_count) ?? "—",
										" · 段 ",
										asNum(morph.segs_count) ?? "—",
										" · 中枢 ",
										asNum(morph.zhongshus_count) ?? "—",
										" ",
										"· 买 ",
										asNum(dynamics.buy_points_count) ?? 0,
										" / 卖 ",
										asNum(dynamics.sell_points_count) ?? 0,
										" · 背驰 ",
										asNum(dynamics.backchi_count) ?? 0
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									className: "ksq-linkbtn",
									type: "button",
									disabled: chanBridge === null,
									onClick: () => {
										if (chanBridge !== null && payload !== null) setPendingAsk(interpretChanPrompt(payload, stock, level));
									},
									children: "让 Agent 深度解读"
								})] })
							]
						}),
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "ksq-note",
							children: error
						}),
						payload !== null && chart !== null && !narrow && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-chanx-grid",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ksq-chanx-chartcol-wrap",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChanChart, {
										chart,
										payload,
										view,
										onViewChange: setView,
										highlight
									})
								}),
								evidenceColumn,
								statusColumn
							]
						}),
						payload !== null && chart !== null && narrow && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-chanx-grid narrow",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "ksq-chanx-chartcol-wrap",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChanChart, {
									chart,
									payload,
									view,
									onViewChange: setView,
									highlight
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ksq-chanx-tabpanel",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-chanx-tabs",
									role: "tablist",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										role: "tab",
										"aria-selected": sideTab === "evidence",
										className: `ksq-chanx-tab${sideTab === "evidence" ? " on" : ""}`,
										onClick: () => setSideTab("evidence"),
										children: "证据链"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										role: "tab",
										"aria-selected": sideTab === "status",
										className: `ksq-chanx-tab${sideTab === "status" ? " on" : ""}`,
										onClick: () => setSideTab("status"),
										children: "状态 / 联立"
									})]
								}), sideTab === "evidence" ? evidenceColumn : statusColumn]
							})]
						}),
						pendingAsk !== null && chanBridge !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TaskTargetMenu, {
							taskKind: "chan",
							title: "缠论深度解读发送到…",
							prompt: pendingAsk,
							bridge: chanBridge,
							useWorkspaces,
							onClose: () => setPendingAsk(null)
						})
					]
				})]
			});
		}
		/** index.tsx 注入共享路由桥（模块级单例传递给 slot 组件）。 */
		ChanPage.bindBridge = (bridge) => {
			chanBridge = bridge;
		};
		//#endregion
		//#region src/client/index.tsx
		/**
		* ${pkg} — KStock 缠论研究客户端插件。
		*
		* 注册 `main` keyed 面板（键 kstock-client-chan）+ `sidebar.panellist`
		* 导航入口。面板直连宿主 `POST /kstock-api/chan-analyze`（秒级引擎），
		* 交互式 K 线缠论图（笔/段/中枢/买卖点叠加）+ 形态/走势/信号摘要 +
		* Agent 深度解读联动（quant-ui 共享路由桥）。
		*/
		/** 面板键：main slot 与侧栏入口共用。 */
		const PANEL_KEY = "kstock-client-chan";
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
				ChanPage.bindBridge(buildTaskRouterBridge(ctx));
				ctx.slots.inject("main", () => ctx.slots.register({
					name: "main",
					key: PANEL_KEY
				}, ChanPage));
				ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
					name: "sidebar.panellist",
					id: PANEL_KEY,
					order: 150,
					label: "缠论研究"
				}, NavIcon));
			}, "kstock-client-chan: panel + nav");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.cjs.map