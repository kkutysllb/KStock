window.__ModuleLoader__.load({
	id: "@kstock/client-news",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region ../quant-ui/src/quant.css?raw
		var quant_default = "/* KStock 量化工作台面板样式（@kstock/quant 客户端半端）。\n *\n * 全部类名以 ksq- 前缀隔离；颜色走引擎 dsw 别名 token（随明暗主题\n * 自动切换），强调色沿用 KStock 品牌绿。由客户端 bundle 以 ?raw 内联，\n * apply() 时注入 <style data-kstock=\"quant-pages\">。 */\n\n.ksq-page {\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-bg-base) 88%, transparent);\n}\n\n/* ── 顶部：标题 + 库切换 tab ─────────────────────────────── */\n\n.ksq-topbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  padding: 14px 22px 0;\n  flex: none;\n}\n\n.ksq-title {\n  display: flex;\n  align-items: baseline;\n  gap: 10px;\n  min-width: 0;\n}\n\n.ksq-title strong {\n  font-size: 17px;\n  letter-spacing: 0.2px;\n}\n\n.ksq-title span {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.ksq-topbar-actions {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex: none;\n}\n\n.ksq-count {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.ksq-tabs {\n  display: flex;\n  gap: 4px;\n  padding: 10px 22px 0;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-tab {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  padding: 8px 14px 10px;\n  cursor: pointer;\n  border-bottom: 2px solid transparent;\n  margin-bottom: -1px;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-tab:hover { color: var(--dsw-alias-label-primary); }\n\n.ksq-tab.active {\n  color: var(--dsw-alias-label-primary);\n  border-bottom-color: var(--dsw-alias-brand-primary);\n  font-weight: 600;\n}\n\n/* ── 通用控件 ─────────────────────────────────────────────── */\n\n.ksq-iconbtn {\n  appearance: none;\n  border: 1px solid transparent;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  width: 28px;\n  height: 28px;\n  border-radius: 7px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n\n.ksq-iconbtn:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.ksq-iconbtn:disabled { opacity: 0.5; cursor: default; }\n.ksq-iconbtn.danger:hover { color: #e64646; }\n\n.ksq-btn {\n  appearance: none;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  padding: 5px 12px;\n  border-radius: 7px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }\n\n.ksq-linkbtn {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-link);\n  font-size: 12px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 0;\n}\n\n.ksq-linkbtn:hover { text-decoration: underline; }\n\n.ksq-search {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 8px;\n  padding: 6px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  min-width: 260px;\n}\n\n.ksq-search input {\n  border: none;\n  outline: none;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  flex: 1;\n}\n\n.ksq-search input::placeholder { color: var(--dsw-alias-label-tertiary); }\n\n.ksq-spin { animation: ksq-rotate 0.9s linear infinite; }\n\n@keyframes ksq-rotate {\n  to { transform: rotate(360deg); }\n}\n\n.ksq-error {\n  margin: 10px 22px 0;\n  padding: 8px 12px;\n  border: 1px solid rgba(230, 70, 70, 0.4);\n  border-radius: 8px;\n  background: rgba(230, 70, 70, 0.08);\n  color: #e64646;\n  font-size: 12.5px;\n}\n\n.ksq-loading {\n  margin: 24px 22px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n}\n\n.ksq-empty {\n  margin: 40px auto;\n  max-width: 420px;\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  font-size: 13px;\n}\n\n.ksq-empty strong { color: var(--dsw-alias-label-secondary); font-size: 14px; }\n\n.ksq-mono {\n  font-family: ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace;\n  font-size: 0.92em;\n}\n\n/* 数值语义色 */\n.ksq-up { color: #31c7a2; }\n.ksq-down { color: #e64646; }\n.ksq-warn { color: #e8a33d; }\n\n/* ── 数据表 ─────────────────────────────────────────────── */\n\n.ksq-table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 12.5px;\n}\n\n.ksq-table th {\n  text-align: left;\n  font-weight: 500;\n  color: var(--dsw-alias-label-tertiary);\n  padding: 6px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  white-space: nowrap;\n}\n\n.ksq-table td {\n  padding: 7px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  color: var(--dsw-alias-label-primary);\n  white-space: nowrap;\n}\n\n.ksq-table td.num { text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-table tr.selected td { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-table input[type=\"checkbox\"] { accent-color: var(--dsw-alias-brand-primary); }\n\n/* 长文本单元格裁剪（agent 写入的股票池/口径描述可达数百字，nowrap 下会把\n   操作列挤出视口）：max-width + ellipsis，全文走 title 悬浮。 */\n.ksq-table td.ksq-cell-clip {\n  max-width: 230px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* 表格横向滚动兜底：窗口再窄操作列（报告/看板）也始终可达，不整页溢出。 */\n.ksq-table-wrap { overflow-x: auto; }\n.ksq-table-wrap .ksq-table { min-width: 640px; }\n\n/* ── 内容区骨架 ─────────────────────────────────────────── */\n\n.ksq-body {\n  flex: 1;\n  overflow: auto;\n  padding: 14px 22px 26px;\n}\n\n.ksq-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-bottom: 14px;\n}\n\n/* ── 策略/因子/选股：列表 + 详情双栏 ────────────────────── */\n\n.ksq-split {\n  display: grid;\n  grid-template-columns: 264px 1fr;\n  gap: 16px;\n  align-items: start;\n}\n\n.ksq-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  position: sticky;\n  top: 0;\n}\n\n.ksq-list-item {\n  appearance: none;\n  text-align: left;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 10px;\n  padding: 9px 12px;\n  cursor: pointer;\n  color: var(--dsw-alias-label-primary);\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.ksq-list-item:hover { border-color: var(--dsw-alias-border-l2); }\n\n.ksq-list-item.active {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-1));\n}\n\n.ksq-item-name {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  font-size: 13px;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.ksq-item-name > span.ksq-name-text {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dot {\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  flex: none;\n}\n\n.ksq-dot.tone-live { background: #31c7a2; }\n.ksq-dot.tone-idle { background: #8f98a2; }\n.ksq-dot.tone-bad { background: #e64646; }\n\n.ksq-item-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-chip {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 999px;\n  padding: 0 7px;\n  font-size: 11px;\n  line-height: 18px;\n}\n\n.ksq-badge {\n  border-radius: 5px;\n  padding: 1px 7px;\n  font-size: 11px;\n  line-height: 18px;\n  flex: none;\n}\n\n.ksq-badge.tone-live {\n  color: #31c7a2;\n  background: rgba(49, 199, 162, 0.12);\n}\n\n.ksq-badge.tone-idle {\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-3);\n}\n\n.ksq-badge.tone-bad {\n  color: #e64646;\n  background: rgba(230, 70, 70, 0.1);\n}\n\n.ksq-detail { min-width: 0; display: flex; flex-direction: column; gap: 14px; }\n\n.ksq-hint {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12.5px;\n  margin: 6px 0;\n}\n\n.ksq-identity { border-bottom: 1px solid var(--dsw-alias-border-l3); padding-bottom: 10px; }\n\n.ksq-identity-head {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.ksq-identity-head h2 { font-size: 16px; margin: 0; }\n\n.ksq-hypothesis {\n  margin: 6px 0 4px;\n  font-size: 12.5px;\n  color: var(--dsw-alias-label-secondary);\n  line-height: 1.6;\n}\n\n.ksq-section-title {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n  margin: 4px 0 8px;\n}\n\n/* 版本时间线 */\n.ksq-versions { display: flex; flex-direction: column; gap: 8px; padding-left: 14px; }\n\n.ksq-version {\n  position: relative;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 9px 12px;\n}\n\n.ksq-version.latest { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); }\n\n.ksq-version::before {\n  content: \"\";\n  position: absolute;\n  left: -11px;\n  top: 16px;\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-version.latest::before { background: var(--dsw-alias-brand-primary); }\n\n.ksq-version-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 12.5px;\n}\n\n.ksq-version-note {\n  margin: 5px 0 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* 对比块 */\n.ksq-compare {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-compare h3 { font-size: 13px; margin: 0 0 8px; }\n\n.ksq-note {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  margin: 4px 0;\n}\n\n.ksq-chart { margin-top: 10px; }\n\n.ksq-chart h4 {\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n  margin: 0 0 6px;\n}\n\n.ksq-chart svg { max-width: 100%; height: auto; }\n\n/* 选股 criteria 摘要 */\n.ksq-criteria {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 8px 10px;\n  margin: 6px 0 0;\n  white-space: pre-wrap;\n  word-break: break-word;\n  max-height: 160px;\n  overflow: auto;\n}\n\n/* 选股 picks 表 */\n.ksq-picks-meta { display: flex; gap: 14px; font-size: 12px; color: var(--dsw-alias-label-tertiary); margin: 6px 0; }\n\n/* ── 报告库 ─────────────────────────────────────────────── */\n\n.ksq-report-group { margin-bottom: 16px; }\n\n.ksq-report-heading {\n  appearance: none;\n  border: none;\n  background: transparent;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  cursor: pointer;\n  padding: 4px 0 8px;\n  width: 100%;\n}\n\n.ksq-report-heading h2 { font-size: 13px; margin: 0; font-weight: 600; color: var(--dsw-alias-label-primary); }\n.ksq-report-heading span { color: var(--dsw-alias-label-tertiary); font-size: 12px; }\n\n.ksq-report-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));\n  gap: 10px;\n}\n\n.ksq-report-card {\n  display: flex;\n  gap: 12px;\n  align-items: flex-start;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-report-icon {\n  flex: none;\n  width: 34px;\n  height: 34px;\n  border-radius: 9px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);\n}\n\n.ksq-report-copy { flex: 1; min-width: 0; }\n\n.ksq-report-copy h3 {\n  margin: 0 0 4px;\n  font-size: 13.5px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-report-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px 12px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-report-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex: none; }\n\n/* 报告预览浮层 */\n.ksq-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 80;\n  background: rgba(3, 13, 11, 0.72);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 40px;\n}\n\n.ksq-dialog {\n  width: min(1080px, 100%);\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  border-radius: 14px;\n  overflow: hidden;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-dialog-bar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 14px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-dialog-bar strong {\n  font-size: 13px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dialog iframe {\n  flex: 1;\n  border: none;\n  background: #fff;\n}\n\n/* 确认弹窗 */\n.ksq-confirm {\n  width: min(420px, 100%);\n  height: auto;\n  border-radius: 14px;\n  padding: 18px;\n  gap: 10px;\n}\n\n.ksq-confirm h3 { margin: 0; font-size: 15px; }\n.ksq-confirm p { margin: 0; font-size: 12.5px; color: var(--dsw-alias-label-secondary); line-height: 1.6; }\n\n.ksq-confirm-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  margin-top: 8px;\n}\n\n.ksq-btn.danger {\n  color: #fff;\n  background: #c0392b;\n  border-color: #c0392b;\n}\n\n.ksq-btn.danger:hover { background: #a93226; }\n\n/* 复制成功提示 */\n.ksq-toast {\n  position: fixed;\n  bottom: 28px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 90;\n  /* 自洽深色药丸：不依赖宿主 toast token（--dsw-alias-toast-bg 在宿主不存在，\n     回退 bg-overlay 是遮罩 scrim 色——黑条不可读）。深底浅字双主题通用。 */\n  background: rgba(3, 13, 11, 0.92);\n  color: #e8edef;\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  font-size: 12.5px;\n  border-radius: 999px;\n  padding: 8px 16px;\n  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);\n}\n\n/* ── 财经新闻面板（@kstock/client-news）────────────────────────── */\n\n.ksq-news-list {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  padding-bottom: 8px;\n}\n\n.ksq-news-item {\n  position: relative;\n  padding: 12px 16px 12px 20px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  overflow: hidden;\n  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;\n}\n\n/* 左侧品牌色细轨：常亮 55%，hover 点满。 */\n.ksq-news-item::before {\n  content: '';\n  position: absolute;\n  left: 0;\n  top: 0;\n  bottom: 0;\n  width: 3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 100%, transparent);\n  opacity: .45;\n  transition: opacity .15s ease;\n}\n\n.ksq-news-item:hover {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, var(--dsw-alias-border-l2));\n  transform: translateY(-1px);\n  box-shadow: 0 4px 16px color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n}\n\n.ksq-news-item:hover::before {\n  opacity: 1;\n}\n\n.ksq-news-meta {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-source {\n  padding: 1.5px 8px;\n  border-radius: 99px;\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: .3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent);\n  color: var(--dsw-alias-brand-primary);\n  white-space: nowrap;\n}\n\n.ksq-news-dot {\n  width: 3px;\n  height: 3px;\n  border-radius: 50%;\n  background: currentColor;\n  opacity: .55;\n  flex: none;\n}\n\n.ksq-news-time {\n  margin-left: auto;\n  white-space: nowrap;\n}\n\n.ksq-news-title {\n  font-size: 14px;\n  font-weight: 600;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  text-decoration: none;\n}\n\na.ksq-news-title:hover {\n  color: var(--dsw-alias-link);\n}\n\n.ksq-news-summary {\n  margin: 0;\n  font-size: 12.5px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n\n.ksq-news-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 22px 0;\n  flex: none;\n}\n\n.ksq-news-toolbar .ksq-tabs { margin-bottom: 0; }\n\n.ksq-news-toolbar-right {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  min-width: 0;\n}\n\n.ksq-news-toolbar-right .ksq-search { margin-bottom: 0; flex: 1; min-width: 220px; max-width: 460px; }\n\n.ksq-news-watchedit {\n  padding: 8px 22px 0;\n  flex: none;\n}\n\n.ksq-news-watchedit input {\n  width: 100%;\n  box-sizing: border-box;\n  padding: 7px 12px;\n  border-radius: 8px;\n  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, var(--dsw-alias-border-l2));\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n}\n\n/* 双栏：主列表 + 统计侧栏（窄面板时侧栏隐藏）。 */\n.ksq-news-split {\n  display: flex;\n  gap: 20px;\n  align-items: flex-start;\n  width: 100%;\n  max-width: 1360px;\n  margin: 0 auto;\n}\n\n.ksq-news-main {\n  flex: 1;\n  min-width: 0;\n}\n\n.ksq-news-item.read { opacity: .58; }\n.ksq-news-item.read:hover { opacity: 1; }\n\n.ksq-news-item.watched {\n  border-color: color-mix(in srgb, #f59e0b 45%, var(--dsw-alias-border-l2));\n  background: color-mix(in srgb, #f59e0b 5%, var(--dsw-alias-bg-layer-2));\n}\n\n.ksq-news-item.watched::before {\n  background: #f59e0b;\n}\n\n.ksq-news-watchflag {\n  padding: 1px 7px;\n  border-radius: 99px;\n  font-size: 10.5px;\n  font-weight: 600;\n  letter-spacing: .5px;\n  color: #f59e0b;\n  background: color-mix(in srgb, #f59e0b 16%, transparent);\n}\n\n.ksq-news-stocks {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-stocktag {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  padding: 2px 9px;\n  border-radius: 6px;\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n  transition: border-color .12s ease, background .12s ease;\n}\n\n.ksq-news-stocktag:hover {\n  border-color: var(--dsw-alias-brand-primary);\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);\n}\n\n.ksq-news-actions {\n  display: flex;\n  justify-content: flex-end;\n  font-size: 12.5px;\n}\n\n/* 统计侧栏 */\n.ksq-news-stats {\n  flex: none;\n  width: 220px;\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  position: sticky;\n  top: 0;\n}\n\n@media (max-width: 980px) {\n  .ksq-news-stats { display: none; }\n  .ksq-news-split { display: block; }\n}\n\n.ksq-news-stats-block {\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  padding: 12px 14px;\n}\n\n.ksq-news-stats-head {\n  font-size: 13px;\n  font-weight: 600;\n  margin-bottom: 10px;\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n}\n\n.ksq-news-stats-head span {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-stats-empty {\n  margin: 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-trending {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-trendword {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 2.5px 9px;\n  border-radius: 99px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-news-trendword:hover {\n  color: var(--dsw-alias-brand-primary);\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.ksq-news-trendword em {\n  font-style: normal;\n  font-size: 10.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-freq {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: 50px;\n}\n\n.ksq-news-freq-bar {\n  flex: 1;\n  min-width: 3px;\n  border-radius: 2px 2px 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n}\n\n.ksq-news-freq-bar:hover {\n  background: var(--dsw-alias-brand-primary);\n}\n";
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
		/** 报纸（财经新闻入口）。 */
		function IconNews(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0V9" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M4 22a2 2 0 0 1-2-2v-9h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2Z" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M18 14h-8" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M15 18h-5" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M10 6h8v4h-8Z" })
				]
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
		const STYLE_VERSION = "2026-09-20.6-sel2";
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
		* 财经新闻 主区面板 2.0：实时流 + 标的联动 + 关注雷达 + 已读 + 统计。
		*
		* - 实时流：`GET /kstock-api/workspace-news`（60s 服务端缓存 + 客户端
		*   60s 自动刷新 + 手动刷新）；条目带标的识别徽章（服务端字典匹配）；
		* - 标的联动 / 「让 Agent 解读」：经 bindAgentBridge 注入的
		*   conversation.send() 把提示词送进当前会话并切回对话页；
		* - 关注雷达：localStorage 关注词表，命中高亮 + 「只看命中」过滤；
		* - 已读/未读：localStorage 已读标题哈希集（上限 300），已读淡化，
		*   未读计数展示；
		* - 统计侧栏：热词榜（6h 字典词频，点击即检索）+ 24h 逐小时频率条；
		* - 检索：输入 ≥2 字切「历史模式」查 news-archive 留档库（含已滚出的
		*   旧闻），清空回实时流。
		*/
		/** 与服务端缓存 TTL 对齐的自动刷新间隔。 */
		const REFRESH_MS = 6e4;
		const WATCH_KEY = "kstock-news-watch";
		const READ_KEY = "kstock-news-read";
		let agentBridge = null;
		function bindAgentBridge(bridge) {
			agentBridge = bridge;
		}
		/** 稳定字符串哈希（已读集键，djb2）。 */
		function hash(text) {
			let value = 5381;
			for (let index = 0; index < text.length; index += 1) value = (value << 5) + value + text.charCodeAt(index) >>> 0;
			return value.toString(36);
		}
		function loadWatchWords() {
			try {
				const raw = JSON.parse(localStorage.getItem(WATCH_KEY) ?? "[]");
				return Array.isArray(raw) ? raw.filter((word) => typeof word === "string" && word !== "") : [];
			} catch {
				return [];
			}
		}
		function loadReadSet() {
			try {
				const raw = JSON.parse(localStorage.getItem(READ_KEY) ?? "[]");
				return new Set(Array.isArray(raw) ? raw.filter((item) => typeof item === "string") : []);
			} catch {
				return /* @__PURE__ */ new Set();
			}
		}
		function saveReadSet(set) {
			const list = [...set].slice(-300);
			localStorage.setItem(READ_KEY, JSON.stringify(list));
		}
		/** 展示时间：可解析的「YYYY-MM-DD HH:mm[:ss]」转相对时间，否则原样。 */
		function displayTime(raw) {
			const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(raw);
			if (match === null) return raw;
			const timestamp = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5])).getTime();
			if (Number.isNaN(timestamp)) return raw;
			const diff = Date.now() - timestamp;
			if (diff < 6e4) return "刚刚";
			if (diff < 36e5) return `${Math.floor(diff / 6e4)} 分钟前`;
			if (diff < 864e5) return `${Math.floor(diff / 36e5)} 小时前`;
			return raw.slice(5, 16);
		}
		/** 标的快析提示词（徽章点击）。 */
		function stockPrompt(tag) {
			return `对 ${tag.name}（${tag.code}）做快速分析：公司基本面要点 + 当前估值水平（含近一年历史分位）+ 近期催化与风险，最后一句话结论。`;
		}
		/** 新闻解读提示词（解读按钮）。 */
		function interpretPrompt(item) {
			const summary = item.summary !== "" ? `——${item.summary}` : "";
			const related = (item.stocks ?? []).map((tag) => `${tag.name}(${tag.code})`).join("、");
			return `请解读这条财经快讯的市场影响：【${item.source} ${item.published_at}】${item.title}${summary}。` + (related !== "" ? `标题涉及标的：${related}。` : "") + "要求：1) 用 news-search 技能检索交叉验证；2) 分析受益/受损方向与相关 A 股标的；3) 给出关注信号与反证信号；数据缺失诚实标注「无数据」，不构成投资建议。";
		}
		function NewsPage() {
			const [payload, setPayload] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [query, setQuery] = (0, react.useState)("");
			const [archive, setArchive] = (0, react.useState)(null);
			const [archiveLoading, setArchiveLoading] = (0, react.useState)(false);
			const [watchRaw, setWatchRaw] = (0, react.useState)(() => loadWatchWords().join(" "));
			const [watchEditing, setWatchEditing] = (0, react.useState)(false);
			const [onlyWatch, setOnlyWatch] = (0, react.useState)(false);
			const [readSet, setReadSet] = (0, react.useState)(() => loadReadSet());
			const [stats, setStats] = (0, react.useState)(null);
			const alive = (0, react.useRef)(true);
			const watchWords = (0, react.useMemo)(() => watchRaw.split(/[\s,，、;；]+/).filter((word) => word !== ""), [watchRaw]);
			const load = (0, react.useCallback)(async () => {
				setLoading(true);
				try {
					const response = await fetch("/kstock-api/workspace-news");
					if (!response.ok) throw new Error(`请求失败（${response.status}）`);
					const data = await response.json();
					if (!alive.current) return;
					setPayload(data);
					setError(null);
				} catch (err) {
					if (!alive.current) return;
					setError(err instanceof Error ? err.message : String(err));
				} finally {
					if (alive.current) setLoading(false);
				}
			}, []);
			const loadStats = (0, react.useCallback)(async () => {
				try {
					const response = await fetch("/kstock-api/news-stats");
					if (!response.ok) return;
					const data = await response.json();
					if (alive.current) setStats(data);
				} catch {}
			}, []);
			(0, react.useEffect)(() => {
				alive.current = true;
				load();
				loadStats();
				const timer = window.setInterval(() => void load(), REFRESH_MS);
				const statsTimer = window.setInterval(() => void loadStats(), 5 * REFRESH_MS);
				return () => {
					alive.current = false;
					window.clearInterval(timer);
					window.clearInterval(statsTimer);
				};
			}, [load, loadStats]);
			(0, react.useEffect)(() => {
				const trimmed = query.trim();
				if (trimmed.length < 2) {
					setArchive(null);
					return;
				}
				setArchiveLoading(true);
				const handle = window.setTimeout(() => {
					(async () => {
						try {
							const response = await fetch(`/kstock-api/news-archive?q=${encodeURIComponent(trimmed)}&hours=168&limit=50`);
							if (!response.ok) return;
							const data = await response.json();
							if (alive.current) setArchive(data);
						} catch {} finally {
							if (alive.current) setArchiveLoading(false);
						}
					})();
				}, 300);
				return () => window.clearTimeout(handle);
			}, [query]);
			const markRead = (0, react.useCallback)((title) => {
				setReadSet((previous) => {
					const next = new Set(previous);
					next.add(hash(title));
					saveReadSet(next);
					return next;
				});
			}, []);
			const askAgent = (0, react.useCallback)((prompt) => {
				if (agentBridge === null) return;
				agentBridge.send(prompt).then(() => agentBridge?.gotoConversation()).catch((err) => console.error("[kstock-news] send failed:", err));
			}, []);
			const items = payload?.items ?? [];
			const hitWatch = (0, react.useCallback)((item) => {
				if (watchWords.length === 0) return false;
				const text = `${item.title} ${item.summary}`;
				return watchWords.some((word) => text.includes(word));
			}, [watchWords]);
			const visibleItems = onlyWatch ? items.filter(hitWatch) : items;
			const unreadCount = items.filter((item) => !readSet.has(hash(item.title))).length;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-page",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: "ksq-topbar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-title",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "财经新闻" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								"实时快讯 · 每 60 秒自动刷新",
								payload ? ` · 更新于 ${formatDateTime(payload.updated_at)}` : "",
								unreadCount > 0 ? ` · 未读 ${unreadCount}` : ""
							] })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-topbar-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-count",
								children: archive !== null ? `${archive.items.length} 条命中` : `${items.length} 条`
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RefreshButton, {
								refreshing: loading,
								onClick: () => {
									load();
									loadStats();
								},
								label: "刷新"
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-news-toolbar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-tabs",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `ksq-tab ${onlyWatch ? "" : "active"}`,
								onClick: () => setOnlyWatch(false),
								children: "全部"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: `ksq-tab ${onlyWatch ? "active" : ""}`,
								onClick: () => setOnlyWatch(true),
								disabled: watchWords.length === 0,
								title: watchWords.length === 0 ? "先配置关注词" : void 0,
								children: ["关注命中 ", watchWords.length > 0 ? `(${watchWords.length})` : ""]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-news-toolbar-right",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "ksq-linkbtn",
								onClick: () => setWatchEditing((value) => !value),
								children: "关注词"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "ksq-search",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									value: query,
									onChange: (event) => setQuery(event.target.value),
									placeholder: query.trim().length >= 2 ? "历史检索中（近 7 天）…" : "搜索标题 / 摘要 / 标的（≥2 字查历史）"
								})
							})]
						})]
					}),
					watchEditing && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ksq-news-watchedit",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							value: watchRaw,
							onChange: (event) => {
								setWatchRaw(event.target.value);
								localStorage.setItem(WATCH_KEY, JSON.stringify(event.target.value.split(/[\s,，、;；]+/).filter((word) => word !== "")));
							},
							placeholder: "关注词，空格或逗号分隔（如：锂矿 美联储 宁德时代）——命中的新闻会高亮",
							autoFocus: true
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-body ksq-news-split",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-news-main",
							children: [
								error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorLine, { message: error }),
								loading && payload === null && error === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { text: "加载财经快讯…" }),
								archiveLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { text: "检索历史留档…" }),
								!loading && payload !== null && items.length === 0 && error === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
									icon: "📰",
									title: "暂无快讯",
									hint: "数据源（东方财富/央视）暂未返回内容——网络不可用或接口限流，稍后自动重试"
								}),
								onlyWatch && visibleItems.length === 0 && items.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
									icon: "🎯",
									title: "暂无关注命中",
									hint: `当前 ${watchWords.length} 个关注词在最近快讯中未命中`
								}),
								archive !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-news-list",
									children: [archive.items.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NewsCard, {
										item,
										watched: hitWatch(item),
										read: true,
										onRead: markRead,
										onAsk: askAgent,
										archived: true
									}, `a-${item.title}-${index}`)), archive.items.length === 0 && !archiveLoading && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
										icon: "🔍",
										title: "历史无命中",
										hint: "近 7 天留档中没有匹配「此关键词」的新闻"
									})]
								}),
								archive === null && visibleItems.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ksq-news-list",
									children: visibleItems.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NewsCard, {
										item,
										watched: hitWatch(item),
										read: readSet.has(hash(item.title)),
										onRead: markRead,
										onAsk: askAgent
									}, `${item.title}-${index}`))
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatsAside, {
							stats,
							onPickWord: (word) => setQuery(word)
						})]
					})
				]
			});
		}
		function NewsCard({ item, watched, read, onRead, onAsk, archived = false }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
				className: `ksq-news-item${watched ? " watched" : ""}${read ? " read" : ""}`,
				onClick: () => onRead(item.title),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-news-meta",
						children: [
							watched && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-news-watchflag",
								children: "关注"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-news-source",
								children: item.source
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-news-dot",
								"aria-hidden": "true"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("time", {
								className: "ksq-news-time",
								title: item.published_at,
								children: archived ? item.published_at.slice(0, 16) : displayTime(item.published_at)
							})
						]
					}),
					item.url !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
						className: "ksq-news-title",
						href: item.url,
						target: "_blank",
						rel: "noreferrer noopener",
						onClick: (event) => event.stopPropagation(),
						children: item.title
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "ksq-news-title",
						children: item.title
					}),
					item.summary !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "ksq-news-summary",
						children: item.summary
					}),
					item.stocks !== void 0 && item.stocks.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ksq-news-stocks",
						children: item.stocks.map((tag) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ksq-news-stocktag",
							title: `让 Agent 快析 ${tag.name}（${tag.code}）`,
							onClick: (event) => {
								event.stopPropagation();
								onRead(item.title);
								onAsk(stockPrompt(tag));
							},
							children: tag.name
						}, tag.code))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "ksq-news-actions",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "ksq-linkbtn",
							onClick: (event) => {
								event.stopPropagation();
								onRead(item.title);
								onAsk(interpretPrompt(item));
							},
							children: "让 Agent 解读 →"
						})
					})
				]
			});
		}
		function StatsAside({ stats, onPickWord }) {
			const max = stats === null ? 1 : Math.max(1, ...stats.frequency.map((point) => point.count));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
				className: "ksq-news-stats",
				"aria-label": "新闻统计",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-news-stats-block",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ksq-news-stats-head",
								children: ["热点主题 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "近 6 小时" })]
							}),
							stats !== null && stats.themes.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "ksq-news-stats-empty",
								children: "留档积累中——运行一段时间后出现"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "ksq-news-trending",
								children: stats?.themes.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "ksq-news-trendword",
									title: `检索「${entry.word}」`,
									onClick: () => onPickWord(entry.word),
									children: [entry.word, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: entry.count })]
								}, `t-${entry.word}`))
							})
						]
					}),
					stats !== null && stats.stocks.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-news-stats-block",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-news-stats-head",
							children: ["提及标的 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "近 6 小时" })]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "ksq-news-trending",
							children: stats.stocks.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "ksq-news-trendword",
								title: `检索「${entry.word}」`,
								onClick: () => onPickWord(entry.word),
								children: [entry.word, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("em", { children: entry.count })]
							}, `s-${entry.word}`))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-news-stats-block",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "ksq-news-stats-head",
							children: ["快讯频率 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "近 24 小时" })]
						}), stats !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "ksq-news-freq",
							title: "每小时留档条数（新闻密度≈市场情绪代理）",
							children: stats.frequency.map((point) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "ksq-news-freq-bar",
								style: { height: `${Math.max(4, Math.round(point.count / max * 46))}px` },
								title: `${new Date(point.bucket).toLocaleTimeString("zh-CN", { hour: "2-digit" })}时 · ${point.count} 条`
							}, point.bucket))
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* ${pkg} — KStock 财经新闻客户端插件。
		*
		* 注册 `main` keyed 面板（键 kstock-client-news）+ `sidebar.panellist`
		* 导航入口（同 id，侧栏自动接线 ctx.layout.selectPanel）。与四个量化库
		* 插件同款注册形态（对照 @kstock/quant-factors）；ksq 样式经
		* @kstock/quant-ui 幂等注入。
		*
		* 数据走 @kstock/quant 宿主三路：`GET /kstock-api/workspace-news`
		* （东方财富主源 + 央视备源，60 秒缓存，带标的识别标注）、
		* `news-archive`（历史检索）、`news-stats`（热词榜 + 24h 频率）。
		*
		* 研究联动：注入 `conversation` 服务——标的徽章点击与「让 Agent 解读」
		* 按钮经 `conversation.send()` 把结构化提示词送进当前会话（官方排队
		* 回合通道），随后 `layout.selectPanel('conversation')` 切回对话页。
		*/
		/** 面板键：main slot 与侧栏入口共用。 */
		const PANEL_KEY = "kstock-client-news";
		/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
		function NavIcon({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconNews, { size: size ?? 18 });
		}
		/** 必需服务：slot 注册表 + 会话作用域 + 面板切换。 */
		const inject = [
			"slots",
			"sessions",
			"layout"
		];
		/** 客户端插件体。 */
		function apply(ctx) {
			ctx.effect(() => {
				injectQuantStyles();
				bindAgentBridge({
					send: async (text) => {
						const sessions = ctx.sessions;
						if (sessions === void 0) throw new Error("会话服务不可用");
						let id = sessions.list.getSnapshot().current;
						if (id === void 0) {
							id = await sessions.create();
							sessions.open(id);
						}
						const conversation = sessions.scope(id)?.get("conversation");
						if (conversation === void 0) throw new Error("会话作用域不可用（conversation 服务缺席）");
						await conversation.send(text);
					},
					gotoConversation: () => ctx.layout?.selectPanel(null)
				});
				ctx.slots.inject("main", () => ctx.slots.register({
					name: "main",
					key: PANEL_KEY
				}, NewsPage));
				ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
					name: "sidebar.panellist",
					id: PANEL_KEY,
					order: 140,
					label: "财经新闻"
				}, NavIcon));
			}, "kstock-client-news: panel + nav");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.cjs.map