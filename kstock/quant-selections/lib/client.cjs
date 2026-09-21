window.__ModuleLoader__.load({
	id: "@kstock/quant-selections",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region ../quant-ui/src/quant.css?raw
		var quant_default = "/* KStock 量化工作台面板样式（@kstock/quant 客户端半端）。\n *\n * 全部类名以 ksq- 前缀隔离；颜色走引擎 dsw 别名 token（随明暗主题\n * 自动切换），强调色沿用 KStock 品牌绿。由客户端 bundle 以 ?raw 内联，\n * apply() 时注入 <style data-kstock=\"quant-pages\">。 */\n\n.ksq-page {\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-bg-base) 88%, transparent);\n}\n\n/* ── 顶部：标题 + 库切换 tab ─────────────────────────────── */\n\n.ksq-topbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  padding: 14px 22px 0;\n  flex: none;\n}\n\n.ksq-title {\n  display: flex;\n  align-items: baseline;\n  gap: 10px;\n  min-width: 0;\n}\n\n.ksq-title strong {\n  font-size: 17px;\n  letter-spacing: 0.2px;\n}\n\n.ksq-title span {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.ksq-topbar-actions {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex: none;\n}\n\n.ksq-count {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.ksq-tabs {\n  display: flex;\n  gap: 4px;\n  padding: 10px 22px 0;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-tab {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  padding: 8px 14px 10px;\n  cursor: pointer;\n  border-bottom: 2px solid transparent;\n  margin-bottom: -1px;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-tab:hover { color: var(--dsw-alias-label-primary); }\n\n.ksq-tab.active {\n  color: var(--dsw-alias-label-primary);\n  border-bottom-color: var(--dsw-alias-brand-primary);\n  font-weight: 600;\n}\n\n/* ── 通用控件 ─────────────────────────────────────────────── */\n\n.ksq-iconbtn {\n  appearance: none;\n  border: 1px solid transparent;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  width: 28px;\n  height: 28px;\n  border-radius: 7px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n\n.ksq-iconbtn:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.ksq-iconbtn:disabled { opacity: 0.5; cursor: default; }\n.ksq-iconbtn.danger:hover { color: #e64646; }\n\n.ksq-btn {\n  appearance: none;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  padding: 5px 12px;\n  border-radius: 7px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }\n\n.ksq-linkbtn {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-link);\n  font-size: 12px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 0;\n}\n\n.ksq-linkbtn:hover { text-decoration: underline; }\n\n.ksq-search {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 8px;\n  padding: 6px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  min-width: 260px;\n}\n\n.ksq-search input {\n  border: none;\n  outline: none;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  flex: 1;\n}\n\n.ksq-search input::placeholder { color: var(--dsw-alias-label-tertiary); }\n\n.ksq-spin { animation: ksq-rotate 0.9s linear infinite; }\n\n@keyframes ksq-rotate {\n  to { transform: rotate(360deg); }\n}\n\n.ksq-error {\n  margin: 10px 22px 0;\n  padding: 8px 12px;\n  border: 1px solid rgba(230, 70, 70, 0.4);\n  border-radius: 8px;\n  background: rgba(230, 70, 70, 0.08);\n  color: #e64646;\n  font-size: 12.5px;\n}\n\n.ksq-loading {\n  margin: 24px 22px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n}\n\n.ksq-empty {\n  margin: 40px auto;\n  max-width: 420px;\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  font-size: 13px;\n}\n\n.ksq-empty strong { color: var(--dsw-alias-label-secondary); font-size: 14px; }\n\n.ksq-mono {\n  font-family: ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace;\n  font-size: 0.92em;\n}\n\n/* 数值语义色 */\n.ksq-up { color: #31c7a2; }\n.ksq-down { color: #e64646; }\n.ksq-warn { color: #e8a33d; }\n\n/* ── 数据表 ─────────────────────────────────────────────── */\n\n.ksq-table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 12.5px;\n}\n\n.ksq-table th {\n  text-align: left;\n  font-weight: 500;\n  color: var(--dsw-alias-label-tertiary);\n  padding: 6px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  white-space: nowrap;\n}\n\n.ksq-table td {\n  padding: 7px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  color: var(--dsw-alias-label-primary);\n  white-space: nowrap;\n}\n\n.ksq-table td.num { text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-table tr.selected td { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-table input[type=\"checkbox\"] { accent-color: var(--dsw-alias-brand-primary); }\n\n/* 长文本单元格裁剪（agent 写入的股票池/口径描述可达数百字，nowrap 下会把\n   操作列挤出视口）：max-width + ellipsis，全文走 title 悬浮。 */\n.ksq-table td.ksq-cell-clip {\n  max-width: 230px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n/* 表格横向滚动兜底：窗口再窄操作列（报告/看板）也始终可达，不整页溢出。 */\n.ksq-table-wrap { overflow-x: auto; }\n.ksq-table-wrap .ksq-table { min-width: 640px; }\n\n/* ── 内容区骨架 ─────────────────────────────────────────── */\n\n.ksq-body {\n  flex: 1;\n  overflow: auto;\n  padding: 14px 22px 26px;\n}\n\n.ksq-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-bottom: 14px;\n}\n\n/* ── 策略/因子/选股：列表 + 详情双栏 ────────────────────── */\n\n.ksq-split {\n  display: grid;\n  grid-template-columns: 264px 1fr;\n  gap: 16px;\n  align-items: start;\n}\n\n.ksq-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  position: sticky;\n  top: 0;\n}\n\n.ksq-list-item {\n  appearance: none;\n  text-align: left;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 10px;\n  padding: 9px 12px;\n  cursor: pointer;\n  color: var(--dsw-alias-label-primary);\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.ksq-list-item:hover { border-color: var(--dsw-alias-border-l2); }\n\n.ksq-list-item.active {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-1));\n}\n\n.ksq-item-name {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  font-size: 13px;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.ksq-item-name > span.ksq-name-text {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dot {\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  flex: none;\n}\n\n.ksq-dot.tone-live { background: #31c7a2; }\n.ksq-dot.tone-idle { background: #8f98a2; }\n.ksq-dot.tone-bad { background: #e64646; }\n\n.ksq-item-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-chip {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 999px;\n  padding: 0 7px;\n  font-size: 11px;\n  line-height: 18px;\n}\n\n.ksq-badge {\n  border-radius: 5px;\n  padding: 1px 7px;\n  font-size: 11px;\n  line-height: 18px;\n  flex: none;\n}\n\n.ksq-badge.tone-live {\n  color: #31c7a2;\n  background: rgba(49, 199, 162, 0.12);\n}\n\n.ksq-badge.tone-idle {\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-3);\n}\n\n.ksq-badge.tone-bad {\n  color: #e64646;\n  background: rgba(230, 70, 70, 0.1);\n}\n\n.ksq-detail { min-width: 0; display: flex; flex-direction: column; gap: 14px; }\n\n.ksq-hint {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12.5px;\n  margin: 6px 0;\n}\n\n.ksq-identity { border-bottom: 1px solid var(--dsw-alias-border-l3); padding-bottom: 10px; }\n\n.ksq-identity-head {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.ksq-identity-head h2 { font-size: 16px; margin: 0; }\n\n.ksq-hypothesis {\n  margin: 6px 0 4px;\n  font-size: 12.5px;\n  color: var(--dsw-alias-label-secondary);\n  line-height: 1.6;\n}\n\n.ksq-section-title {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n  margin: 4px 0 8px;\n}\n\n/* 版本时间线 */\n.ksq-versions { display: flex; flex-direction: column; gap: 8px; padding-left: 14px; }\n\n.ksq-version {\n  position: relative;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 9px 12px;\n}\n\n.ksq-version.latest { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); }\n\n.ksq-version::before {\n  content: \"\";\n  position: absolute;\n  left: -11px;\n  top: 16px;\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-version.latest::before { background: var(--dsw-alias-brand-primary); }\n\n.ksq-version-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 12.5px;\n}\n\n.ksq-version-note {\n  margin: 5px 0 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* 对比块 */\n.ksq-compare {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-compare h3 { font-size: 13px; margin: 0 0 8px; }\n\n.ksq-note {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  margin: 4px 0;\n}\n\n.ksq-chart { margin-top: 10px; }\n\n.ksq-chart h4 {\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n  margin: 0 0 6px;\n}\n\n.ksq-chart svg { max-width: 100%; height: auto; }\n\n/* 选股 criteria 摘要 */\n.ksq-criteria {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 8px 10px;\n  margin: 6px 0 0;\n  white-space: pre-wrap;\n  word-break: break-word;\n  max-height: 160px;\n  overflow: auto;\n}\n\n/* 选股 picks 表 */\n.ksq-picks-meta { display: flex; gap: 14px; font-size: 12px; color: var(--dsw-alias-label-tertiary); margin: 6px 0; }\n\n/* ── 报告库 ─────────────────────────────────────────────── */\n\n.ksq-report-group { margin-bottom: 16px; }\n\n.ksq-report-heading {\n  appearance: none;\n  border: none;\n  background: transparent;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  cursor: pointer;\n  padding: 4px 0 8px;\n  width: 100%;\n}\n\n.ksq-report-heading h2 { font-size: 13px; margin: 0; font-weight: 600; color: var(--dsw-alias-label-primary); }\n.ksq-report-heading span { color: var(--dsw-alias-label-tertiary); font-size: 12px; }\n\n.ksq-report-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));\n  gap: 10px;\n}\n\n.ksq-report-card {\n  display: flex;\n  gap: 12px;\n  align-items: flex-start;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-report-icon {\n  flex: none;\n  width: 34px;\n  height: 34px;\n  border-radius: 9px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);\n}\n\n.ksq-report-copy { flex: 1; min-width: 0; }\n\n.ksq-report-copy h3 {\n  margin: 0 0 4px;\n  font-size: 13.5px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-report-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px 12px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-report-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex: none; }\n\n/* 报告预览浮层 */\n.ksq-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 80;\n  background: rgba(3, 13, 11, 0.72);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 40px;\n}\n\n.ksq-dialog {\n  width: min(1080px, 100%);\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  border-radius: 14px;\n  overflow: hidden;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-dialog-bar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 14px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-dialog-bar strong {\n  font-size: 13px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dialog iframe {\n  flex: 1;\n  border: none;\n  background: #fff;\n}\n\n/* 确认弹窗 */\n.ksq-confirm {\n  width: min(420px, 100%);\n  height: auto;\n  border-radius: 14px;\n  padding: 18px;\n  gap: 10px;\n}\n\n.ksq-confirm h3 { margin: 0; font-size: 15px; }\n.ksq-confirm p { margin: 0; font-size: 12.5px; color: var(--dsw-alias-label-secondary); line-height: 1.6; }\n\n.ksq-confirm-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  margin-top: 8px;\n}\n\n.ksq-btn.danger {\n  color: #fff;\n  background: #c0392b;\n  border-color: #c0392b;\n}\n\n.ksq-btn.danger:hover { background: #a93226; }\n\n/* 复制成功提示 */\n.ksq-toast {\n  position: fixed;\n  bottom: 28px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 90;\n  /* 自洽深色药丸：不依赖宿主 toast token（--dsw-alias-toast-bg 在宿主不存在，\n     回退 bg-overlay 是遮罩 scrim 色——黑条不可读）。深底浅字双主题通用。 */\n  background: rgba(3, 13, 11, 0.92);\n  color: #e8edef;\n  border: 1px solid rgba(255, 255, 255, 0.1);\n  font-size: 12.5px;\n  border-radius: 999px;\n  padding: 8px 16px;\n  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);\n}\n\n/* ── 财经新闻面板（@kstock/client-news）────────────────────────── */\n\n.ksq-news-list {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n  padding-bottom: 8px;\n}\n\n.ksq-news-item {\n  position: relative;\n  padding: 12px 16px 12px 20px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  overflow: hidden;\n  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;\n}\n\n/* 左侧品牌色细轨：常亮 55%，hover 点满。 */\n.ksq-news-item::before {\n  content: '';\n  position: absolute;\n  left: 0;\n  top: 0;\n  bottom: 0;\n  width: 3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 100%, transparent);\n  opacity: .45;\n  transition: opacity .15s ease;\n}\n\n.ksq-news-item:hover {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, var(--dsw-alias-border-l2));\n  transform: translateY(-1px);\n  box-shadow: 0 4px 16px color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n}\n\n.ksq-news-item:hover::before {\n  opacity: 1;\n}\n\n.ksq-news-meta {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-source {\n  padding: 1.5px 8px;\n  border-radius: 99px;\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: .3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent);\n  color: var(--dsw-alias-brand-primary);\n  white-space: nowrap;\n}\n\n.ksq-news-dot {\n  width: 3px;\n  height: 3px;\n  border-radius: 50%;\n  background: currentColor;\n  opacity: .55;\n  flex: none;\n}\n\n.ksq-news-time {\n  margin-left: auto;\n  white-space: nowrap;\n}\n\n.ksq-news-title {\n  font-size: 14px;\n  font-weight: 600;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  text-decoration: none;\n}\n\na.ksq-news-title:hover {\n  color: var(--dsw-alias-link);\n}\n\n.ksq-news-summary {\n  margin: 0;\n  font-size: 12.5px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n\n.ksq-news-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 22px 0;\n  flex: none;\n}\n\n.ksq-news-toolbar .ksq-tabs { margin-bottom: 0; }\n\n.ksq-news-toolbar-right {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  min-width: 0;\n}\n\n.ksq-news-toolbar-right .ksq-search { margin-bottom: 0; flex: 1; min-width: 220px; max-width: 460px; }\n\n.ksq-news-watchedit {\n  padding: 8px 22px 0;\n  flex: none;\n}\n\n.ksq-news-watchedit input {\n  width: 100%;\n  box-sizing: border-box;\n  padding: 7px 12px;\n  border-radius: 8px;\n  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 40%, var(--dsw-alias-border-l2));\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n}\n\n/* 双栏：主列表 + 统计侧栏（窄面板时侧栏隐藏）。 */\n.ksq-news-split {\n  display: flex;\n  gap: 20px;\n  align-items: flex-start;\n  width: 100%;\n  max-width: 1360px;\n  margin: 0 auto;\n}\n\n.ksq-news-main {\n  flex: 1;\n  min-width: 0;\n}\n\n.ksq-news-item.read { opacity: .58; }\n.ksq-news-item.read:hover { opacity: 1; }\n\n.ksq-news-item.watched {\n  border-color: color-mix(in srgb, #f59e0b 45%, var(--dsw-alias-border-l2));\n  background: color-mix(in srgb, #f59e0b 5%, var(--dsw-alias-bg-layer-2));\n}\n\n.ksq-news-item.watched::before {\n  background: #f59e0b;\n}\n\n.ksq-news-watchflag {\n  padding: 1px 7px;\n  border-radius: 99px;\n  font-size: 10.5px;\n  font-weight: 600;\n  letter-spacing: .5px;\n  color: #f59e0b;\n  background: color-mix(in srgb, #f59e0b 16%, transparent);\n}\n\n.ksq-news-stocks {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-stocktag {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  padding: 2px 9px;\n  border-radius: 6px;\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n  transition: border-color .12s ease, background .12s ease;\n}\n\n.ksq-news-stocktag:hover {\n  border-color: var(--dsw-alias-brand-primary);\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);\n}\n\n.ksq-news-actions {\n  display: flex;\n  justify-content: flex-end;\n  font-size: 12.5px;\n}\n\n/* 统计侧栏 */\n.ksq-news-stats {\n  flex: none;\n  width: 220px;\n  display: flex;\n  flex-direction: column;\n  gap: 14px;\n  position: sticky;\n  top: 0;\n}\n\n@media (max-width: 980px) {\n  .ksq-news-stats { display: none; }\n  .ksq-news-split { display: block; }\n}\n\n.ksq-news-stats-block {\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  padding: 12px 14px;\n}\n\n.ksq-news-stats-head {\n  font-size: 13px;\n  font-weight: 600;\n  margin-bottom: 10px;\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n}\n\n.ksq-news-stats-head span {\n  font-size: 11px;\n  font-weight: 400;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-stats-empty {\n  margin: 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-news-trending {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.ksq-news-trendword {\n  all: unset;\n  box-sizing: border-box;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 2.5px 9px;\n  border-radius: 99px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 6%, transparent);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-news-trendword:hover {\n  color: var(--dsw-alias-brand-primary);\n  border-color: var(--dsw-alias-brand-primary);\n}\n\n.ksq-news-trendword em {\n  font-style: normal;\n  font-size: 10.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-freq {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: 50px;\n}\n\n.ksq-news-freq-bar {\n  flex: 1;\n  min-width: 3px;\n  border-radius: 2px 2px 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n}\n\n.ksq-news-freq-bar:hover {\n  background: var(--dsw-alias-brand-primary);\n}\n\n/* ── 联动任务目标选择菜单（§26-10，新闻/选股库共用）────────────── */\n\n.ksq-target-overlay { z-index: 95; padding: 40px; background: rgba(3, 13, 11, 0.45); }\n\n.ksq-target-menu {\n  width: min(480px, 100%);\n  max-height: min(70vh, 560px);\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  padding: 12px;\n  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4);\n}\n\n.ksq-target-head {\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  padding: 4px 8px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  margin-bottom: 6px;\n}\n\n.ksq-target-item {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  padding: 9px 10px;\n  border: none;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  text-align: left;\n  cursor: pointer;\n  font-size: 13px;\n}\n\n.ksq-target-item:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent); }\n.ksq-target-item:disabled { opacity: 0.55; cursor: default; }\n.ksq-target-item.last { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }\n\n.ksq-target-name { font-weight: 500; flex: none; }\n.ksq-target-path {\n  flex: 1;\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-target-error { color: #e64646; font-size: 12.5px; margin: 4px 8px; }\n.ksq-target-cancel { align-self: flex-end; margin-top: 4px; }\n\n/* ── 选股库：口径芯片（P4）+ 命中趋势（P3）────────────────────── */\n\n.ksq-chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 6px 0 2px; }\n.ksq-chips .ksq-chip { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }\n\n.ksq-trend {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 8px 10px;\n  margin: 6px 0 10px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-trend-label {\n  flex: none;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-trend-bars {\n  flex: 1;\n  display: flex;\n  align-items: flex-end;\n  justify-content: flex-start;\n  gap: 4px;\n  height: 44px;\n  min-width: 0;\n}\n\n.ksq-trend-col {\n  display: flex;\n  align-items: flex-end;\n  gap: 2px;\n  height: 100%;\n  cursor: default;\n}\n\n.ksq-trend-bar {\n  width: 9px;\n  min-height: 3px;\n  border-radius: 2px 2px 0 0;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 60%, transparent);\n}\n\n.ksq-trend-bar:hover { background: var(--dsw-alias-brand-primary); }\n\n.ksq-trend-bar.consensus { background: #31c7a2; }\n.ksq-trend-bar.consensus:hover { background: #22a06b; }\n\n/* ── 因子库：跨因子概览（F3，IC 均值零轴双向横条）──────────────── */\n\n.ksq-factors-overview {\n  display: flex;\n  align-items: flex-start;\n  gap: 10px;\n  padding: 10px 12px;\n  margin-bottom: 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-fo-rows { flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0; }\n\n.ksq-fo-row {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  width: 100%;\n  padding: 3px 6px;\n  border: none;\n  border-radius: 6px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  text-align: left;\n  cursor: pointer;\n  font-size: 12px;\n}\n\n.ksq-fo-row:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-fo-row.active { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent); }\n\n.ksq-fo-name {\n  flex: none;\n  width: 128px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-weight: 500;\n}\n\n.ksq-fo-bar {\n  flex: 1;\n  position: relative;\n  height: 10px;\n  min-width: 0;\n}\n\n/* 零轴：容器中缝 1px 基线；正值条从中线向右，负值向左。 */\n.ksq-fo-bar::before {\n  content: '';\n  position: absolute;\n  left: 50%;\n  top: -2px;\n  bottom: -2px;\n  width: 1px;\n  background: var(--dsw-alias-border-l3);\n}\n\n.ksq-fo-fill {\n  position: absolute;\n  top: 1px;\n  bottom: 1px;\n  border-radius: 2px;\n}\n\n.ksq-fo-fill.up { background: #31c7a2; }\n.ksq-fo-fill.down { background: #e64646; }\n\n.ksq-fo-value { flex: none; width: 52px; text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-fo-ir { flex: none; width: 64px; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }\n\n/* ── 策略库：调仓记录（§28-5，按日折叠）────────────────────────── */\n\n.ksq-rebalances {\n  max-height: 380px;\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 6px;\n}\n\n.ksq-rebalance { border-bottom: 1px solid var(--dsw-alias-border-l3); }\n.ksq-rebalance:last-child { border-bottom: none; }\n\n.ksq-rebalance summary {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n  padding: 5px 8px;\n  cursor: pointer;\n  font-size: 12.5px;\n  list-style: none;\n  border-radius: 6px;\n}\n\n.ksq-rebalance summary::-webkit-details-marker { display: none; }\n.ksq-rebalance summary::before { content: '\\25B8'; color: var(--dsw-alias-label-tertiary); transition: transform 0.12s; }\n.ksq-rebalance[open] summary::before { transform: rotate(90deg); }\n.ksq-rebalance summary:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, transparent); }\n\n.ksq-rebalance-body { padding: 6px 10px 10px 22px; display: flex; flex-direction: column; gap: 6px; }\n\n.ksq-rebalance-dayhead { display: flex; justify-content: flex-end; }\n\n/* ── 版本迭代面板（§28-10「从此版本改进」）────────────────────── */\n\n.ksq-iter {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  margin-top: 8px;\n  padding: 10px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 4%, transparent);\n}\n\n.ksq-iter-chip { cursor: pointer; background: transparent; }\n.ksq-iter-chip.active {\n  border-color: var(--dsw-alias-brand-primary);\n  color: var(--dsw-alias-brand-primary);\n  font-weight: 500;\n}\n\n.ksq-iter-input {\n  height: 30px;\n  padding: 0 10px;\n  border-radius: 8px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: transparent;\n  color: inherit;\n  font-size: 12.5px;\n}\n.ksq-rebalance-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }\n@media (max-width: 720px) { .ksq-rebalance-cols { grid-template-columns: 1fr; } }\n.ksq-rebalance-side p { margin: 0 0 4px; font-size: 12px; font-weight: 500; }\n.ksq-rebalance-side .ksq-table { font-size: 11.5px; }\n\n\n/* ── 缠论研究面板（§29-C1，@kstock/client-chan）────────────────── */\n\n.ksq-chan-input {\n  width: 260px;\n  height: 30px;\n  padding: 0 10px;\n  border-radius: 8px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: transparent;\n  color: inherit;\n  font-size: 12.5px;\n}\n\n.ksq-chan-select {\n  height: 30px;\n  padding: 0 6px;\n  border-radius: 8px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: transparent;\n  color: inherit;\n  font-size: 12.5px;\n}\n\n.ksq-chan-summary {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));\n  gap: 10px;\n  margin-top: 12px;\n}\n\n.ksq-chan-card {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  font-size: 12.5px;\n}\n\n.ksq-chan-card strong { font-size: 12px; color: var(--dsw-alias-label-tertiary); font-weight: 500; }\n.ksq-chan-card span { color: var(--dsw-alias-label-primary); }\n\n.ksq-chan-radar {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-chan-radar svg { width: 156px; flex: none; }\n.ksq-chan-radar-meta { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }\n\n.ksq-chan-signals {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  padding: 10px 12px;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n}\n\n.ksq-chan-signals strong { font-size: 12px; color: var(--dsw-alias-label-tertiary); font-weight: 500; }\n";
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
		const listSelections = () => get("/kstock-api/selections");
		const listSelectionVersions = (id) => get(`/kstock-api/selections/${encodeURIComponent(id)}/versions`);
		const listSelectionRuns = (id) => get(`/kstock-api/selections/${encodeURIComponent(id)}/runs`);
		const compareSelectionRuns = (id, runIds) => get(`/kstock-api/selections/${encodeURIComponent(id)}/compare?runs=${runIds.map(encodeURIComponent).join(",")}`);
		const getSelectionRunPicks = (id, runId) => get(`/kstock-api/selections/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/picks`);
		const getSelectionRunReport = (id, runId) => get(`/kstock-api/selections/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}/report`);
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
		function IconRefresh(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 1 1-2.64-6.36" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M21 3v6h-6" })]
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
		/** 靶心（选股库入口）。 */
		function IconTarget(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Svg, {
				...props,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "12",
						r: "9"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "12",
						r: "5"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "12",
						cy: "12",
						r: "1",
						fill: "currentColor"
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
		function formatDateTime(iso) {
			if (!iso) return "—";
			const date = new Date(iso);
			if (Number.isNaN(date.getTime())) return iso;
			return date.toLocaleString("zh-CN", { hour12: false });
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
		const STYLE_VERSION = "2026-09-21.1-chan1";
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
		/** 命中清单「解读」提示词：带方案名 / 排名 / 综合分 / 陷阱提示上下文。 */
		function interpretPickPrompt(input) {
			const rank = input.rank !== void 0 && String(input.rank) !== "" ? `排名第 ${input.rank} 的` : "";
			const score = input.score !== void 0 && String(input.score) !== "" ? `，综合分 ${input.score}` : "";
			const dv = typeof input.dvTtm === "number" && Number.isFinite(input.dvTtm) ? `，股息率(TTM) ${input.dvTtm.toFixed(2)}%` : "";
			const trap = input.trap !== void 0 && input.trap !== "" && input.trap !== "—" ? `（股息陷阱提示：${input.trap}）` : "";
			return `选股库「${input.selectionName}」v${input.version} 命中清单中${rank}${input.name}（${input.code}${score}${dv}）${trap}：请做个股快速分析——公司基本面要点 + 当前估值水平（含近一年历史分位）+ 作为高股息标的的分红可持续性 + 近期催化与风险，最后一句话结论。当前会话若未挂载 stock-analysis/估值引擎技能，用网页检索补充并标注数据来源，禁止编造数值。数据缺失诚实标注「无数据」，不构成投资建议。`;
		}
		//#endregion
		//#region src/client/section.tsx
		/**
		* 选股库面板：方案列表 + 要求版本时间线 + 运行归档（报告查看）+
		* 命中清单（P2：picks 表展开 + 每股「解读」联动会话）+
		* 跨期命中对比（重合分析）。移植自 1.x components/SelectionsLibrary.tsx。
		*/
		const asNumber = (value) => typeof value === "number" && Number.isFinite(value) ? value : null;
		const asText = (value) => typeof value === "string" ? value : value === void 0 || value === null ? "" : String(value);
		const fmtPct = (value) => {
			const n = asNumber(value);
			return n === null ? asText(value) || "—" : `${n.toFixed(2)}%`;
		};
		const fmtNum = (value, digits = 2) => {
			const n = asNumber(value);
			return n === null ? asText(value) || "—" : n.toFixed(digits);
		};
		/** 共振股数 > 0 绿。 */
		function selectionMetricClass(key, value) {
			if (typeof value !== "number") return "";
			if (key === "consensus_count") return value > 0 ? "ksq-up" : "";
			return "";
		}
		/** 版本口径解析（历史双重编码防御：字符串先解一层）。 */
		function parseCriteria(version) {
			let value = version.criteria;
			if (typeof value === "string") {
				const text = value.trim();
				try {
					value = JSON.parse(text);
				} catch {
					return { summary: text };
				}
			}
			return value ?? {};
		}
		/** 口径一行摘要（summary 字段 → pipeline 字段 → 字段名列表）。 */
		function criteriaSummaryText(record) {
			const summary = record.summary;
			if (typeof summary === "string" && summary.trim() !== "") return summary;
			const pipeline = record.pipeline;
			if (typeof pipeline === "string" && pipeline.trim() !== "") return pipeline;
			const keys = Object.keys(record);
			return keys.length > 0 ? `（口径字段：${keys.join(" / ")}）` : "（空口径）";
		}
		/** 已知闸门参数 → 展示标签（gates_params 数值键，agent 常用口径）。 */
		const GATE_LABELS = [
			[
				"dv_ttm_min",
				"股息率%",
				"≥"
			],
			[
				"dv_ttm_max",
				"股息率%",
				"≤"
			],
			[
				"pe_ttm_min",
				"PE",
				"≥"
			],
			[
				"pe_ttm_max",
				"PE",
				"≤"
			],
			[
				"min_div_years_3y",
				"3年分红",
				"≥"
			]
		];
		/** 口径 → 条件芯片（P4）：识别 gates_params 闸门 / factors 权重 Top3 /
		* top_n；识别不出时回退空数组（时间线仍显示文本摘要）。 */
		function criteriaChips(record) {
			const chips = [];
			const params = record.gates_params;
			if (typeof params === "object" && params !== null) for (const [key, label, op] of GATE_LABELS) {
				const value = params[key];
				if (typeof value === "number" && Number.isFinite(value)) chips.push(`${label} ${op} ${value}`);
			}
			const factors = record.factors;
			if (Array.isArray(factors)) {
				const weights = factors.map((item) => typeof item === "object" && item !== null ? item : null).filter((item) => item !== null).map((item) => ({
					field: String(item.field ?? ""),
					weight: Number(item.weight)
				})).filter((item) => item.field !== "" && Number.isFinite(item.weight) && item.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, 3);
				for (const item of weights) chips.push(`${item.field} ×${item.weight}`);
			}
			if (typeof record.top_n === "number" && Number.isFinite(record.top_n)) chips.push(`Top${record.top_n}`);
			return chips;
		}
		/** 命中清单 → 股票代码集合（对比重合分析用）。 */
		function pickCodes(picks) {
			return new Set(picks.map((item) => typeof item?.code === "string" ? item.code : null).filter((code) => Boolean(code)));
		}
		const METRIC_KEYS = [
			["hit_count", "命中数"],
			["strategy_count", "策略数"],
			["consensus_count", "共振股数"],
			["top_n", "TopN"]
		];
		/** 空态引导：让 agent 把最近一次选股任务结果归档进选股库的复制提示词。 */
		const INGEST_PROMPT = "请把本工作区最近一次选股任务的结果归档进 KStock 选股库（引擎 http://127.0.0.1:18001，不可达则跳过并明说）。三步：1) POST /kstock-api/selections，body {name: 方案名, criteria: 一句话口径}；2) POST /kstock-api/selections/{selection_id}/versions，body {criteria: 结构化口径 JSON, change_note}；3) POST /kstock-api/selections/{selection_id}/runs，body {version, trade_date, universe, rules, metrics, report: 报告全文, picks: 命中清单数组}。picks 每项含 code（必须带 .SH/.SZ/.BJ 后缀）/name/score 等报告总表字段。数据取自工作区 data/ 与 reports/ 下的真实产物，禁止编造。";
		/** run 的 rules.report_id（阶段三报告库归档返回的看板链，有则直嵌）。 */
		function runReportId(run) {
			const value = run?.rules?.report_id;
			return typeof value === "string" && value ? value : null;
		}
		/** 命中趋势（P3）：run 时间正序 mini 柱图——柱高 ∝ hit_count，
		* 绿色叠加 consensus_count；hover 显示 run 明细。单 run 即当前水平。 */
		function RunsTrend({ runs }) {
			const asc = [...runs].reverse();
			if (asc.length === 0) return null;
			const hitOf = (run) => {
				const value = run.metrics?.hit_count;
				return typeof value === "number" && Number.isFinite(value) ? value : 0;
			};
			const consensusOf = (run) => {
				const value = run.metrics?.consensus_count;
				return typeof value === "number" && Number.isFinite(value) ? value : 0;
			};
			const max = Math.max(1, ...asc.map(hitOf));
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-trend",
				"aria-label": "运行趋势",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "ksq-trend-label",
					children: "命中趋势"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "ksq-trend-bars",
					children: asc.map((run) => {
						const hit = hitOf(run);
						const consensus = consensusOf(run);
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "ksq-trend-col",
							title: `v${run.version} · ${run.trade_date || run.run_id.slice(7, 15)} · 命中 ${hit}` + (consensus > 0 ? ` · 共振 ${consensus}` : "") + ` · ${formatDateTime(run.created_at)}`,
							children: [consensus > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-trend-bar consensus",
								style: { height: `${Math.max(6, Math.round(consensus / max * 100))}%` }
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "ksq-trend-bar",
								style: { height: `${Math.max(6, Math.round(hit / max * 100))}%` }
							})]
						}, run.run_id);
					})
				})]
			});
		}
		function SelectionsSection({ useWorkspaces } = {}) {
			const [selections, setSelections] = (0, react.useState)([]);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const [selectedId, setSelectedId] = (0, react.useState)(null);
			const [versions, setVersions] = (0, react.useState)([]);
			const [runs, setRuns] = (0, react.useState)([]);
			const [detailLoading, setDetailLoading] = (0, react.useState)(false);
			const [compareIds, setCompareIds] = (0, react.useState)([]);
			const [comparison, setComparison] = (0, react.useState)(null);
			const [picksList, setPicksList] = (0, react.useState)([]);
			const [reportView, setReportView] = (0, react.useState)(null);
			const [picksView, setPicksView] = (0, react.useState)(null);
			const [refreshing, setRefreshing] = (0, react.useState)(false);
			const { copy, toast } = useCopyPrompt();
			const reload = (0, react.useCallback)(async () => {
				setError(null);
				try {
					setSelections(await listSelections());
				} catch (err) {
					setError(err instanceof Error ? err.message : "加载选股库失败");
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				reload();
			}, [reload]);
			const refresh = (0, react.useCallback)(async () => {
				setRefreshing(true);
				setError(null);
				try {
					const list = await listSelections();
					setSelections(list);
					if (selectedId) {
						const [versionList, runList] = await Promise.all([listSelectionVersions(selectedId), listSelectionRuns(selectedId)]);
						setVersions(versionList);
						setRuns(runList);
					}
				} catch (err) {
					setError(err instanceof Error ? err.message : "刷新选股库失败");
				} finally {
					setRefreshing(false);
				}
			}, [selectedId]);
			const selected = selections.find((item) => item.selection_id === selectedId) ?? null;
			/** 关闭报告视图并释放 blob URL（函数式 setState 避免闭包过期）。 */
			const closeReportView = (0, react.useCallback)(() => {
				setReportView((current) => {
					if (current?.htmlUrl) URL.revokeObjectURL(current.htmlUrl);
					return null;
				});
			}, []);
			(0, react.useEffect)(() => {
				if (!selectedId) return;
				setDetailLoading(true);
				setCompareIds([]);
				setComparison(null);
				setPicksList([]);
				closeReportView();
				setPicksView(null);
				setError(null);
				let active = true;
				(async () => {
					try {
						const [versionList, runList] = await Promise.all([listSelectionVersions(selectedId), listSelectionRuns(selectedId)]);
						if (!active) return;
						setVersions(versionList);
						setRuns(runList);
					} catch (err) {
						if (active) setError(err instanceof Error ? err.message : "加载方案详情失败");
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
					setPicksList([]);
					return;
				}
				let active = true;
				(async () => {
					try {
						const [result, ...lists] = await Promise.all([compareSelectionRuns(selectedId, compareIds), ...compareIds.map((runId) => getSelectionRunPicks(selectedId, runId).catch(() => null))]);
						if (!active) return;
						setComparison(result);
						setPicksList(lists.filter((item) => item !== null));
					} catch (err) {
						if (active) setError(err instanceof Error ? err.message : "对比加载失败");
					}
				})();
				return () => {
					active = false;
				};
			}, [selectedId, compareIds]);
			const showReport = (0, react.useCallback)(async (runId) => {
				if (!selectedId) return;
				if (reportView?.runId === runId) {
					closeReportView();
					return;
				}
				const run = runs.find((item) => item.run_id === runId);
				const reportId = runReportId(run);
				closeReportView();
				if (reportId) try {
					const html = await fetchReportHtml(reportId);
					setReportView({
						runId,
						text: "",
						htmlUrl: reportBlobUrl(html)
					});
					return;
				} catch {}
				if (!run?.report_path) return;
				try {
					const detail = await getSelectionRunReport(selectedId, runId);
					setReportView({
						runId,
						text: detail.report,
						htmlUrl: null
					});
				} catch (err) {
					setError(err instanceof Error ? err.message : "报告加载失败");
				}
			}, [
				selectedId,
				reportView,
				runs,
				closeReportView
			]);
			/** 展开某 run 的命中清单（再点收起；未存 picks 报服务端 422 文案）。 */
			const togglePicks = (0, react.useCallback)(async (runId) => {
				if (!selectedId) return;
				if (picksView?.run_id === runId) {
					setPicksView(null);
					return;
				}
				try {
					setPicksView(await getSelectionRunPicks(selectedId, runId));
				} catch (err) {
					setError(err instanceof Error ? err.message : "命中清单加载失败");
				}
			}, [selectedId, picksView]);
			/** 命中清单排序：rank 全数值时按排名，否则按综合分降序。 */
			const sortedPicks = (0, react.useMemo)(() => {
				const rows = [...picksView?.picks ?? []];
				if (rows.length > 0 && rows.every((row) => asNumber(row.rank) !== null)) {
					rows.sort((a, b) => asNumber(a.rank) - asNumber(b.rank));
					return rows;
				}
				rows.sort((a, b) => (asNumber(b.score) ?? -Infinity) - (asNumber(a.score) ?? -Infinity));
				return rows;
			}, [picksView]);
			/** 单股「解读」（§26-10）：先弹目标选择菜单（pick 类型记忆），选完发送。 */
			const [pendingInterpret, setPendingInterpret] = (0, react.useState)(null);
			const askPickInterpret = (0, react.useCallback)((row) => {
				if (selected === null) return;
				if (getAgentBridge() === null) {
					setError("会话联动不可用（sessions/layout 服务缺席）");
					return;
				}
				setPendingInterpret(interpretPickPrompt({
					selectionName: selected.name,
					version: picksView?.version ?? selected.current_version,
					rank: asNumber(row.rank) ?? void 0,
					name: asText(row.name) || asText(row.code) || "该标的",
					code: asText(row.code),
					score: asNumber(row.score) ?? void 0,
					dvTtm: asNumber(row.dv_ttm) ?? void 0,
					trap: asText(row.trap_flags)
				}));
			}, [selected, picksView]);
			const rerunPrompt = (version) => `请重跑选股库中的「${selected?.name ?? ""}」（${selectedId}）：选股口径采用 v${version.version} 版本（${criteriaSummaryText(parseCriteria(version))}），股票池与执行口径与该版本最近一次 run 保持一致（无历史 run 则按口径默认执行）。跑完后把结果入库：POST /kstock-api/selections/${selectedId}/runs，version=${version.version}，附 trade_date/universe/rules/metrics/report（报告全文）/picks（命中清单）。`;
			/** 命中重合分析：以所选第一个运行为基准，统计其余运行的保留/新增/剔除。 */
			const overlapRows = (0, react.useMemo)(() => {
				if (picksList.length < 2) return [];
				const [base, ...rest] = picksList;
				const baseCodes = pickCodes(base.picks);
				return rest.map((item) => {
					const codes = pickCodes(item.picks);
					const kept = [...codes].filter((code) => baseCodes.has(code));
					const added = [...codes].filter((code) => !baseCodes.has(code));
					const removed = [...baseCodes].filter((code) => !codes.has(code));
					return {
						run: item,
						keptCount: kept.length,
						addedCount: added.length,
						removedCount: removed.length,
						keptSample: kept.slice(0, 5),
						addedSample: added.slice(0, 5)
					};
				});
			}, [picksList]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-body",
				"aria-label": "选股库",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-toolbar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "ksq-count",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconTarget, { size: 13 }),
								" ",
								selections.length,
								" 个方案"
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RefreshButton, {
							refreshing,
							onClick: () => void refresh(),
							label: "刷新选股库"
						})]
					}),
					error && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorLine, { message: error }),
					loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { text: "加载选股库…" }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-split",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("aside", {
							className: "ksq-list",
							children: selections.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "ksq-hint",
								children: "暂无方案。用右侧提示词把最近一次选股结果入库。"
							}) : selections.map((selection) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: `ksq-list-item ${selection.selection_id === selectedId ? "active" : ""}`,
								onClick: () => setSelectedId(selection.selection_id),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "ksq-item-name",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: `ksq-dot tone-${statusBadge(selection.status).tone}`,
										"aria-hidden": "true"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "ksq-name-text",
										children: selection.name
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "ksq-item-meta",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
										"v",
										selection.current_version,
										" · ",
										statusBadge(selection.status).label
									] }), selection.latest_run && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "ksq-chip",
										children: ["命中 ", metric(selection.latest_run, "hit_count")]
									})]
								})]
							}, selection.selection_id))
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
							className: "ksq-detail",
							children: !selected ? selections.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "ksq-empty",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "选股库还是空的" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: "选股任务的产物目前只落在工作区文件（data/ 与 reports/）里。归档进选股库后，这里会出现可回看、可重跑、可跨期对比的方案资产。" }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										className: "ksq-linkbtn",
										type: "button",
										onClick: () => copy(INGEST_PROMPT),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCopy, { size: 11 }), " 复制「把最近一次选股结果入库」提示词"]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "ksq-item-meta",
										children: "粘贴到对话发送即可；后续选股任务会按 stock-screening-theme 阶段四自动归档。"
									})
								]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "ksq-hint",
								children: "从左侧选择一个方案查看要求时间线与运行归档。"
							}) : detailLoading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { text: "加载方案详情…" }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
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
											children: selected.criteria || "（未写选股要求口径）"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
											className: "ksq-item-meta ksq-mono",
											children: [
												selected.selection_id,
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
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconTarget, { size: 14 }), " 要求版本时间线"]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "ksq-versions",
									children: versions.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "ksq-hint",
										children: "尚无版本。"
									}) : versions.slice().reverse().map((version) => {
										const record = parseCriteria(version);
										const chips = criteriaChips(record);
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "ksq-item-meta",
															children: formatDateTime(version.created_at)
														})
													]
												}),
												chips.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "ksq-chips",
													"aria-label": "口径条件",
													children: chips.map((chip) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "ksq-chip",
														children: chip
													}, chip))
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "ksq-version-note",
													children: criteriaSummaryText(record)
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "ksq-item-meta",
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
										}, version.version);
									})
								})] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
										className: "ksq-section-title",
										children: "运行归档（勾选 2-4 个对比）"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RunsTrend, { runs }),
									runs.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "ksq-hint",
										children: "尚无运行归档。"
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "ksq-table-wrap",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
											className: "ksq-table",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "对比" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "run" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "版本" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "基准日" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "股票池" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "命中" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "共振" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "TopN" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "时间" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "清单 / 报告" })
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
														children: run.run_id.slice(7, 15)
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: ["v", run.version] }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: run.trade_date || "—" }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: "ksq-cell-clip",
														title: run.universe || void 0,
														children: run.universe || "—"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: "num",
														children: metric(run, "hit_count")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: `num ${selectionMetricClass("consensus_count", run.metrics?.consensus_count)}`,
														children: metric(run, "consensus_count")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: "num",
														children: metric(run, "top_n")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: formatDateTime(run.created_at) }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", { children: [
														run.picks_path ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															className: "ksq-linkbtn",
															type: "button",
															onClick: () => void togglePicks(run.run_id),
															children: picksView?.run_id === run.run_id ? "收清单" : "清单"
														}) : null,
														run.report_path || runReportId(run) ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [run.picks_path ? " " : "", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															className: "ksq-linkbtn",
															type: "button",
															onClick: () => void showReport(run.run_id),
															children: reportView?.runId === run.run_id ? "收起" : runReportId(run) ? "看板" : "查看"
														})] }) : null,
														!run.picks_path && !run.report_path && !runReportId(run) ? "—" : null
													] })
												]
											}, run.run_id)) })]
										})
									})
								] }),
								picksView && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-compare",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: [
										"命中清单（",
										picksView.run_id.slice(7, 15),
										" · v",
										picksView.version,
										" · ",
										picksView.trade_date || "—",
										" · ",
										sortedPicks.length,
										" 只）",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											className: "ksq-linkbtn",
											type: "button",
											onClick: () => setPicksView(null),
											children: "收起"
										})
									] }), sortedPicks.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "ksq-hint",
										children: "该 run 命中清单为空。"
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "ksq-table-wrap",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
											className: "ksq-table",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "排名" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "代码" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "名称" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "行业" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "综合分" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "股息率TTM" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "PE" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "PB" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "ROE" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "3年分红" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "陷阱" }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "解读" })
											] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: sortedPicks.map((row, index) => {
												const code = asText(row.code);
												const trap = asText(row.trap_flags);
												const hasTrap = trap !== "" && trap !== "—";
												return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: "num",
														children: asText(row.rank) || index + 1
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: "ksq-mono",
														children: code || "—"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: asText(row.name) || "—" }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: "ksq-cell-clip",
														title: asText(row.industry) || void 0,
														children: asText(row.industry) || "—"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: "num",
														children: asText(row.score) || "—"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: "num",
														children: fmtPct(row.dv_ttm)
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: "num",
														children: fmtNum(row.pe_ttm)
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: "num",
														children: fmtNum(row.pb)
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: "num",
														children: fmtPct(row.roe)
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
														className: "num",
														children: asText(row.div_years_3y) || "—"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: hasTrap ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "ksq-badge tone-bad",
														title: trap,
														children: "陷阱"
													}) : "—" }),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: code !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														className: "ksq-linkbtn",
														type: "button",
														onClick: () => askPickInterpret(row),
														children: "解读"
													}) : "—" })
												] }, code || index);
											}) })]
										})
									})]
								}),
								reportView?.htmlUrl ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PreviewDialog, {
									title: "运行报告看板",
									onClose: closeReportView,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("iframe", {
										title: "运行报告看板",
										src: reportView.htmlUrl,
										sandbox: "allow-scripts"
									})
								}) : reportView ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-compare",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: [
										"运行报告（",
										reportView.runId.slice(7, 15),
										" · 纯文本附件）"
									] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
										className: "ksq-criteria",
										style: { maxHeight: 320 },
										children: reportView.text
									})]
								}) : null,
								comparison && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "ksq-compare",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h3", { children: ["运行对比", comparison.comparable ? "（同口径，可严格对比）" : "（口径不一致，仅供参考）"] }),
										!comparison.comparable && comparison.notes.map((note) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "ksq-note",
											children: note
										}, note)),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "ksq-table-wrap",
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
												className: "ksq-table",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "指标" }), comparison.runs.map((run) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("th", {
													className: "ksq-mono",
													children: [
														"v",
														run.version,
														" · ",
														run.trade_date || run.run_id.slice(7, 15)
													]
												}, run.run_id))] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: METRIC_KEYS.map(([key, label]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: label }), comparison.runs.map((run) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
													className: `num ${selectionMetricClass(key, run.metrics?.[key])}`,
													children: metric(run, key)
												}, run.run_id))] }, key)) })]
											})
										}),
										overlapRows.length >= 1 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "ksq-chart",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h4", { children: [
												"命中重合分析（基准：v",
												picksList[0].version,
												" · ",
												picksList[0].trade_date || picksList[0].run_id.slice(7, 15),
												"）"
											] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "ksq-table-wrap",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
													className: "ksq-table",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "run" }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "基准日" }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "保留" }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "新增" }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "剔除" }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "保留样例" }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { children: "新增样例" })
													] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: overlapRows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("td", {
															className: "ksq-mono",
															children: [
																"v",
																row.run.version,
																" · ",
																row.run.run_id.slice(7, 15)
															]
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: row.run.trade_date || "—" }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
															className: "num",
															children: row.keptCount
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
															className: "num",
															children: row.addedCount
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
															className: "num",
															children: row.removedCount
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
															className: "ksq-mono ksq-cell-clip",
															title: row.keptSample.join("、") || void 0,
															children: row.keptSample.join("、") || "—"
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
															className: "ksq-mono ksq-cell-clip",
															title: row.addedSample.join("、") || void 0,
															children: row.addedSample.join("、") || "—"
														})
													] }, row.run.run_id)) })]
												})
											})]
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
											className: "ksq-note",
											children: "所选运行缺少命中清单数据（record_run 未存 picks），无法做重合分析。"
										})
									]
								})
							] })
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CopyToast, { text: toast }),
					pendingInterpret !== null && getAgentBridge() !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TaskTargetMenu, {
						taskKind: "pick",
						title: "个股解读发送到…",
						prompt: pendingInterpret,
						bridge: getAgentBridge(),
						useWorkspaces,
						onClose: () => setPendingInterpret(null)
					})
				]
			});
		}
		//#endregion
		//#region src/client/page.tsx
		function SelectionsPage({ useWorkspaces } = {}) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-page",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("header", {
					className: "ksq-topbar",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-title",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "选股库" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "选股研究资产沉淀：结果快照与重合分析" })]
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectionsSection, { useWorkspaces })]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* ${pkg} — KStock 量化库客户端插件。
		*
		* 注册 `main` keyed 面板（键 kstock-quant-selections）+ `sidebar.panellist` 导航入口
		* （同 id，侧栏自动接线 ctx.layout.selectPanel）；ksq 样式经
		* @kstock/quant-ui 幂等注入（四个量化库插件共用一份）。
		*
		* 研究联动（P2 + §26-10 目标选择菜单）：命中股「解读」按钮先弹
		* TaskTargetMenu 让用户选任务归属（跟随当前会话 / 已注册子工作区 /
		* 浏览注册新目录），按 pick 类型记忆；路由桥为 quant-ui 共享实现
		* buildTaskRouterBridge（workspace 目标经 uiWorkspace.connectWorkspace
		* 落地，会话挂进工作区分组，不再「未分组」）。
		*/
		/** 面板键：main slot 与侧栏入口共用。 */
		const PANEL_KEY = "kstock-quant-selections";
		/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
		function NavIcon({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconTarget, { size: size ?? 18 });
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
				}, SelectionsPage));
				ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
					name: "sidebar.panellist",
					id: PANEL_KEY,
					order: 120,
					label: "选股库"
				}, NavIcon));
			}, "kstock-quant-selections: panel + nav");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.cjs.map