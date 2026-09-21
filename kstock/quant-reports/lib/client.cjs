window.__ModuleLoader__.load({
	id: "@kstock/quant-reports",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region ../quant-ui/src/quant.css?raw
		var quant_default = "/* KStock 量化工作台面板样式（@kstock/quant 客户端半端）。\n *\n * 全部类名以 ksq- 前缀隔离；颜色走引擎 dsw 别名 token（随明暗主题\n * 自动切换），强调色沿用 KStock 品牌绿。由客户端 bundle 以 ?raw 内联，\n * apply() 时注入 <style data-kstock=\"quant-pages\">。 */\n\n.ksq-page {\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-bg-base) 88%, transparent);\n}\n\n/* ── 顶部：标题 + 库切换 tab ─────────────────────────────── */\n\n.ksq-topbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  padding: 14px 22px 0;\n  flex: none;\n}\n\n.ksq-title {\n  display: flex;\n  align-items: baseline;\n  gap: 10px;\n  min-width: 0;\n}\n\n.ksq-title strong {\n  font-size: 17px;\n  letter-spacing: 0.2px;\n}\n\n.ksq-title span {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.ksq-topbar-actions {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex: none;\n}\n\n.ksq-count {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.ksq-tabs {\n  display: flex;\n  gap: 4px;\n  padding: 10px 22px 0;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-tab {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  padding: 8px 14px 10px;\n  cursor: pointer;\n  border-bottom: 2px solid transparent;\n  margin-bottom: -1px;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-tab:hover { color: var(--dsw-alias-label-primary); }\n\n.ksq-tab.active {\n  color: var(--dsw-alias-label-primary);\n  border-bottom-color: var(--dsw-alias-brand-primary);\n  font-weight: 600;\n}\n\n/* ── 通用控件 ─────────────────────────────────────────────── */\n\n.ksq-iconbtn {\n  appearance: none;\n  border: 1px solid transparent;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  width: 28px;\n  height: 28px;\n  border-radius: 7px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n\n.ksq-iconbtn:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.ksq-iconbtn:disabled { opacity: 0.5; cursor: default; }\n.ksq-iconbtn.danger:hover { color: #e64646; }\n\n.ksq-btn {\n  appearance: none;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  padding: 5px 12px;\n  border-radius: 7px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }\n\n.ksq-linkbtn {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-link);\n  font-size: 12px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 0;\n}\n\n.ksq-linkbtn:hover { text-decoration: underline; }\n\n.ksq-search {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 8px;\n  padding: 6px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  min-width: 260px;\n}\n\n.ksq-search input {\n  border: none;\n  outline: none;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  flex: 1;\n}\n\n.ksq-search input::placeholder { color: var(--dsw-alias-label-tertiary); }\n\n.ksq-spin { animation: ksq-rotate 0.9s linear infinite; }\n\n@keyframes ksq-rotate {\n  to { transform: rotate(360deg); }\n}\n\n.ksq-error {\n  margin: 10px 22px 0;\n  padding: 8px 12px;\n  border: 1px solid rgba(230, 70, 70, 0.4);\n  border-radius: 8px;\n  background: rgba(230, 70, 70, 0.08);\n  color: #e64646;\n  font-size: 12.5px;\n}\n\n.ksq-loading {\n  margin: 24px 22px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n}\n\n.ksq-empty {\n  margin: 40px auto;\n  max-width: 420px;\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  font-size: 13px;\n}\n\n.ksq-empty strong { color: var(--dsw-alias-label-secondary); font-size: 14px; }\n\n.ksq-mono {\n  font-family: ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace;\n  font-size: 0.92em;\n}\n\n/* 数值语义色 */\n.ksq-up { color: #31c7a2; }\n.ksq-down { color: #e64646; }\n.ksq-warn { color: #e8a33d; }\n\n/* ── 数据表 ─────────────────────────────────────────────── */\n\n.ksq-table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 12.5px;\n}\n\n.ksq-table th {\n  text-align: left;\n  font-weight: 500;\n  color: var(--dsw-alias-label-tertiary);\n  padding: 6px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  white-space: nowrap;\n}\n\n.ksq-table td {\n  padding: 7px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  color: var(--dsw-alias-label-primary);\n  white-space: nowrap;\n}\n\n.ksq-table td.num { text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-table tr.selected td { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-table input[type=\"checkbox\"] { accent-color: var(--dsw-alias-brand-primary); }\n\n/* 长文本单元格裁剪（agent 写入的股票池/口径描述可达数百字，nowrap 下会把\n   操作列挤出视口）：max-width + ellipsis，全文走 title 悬浮。 */\n.ksq-table td.ksq-cell-clip {\n  max-width: 230px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* 表格横向滚动兜底：窗口再窄操作列（报告/看板）也始终可达，不整页溢出。 */\n.ksq-table-wrap { overflow-x: auto; }\n.ksq-table-wrap .ksq-table { min-width: 640px; }\n\n/* ── 内容区骨架 ─────────────────────────────────────────── */\n\n.ksq-body {\n  flex: 1;\n  overflow: auto;\n  padding: 14px 22px 26px;\n}\n\n.ksq-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-bottom: 14px;\n}\n\n/* ── 策略/因子/选股：列表 + 详情双栏 ────────────────────── */\n\n.ksq-split {\n  display: grid;\n  grid-template-columns: 264px 1fr;\n  gap: 16px;\n  align-items: start;\n}\n\n.ksq-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  position: sticky;\n  top: 0;\n}\n\n.ksq-list-item {\n  appearance: none;\n  text-align: left;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 10px;\n  padding: 9px 12px;\n  cursor: pointer;\n  color: var(--dsw-alias-label-primary);\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.ksq-list-item:hover { border-color: var(--dsw-alias-border-l2); }\n\n.ksq-list-item.active {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-1));\n}\n\n.ksq-item-name {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  font-size: 13px;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.ksq-item-name > span.ksq-name-text {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dot {\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  flex: none;\n}\n\n.ksq-dot.tone-live { background: #31c7a2; }\n.ksq-dot.tone-idle { background: #8f98a2; }\n.ksq-dot.tone-bad { background: #e64646; }\n\n.ksq-item-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-chip {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 999px;\n  padding: 0 7px;\n  font-size: 11px;\n  line-height: 18px;\n}\n\n.ksq-badge {\n  border-radius: 5px;\n  padding: 1px 7px;\n  font-size: 11px;\n  line-height: 18px;\n  flex: none;\n}\n\n.ksq-badge.tone-live {\n  color: #31c7a2;\n  background: rgba(49, 199, 162, 0.12);\n}\n\n.ksq-badge.tone-idle {\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-3);\n}\n\n.ksq-badge.tone-bad {\n  color: #e64646;\n  background: rgba(230, 70, 70, 0.1);\n}\n\n.ksq-detail { min-width: 0; display: flex; flex-direction: column; gap: 14px; }\n\n.ksq-hint {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12.5px;\n  margin: 6px 0;\n}\n\n.ksq-identity { border-bottom: 1px solid var(--dsw-alias-border-l3); padding-bottom: 10px; }\n\n.ksq-identity-head {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.ksq-identity-head h2 { font-size: 16px; margin: 0; }\n\n.ksq-hypothesis {\n  margin: 6px 0 4px;\n  font-size: 12.5px;\n  color: var(--dsw-alias-label-secondary);\n  line-height: 1.6;\n}\n\n.ksq-section-title {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n  margin: 4px 0 8px;\n}\n\n/* 版本时间线 */\n.ksq-versions { display: flex; flex-direction: column; gap: 8px; padding-left: 14px; }\n\n.ksq-version {\n  position: relative;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 9px 12px;\n}\n\n.ksq-version.latest { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); }\n\n.ksq-version::before {\n  content: \"\";\n  position: absolute;\n  left: -11px;\n  top: 16px;\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-version.latest::before { background: var(--dsw-alias-brand-primary); }\n\n.ksq-version-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 12.5px;\n}\n\n.ksq-version-note {\n  margin: 5px 0 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* 对比块 */\n.ksq-compare {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-compare h3 { font-size: 13px; margin: 0 0 8px; }\n\n.ksq-note {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  margin: 4px 0;\n}\n\n.ksq-chart { margin-top: 10px; }\n\n.ksq-chart h4 {\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n  margin: 0 0 6px;\n}\n\n.ksq-chart svg { max-width: 100%; height: auto; }\n\n/* 选股 criteria 摘要 */\n.ksq-criteria {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 8px 10px;\n  margin: 6px 0 0;\n  white-space: pre-wrap;\n  word-break: break-word;\n  max-height: 160px;\n  overflow: auto;\n}\n\n/* 选股 picks 表 */\n.ksq-picks-meta { display: flex; gap: 14px; font-size: 12px; color: var(--dsw-alias-label-tertiary); margin: 6px 0; }\n\n/* ── 报告库 ─────────────────────────────────────────────── */\n\n.ksq-report-group { margin-bottom: 16px; }\n\n.ksq-report-heading {\n  appearance: none;\n  border: none;\n  background: transparent;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  cursor: pointer;\n  padding: 4px 0 8px;\n  width: 100%;\n}\n\n.ksq-report-heading h2 { font-size: 13px; margin: 0; font-weight: 600; color: var(--dsw-alias-label-primary); }\n.ksq-report-heading span { color: var(--dsw-alias-label-tertiary); font-size: 12px; }\n\n.ksq-report-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));\n  gap: 10px;\n}\n\n.ksq-report-card {\n  display: flex;\n  gap: 12px;\n  align-items: flex-start;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-report-icon {\n  flex: none;\n  width: 34px;\n  height: 34px;\n  border-radius: 9px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);\n}\n\n.ksq-report-copy { flex: 1; min-width: 0; }\n\n.ksq-report-copy h3 {\n  margin: 0 0 4px;\n  font-size: 13.5px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-report-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px 12px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-report-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex: none; }\n\n/* 报告预览浮层 */\n.ksq-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 80;\n  background: rgba(3, 13, 11, 0.72);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 40px;\n}\n\n.ksq-dialog {\n  width: min(1080px, 100%);\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  border-radius: 14px;\n  overflow: hidden;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-dialog-bar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 14px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-dialog-bar strong {\n  font-size: 13px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dialog iframe {\n  flex: 1;\n  border: none;\n  background: #fff;\n}\n\n/* 确认弹窗 */\n.ksq-confirm {\n  width: min(420px, 100%);\n  height: auto;\n  border-radius: 14px;\n  padding: 18px;\n  gap: 10px;\n}\n\n.ksq-confirm h3 { margin: 0; font-size: 15px; }\n.ksq-confirm p { margin: 0; font-size: 12.5px; color: var(--dsw-alias-label-secondary); line-height: 1.6; }\n\n.ksq-confirm-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  margin-top: 8px;\n}\n\n.ksq-btn.danger {\n  color: #fff;\n  background: #c0392b;\n  border-color: #c0392b;\n}\n\n.ksq-btn.danger:hover { background: #a93226; }\n\n/* 复制成功提示 */\n.ksq-toast {\n  position: fixed;\n  bottom: 28px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 90;\n  /* 自洽深色药丸：不依赖宿主 toast token（--dsw-alias-toast-bg 在宿主不存在，\n     回退 bg-overlay 是遮罩 scrim 色——黑条不可读）。深底浅字双主题通用。 */\n  background: rgba(3, 13, 11, 0.92);\n  color: #e8edef;\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  font-size: 12.5px;\n  border-radius: 999px;\n  padding: 8px 16px;\n  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);\n}\n\n/* ── 财经新闻面板（@kstock/client-news）────────────────────────── */\n\n.ksq-news-list {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  padding-bottom: 8px;\n}\n\n.ksq-news-item {\n  position: relative;\n  padding: 12px 16px 12px 20px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  overflow: hidden;\n  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;\n}\n\n/* 左侧品牌色细轨：常亮 55%，hover 点满。 */\n.ksq-news-item::before {\n  content: '';\n  position: absolute;\n  left: 0;\n  top: 0;\n  bottom: 0;\n  width: 3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 100%, transparent);\n  opacity: .45;\n  transition: opacity .15s ease;\n}\n\n.ksq-news-item:hover {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, var(--dsw-alias-border-l2));\n  transform: translateY(-1px);\n  box-shadow: 0 4px 16px color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n}\n\n.ksq-news-item:hover::before {\n  opacity: 1;\n}\n\n.ksq-news-meta {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-source {\n  padding: 1.5px 8px;\n  border-radius: 99px;\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: .3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent);\n  color: var(--dsw-alias-brand-primary);\n  white-space: nowrap;\n}\n\n.ksq-news-dot {\n  width: 3px;\n  height: 3px;\n  border-radius: 50%;\n  background: currentColor;\n  opacity: .55;\n  flex: none;\n}\n\n.ksq-news-time {\n  margin-left: auto;\n  white-space: nowrap;\n}\n\n.ksq-news-title {\n  font-size: 14px;\n  font-weight: 600;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  text-decoration: none;\n}\n\na.ksq-news-title:hover {\n  color: var(--dsw-alias-link);\n}\n\n.ksq-news-summary {\n  margin: 0;\n  font-size: 12.5px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n\n.ksq-news-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 22px 0;\n  flex: none;\n}\n\n.ksq-news-toolbar .ksq-tabs { margin-bottom: 0; }\n\n.ksq-news-toolbar-right {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  min-width: 0;\n}\n\n.ksq-news-toolbar-right .ksq-search { margin-bottom: 0; flex: 1; min-width: 220px; max-width: 460px; }\n\n.ksq-news-watchedit {\n  padding: 8px 22px 0;\n  flex: none;\n}\n\n.ksq-news-watchedit input {\n  width: 100%;\n  box-sizing: border-box;\n  padding: 7px 12px;\n  border-radius: 8px;\n  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, var(--dsw-alias-border-l2));\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n}\n\n/* 双栏：主列表 + 统计侧栏（窄面板时侧栏隐藏）。 */\n.ksq-news-split {\n  display: flex;\n  gap: 20px;\n  align-items: flex-start;\n  width: 100%;\n  max-width: 1360px;\n  margin: 0 auto;\n}\n\n.ksq-news-main {\n  flex: 1;\n  min-width: 0;\n}\n\n.ksq-news-item.read { opacity: .58; }\n.ksq-news-item.read:hover { opacity: 1; }\n\n.ksq-news-item.watched {\n  border-color: color-mix(in srgb, #f59e0b 45%, var(--dsw-alias-border-l2));\n  background: color-mix(in srgb, #f59e0b 5%, var(--dsw-alias-bg-layer-2));\n}\n\n.ksq-news-item.watched::before {\n  background: #f59e0b;\n}\n\n.ksq-news-watchflag {\n  padding: 1px 7px;\n  border-radius: 99px;\n  font-size: 10.5px;\n  font-weight: 600;\n  letter-spacing: .5px;\n  color: #f59e0b;\n  background: color-mix(in srgb, #f59e0b 16%, transparent);\n}\n\n.ksq-news-stocks {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-stocktag {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  padding: 2px 9px;\n  border-radius: 6px;\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n  transition: border-color .12s ease, background .12s ease;\n}\n\n.ksq-news-stocktag:hover {\n  border-color: var(--dsw-alias-brand-primary);\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);\n}\n\n.ksq-news-actions {\n  display: flex;\n  justify-content: flex-end;\n  font-size: 12.5px;\n}\n\n/* 统计侧栏 */\n.ksq-news-stats {\n  flex: none;\n  width: 220px;\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  position: sticky;\n  top: 0;\n}\n\n@media (max-width: 980px) {\n  .ksq-news-stats { display: none; }\n  .ksq-news-split { display: block; }\n}\n\n.ksq-news-stats-block {\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  padding: 12px 14px;\n}\n\n.ksq-news-stats-head {\n  font-size: 13px;\n  font-weight: 600;\n  margin-bottom: 10px;\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n}\n\n.ksq-news-stats-head span {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-stats-empty {\n  margin: 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-trending {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-trendword {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 2.5px 9px;\n  border-radius: 99px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-news-trendword:hover {\n  color: var(--dsw-alias-brand-primary);\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.ksq-news-trendword em {\n  font-style: normal;\n  font-size: 10.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-freq {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: 50px;\n}\n\n.ksq-news-freq-bar {\n  flex: 1;\n  min-width: 3px;\n  border-radius: 2px 2px 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n}\n\n.ksq-news-freq-bar:hover {\n  background: var(--dsw-alias-brand-primary);\n}\n\n/* ── 联动任务目标选择菜单（§26-10，新闻/选股库共用）────────────── */\n\n.ksq-target-overlay { z-index: 95; padding: 40px; background: rgba(3, 13, 11, 0.45); }\n\n.ksq-target-menu {\n  width: min(480px, 100%);\n  max-height: min(70vh, 560px);\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  padding: 12px;\n  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);\n}\n\n.ksq-target-head {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  padding: 4px 8px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  margin-bottom: 6px;\n}\n\n.ksq-target-item {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  padding: 9px 10px;\n  border: none;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  text-align: left;\n  cursor: pointer;\n  font-size: 13px;\n}\n\n.ksq-target-item:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }\n.ksq-target-item:disabled { opacity: 0.55; cursor: default; }\n.ksq-target-item.last { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }\n\n.ksq-target-name { font-weight: 500; flex: none; }\n.ksq-target-path {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-target-error { color: #e64646; font-size: 12.5px; margin: 4px 8px; }\n.ksq-target-cancel { align-self: flex-end; margin-top: 4px; }\n\n/* ── 选股库：口径芯片（P4）+ 命中趋势（P3）────────────────────── */\n\n.ksq-chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0 2px; }\n.ksq-chips .ksq-chip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }\n\n.ksq-trend {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 8px 10px;\n  margin: 6px 0 10px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-trend-label {\n  flex: none;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-trend-bars {\n  flex: 1;\n  display: flex;\n  align-items: flex-end;\n  justify-content: flex-start;\n  gap: 4px;\n  height: 44px;\n  min-width: 0;\n}\n\n.ksq-trend-col {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: 100%;\n  cursor: default;\n}\n\n.ksq-trend-bar {\n  width: 9px;\n  min-height: 3px;\n  border-radius: 2px 2px 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 60%, transparent);\n}\n\n.ksq-trend-bar:hover { background: var(--dsw-alias-brand-primary); }\n\n.ksq-trend-bar.consensus { background: #31c7a2; }\n.ksq-trend-bar.consensus:hover { background: #22a06b; }\n\n/* ── 因子库：跨因子概览（F3，IC 均值零轴双向横条）──────────────── */\n\n.ksq-factors-overview {\n  display: flex;\n  align-items: flex-start;\n  gap: 10px;\n  padding: 10px 12px;\n  margin-bottom: 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-fo-rows { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }\n\n.ksq-fo-row {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  padding: 3px 6px;\n  border: none;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  text-align: left;\n  cursor: pointer;\n  font-size: 12px;\n}\n\n.ksq-fo-row:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-fo-row.active { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); }\n\n.ksq-fo-name {\n  flex: none;\n  width: 128px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-weight: 500;\n}\n\n.ksq-fo-bar {\n  flex: 1;\n  position: relative;\n  height: 10px;\n  min-width: 0;\n}\n\n/* 零轴：容器中缝 1px 基线；正值条从中线向右，负值向左。 */\n.ksq-fo-bar::before {\n  content: '';\n  position: absolute;\n  left: 50%;\n  top: -2px;\n  bottom: -2px;\n  width: 1px;\n  background: var(--dsw-alias-border-l3);\n}\n\n.ksq-fo-fill {\n  position: absolute;\n  top: 1px;\n  bottom: 1px;\n  border-radius: 2px;\n}\n\n.ksq-fo-fill.up { background: #31c7a2; }\n.ksq-fo-fill.down { background: #e64646; }\n\n.ksq-fo-value { flex: none; width: 52px; text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-fo-ir { flex: none; width: 64px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }\n\n/* ── 策略库：调仓记录（§28-5，按日折叠）────────────────────────── */\n\n.ksq-rebalances {\n  max-height: 380px;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 6px;\n}\n\n.ksq-rebalance { border-bottom: 1px solid var(--dsw-alias-border-l3); }\n.ksq-rebalance:last-child { border-bottom: none; }\n\n.ksq-rebalance summary {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 5px 8px;\n  cursor: pointer;\n  font-size: 12.5px;\n  list-style: none;\n  border-radius: 6px;\n}\n\n.ksq-rebalance summary::-webkit-details-marker { display: none; }\n.ksq-rebalance summary::before { content: '\\25B8'; color: var(--dsw-alias-label-tertiary); transition: transform 0.12s; }\n.ksq-rebalance[open] summary::before { transform: rotate(90deg); }\n.ksq-rebalance summary:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }\n\n.ksq-rebalance-body { padding: 6px 10px 10px 22px; display: flex; flex-direction: column; gap: 6px; }\n\n.ksq-rebalance-dayhead { display: flex; justify-content: flex-end; }\n\n/* ── 版本迭代面板（§28-10「从此版本改进」）────────────────────── */\n\n.ksq-iter {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  margin-top: 8px;\n  padding: 10px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 4%, transparent);\n}\n\n.ksq-iter-chip { cursor: pointer; background: transparent; }\n.ksq-iter-chip.active {\n  border-color: var(--dsw-alias-brand-primary);\n  color: var(--dsw-alias-brand-primary);\n  font-weight: 500;\n}\n\n.ksq-iter-input {\n  height: 30px;\n  padding: 0 10px;\n  border-radius: 8px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: transparent;\n  color: inherit;\n  font-size: 12.5px;\n}\n.ksq-rebalance-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\n@media (max-width: 720px) { .ksq-rebalance-cols { grid-template-columns: 1fr; } }\n.ksq-rebalance-side p { margin: 0 0 4px; font-size: 12px; font-weight: 500; }\n.ksq-rebalance-side .ksq-table { font-size: 11.5px; }\n";
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
		async function listReports(filters = {}) {
			const params = new URLSearchParams();
			if (filters.date) params.set("date", filters.date);
			if (filters.symbol) params.set("symbol", filters.symbol);
			if (filters.query) params.set("query", filters.query);
			return (await get(`/kstock-api/reports${params.toString() ? `?${params.toString()}` : ""}`)).reports;
		}
		async function fetchReportHtml(reportId) {
			const response = await fetch(`/kstock-api/reports/${encodeURIComponent(reportId)}/content`);
			if (!response.ok) throw new KsqError(response.status, `报告加载失败（${response.status}）`);
			return response.text();
		}
		/** 报告 HTML 的 blob 预览地址。显式带 utf-8 charset——blob 文档不继承响应头，缺失时中文会被按 windows-1252 解码。 */
		function reportBlobUrl(html) {
			return URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
		}
		const deleteReport = (reportId) => request(`/kstock-api/reports/${encodeURIComponent(reportId)}`, { method: "DELETE" });
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
		function IconRefresh(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 3v6h-6" })]
			});
		}
		function IconSearch(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "11",
					cy: "11",
					r: "7"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m20 20-3.5-3.5" })]
			});
		}
		function IconTrash(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 6h18" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" })
				]
			});
		}
		function IconFile(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M14 3v5h5" })]
			});
		}
		function IconCalendar(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "3",
					y: "5",
					width: "18",
					height: "16",
					rx: "2"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 3v4M16 3v4M3 10h18" })]
			});
		}
		function IconChevronDown(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, {
				...props,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m6 9 6 6 6-6" })
			});
		}
		function IconChevronRight(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Svg, {
				...props,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "m9 6 6 6-6 6" })
			});
		}
		function IconExternal(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M15 3h6v6" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M10 14 21 3" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" })
				]
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
		function Empty({ icon, title, hint }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-empty",
				children: [
					icon,
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: title }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: hint })
				]
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
		/** 确认弹窗（删除等破坏性操作）。 */
		function ConfirmDialog({ title, description, confirmText, onConfirm, onCancel }) {
			(0, react.useEffect)(() => {
				const onKey = (event) => {
					if (event.key === "Escape") onCancel();
				};
				window.addEventListener("keydown", onKey);
				return () => window.removeEventListener("keydown", onKey);
			}, [onCancel]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "ksq-overlay",
				role: "dialog",
				"aria-modal": "true",
				"aria-label": title,
				onClick: onCancel,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ksq-dialog ksq-confirm",
					onClick: (event) => event.stopPropagation(),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", { children: title }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: description }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-confirm-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ksq-btn",
								onClick: onCancel,
								children: "取消"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ksq-btn danger",
								onClick: onConfirm,
								children: confirmText
							})]
						})
					]
				})
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
		const STYLE_VERSION = "2026-09-20.13-sel9";
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
		//#region src/client/section.tsx
		/**
		* 报告库面板：按日期分组浏览归档的 HTML 看板，搜索 / 预览 / 删除。
		* 移植自 1.x components/ReportLibrary.tsx；预览 iframe 沿用 sandbox
		* allow-scripts（与服务端 CSP 头双重隔离）。
		*/
		function ReportsSection() {
			const [reports, setReports] = (0, react.useState)([]);
			const [query, setQuery] = (0, react.useState)("");
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [preview, setPreview] = (0, react.useState)(null);
			const [pendingDelete, setPendingDelete] = (0, react.useState)(null);
			const [collapsed, setCollapsed] = (0, react.useState)(/* @__PURE__ */ new Set());
			const reload = (0, react.useCallback)(async () => {
				setLoading(true);
				setError(null);
				try {
					setReports(await listReports({ query: query.trim() || void 0 }));
				} catch (err) {
					setError(err instanceof Error ? err.message : "报告库加载失败");
				} finally {
					setLoading(false);
				}
			}, [query]);
			(0, react.useEffect)(() => {
				reload();
			}, [reload]);
			const grouped = (0, react.useMemo)(() => {
				const groups = /* @__PURE__ */ new Map();
				reports.forEach((report) => {
					const date = report.generated_at.slice(0, 10) || "未标注日期";
					groups.set(date, [...groups.get(date) ?? [], report]);
				});
				return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
			}, [reports]);
			const openPreview = async (report) => {
				setError(null);
				try {
					const html = await fetchReportHtml(report.report_id);
					setPreview({
						report,
						url: reportBlobUrl(html)
					});
				} catch (err) {
					setError(err instanceof Error ? err.message : "报告加载失败");
				}
			};
			const closePreview = () => {
				if (preview) URL.revokeObjectURL(preview.url);
				setPreview(null);
			};
			const toggleCollapse = (0, react.useCallback)((date) => {
				setCollapsed((prev) => {
					const next = new Set(prev);
					if (next.has(date)) next.delete(date);
					else next.add(date);
					return next;
				});
			}, []);
			const confirmDelete = async () => {
				if (!pendingDelete) return;
				try {
					await deleteReport(pendingDelete.report_id);
					setPendingDelete(null);
					closePreview();
					await reload();
				} catch (err) {
					setError(err instanceof Error ? err.message : "报告删除失败");
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-body",
				"aria-label": "报告库",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-toolbar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "ksq-search",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSearch, { size: 14 }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								value: query,
								onChange: (event) => setQuery(event.target.value),
								placeholder: "搜索标题、标的或报告类型"
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RefreshButton, {
							refreshing: loading,
							onClick: () => void reload(),
							label: "刷新报告库"
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorLine, { message: error }),
					loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { text: "加载报告库…" }) : grouped.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
						icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFile, { size: 22 }),
						title: "暂无归档报告",
						hint: "在对话里让 agent 生成 HTML 看板并归档后，这里会按日期出现报告。"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: grouped.map(([date, items]) => {
						const isCollapsed = collapsed.has(date);
						const groupId = `ksq-report-group-${date}`;
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
							className: "ksq-report-group",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "ksq-report-heading",
								onClick: () => toggleCollapse(date),
								"aria-expanded": !isCollapsed,
								"aria-controls": groupId,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCalendar, { size: 14 }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: date }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [items.length, " 份"] }),
									isCollapsed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevronRight, { size: 13 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevronDown, { size: 13 })
								]
							}), !isCollapsed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								id: groupId,
								className: "ksq-report-grid",
								children: items.map((report) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
									className: "ksq-report-card",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "ksq-report-icon",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFile, { size: 16 })
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "ksq-report-copy",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
												title: report.title,
												children: report.title
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "ksq-report-meta",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: report.symbol || "未标注标的" }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: report.report_type }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
														report.period_start || "—",
														" 至 ",
														report.period_end || "—"
													] }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["风险 ", report.risk_level || "未标注"] })
												]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "ksq-report-actions",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: "ksq-btn",
												onClick: () => void openPreview(report),
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconExternal, { size: 13 }), " 打开看板"]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "ksq-iconbtn danger",
												onClick: () => setPendingDelete(report),
												"aria-label": `删除报告 ${report.title}`,
												title: "删除报告",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconTrash, { size: 14 })
											})]
										})
									]
								}, report.report_id))
							})]
						}, date);
					}) }),
					preview && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreviewDialog, {
						title: preview.report.title,
						onClose: closePreview,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
							title: preview.report.title,
							src: preview.url,
							sandbox: "allow-scripts"
						})
					}),
					pendingDelete && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ConfirmDialog, {
						title: "删除报告？",
						description: `将从报告库删除「${pendingDelete.title}」及其 HTML 文件。历史任务和其他报告不受影响。`,
						confirmText: "删除报告",
						onConfirm: () => void confirmDelete(),
						onCancel: () => setPendingDelete(null)
					})
				]
			});
		}
		//#endregion
		//#region src/client/page.tsx
		/**
		* 报告库 主区面板：页头 + 库 Section。
		*/
		function ReportsPage() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-page",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", {
					className: "ksq-topbar",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-title",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "报告库" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "研究报告归档：日期分组与看板预览" })]
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReportsSection, {})]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* ${pkg} — KStock 量化库客户端插件。
		*
		* 注册 `main` keyed 面板（键 kstock-quant-reports）+ `sidebar.panellist` 导航入口
		* （同 id，侧栏自动接线 ctx.layout.selectPanel）；ksq 样式经
		* @kstock/quant-ui 幂等注入（四个量化库插件共用一份）。
		*/
		/** 面板键：main slot 与侧栏入口共用。 */
		const PANEL_KEY = "kstock-quant-reports";
		/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
		function NavIcon({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFile, { size: size ?? 18 });
		}
		/** 必需服务：slot 注册表。 */
		const inject = ["slots"];
		/** 客户端插件体。 */
		function apply(ctx) {
			ctx.effect(() => {
				injectQuantStyles();
				ctx.slots.inject("main", () => ctx.slots.register({
					name: "main",
					key: PANEL_KEY
				}, ReportsPage));
				ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
					name: "sidebar.panellist",
					id: PANEL_KEY,
					order: 130,
					label: "报告库"
				}, NavIcon));
			}, "kstock-quant-reports: panel + nav");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.cjs.map