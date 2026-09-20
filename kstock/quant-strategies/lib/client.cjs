window.__ModuleLoader__.load({
	id: "@kstock/quant-strategies",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region ../quant-ui/src/quant.css?raw
		var quant_default = "/* KStock 量化工作台面板样式（@kstock/quant 客户端半端）。\n *\n * 全部类名以 ksq- 前缀隔离；颜色走引擎 dsw 别名 token（随明暗主题\n * 自动切换），强调色沿用 KStock 品牌绿。由客户端 bundle 以 ?raw 内联，\n * apply() 时注入 <style data-kstock=\"quant-pages\">。 */\n\n.ksq-page {\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-bg-base) 88%, transparent);\n}\n\n/* ── 顶部：标题 + 库切换 tab ─────────────────────────────── */\n\n.ksq-topbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  padding: 14px 22px 0;\n  flex: none;\n}\n\n.ksq-title {\n  display: flex;\n  align-items: baseline;\n  gap: 10px;\n  min-width: 0;\n}\n\n.ksq-title strong {\n  font-size: 17px;\n  letter-spacing: 0.2px;\n}\n\n.ksq-title span {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.ksq-topbar-actions {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex: none;\n}\n\n.ksq-count {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.ksq-tabs {\n  display: flex;\n  gap: 4px;\n  padding: 10px 22px 0;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-tab {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  padding: 8px 14px 10px;\n  cursor: pointer;\n  border-bottom: 2px solid transparent;\n  margin-bottom: -1px;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-tab:hover { color: var(--dsw-alias-label-primary); }\n\n.ksq-tab.active {\n  color: var(--dsw-alias-label-primary);\n  border-bottom-color: var(--dsw-alias-brand-primary);\n  font-weight: 600;\n}\n\n/* ── 通用控件 ─────────────────────────────────────────────── */\n\n.ksq-iconbtn {\n  appearance: none;\n  border: 1px solid transparent;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  width: 28px;\n  height: 28px;\n  border-radius: 7px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n\n.ksq-iconbtn:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.ksq-iconbtn:disabled { opacity: 0.5; cursor: default; }\n.ksq-iconbtn.danger:hover { color: #e64646; }\n\n.ksq-btn {\n  appearance: none;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  padding: 5px 12px;\n  border-radius: 7px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }\n\n.ksq-linkbtn {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-link);\n  font-size: 12px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 0;\n}\n\n.ksq-linkbtn:hover { text-decoration: underline; }\n\n.ksq-search {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 8px;\n  padding: 6px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  min-width: 260px;\n}\n\n.ksq-search input {\n  border: none;\n  outline: none;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  flex: 1;\n}\n\n.ksq-search input::placeholder { color: var(--dsw-alias-label-tertiary); }\n\n.ksq-spin { animation: ksq-rotate 0.9s linear infinite; }\n\n@keyframes ksq-rotate {\n  to { transform: rotate(360deg); }\n}\n\n.ksq-error {\n  margin: 10px 22px 0;\n  padding: 8px 12px;\n  border: 1px solid rgba(230, 70, 70, 0.4);\n  border-radius: 8px;\n  background: rgba(230, 70, 70, 0.08);\n  color: #e64646;\n  font-size: 12.5px;\n}\n\n.ksq-loading {\n  margin: 24px 22px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n}\n\n.ksq-empty {\n  margin: 40px auto;\n  max-width: 420px;\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  font-size: 13px;\n}\n\n.ksq-empty strong { color: var(--dsw-alias-label-secondary); font-size: 14px; }\n\n.ksq-mono {\n  font-family: ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace;\n  font-size: 0.92em;\n}\n\n/* 数值语义色 */\n.ksq-up { color: #31c7a2; }\n.ksq-down { color: #e64646; }\n.ksq-warn { color: #e8a33d; }\n\n/* ── 数据表 ─────────────────────────────────────────────── */\n\n.ksq-table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 12.5px;\n}\n\n.ksq-table th {\n  text-align: left;\n  font-weight: 500;\n  color: var(--dsw-alias-label-tertiary);\n  padding: 6px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  white-space: nowrap;\n}\n\n.ksq-table td {\n  padding: 7px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  color: var(--dsw-alias-label-primary);\n  white-space: nowrap;\n}\n\n.ksq-table td.num { text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-table tr.selected td { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-table input[type=\"checkbox\"] { accent-color: var(--dsw-alias-brand-primary); }\n\n/* 长文本单元格裁剪（agent 写入的股票池/口径描述可达数百字，nowrap 下会把\n   操作列挤出视口）：max-width + ellipsis，全文走 title 悬浮。 */\n.ksq-table td.ksq-cell-clip {\n  max-width: 230px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* 表格横向滚动兜底：窗口再窄操作列（报告/看板）也始终可达，不整页溢出。 */\n.ksq-table-wrap { overflow-x: auto; }\n.ksq-table-wrap .ksq-table { min-width: 640px; }\n\n/* ── 内容区骨架 ─────────────────────────────────────────── */\n\n.ksq-body {\n  flex: 1;\n  overflow: auto;\n  padding: 14px 22px 26px;\n}\n\n.ksq-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-bottom: 14px;\n}\n\n/* ── 策略/因子/选股：列表 + 详情双栏 ────────────────────── */\n\n.ksq-split {\n  display: grid;\n  grid-template-columns: 264px 1fr;\n  gap: 16px;\n  align-items: start;\n}\n\n.ksq-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  position: sticky;\n  top: 0;\n}\n\n.ksq-list-item {\n  appearance: none;\n  text-align: left;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 10px;\n  padding: 9px 12px;\n  cursor: pointer;\n  color: var(--dsw-alias-label-primary);\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.ksq-list-item:hover { border-color: var(--dsw-alias-border-l2); }\n\n.ksq-list-item.active {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-1));\n}\n\n.ksq-item-name {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  font-size: 13px;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.ksq-item-name > span.ksq-name-text {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dot {\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  flex: none;\n}\n\n.ksq-dot.tone-live { background: #31c7a2; }\n.ksq-dot.tone-idle { background: #8f98a2; }\n.ksq-dot.tone-bad { background: #e64646; }\n\n.ksq-item-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-chip {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 999px;\n  padding: 0 7px;\n  font-size: 11px;\n  line-height: 18px;\n}\n\n.ksq-badge {\n  border-radius: 5px;\n  padding: 1px 7px;\n  font-size: 11px;\n  line-height: 18px;\n  flex: none;\n}\n\n.ksq-badge.tone-live {\n  color: #31c7a2;\n  background: rgba(49, 199, 162, 0.12);\n}\n\n.ksq-badge.tone-idle {\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-3);\n}\n\n.ksq-badge.tone-bad {\n  color: #e64646;\n  background: rgba(230, 70, 70, 0.1);\n}\n\n.ksq-detail { min-width: 0; display: flex; flex-direction: column; gap: 14px; }\n\n.ksq-hint {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12.5px;\n  margin: 6px 0;\n}\n\n.ksq-identity { border-bottom: 1px solid var(--dsw-alias-border-l3); padding-bottom: 10px; }\n\n.ksq-identity-head {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.ksq-identity-head h2 { font-size: 16px; margin: 0; }\n\n.ksq-hypothesis {\n  margin: 6px 0 4px;\n  font-size: 12.5px;\n  color: var(--dsw-alias-label-secondary);\n  line-height: 1.6;\n}\n\n.ksq-section-title {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n  margin: 4px 0 8px;\n}\n\n/* 版本时间线 */\n.ksq-versions { display: flex; flex-direction: column; gap: 8px; padding-left: 14px; }\n\n.ksq-version {\n  position: relative;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 9px 12px;\n}\n\n.ksq-version.latest { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); }\n\n.ksq-version::before {\n  content: \"\";\n  position: absolute;\n  left: -11px;\n  top: 16px;\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-version.latest::before { background: var(--dsw-alias-brand-primary); }\n\n.ksq-version-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 12.5px;\n}\n\n.ksq-version-note {\n  margin: 5px 0 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* 对比块 */\n.ksq-compare {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-compare h3 { font-size: 13px; margin: 0 0 8px; }\n\n.ksq-note {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  margin: 4px 0;\n}\n\n.ksq-chart { margin-top: 10px; }\n\n.ksq-chart h4 {\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n  margin: 0 0 6px;\n}\n\n.ksq-chart svg { max-width: 100%; height: auto; }\n\n/* 选股 criteria 摘要 */\n.ksq-criteria {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 8px 10px;\n  margin: 6px 0 0;\n  white-space: pre-wrap;\n  word-break: break-word;\n  max-height: 160px;\n  overflow: auto;\n}\n\n/* 选股 picks 表 */\n.ksq-picks-meta { display: flex; gap: 14px; font-size: 12px; color: var(--dsw-alias-label-tertiary); margin: 6px 0; }\n\n/* ── 报告库 ─────────────────────────────────────────────── */\n\n.ksq-report-group { margin-bottom: 16px; }\n\n.ksq-report-heading {\n  appearance: none;\n  border: none;\n  background: transparent;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  cursor: pointer;\n  padding: 4px 0 8px;\n  width: 100%;\n}\n\n.ksq-report-heading h2 { font-size: 13px; margin: 0; font-weight: 600; color: var(--dsw-alias-label-primary); }\n.ksq-report-heading span { color: var(--dsw-alias-label-tertiary); font-size: 12px; }\n\n.ksq-report-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));\n  gap: 10px;\n}\n\n.ksq-report-card {\n  display: flex;\n  gap: 12px;\n  align-items: flex-start;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-report-icon {\n  flex: none;\n  width: 34px;\n  height: 34px;\n  border-radius: 9px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);\n}\n\n.ksq-report-copy { flex: 1; min-width: 0; }\n\n.ksq-report-copy h3 {\n  margin: 0 0 4px;\n  font-size: 13.5px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-report-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px 12px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-report-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex: none; }\n\n/* 报告预览浮层 */\n.ksq-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 80;\n  background: rgba(3, 13, 11, 0.72);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 40px;\n}\n\n.ksq-dialog {\n  width: min(1080px, 100%);\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  border-radius: 14px;\n  overflow: hidden;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-dialog-bar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 14px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-dialog-bar strong {\n  font-size: 13px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dialog iframe {\n  flex: 1;\n  border: none;\n  background: #fff;\n}\n\n/* 确认弹窗 */\n.ksq-confirm {\n  width: min(420px, 100%);\n  height: auto;\n  border-radius: 14px;\n  padding: 18px;\n  gap: 10px;\n}\n\n.ksq-confirm h3 { margin: 0; font-size: 15px; }\n.ksq-confirm p { margin: 0; font-size: 12.5px; color: var(--dsw-alias-label-secondary); line-height: 1.6; }\n\n.ksq-confirm-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  margin-top: 8px;\n}\n\n.ksq-btn.danger {\n  color: #fff;\n  background: #c0392b;\n  border-color: #c0392b;\n}\n\n.ksq-btn.danger:hover { background: #a93226; }\n\n/* 复制成功提示 */\n.ksq-toast {\n  position: fixed;\n  bottom: 28px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 90;\n  background: var(--dsw-alias-toast-bg, var(--dsw-alias-bg-overlay));\n  color: var(--dsw-alias-label-primary);\n  font-size: 12.5px;\n  border-radius: 999px;\n  padding: 8px 16px;\n  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);\n}\n\n/* ── 财经新闻面板（@kstock/client-news）────────────────────────── */\n\n.ksq-news-list {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  padding-bottom: 8px;\n}\n\n.ksq-news-item {\n  position: relative;\n  padding: 12px 16px 12px 20px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  overflow: hidden;\n  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;\n}\n\n/* 左侧品牌色细轨：常亮 55%，hover 点满。 */\n.ksq-news-item::before {\n  content: '';\n  position: absolute;\n  left: 0;\n  top: 0;\n  bottom: 0;\n  width: 3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 100%, transparent);\n  opacity: .45;\n  transition: opacity .15s ease;\n}\n\n.ksq-news-item:hover {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, var(--dsw-alias-border-l2));\n  transform: translateY(-1px);\n  box-shadow: 0 4px 16px color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n}\n\n.ksq-news-item:hover::before {\n  opacity: 1;\n}\n\n.ksq-news-meta {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-source {\n  padding: 1.5px 8px;\n  border-radius: 99px;\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: .3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent);\n  color: var(--dsw-alias-brand-primary);\n  white-space: nowrap;\n}\n\n.ksq-news-dot {\n  width: 3px;\n  height: 3px;\n  border-radius: 50%;\n  background: currentColor;\n  opacity: .55;\n  flex: none;\n}\n\n.ksq-news-time {\n  margin-left: auto;\n  white-space: nowrap;\n}\n\n.ksq-news-title {\n  font-size: 14px;\n  font-weight: 600;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  text-decoration: none;\n}\n\na.ksq-news-title:hover {\n  color: var(--dsw-alias-link);\n}\n\n.ksq-news-summary {\n  margin: 0;\n  font-size: 12.5px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n\n.ksq-news-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 22px 0;\n  flex: none;\n}\n\n.ksq-news-toolbar .ksq-tabs { margin-bottom: 0; }\n\n.ksq-news-toolbar-right {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  min-width: 0;\n}\n\n.ksq-news-toolbar-right .ksq-search { margin-bottom: 0; flex: 1; min-width: 220px; max-width: 460px; }\n\n.ksq-news-watchedit {\n  padding: 8px 22px 0;\n  flex: none;\n}\n\n.ksq-news-watchedit input {\n  width: 100%;\n  box-sizing: border-box;\n  padding: 7px 12px;\n  border-radius: 8px;\n  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, var(--dsw-alias-border-l2));\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n}\n\n/* 双栏：主列表 + 统计侧栏（窄面板时侧栏隐藏）。 */\n.ksq-news-split {\n  display: flex;\n  gap: 20px;\n  align-items: flex-start;\n  width: 100%;\n  max-width: 1360px;\n  margin: 0 auto;\n}\n\n.ksq-news-main {\n  flex: 1;\n  min-width: 0;\n}\n\n.ksq-news-item.read { opacity: .58; }\n.ksq-news-item.read:hover { opacity: 1; }\n\n.ksq-news-item.watched {\n  border-color: color-mix(in srgb, #f59e0b 45%, var(--dsw-alias-border-l2));\n  background: color-mix(in srgb, #f59e0b 5%, var(--dsw-alias-bg-layer-2));\n}\n\n.ksq-news-item.watched::before {\n  background: #f59e0b;\n}\n\n.ksq-news-watchflag {\n  padding: 1px 7px;\n  border-radius: 99px;\n  font-size: 10.5px;\n  font-weight: 600;\n  letter-spacing: .5px;\n  color: #f59e0b;\n  background: color-mix(in srgb, #f59e0b 16%, transparent);\n}\n\n.ksq-news-stocks {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-stocktag {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  padding: 2px 9px;\n  border-radius: 6px;\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n  transition: border-color .12s ease, background .12s ease;\n}\n\n.ksq-news-stocktag:hover {\n  border-color: var(--dsw-alias-brand-primary);\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);\n}\n\n.ksq-news-actions {\n  display: flex;\n  justify-content: flex-end;\n  font-size: 12.5px;\n}\n\n/* 统计侧栏 */\n.ksq-news-stats {\n  flex: none;\n  width: 220px;\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  position: sticky;\n  top: 0;\n}\n\n@media (max-width: 980px) {\n  .ksq-news-stats { display: none; }\n  .ksq-news-split { display: block; }\n}\n\n.ksq-news-stats-block {\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  padding: 12px 14px;\n}\n\n.ksq-news-stats-head {\n  font-size: 13px;\n  font-weight: 600;\n  margin-bottom: 10px;\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n}\n\n.ksq-news-stats-head span {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-stats-empty {\n  margin: 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-trending {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-trendword {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 2.5px 9px;\n  border-radius: 99px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-news-trendword:hover {\n  color: var(--dsw-alias-brand-primary);\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.ksq-news-trendword em {\n  font-style: normal;\n  font-size: 10.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-freq {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: 50px;\n}\n\n.ksq-news-freq-bar {\n  flex: 1;\n  min-width: 3px;\n  border-radius: 2px 2px 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n}\n\n.ksq-news-freq-bar:hover {\n  background: var(--dsw-alias-brand-primary);\n}\n";
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
		/** 通用多序列折线叠加图（策略净值 / 因子累计 IC 共用，自绘 SVG）。 */
		function LineOverlay({ series, baseline, title }) {
			const drawable = series.filter((item) => item.values.length >= 2);
			if (drawable.length === 0) return null;
			const width = 560;
			const height = 240;
			const padLeft = 46;
			const padBottom = 26;
			const maxLen = Math.max(...drawable.map((item) => item.values.length));
			const all = drawable.flatMap((item) => item.values);
			const min = Math.min(...all, baseline ?? Infinity);
			const max = Math.max(...all, baseline ?? -Infinity);
			const span = max - min || 1;
			const x = (index, length) => padLeft + index / Math.max(1, length - 1) * (width - padLeft - 12);
			const y = (value) => 14 + (1 - (value - min) / span) * (height - padBottom - 14);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: `0 0 ${width} ${height}`,
				role: "img",
				"aria-label": title,
				children: [
					baseline !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
						x1: padLeft,
						y1: y(baseline),
						x2: width - 12,
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
		const STYLE_VERSION = "2026-09-20.5-sel1";
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
		function StrategiesSection() {
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
			const rerunPrompt = (version) => `请重跑策略库中的「${selected?.name ?? ""}」（${selectedId}）：策略代码与参数采用 v${version.version} 版本（change_note：${version.change_note || "无"}），数据区间与交易规则参照该版本最近一次回测（无历史记录则用近 2 年日线 + 默认 A 股规则）。跑完后把结果入库：POST /kstock-api/strategies/${selectedId}/runs，version=${version.version}，附 data_start/data_end/rules/metrics/equity。`;
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
								children: "暂无策略。在对话里让 agent 做「策略研究回测」并入库版本后，这里会出现策略资产。"
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
							children: !selected ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
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
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "时间" })
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
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: formatDateTime(run.created_at) })
										]
									}, run.run_id)) })]
								})] }),
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
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CopyToast, { text: toast })
				]
			});
		}
		//#endregion
		//#region src/client/page.tsx
		/**
		* 策略库 主区面板：页头 + 库 Section。
		*/
		function StrategiesPage() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-page",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", {
					className: "ksq-topbar",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-title",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "策略库" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "策略研究资产沉淀：版本时间线与回测对比" })]
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StrategiesSection, {})]
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
		*/
		/** 面板键：main slot 与侧栏入口共用。 */
		const PANEL_KEY = "kstock-quant-strategies";
		/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
		function NavIcon({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCandles, { size: size ?? 18 });
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