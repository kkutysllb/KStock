window.__ModuleLoader__.load({
	id: "@kstock/client-news",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region ../quant-ui/src/quant.css?raw
		var quant_default = "/* KStock 量化工作台面板样式（@kstock/quant 客户端半端）。\n *\n * 全部类名以 ksq- 前缀隔离；颜色走引擎 dsw 别名 token（随明暗主题\n * 自动切换），强调色沿用 KStock 品牌绿。由客户端 bundle 以 ?raw 内联，\n * apply() 时注入 <style data-kstock=\"quant-pages\">。 */\n\n.ksq-page {\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  color: var(--dsw-alias-label-primary);\n  background: color-mix(in srgb, var(--dsw-alias-bg-base) 88%, transparent);\n}\n\n/* ── 顶部：标题 + 库切换 tab ─────────────────────────────── */\n\n.ksq-topbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 16px;\n  padding: 14px 22px 0;\n  flex: none;\n}\n\n.ksq-title {\n  display: flex;\n  align-items: baseline;\n  gap: 10px;\n  min-width: 0;\n}\n\n.ksq-title strong {\n  font-size: 17px;\n  letter-spacing: 0.2px;\n}\n\n.ksq-title span {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.ksq-topbar-actions {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  flex: none;\n}\n\n.ksq-count {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.ksq-tabs {\n  display: flex;\n  gap: 4px;\n  padding: 10px 22px 0;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-tab {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  padding: 8px 14px 10px;\n  cursor: pointer;\n  border-bottom: 2px solid transparent;\n  margin-bottom: -1px;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-tab:hover { color: var(--dsw-alias-label-primary); }\n\n.ksq-tab.active {\n  color: var(--dsw-alias-label-primary);\n  border-bottom-color: var(--dsw-alias-brand-primary);\n  font-weight: 600;\n}\n\n/* ── 通用控件 ─────────────────────────────────────────────── */\n\n.ksq-iconbtn {\n  appearance: none;\n  border: 1px solid transparent;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  width: 28px;\n  height: 28px;\n  border-radius: 7px;\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n\n.ksq-iconbtn:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.ksq-iconbtn:disabled { opacity: 0.5; cursor: default; }\n.ksq-iconbtn.danger:hover { color: #e64646; }\n\n.ksq-btn {\n  appearance: none;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-2);\n  color: var(--dsw-alias-label-primary);\n  font-size: 12px;\n  padding: 5px 12px;\n  border-radius: 7px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n}\n\n.ksq-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }\n\n.ksq-linkbtn {\n  appearance: none;\n  border: none;\n  background: transparent;\n  color: var(--dsw-alias-link);\n  font-size: 12px;\n  cursor: pointer;\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  padding: 0;\n}\n\n.ksq-linkbtn:hover { text-decoration: underline; }\n\n.ksq-search {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 8px;\n  padding: 6px 10px;\n  color: var(--dsw-alias-label-tertiary);\n  min-width: 260px;\n}\n\n.ksq-search input {\n  border: none;\n  outline: none;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  flex: 1;\n}\n\n.ksq-search input::placeholder { color: var(--dsw-alias-label-tertiary); }\n\n.ksq-spin { animation: ksq-rotate 0.9s linear infinite; }\n\n@keyframes ksq-rotate {\n  to { transform: rotate(360deg); }\n}\n\n.ksq-error {\n  margin: 10px 22px 0;\n  padding: 8px 12px;\n  border: 1px solid rgba(230, 70, 70, 0.4);\n  border-radius: 8px;\n  background: rgba(230, 70, 70, 0.08);\n  color: #e64646;\n  font-size: 12.5px;\n}\n\n.ksq-loading {\n  margin: 24px 22px;\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 13px;\n}\n\n.ksq-empty {\n  margin: 40px auto;\n  max-width: 420px;\n  text-align: center;\n  color: var(--dsw-alias-label-tertiary);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 8px;\n  font-size: 13px;\n}\n\n.ksq-empty strong { color: var(--dsw-alias-label-secondary); font-size: 14px; }\n\n.ksq-mono {\n  font-family: ui-monospace, SFMono-Regular, \"SF Mono\", Menlo, Consolas, monospace;\n  font-size: 0.92em;\n}\n\n/* 数值语义色 */\n.ksq-up { color: #31c7a2; }\n.ksq-down { color: #e64646; }\n.ksq-warn { color: #e8a33d; }\n\n/* ── 数据表 ─────────────────────────────────────────────── */\n\n.ksq-table {\n  width: 100%;\n  border-collapse: collapse;\n  font-size: 12.5px;\n}\n\n.ksq-table th {\n  text-align: left;\n  font-weight: 500;\n  color: var(--dsw-alias-label-tertiary);\n  padding: 6px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  white-space: nowrap;\n}\n\n.ksq-table td {\n  padding: 7px 10px;\n  border-bottom: 1px solid var(--dsw-alias-border-l3);\n  color: var(--dsw-alias-label-primary);\n  white-space: nowrap;\n}\n\n.ksq-table td.num { text-align: right; font-variant-numeric: tabular-nums; }\n.ksq-table tr.selected td { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent); }\n.ksq-table input[type=\"checkbox\"] { accent-color: var(--dsw-alias-brand-primary); }\n\n/* ── 内容区骨架 ─────────────────────────────────────────── */\n\n.ksq-body {\n  flex: 1;\n  overflow: auto;\n  padding: 14px 22px 26px;\n}\n\n.ksq-toolbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  margin-bottom: 14px;\n}\n\n/* ── 策略/因子/选股：列表 + 详情双栏 ────────────────────── */\n\n.ksq-split {\n  display: grid;\n  grid-template-columns: 264px 1fr;\n  gap: 16px;\n  align-items: start;\n}\n\n.ksq-list {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  position: sticky;\n  top: 0;\n}\n\n.ksq-list-item {\n  appearance: none;\n  text-align: left;\n  border: 1px solid var(--dsw-alias-border-l3);\n  background: var(--dsw-alias-bg-layer-1);\n  border-radius: 10px;\n  padding: 9px 12px;\n  cursor: pointer;\n  color: var(--dsw-alias-label-primary);\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n}\n\n.ksq-list-item:hover { border-color: var(--dsw-alias-border-l2); }\n\n.ksq-list-item.active {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 8%, var(--dsw-alias-bg-layer-1));\n}\n\n.ksq-item-name {\n  display: flex;\n  align-items: center;\n  gap: 7px;\n  font-size: 13px;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.ksq-item-name > span.ksq-name-text {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dot {\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  flex: none;\n}\n\n.ksq-dot.tone-live { background: #31c7a2; }\n.ksq-dot.tone-idle { background: #8f98a2; }\n.ksq-dot.tone-bad { background: #e64646; }\n\n.ksq-item-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-chip {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 999px;\n  padding: 0 7px;\n  font-size: 11px;\n  line-height: 18px;\n}\n\n.ksq-badge {\n  border-radius: 5px;\n  padding: 1px 7px;\n  font-size: 11px;\n  line-height: 18px;\n  flex: none;\n}\n\n.ksq-badge.tone-live {\n  color: #31c7a2;\n  background: rgba(49, 199, 162, 0.12);\n}\n\n.ksq-badge.tone-idle {\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-3);\n}\n\n.ksq-badge.tone-bad {\n  color: #e64646;\n  background: rgba(230, 70, 70, 0.1);\n}\n\n.ksq-detail { min-width: 0; display: flex; flex-direction: column; gap: 14px; }\n\n.ksq-hint {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12.5px;\n  margin: 6px 0;\n}\n\n.ksq-identity { border-bottom: 1px solid var(--dsw-alias-border-l3); padding-bottom: 10px; }\n\n.ksq-identity-head {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n}\n\n.ksq-identity-head h2 { font-size: 16px; margin: 0; }\n\n.ksq-hypothesis {\n  margin: 6px 0 4px;\n  font-size: 12.5px;\n  color: var(--dsw-alias-label-secondary);\n  line-height: 1.6;\n}\n\n.ksq-section-title {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 13px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-primary);\n  margin: 4px 0 8px;\n}\n\n/* 版本时间线 */\n.ksq-versions { display: flex; flex-direction: column; gap: 8px; padding-left: 14px; }\n\n.ksq-version {\n  position: relative;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 9px 12px;\n}\n\n.ksq-version.latest { border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent); }\n\n.ksq-version::before {\n  content: \"\";\n  position: absolute;\n  left: -11px;\n  top: 16px;\n  width: 7px;\n  height: 7px;\n  border-radius: 50%;\n  background: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-version.latest::before { background: var(--dsw-alias-brand-primary); }\n\n.ksq-version-head {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 12.5px;\n}\n\n.ksq-version-note {\n  margin: 5px 0 0;\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n/* 对比块 */\n.ksq-compare {\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-compare h3 { font-size: 13px; margin: 0 0 8px; }\n\n.ksq-note {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  margin: 4px 0;\n}\n\n.ksq-chart { margin-top: 10px; }\n\n.ksq-chart h4 {\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n  margin: 0 0 6px;\n}\n\n.ksq-chart svg { max-width: 100%; height: auto; }\n\n/* 选股 criteria 摘要 */\n.ksq-criteria {\n  font-size: 12px;\n  color: var(--dsw-alias-label-secondary);\n  background: var(--dsw-alias-bg-layer-2);\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 8px;\n  padding: 8px 10px;\n  margin: 6px 0 0;\n  white-space: pre-wrap;\n  word-break: break-word;\n  max-height: 160px;\n  overflow: auto;\n}\n\n/* 选股 picks 表 */\n.ksq-picks-meta { display: flex; gap: 14px; font-size: 12px; color: var(--dsw-alias-label-tertiary); margin: 6px 0; }\n\n/* ── 报告库 ─────────────────────────────────────────────── */\n\n.ksq-report-group { margin-bottom: 16px; }\n\n.ksq-report-heading {\n  appearance: none;\n  border: none;\n  background: transparent;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  color: var(--dsw-alias-label-secondary);\n  font-size: 13px;\n  cursor: pointer;\n  padding: 4px 0 8px;\n  width: 100%;\n}\n\n.ksq-report-heading h2 { font-size: 13px; margin: 0; font-weight: 600; color: var(--dsw-alias-label-primary); }\n.ksq-report-heading span { color: var(--dsw-alias-label-tertiary); font-size: 12px; }\n\n.ksq-report-grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));\n  gap: 10px;\n}\n\n.ksq-report-card {\n  display: flex;\n  gap: 12px;\n  align-items: flex-start;\n  border: 1px solid var(--dsw-alias-border-l3);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-1);\n  padding: 12px 14px;\n}\n\n.ksq-report-icon {\n  flex: none;\n  width: 34px;\n  height: 34px;\n  border-radius: 9px;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: var(--dsw-alias-brand-primary);\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);\n}\n\n.ksq-report-copy { flex: 1; min-width: 0; }\n\n.ksq-report-copy h3 {\n  margin: 0 0 4px;\n  font-size: 13.5px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-report-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 4px 12px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.ksq-report-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; flex: none; }\n\n/* 报告预览浮层 */\n.ksq-overlay {\n  position: fixed;\n  inset: 0;\n  z-index: 80;\n  background: rgba(3, 13, 11, 0.72);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: 40px;\n}\n\n.ksq-dialog {\n  width: min(1080px, 100%);\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  border-radius: 14px;\n  overflow: hidden;\n  background: var(--dsw-alias-bg-layer-1);\n  border: 1px solid var(--dsw-alias-border-l2);\n}\n\n.ksq-dialog-bar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 14px;\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.ksq-dialog-bar strong {\n  font-size: 13px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.ksq-dialog iframe {\n  flex: 1;\n  border: none;\n  background: #fff;\n}\n\n/* 确认弹窗 */\n.ksq-confirm {\n  width: min(420px, 100%);\n  height: auto;\n  border-radius: 14px;\n  padding: 18px;\n  gap: 10px;\n}\n\n.ksq-confirm h3 { margin: 0; font-size: 15px; }\n.ksq-confirm p { margin: 0; font-size: 12.5px; color: var(--dsw-alias-label-secondary); line-height: 1.6; }\n\n.ksq-confirm-actions {\n  display: flex;\n  justify-content: flex-end;\n  gap: 8px;\n  margin-top: 8px;\n}\n\n.ksq-btn.danger {\n  color: #fff;\n  background: #c0392b;\n  border-color: #c0392b;\n}\n\n.ksq-btn.danger:hover { background: #a93226; }\n\n/* 复制成功提示 */\n.ksq-toast {\n  position: fixed;\n  bottom: 28px;\n  left: 50%;\n  transform: translateX(-50%);\n  z-index: 90;\n  background: var(--dsw-alias-toast-bg, var(--dsw-alias-bg-overlay));\n  color: var(--dsw-alias-label-primary);\n  font-size: 12.5px;\n  border-radius: 999px;\n  padding: 8px 16px;\n  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.35);\n}\n\n/* ── 财经新闻面板（@kstock/client-news）────────────────────────── */\n\n.ksq-news-list {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  max-width: 820px;\n  padding-bottom: 8px;\n}\n\n.ksq-news-item {\n  position: relative;\n  padding: 12px 16px 12px 20px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 12px;\n  background: var(--dsw-alias-bg-layer-2);\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  overflow: hidden;\n  transition: border-color .15s ease, transform .15s ease, box-shadow .15s ease;\n}\n\n/* 左侧品牌色细轨：常亮 55%，hover 点满。 */\n.ksq-news-item::before {\n  content: '';\n  position: absolute;\n  left: 0;\n  top: 0;\n  bottom: 0;\n  width: 3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 100%, transparent);\n  opacity: .45;\n  transition: opacity .15s ease;\n}\n\n.ksq-news-item:hover {\n  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, var(--dsw-alias-border-l2));\n  transform: translateY(-1px);\n  box-shadow: 0 4px 16px color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent);\n}\n\n.ksq-news-item:hover::before {\n  opacity: 1;\n}\n\n.ksq-news-meta {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  font-size: 11.5px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n\n.ksq-news-source {\n  padding: 1.5px 8px;\n  border-radius: 99px;\n  font-size: 11px;\n  font-weight: 500;\n  letter-spacing: .3px;\n  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 13%, transparent);\n  color: var(--dsw-alias-brand-primary);\n  white-space: nowrap;\n}\n\n.ksq-news-dot {\n  width: 3px;\n  height: 3px;\n  border-radius: 50%;\n  background: currentColor;\n  opacity: .55;\n  flex: none;\n}\n\n.ksq-news-time {\n  margin-left: auto;\n  white-space: nowrap;\n}\n\n.ksq-news-title {\n  font-size: 14px;\n  font-weight: 600;\n  line-height: 1.5;\n  color: var(--dsw-alias-label-primary);\n  text-decoration: none;\n}\n\na.ksq-news-title:hover {\n  color: var(--dsw-alias-link);\n}\n\n.ksq-news-summary {\n  margin: 0;\n  font-size: 12.5px;\n  line-height: 1.6;\n  color: var(--dsw-alias-label-secondary);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n}\n";
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
		const STYLE_VERSION = "2026-09-20.2-news";
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
		* 财经新闻 主区面板：实时快讯列表（落地页 landing-news 的 workspace 形态）。
		*
		* - 数据：`GET /kstock-api/workspace-news`（服务端 60 秒缓存，主源东方财富
		*   + 备源央视）；客户端每 60 秒自动刷新 + 手动刷新；
		* - 滚动：`.ksq-body`（flex:1 + overflow:auto，与四个量化库同款骨架——
		*   `.ksq-page` 本身 overflow:hidden，列表必须落 body 层才可滚）；
		* - 外链 target=_blank：Electron 壳转交系统浏览器，浏览器直连开新标签；
		* - 无数据诚实空态（数据源不可用时不编造，与全产品口径一致）。
		*/
		/** 与服务端缓存 TTL 对齐的自动刷新间隔。 */
		const REFRESH_MS = 6e4;
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
		function NewsPage() {
			const [payload, setPayload] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(null);
			const alive = (0, react.useRef)(true);
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
			(0, react.useEffect)(() => {
				alive.current = true;
				load();
				const timer = window.setInterval(() => void load(), REFRESH_MS);
				return () => {
					alive.current = false;
					window.clearInterval(timer);
				};
			}, [load]);
			const items = payload?.items ?? [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "ksq-page",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: "ksq-topbar",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-title",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "财经新闻" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["实时快讯 · 每 60 秒自动刷新", payload ? ` · 更新于 ${formatDateTime(payload.updated_at)}` : ""] })]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "ksq-topbar-actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "ksq-count",
							children: [items.length, " 条"]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RefreshButton, {
							refreshing: loading,
							onClick: () => void load(),
							label: "刷新"
						})]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "ksq-body",
					"aria-label": "财经新闻",
					children: [
						error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ErrorLine, { message: error }),
						loading && payload === null && error === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Loading, { text: "加载财经快讯…" }),
						!loading && payload !== null && items.length === 0 && error === null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Empty, {
							icon: "📰",
							title: "暂无快讯",
							hint: "数据源（东方财富/央视）暂未返回内容——网络不可用或接口限流，稍后自动重试"
						}),
						items.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "ksq-news-list",
							children: items.map((item, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
								className: "ksq-news-item",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "ksq-news-meta",
										children: [
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
												children: displayTime(item.published_at)
											})
										]
									}),
									item.url !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
										className: "ksq-news-title",
										href: item.url,
										target: "_blank",
										rel: "noreferrer noopener",
										children: item.title
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "ksq-news-title",
										children: item.title
									}),
									item.summary !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "ksq-news-summary",
										children: item.summary
									})
								]
							}, `${item.title}-${index}`))
						})
					]
				})]
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
		* @kstock/quant-ui 幂等注入。数据走 @kstock/quant 宿主的
		* `GET /kstock-api/workspace-news`（东方财富主源 + 央视备源，60 秒缓存）。
		*/
		/** 面板键：main slot 与侧栏入口共用。 */
		const PANEL_KEY = "kstock-client-news";
		/** 侧栏图标（sidebar.panellist 的组件收到 {size, active} props）。 */
		function NavIcon({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconNews, { size: size ?? 18 });
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