window.__ModuleLoader__.load({
	id: "@kstock/client-chan",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region ../quant-ui/src/quant.css?raw
		var quant_default = "/* KStock 量化工作台面板样式（@kstock/quant 客户端半端）。\n *\n * 全部类名以 ksq- 前缀隔离；颜色走引擎 dsw 别名 token（随明暗主题\n * 自动切换），强调色沿用 KStock 品牌绿。由客户端 bundle 以 ?raw 内联，\n * apply() 时注入 <style data-kstock=\"quant-pages\">。 */\n\n.ksq-page {\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-bg-base) 88%, transparent);\n}\n\n/* ── 顶部：标题 + 库切换 tab ─────────────────────────────── */\n\n.ksq-topbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  padding: 14px 22px 0;\n  flex: none;\n}\n\n.ksq-title {\n  display: flex;\n  align-items: baseline;\n  gap: 10px;\n  min-width: 0;\n}\n\n.ksq-title strong {\n  font-size: 17px;\n  letter-spacing: 0.2px;\n}\n\n.ksq-title span {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.ksq-topbar-actions {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex: none;\n}\n\n.ksq-count {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.ksq-tabs {\n  display: flex;\n  gap: 4px;\n  padding: 10px 22px 0;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-tab {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  padding: 8px 14px 10px;\n  cursor: pointer;\n  border-bottom: 2px solid transparent;\n  margin-bottom: -1px;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-tab:hover { color: var(--dsw-alias-label-primary); }\n\n.ksq-tab.active {\n  color: var(--dsw-alias-label-primary);\n  border-bottom-color: var(--dsw-alias-brand-primary);\n  font-weight: 600;\n}\n\n/* ── 通用控件 ─────────────────────────────────────────────── */\n\n.ksq-iconbtn {\n  appearance: none;\n  border: 1px solid transparent;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  width: 28px;\n  height: 28px;\n  border-radius: 7px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n\n.ksq-iconbtn:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.ksq-iconbtn:disabled { opacity: 0.5; cursor: default; }\n.ksq-iconbtn.danger:hover { color: #e64646; }\n\n.ksq-btn {\n  appearance: none;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  padding: 5px 12px;\n  border-radius: 7px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }\n\n.ksq-linkbtn {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-link);\n  font-size: 12px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 0;\n}\n\n.ksq-linkbtn:hover { text-decoration: underline; }\n\n.ksq-search {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 8px;\n  padding: 6px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  min-width: 260px;\n}\n\n.ksq-search input {\n  border: none;\n  outline: none;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  flex: 1;\n}\n\n.ksq-search input::placeholder { color: var(--dsw-alias-label-tertiary); }\n\n.ksq-spin { animation: ksq-rotate 0.9s linear infinite; }\n\n@keyframes ksq-rotate {\n  to { transform: rotate(360deg); }\n}\n\n.ksq-error {\n  margin: 10px 22px 0;\n  padding: 8px 12px;\n  border: 1px solid rgba(230, 70, 70, 0.4);\n  border-radius: 8px;\n  background: rgba(230, 70, 70, 0.08);\n  color: #e64646;\n  font-size: 12.5px;\n}\n\n.ksq-loading {\n  margin: 24px 22px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n}\n\n.ksq-empty {\n  margin: 40px auto;\n  max-width: 420px;\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  font-size: 13px;\n}\n\n.ksq-empty strong { color: var(--dsw-alias-label-secondary); font-size: 14px; }\n\n.ksq-mono {\n  font-family: ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace;\n  font-size: 0.92em;\n}\n\n/* 数值语义色 */\n.ksq-up { color: #31c7a2; }\n.ksq-down { color: #e64646; }\n.ksq-warn { color: #e8a33d; }\n\n/* ── 数据表 ─────────────────────────────────────────────── */\n\n.ksq-table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 12.5px;\n}\n\n.ksq-table th {\n  text-align: left;\n  font-weight: 500;\n  color: var(--dsw-alias-label-tertiary);\n  padding: 6px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  white-space: nowrap;\n}\n\n.ksq-table td {\n  padding: 7px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  color: var(--dsw-alias-label-primary);\n  white-space: nowrap;\n}\n\n.ksq-table td.num { text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-table tr.selected td { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-table input[type=\"checkbox\"] { accent-color: var(--dsw-alias-brand-primary); }\n\n/* 长文本单元格裁剪（agent 写入的股票池/口径描述可达数百字，nowrap 下会把\n   操作列挤出视口）：max-width + ellipsis，全文走 title 悬浮。 */\n.ksq-table td.ksq-cell-clip {\n  max-width: 230px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* 表格横向滚动兜底：窗口再窄操作列（报告/看板）也始终可达，不整页溢出。 */\n.ksq-table-wrap { overflow-x: auto; }\n.ksq-table-wrap .ksq-table { min-width: 640px; }\n\n/* ── 内容区骨架 ─────────────────────────────────────────── */\n\n.ksq-body {\n  flex: 1;\n  overflow: auto;\n  padding: 14px 22px 26px;\n}\n\n.ksq-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-bottom: 14px;\n}\n\n/* ── 策略/因子/选股：列表 + 详情双栏 ────────────────────── */\n\n.ksq-split {\n  display: grid;\n  grid-template-columns: 264px 1fr;\n  gap: 16px;\n  align-items: start;\n}\n\n.ksq-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  position: sticky;\n  top: 0;\n}\n\n.ksq-list-item {\n  appearance: none;\n  text-align: left;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 10px;\n  padding: 9px 12px;\n  cursor: pointer;\n  color: var(--dsw-alias-label-primary);\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.ksq-list-item:hover { border-color: var(--dsw-alias-border-l2); }\n\n.ksq-list-item.active {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-1));\n}\n\n.ksq-item-name {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  font-size: 13px;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.ksq-item-name > span.ksq-name-text {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dot {\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  flex: none;\n}\n\n.ksq-dot.tone-live { background: #31c7a2; }\n.ksq-dot.tone-idle { background: #8f98a2; }\n.ksq-dot.tone-bad { background: #e64646; }\n\n.ksq-item-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-chip {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 999px;\n  padding: 0 7px;\n  font-size: 11px;\n  line-height: 18px;\n}\n\n.ksq-badge {\n  border-radius: 5px;\n  padding: 1px 7px;\n  font-size: 11px;\n  line-height: 18px;\n  flex: none;\n}\n\n.ksq-badge.tone-live {\n  color: #31c7a2;\n  background: rgba(49, 199, 162, 0.12);\n}\n\n.ksq-badge.tone-idle {\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-3);\n}\n\n.ksq-badge.tone-bad {\n  color: #e64646;\n  background: rgba(230, 70, 70, 0.1);\n}\n\n.ksq-detail { min-width: 0; display: flex; flex-direction: column; gap: 14px; }\n\n.ksq-hint {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12.5px;\n  margin: 6px 0;\n}\n\n.ksq-identity { border-bottom: 1px solid var(--dsw-alias-border-l3); padding-bottom: 10px; }\n\n.ksq-identity-head {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.ksq-identity-head h2 { font-size: 16px; margin: 0; }\n\n.ksq-hypothesis {\n  margin: 6px 0 4px;\n  font-size: 12.5px;\n  color: var(--dsw-alias-label-secondary);\n  line-height: 1.6;\n}\n\n.ksq-section-title {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n  margin: 4px 0 8px;\n}\n\n/* 版本时间线 */\n.ksq-versions { display: flex; flex-direction: column; gap: 8px; padding-left: 14px; }\n\n.ksq-version {\n  position: relative;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 9px 12px;\n}\n\n.ksq-version.latest { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); }\n\n.ksq-version::before {\n  content: \"\";\n  position: absolute;\n  left: -11px;\n  top: 16px;\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-version.latest::before { background: var(--dsw-alias-brand-primary); }\n\n.ksq-version-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 12.5px;\n}\n\n.ksq-version-note {\n  margin: 5px 0 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* 对比块 */\n.ksq-compare {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-compare h3 { font-size: 13px; margin: 0 0 8px; }\n\n.ksq-note {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  margin: 4px 0;\n}\n\n.ksq-chart { margin-top: 10px; }\n\n.ksq-chart h4 {\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n  margin: 0 0 6px;\n}\n\n.ksq-chart svg { max-width: 100%; height: auto; }\n\n/* 选股 criteria 摘要 */\n.ksq-criteria {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 8px 10px;\n  margin: 6px 0 0;\n  white-space: pre-wrap;\n  word-break: break-word;\n  max-height: 160px;\n  overflow: auto;\n}\n\n/* 选股 picks 表 */\n.ksq-picks-meta { display: flex; gap: 14px; font-size: 12px; color: var(--dsw-alias-label-tertiary); margin: 6px 0; }\n\n/* ── 报告库 ─────────────────────────────────────────────── */\n\n.ksq-report-group { margin-bottom: 16px; }\n\n.ksq-report-heading {\n  appearance: none;\n  border: none;\n  background: transparent;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  cursor: pointer;\n  padding: 4px 0 8px;\n  width: 100%;\n}\n\n.ksq-report-heading h2 { font-size: 13px; margin: 0; font-weight: 600; color: var(--dsw-alias-label-primary); }\n.ksq-report-heading span { color: var(--dsw-alias-label-tertiary); font-size: 12px; }\n\n.ksq-report-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));\n  gap: 10px;\n}\n\n.ksq-report-card {\n  display: flex;\n  gap: 12px;\n  align-items: flex-start;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-report-icon {\n  flex: none;\n  width: 34px;\n  height: 34px;\n  border-radius: 9px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);\n}\n\n.ksq-report-copy { flex: 1; min-width: 0; }\n\n.ksq-report-copy h3 {\n  margin: 0 0 4px;\n  font-size: 13.5px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-report-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px 12px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-report-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex: none; }\n\n/* 报告预览浮层 */\n.ksq-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 80;\n  background: rgba(3, 13, 11, 0.72);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 40px;\n}\n\n.ksq-dialog {\n  width: min(1080px, 100%);\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  border-radius: 14px;\n  overflow: hidden;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-dialog-bar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 14px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-dialog-bar strong {\n  font-size: 13px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dialog iframe {\n  flex: 1;\n  border: none;\n  background: #fff;\n}\n\n/* 确认弹窗 */\n.ksq-confirm {\n  width: min(420px, 100%);\n  height: auto;\n  border-radius: 14px;\n  padding: 18px;\n  gap: 10px;\n}\n\n.ksq-confirm h3 { margin: 0; font-size: 15px; }\n.ksq-confirm p { margin: 0; font-size: 12.5px; color: var(--dsw-alias-label-secondary); line-height: 1.6; }\n\n.ksq-confirm-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  margin-top: 8px;\n}\n\n.ksq-btn.danger {\n  color: #fff;\n  background: #c0392b;\n  border-color: #c0392b;\n}\n\n.ksq-btn.danger:hover { background: #a93226; }\n\n/* 复制成功提示 */\n.ksq-toast {\n  position: fixed;\n  bottom: 28px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 90;\n  /* 自洽深色药丸：不依赖宿主 toast token（--dsw-alias-toast-bg 在宿主不存在，\n     回退 bg-overlay 是遮罩 scrim 色——黑条不可读）。深底浅字双主题通用。 */\n  background: rgba(3, 13, 11, 0.92);\n  color: #e8edef;\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  font-size: 12.5px;\n  border-radius: 999px;\n  padding: 8px 16px;\n  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);\n}\n\n/* ── 财经新闻面板（@kstock/client-news）────────────────────────── */\n\n.ksq-news-list {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  padding-bottom: 8px;\n}\n\n.ksq-news-item {\n  position: relative;\n  padding: 12px 16px 12px 20px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  overflow: hidden;\n  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;\n}\n\n/* 左侧品牌色细轨：常亮 55%，hover 点满。 */\n.ksq-news-item::before {\n  content: '';\n  position: absolute;\n  left: 0;\n  top: 0;\n  bottom: 0;\n  width: 3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 100%, transparent);\n  opacity: .45;\n  transition: opacity .15s ease;\n}\n\n.ksq-news-item:hover {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, var(--dsw-alias-border-l2));\n  transform: translateY(-1px);\n  box-shadow: 0 4px 16px color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n}\n\n.ksq-news-item:hover::before {\n  opacity: 1;\n}\n\n.ksq-news-meta {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-source {\n  padding: 1.5px 8px;\n  border-radius: 99px;\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: .3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent);\n  color: var(--dsw-alias-brand-primary);\n  white-space: nowrap;\n}\n\n.ksq-news-dot {\n  width: 3px;\n  height: 3px;\n  border-radius: 50%;\n  background: currentColor;\n  opacity: .55;\n  flex: none;\n}\n\n.ksq-news-time {\n  margin-left: auto;\n  white-space: nowrap;\n}\n\n.ksq-news-title {\n  font-size: 14px;\n  font-weight: 600;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  text-decoration: none;\n}\n\na.ksq-news-title:hover {\n  color: var(--dsw-alias-link);\n}\n\n.ksq-news-summary {\n  margin: 0;\n  font-size: 12.5px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n\n.ksq-news-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 22px 0;\n  flex: none;\n}\n\n.ksq-news-toolbar .ksq-tabs { margin-bottom: 0; }\n\n.ksq-news-toolbar-right {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  min-width: 0;\n}\n\n.ksq-news-toolbar-right .ksq-search { margin-bottom: 0; flex: 1; min-width: 220px; max-width: 460px; }\n\n.ksq-news-watchedit {\n  padding: 8px 22px 0;\n  flex: none;\n}\n\n.ksq-news-watchedit input {\n  width: 100%;\n  box-sizing: border-box;\n  padding: 7px 12px;\n  border-radius: 8px;\n  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, var(--dsw-alias-border-l2));\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n}\n\n/* 双栏：主列表 + 统计侧栏（窄面板时侧栏隐藏）。 */\n.ksq-news-split {\n  display: flex;\n  gap: 20px;\n  align-items: flex-start;\n  width: 100%;\n  max-width: 1360px;\n  margin: 0 auto;\n}\n\n.ksq-news-main {\n  flex: 1;\n  min-width: 0;\n}\n\n.ksq-news-item.read { opacity: .58; }\n.ksq-news-item.read:hover { opacity: 1; }\n\n.ksq-news-item.watched {\n  border-color: color-mix(in srgb, #f59e0b 45%, var(--dsw-alias-border-l2));\n  background: color-mix(in srgb, #f59e0b 5%, var(--dsw-alias-bg-layer-2));\n}\n\n.ksq-news-item.watched::before {\n  background: #f59e0b;\n}\n\n.ksq-news-watchflag {\n  padding: 1px 7px;\n  border-radius: 99px;\n  font-size: 10.5px;\n  font-weight: 600;\n  letter-spacing: .5px;\n  color: #f59e0b;\n  background: color-mix(in srgb, #f59e0b 16%, transparent);\n}\n\n.ksq-news-stocks {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-stocktag {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  padding: 2px 9px;\n  border-radius: 6px;\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n  transition: border-color .12s ease, background .12s ease;\n}\n\n.ksq-news-stocktag:hover {\n  border-color: var(--dsw-alias-brand-primary);\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);\n}\n\n.ksq-news-actions {\n  display: flex;\n  justify-content: flex-end;\n  font-size: 12.5px;\n}\n\n/* 统计侧栏 */\n.ksq-news-stats {\n  flex: none;\n  width: 220px;\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  position: sticky;\n  top: 0;\n}\n\n@media (max-width: 980px) {\n  .ksq-news-stats { display: none; }\n  .ksq-news-split { display: block; }\n}\n\n.ksq-news-stats-block {\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  padding: 12px 14px;\n}\n\n.ksq-news-stats-head {\n  font-size: 13px;\n  font-weight: 600;\n  margin-bottom: 10px;\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n}\n\n.ksq-news-stats-head span {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-stats-empty {\n  margin: 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-trending {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-trendword {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 2.5px 9px;\n  border-radius: 99px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-news-trendword:hover {\n  color: var(--dsw-alias-brand-primary);\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.ksq-news-trendword em {\n  font-style: normal;\n  font-size: 10.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-freq {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: 50px;\n}\n\n.ksq-news-freq-bar {\n  flex: 1;\n  min-width: 3px;\n  border-radius: 2px 2px 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n}\n\n.ksq-news-freq-bar:hover {\n  background: var(--dsw-alias-brand-primary);\n}\n\n/* ── 联动任务目标选择菜单（§26-10，新闻/选股库共用）────────────── */\n\n.ksq-target-overlay { z-index: 95; padding: 40px; background: rgba(3, 13, 11, 0.45); }\n\n.ksq-target-menu {\n  width: min(480px, 100%);\n  max-height: min(70vh, 560px);\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  padding: 12px;\n  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);\n}\n\n.ksq-target-head {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  padding: 4px 8px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  margin-bottom: 6px;\n}\n\n.ksq-target-item {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  padding: 9px 10px;\n  border: none;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  text-align: left;\n  cursor: pointer;\n  font-size: 13px;\n}\n\n.ksq-target-item:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }\n.ksq-target-item:disabled { opacity: 0.55; cursor: default; }\n.ksq-target-item.last { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }\n\n.ksq-target-name { font-weight: 500; flex: none; }\n.ksq-target-path {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-target-error { color: #e64646; font-size: 12.5px; margin: 4px 8px; }\n.ksq-target-cancel { align-self: flex-end; margin-top: 4px; }\n\n/* ── 选股库：口径芯片（P4）+ 命中趋势（P3）────────────────────── */\n\n.ksq-chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0 2px; }\n.ksq-chips .ksq-chip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }\n\n.ksq-trend {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 8px 10px;\n  margin: 6px 0 10px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-trend-label {\n  flex: none;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-trend-bars {\n  flex: 1;\n  display: flex;\n  align-items: flex-end;\n  justify-content: flex-start;\n  gap: 4px;\n  height: 44px;\n  min-width: 0;\n}\n\n.ksq-trend-col {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: 100%;\n  cursor: default;\n}\n\n.ksq-trend-bar {\n  width: 9px;\n  min-height: 3px;\n  border-radius: 2px 2px 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 60%, transparent);\n}\n\n.ksq-trend-bar:hover { background: var(--dsw-alias-brand-primary); }\n\n.ksq-trend-bar.consensus { background: #31c7a2; }\n.ksq-trend-bar.consensus:hover { background: #22a06b; }\n\n/* ── 因子库：跨因子概览（F3，IC 均值零轴双向横条）──────────────── */\n\n.ksq-factors-overview {\n  display: flex;\n  align-items: flex-start;\n  gap: 10px;\n  padding: 10px 12px;\n  margin-bottom: 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-fo-rows { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }\n\n.ksq-fo-row {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  padding: 3px 6px;\n  border: none;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  text-align: left;\n  cursor: pointer;\n  font-size: 12px;\n}\n\n.ksq-fo-row:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-fo-row.active { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); }\n\n.ksq-fo-name {\n  flex: none;\n  width: 128px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-weight: 500;\n}\n\n.ksq-fo-bar {\n  flex: 1;\n  position: relative;\n  height: 10px;\n  min-width: 0;\n}\n\n/* 零轴：容器中缝 1px 基线；正值条从中线向右，负值向左。 */\n.ksq-fo-bar::before {\n  content: '';\n  position: absolute;\n  left: 50%;\n  top: -2px;\n  bottom: -2px;\n  width: 1px;\n  background: var(--dsw-alias-border-l3);\n}\n\n.ksq-fo-fill {\n  position: absolute;\n  top: 1px;\n  bottom: 1px;\n  border-radius: 2px;\n}\n\n.ksq-fo-fill.up { background: #31c7a2; }\n.ksq-fo-fill.down { background: #e64646; }\n\n.ksq-fo-value { flex: none; width: 52px; text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-fo-ir { flex: none; width: 64px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }\n\n/* ── 策略库：调仓记录（§28-5，按日折叠）────────────────────────── */\n\n.ksq-rebalances {\n  max-height: 380px;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 6px;\n}\n\n.ksq-rebalance { border-bottom: 1px solid var(--dsw-alias-border-l3); }\n.ksq-rebalance:last-child { border-bottom: none; }\n\n.ksq-rebalance summary {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 5px 8px;\n  cursor: pointer;\n  font-size: 12.5px;\n  list-style: none;\n  border-radius: 6px;\n}\n\n.ksq-rebalance summary::-webkit-details-marker { display: none; }\n.ksq-rebalance summary::before { content: '\\25B8'; color: var(--dsw-alias-label-tertiary); transition: transform 0.12s; }\n.ksq-rebalance[open] summary::before { transform: rotate(90deg); }\n.ksq-rebalance summary:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }\n\n.ksq-rebalance-body { padding: 6px 10px 10px 22px; display: flex; flex-direction: column; gap: 6px; }\n\n.ksq-rebalance-dayhead { display: flex; justify-content: flex-end; }\n\n/* ── 版本迭代面板（§28-10「从此版本改进」）────────────────────── */\n\n.ksq-iter {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  margin-top: 8px;\n  padding: 10px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 4%, transparent);\n}\n\n.ksq-iter-chip { cursor: pointer; background: transparent; }\n.ksq-iter-chip.active {\n  border-color: var(--dsw-alias-brand-primary);\n  color: var(--dsw-alias-brand-primary);\n  font-weight: 500;\n}\n\n.ksq-iter-input {\n  height: 30px;\n  padding: 0 10px;\n  border-radius: 8px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: transparent;\n  color: inherit;\n  font-size: 12.5px;\n}\n.ksq-rebalance-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\n@media (max-width: 720px) { .ksq-rebalance-cols { grid-template-columns: 1fr; } }\n.ksq-rebalance-side p { margin: 0 0 4px; font-size: 12px; font-weight: 500; }\n.ksq-rebalance-side .ksq-table { font-size: 11.5px; }\n\n\n/* ── 图表视觉比例锚定（viewBox 拉伸陷阱修复）──────────────────────\n   图表 SVG viewBox 固定宽（560/720），宽面板被拉伸 1.5-2x，字号视觉\n   翻倍显巨大。统一锚定 max-width：560 系 ≤660px（放大上限 1.18x）、\n   720 系（缠论 K 线）≤880px；height:auto 保持宽高比。 */\n.ksq-chart svg { max-width: 660px; height: auto; }\n.ksq-chan-chart svg { max-width: 880px; height: auto; display: block; }\n\n/* ── 缠论研究面板（§29-C1，@kstock/client-chan）────────────────── */\n\n.ksq-chan-input {\n  width: 260px;\n  height: 30px;\n  padding: 0 10px;\n  border-radius: 8px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: transparent;\n  color: inherit;\n  font-size: 12.5px;\n}\n\n.ksq-chan-select {\n  height: 30px;\n  padding: 0 6px;\n  border-radius: 8px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: transparent;\n  color: inherit;\n  font-size: 12.5px;\n}\n\n.ksq-chan-summary {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n  gap: 10px;\n  margin-top: 12px;\n}\n\n.ksq-chan-card {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  font-size: 12.5px;\n}\n\n.ksq-chan-card strong { font-size: 12px; color: var(--dsw-alias-label-tertiary); font-weight: 500; }\n.ksq-chan-card span { color: var(--dsw-alias-label-primary); }\n\n.ksq-chan-radar {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-chan-radar svg { width: 156px; flex: none; }\n.ksq-chan-radar-meta { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }\n\n.ksq-chan-signals {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-chan-signals strong { font-size: 12px; color: var(--dsw-alias-label-tertiary); font-weight: 500; }\n\n/* ── 缠论面板：左图右栏布局 + 右侧信息栏（§29-7）────────────────── */\n\n.ksq-chan-main {\n  display: flex;\n  gap: 14px;\n  align-items: flex-start;\n  margin-top: 12px;\n}\n\n.ksq-chan-chartwrap { flex: 1; min-width: 0; }\n.ksq-chan-chartwrap svg { width: 100%; max-width: 880px; height: auto; display: block; }\n\n.ksq-chan-side {\n  flex: none;\n  width: 268px;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n\n.ksq-chan-sidecard {\n  display: flex;\n  flex-direction: column;\n  gap: 5px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  font-size: 12.5px;\n}\n\n.ksq-chan-sidecard strong { font-size: 12px; color: var(--dsw-alias-label-tertiary); font-weight: 500; }\n\n.ksq-chan-levelrow em { font-style: normal; font-weight: 500; margin-right: 6px; }\n\n.ksq-chan-signal {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  width: 100%;\n  padding: 4px 6px;\n  border: none;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  text-align: left;\n  cursor: pointer;\n}\n\n.ksq-chan-signal:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-chan-signal em { font-style: normal; font-family: ui-monospace, Menlo, monospace; font-size: 11px; color: var(--dsw-alias-label-tertiary); flex: none; }\n.ksq-chan-signal span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n.ksq-chan-signal b { font-weight: 500; font-variant-numeric: tabular-nums; }\n.ksq-chan-signal.up b { color: #e05656; }\n.ksq-chan-signal.down b { color: #2f9e77; }\n\n@media (max-width: 1080px) {\n  .ksq-chan-main { flex-direction: column; }\n  .ksq-chan-side { width: 100%; }\n}\n";
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
		const STYLE_VERSION = "2026-09-21.3-chan3";
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
		//#region src/client/page.tsx
		/**
		* 缠论研究面板：交互式 K 线缠论图 + 形态/走势/信号摘要 + Agent 深度解读。
		*
		* 数据走宿主 `POST /kstock-api/chan-analyze`（{stock, level} → 引擎 JSON，
		* 60s 服务端缓存）。图表自研 SVG：蜡烛（A 股红涨绿跌）+ 笔/段折线 +
		* 中枢矩形 + 买卖点徽章 + 成交量副图，hover 十字线逐根读值。
		* 深度解读走 TaskTargetMenu（chan 类型独立记忆落点）。
		*/
		const asRec = (v) => typeof v === "object" && v !== null ? v : {};
		const asArr = (v) => Array.isArray(v) ? v : [];
		const asNum = (v) => typeof v === "number" && Number.isFinite(v) ? v : null;
		const asStr = (v) => typeof v === "string" ? v : "";
		/** 桥（index.tsx 注入；页面为 slot 组件拿不到 ctx，模块级单例传递）。 */
		let chanBridge = null;
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
						center: asNum(r.center) ?? 0
					};
				}),
				markers: asArr(c.markers).map(asRec)
			};
		}
		const LEVEL_OPTIONS = [
			"30min",
			"daily",
			"weekly",
			"monthly"
		];
		const W = 720;
		const H_MAIN = 300;
		const H_VOL = 56;
		const PAD_L = 54;
		const PAD_R = 14;
		const H_TOTAL = 382;
		/**
		* K 线缠论主图（含成交量副图）：滚轮缩放（鼠标为锚）+ 拖拽平移 +
		* 双击复位 + hover 十字线逐根读值。价格轴按可视窗口自适应。
		*/
		function ChanChart({ chart, view, onViewChange }) {
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
			}, [total]);
			const slot = (W - PAD_L - PAD_R) / view.count;
			const winEnd = view.start + view.count;
			const x = (index) => PAD_L + (index - view.start + .5) * slot;
			const dateIndex = /* @__PURE__ */ new Map();
			dates.forEach((date, index) => dateIndex.set(date.slice(0, 10), index));
			function indexOfTimeLocal(time) {
				return dateIndex.get(time.slice(0, 10)) ?? -1;
			}
			const indexOfTime = indexOfTimeLocal;
			const visK = kline.slice(view.start, winEnd);
			const lows = visK.map((k) => k[2]).concat(chart.zhongshus.filter((z) => {
				const i1 = indexOfTimeLocal(z.start_time);
				return indexOfTimeLocal(z.end_time) >= view.start && i1 <= winEnd;
			}).map((z) => z.low));
			const highs = visK.map((k) => k[3]).concat(chart.zhongshus.filter((z) => {
				const i1 = indexOfTimeLocal(z.start_time);
				return indexOfTimeLocal(z.end_time) >= view.start && i1 <= winEnd;
			}).map((z) => z.high));
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
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
					chart.zhongshus.map((zone, i) => {
						const x1 = indexOfTime(zone.start_time);
						const x2 = indexOfTime(zone.end_time);
						if (x1 < 0 || x2 < x1 || x2 < view.start || x1 > winEnd) return null;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
								x: x(x1) - slot / 2,
								y: yMain(zone.high),
								width: (x2 - x1 + 1) * slot,
								height: Math.max(2, yMain(zone.low) - yMain(zone.high)),
								fill: "rgba(199,146,234,0.14)",
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
									zone.high.toFixed(2)
								]
							})
						] }, `zs-${i}`);
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
					chart.markers.map((marker, i) => {
						const time = asStr(marker.time ?? marker.date);
						const index = indexOfTime(time);
						const price = asNum(marker.price);
						if (index < 0 || price === null || index < view.start || index >= winEnd) return null;
						const label = asStr(marker.label ?? marker.type ?? "?");
						const isBuy = label.toLowerCase().includes("b") || label.includes("买");
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
							cx: x(index),
							cy: yMain(price),
							r: "7",
							fill: isBuy ? "#31c7a2" : "#e64646",
							opacity: "0.92"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
							x: x(index),
							y: yMain(price) + 3,
							fontSize: "8.5",
							textAnchor: "middle",
							fill: "#fff",
							fontWeight: "600",
							children: label.slice(0, 2)
						})] }, `mk-${i}`);
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
									height: "58",
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
								})
							] })
						]
					})
				]
			});
		}
		/** 七类信号雷达（SVG 七边形，czsc 式分类）。 */
		function SignalRadar({ radar, score, direction, strength }) {
			const categories = [
				"cxt",
				"tas",
				"vol",
				"bar",
				"pos",
				"jcc",
				"sta"
			];
			const labels = {
				cxt: "形态",
				tas: "走势",
				vol: "量能",
				bar: "K线",
				pos: "位置",
				jcc: "交叉",
				sta: "统计"
			};
			const cx = 78, cy = 72, r = 52;
			const angle = (i) => Math.PI * 2 * i / categories.length - Math.PI / 2;
			const point = (i, value) => [cx + Math.cos(angle(i)) * r * value, cy + Math.sin(angle(i)) * r * value];
			const polygon = categories.map((c) => {
				const v = asNum(radar[c]);
				return v === null ? .5 : Math.max(0, Math.min(1, v / 100));
			}).map((v, i) => point(i, v).join(",")).join(" ");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-chan-radar",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					viewBox: "0 0 156 144",
					role: "img",
					"aria-label": "信号雷达",
					children: [
						[
							.25,
							.5,
							.75,
							1
						].map((ring) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("polygon", {
							points: categories.map((_, i) => point(i, ring).join(",")).join(" "),
							fill: "none",
							stroke: "var(--dsw-alias-border-l3)",
							strokeWidth: "0.6"
						}, ring)),
						categories.map((cat, i) => {
							const [px, py] = point(i, 1);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
								x1: cx,
								y1: cy,
								x2: px,
								y2: py,
								stroke: "var(--dsw-alias-border-l3)",
								strokeWidth: "0.6"
							}, cat);
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("polygon", {
							points: polygon,
							fill: "rgba(232,163,61,0.3)",
							stroke: "#e8a33d",
							strokeWidth: "1.4"
						}),
						categories.map((cat, i) => {
							const [px, py] = point(i, 1.22);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
								x: px,
								y: py + 3,
								fontSize: "9",
								textAnchor: "middle",
								fill: "var(--dsw-alias-label-tertiary)",
								children: labels[cat] ?? cat
							}, `l-${cat}`);
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ksq-chan-radar-meta",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("strong", {
						className: direction === "bullish" ? "ksq-up" : direction === "bearish" ? "ksq-down" : "",
						children: [
							score !== null ? score.toFixed(1) : "—",
							" 分 · ",
							direction === "bullish" ? "偏多" : direction === "bearish" ? "偏空" : direction
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: "ksq-item-meta",
						children: ["强度：", strength === "weak" ? "弱" : strength === "strong" ? "强" : strength]
					})]
				})]
			});
		}
		/** 深度解读提示词（结构摘要 + 信号明细 → czsc 式信号字典作解读输入）。 */
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
		/** 缠论研究页：左 K 线（缩放/拖拽）+ 右信息栏（摘要/多级别/信号流/关键位）。 */
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
			const [levelsBrief, setLevelsBrief] = (0, react.useState)({});
			const analyze = (0, react.useCallback)(async (targetStock, targetLevel) => {
				if (targetStock.trim() === "") return;
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
					setPayload(data);
					const next = parseChart(data);
					setChart(next);
					setView({
						start: 0,
						count: Math.max(1, next?.dates.length ?? 1)
					});
				} catch (err) {
					setError(err instanceof Error ? err.message : "分析失败");
					setPayload(null);
					setChart(null);
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				analyze("000001", "daily");
			}, [analyze]);
			const stockCode = payload !== null ? asStr(payload.stock_code) : "";
			(0, react.useEffect)(() => {
				if (stockCode === "") {
					setLevelsBrief({});
					return;
				}
				const idx = LEVEL_OPTIONS.indexOf(level);
				const others = LEVEL_OPTIONS.slice(idx + 1, idx + 3).length >= 2 ? LEVEL_OPTIONS.slice(idx + 1, idx + 3) : LEVEL_OPTIONS.slice(0, 2);
				setLevelsBrief(Object.fromEntries(others.map((l) => [l, "loading"])));
				for (const other of others) fetch("/kstock-api/chan-analyze", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						stock: stockCode,
						level: other
					})
				}).then(async (response) => {
					if (!response.ok) throw new Error("fail");
					const data = await response.json();
					setLevelsBrief((current) => ({
						...current,
						[other]: data
					}));
				}).catch(() => {
					setLevelsBrief((current) => ({
						...current,
						[other]: "error"
					}));
				});
			}, [stockCode, level]);
			/** 信号定位：把 K 线窗口聚焦到该索引 ±40 根。 */
			const focusIndex = (0, react.useCallback)((index, total) => {
				setView({
					start: Math.max(0, Math.min(Math.max(0, total - 80), index - 40)),
					count: Math.min(80, Math.max(15, total))
				});
			}, []);
			const morph = payload !== null ? asRec(payload.morphology) : {};
			const trend = payload !== null ? asRec(payload.trend_analysis) : {};
			const dynamics = payload !== null ? asRec(payload.dynamics) : {};
			const advice = payload !== null ? asRec(payload.trading_advice) : {};
			const scores = payload !== null ? asRec(payload.signal_scores) : {};
			const total = chart?.dates.length ?? 0;
			const signalRows = [];
			if (chart !== null) {
				const dateIndex = /* @__PURE__ */ new Map();
				chart.dates.forEach((date, index) => dateIndex.set(date.slice(0, 10), index));
				for (const marker of chart.markers) {
					const time = asStr(marker.time ?? marker.date);
					const index = dateIndex.get(time.slice(0, 10)) ?? -1;
					if (index >= 0) signalRows.push({
						key: `m-${index}-${asStr(marker.label)}`,
						date: time.slice(0, 10),
						label: asStr(marker.label ?? marker.type ?? "信号"),
						price: asNum(marker.price),
						index
					});
				}
				for (const bi of chart.biLines.slice(-6).reverse()) {
					const endIndex = dateIndex.get(bi.end_time.slice(0, 10)) ?? -1;
					if (endIndex >= 0) signalRows.push({
						key: `b-${endIndex}`,
						date: bi.end_time.slice(0, 10),
						label: `笔转折（${bi.end_price >= bi.start_price ? "向上" : "向下"}）`,
						price: bi.end_price,
						index: endIndex
					});
				}
			}
			const lastZhongshu = chart !== null && chart.zhongshus.length > 0 ? chart.zhongshus[chart.zhongshus.length - 1] ?? null : null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-page",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", {
					className: "ksq-topbar",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-title",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "缠论研究" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "笔段中枢 · 买卖点 · 背驰 · 信号雷达" })]
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
										asStr(payload.stock_name),
										" ",
										asStr(payload.stock_code),
										" · ",
										asStr(payload.time_level)
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
						payload !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-chan-main",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "ksq-chan-chartwrap",
								children: chart !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChanChart, {
									chart,
									view,
									onViewChange: setView
								})
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
								className: "ksq-chan-side",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "ksq-chan-sidecard",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "结构" }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
												"笔 ",
												asNum(morph.bis_count) ?? "—",
												" · 段 ",
												asNum(morph.segs_count) ?? "—",
												" · 中枢 ",
												asNum(morph.zhongshus_count) ?? "—"
											] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
												asStr(trend.type_cn) || "—",
												" · 强度 ",
												asNum(trend.trend_strength) ?? "—",
												" · 现价 ",
												asNum(trend.latest_price) ?? "—"
											] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
												"买 ",
												asNum(dynamics.buy_points_count) ?? 0,
												" / 卖 ",
												asNum(dynamics.sell_points_count) ?? 0,
												" · 背驰 ",
												asNum(dynamics.backchi_count) ?? 0
											] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "ksq-item-meta",
												children: ["操作参考 ", asStr(advice.recommended_action) || "—"]
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "ksq-chan-sidecard",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "多级别联立" }),
											Object.entries(levelsBrief).map(([lvl, brief]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "ksq-chan-levelrow",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: lvl }), brief === "loading" ? "加载中…" : brief === "error" ? "加载失败" : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
													" ",
													asStr(asRec(brief.trend_analysis).type_cn) || "—",
													" ",
													"买",
													asNum(asRec(brief.dynamics).buy_points_count) ?? 0,
													"/卖",
													asNum(asRec(brief.dynamics).sell_points_count) ?? 0,
													" ",
													asNum(asRec(brief.signal_scores).final_score)?.toFixed(0) ?? "—",
													"分"
												] })]
											}, lvl)),
											Object.keys(levelsBrief).length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "ksq-item-meta",
												children: "—"
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "ksq-chan-sidecard",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "信号流（点击定位图）" }),
											signalRows.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "ksq-item-meta",
												children: "无买卖点/笔转折信号"
											}),
											signalRows.slice(0, 10).map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: `ksq-chan-signal ${row.label.includes("买") || row.label.startsWith("B") ? "up" : row.label.includes("卖") || row.label.startsWith("S") ? "down" : ""}`,
												onClick: () => {
													if (total > 0) focusIndex(row.index, total);
												},
												title: `定位到 ${row.date}`,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: row.date }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: row.label }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: row.price !== null ? row.price.toFixed(2) : "" })
												]
											}, row.key))
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "ksq-chan-sidecard",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "关键位" }),
											lastZhongshu !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
												"中枢 ",
												lastZhongshu.low.toFixed(2),
												" ~ ",
												lastZhongshu.high.toFixed(2),
												"（中轴 ",
												lastZhongshu.center.toFixed(2),
												"）"
											] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
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
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
												"入场 ",
												asNum(advice.entry_price)?.toFixed(2) ?? "—",
												" · 止损 ",
												asNum(advice.stop_loss)?.toFixed(2) ?? "—",
												" · 目标 ",
												asNum(advice.take_profit)?.toFixed(2) ?? "—"
											] })
										]
									})
								]
							})]
						}),
						payload !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-chan-summary",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SignalRadar, {
								radar: asRec(scores.radar_data),
								score: asNum(scores.final_score),
								direction: asStr(scores.direction),
								strength: asStr(scores.strength)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ksq-chan-signals",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "信号明细" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-chips",
									children: [asArr(scores.signal_details).slice(0, 12).map((item, index) => {
										const r = asRec(item);
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "ksq-chip ksq-mono",
											children: [
												asStr(r.name),
												" ",
												asStr(r.value)
											]
										}, index);
									}), asArr(scores.signal_details).length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "ksq-item-meta",
										children: "无信号"
									})]
								})]
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