window.__ModuleLoader__.load({
	id: "@kstock/client-brand",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/background.ts
		/**
		* KStock 环境背景：还原 1.x 桌面端的全局五层渐变网格背景
		* （apps/desktop/src/styles.css `.landing-shell` 等 8 个顶层容器共享的定义），
		* 两层绿色径向光晕 + 52px 网格线 + 纵向渐隐，亮色为薄荷纸衍生方案。
		*
		* 引擎 UI 的画布由 token（--dsw-alias-bg-base 等）驱动且可能被运行时内联
		* 变量覆盖，因此这里的品牌背景用样式表 + !important 声明，作为品牌层的
		* 画布兜底；面板层级表面仍由 token 控制，渐变只在可见画布处透出。
		*/
		const STYLE_TAG_ID = "kstock-brand-background";
		const BACKGROUND_CSS = `
/* KStock 品牌环境背景（亮色：薄荷纸衍生；暗色：1.x 深绿黑原案） */
body {
  background-color: #f2f7f5 !important;
  background-image:
    radial-gradient(circle at 72% 16%, rgba(23, 130, 103, 0.07), transparent 34%),
    radial-gradient(circle at 20% 82%, rgba(16, 90, 71, 0.05), transparent 32%),
    linear-gradient(rgba(23, 130, 103, 0.030) 1px, transparent 1px),
    linear-gradient(90deg, rgba(23, 130, 103, 0.026) 1px, transparent 1px),
    linear-gradient(180deg, #f7fbf9 0%, #edf4f1 100%) !important;
  background-position: center, center, 0 0, 0 0, 0 0 !important;
  background-size: auto, auto, 52px 52px, 52px 52px, auto !important;
}

body[data-ds-dark-theme] {
  background-color: #030d0b !important;
  background-image:
    radial-gradient(circle at 72% 16%, rgba(36, 132, 104, 0.085), transparent 34%),
    radial-gradient(circle at 20% 82%, rgba(22, 76, 61, 0.065), transparent 32%),
    linear-gradient(rgba(129, 205, 178, 0.026) 1px, transparent 1px),
    linear-gradient(90deg, rgba(129, 205, 178, 0.022) 1px, transparent 1px),
    linear-gradient(180deg, #061511 0%, #020a08 100%) !important;
  background-position: center, center, 0 0, 0 0, 0 0 !important;
  background-size: auto, auto, 52px 52px, 52px 52px, auto !important;
}
`;
		/** 注入品牌背景样式表；返回卸用 disposer（幂等：已存在则不再注入）。 */
		function applyBackgroundCss() {
			if (typeof document === "undefined") return () => {};
			const existing = document.querySelector(`style[data-kstock="${STYLE_TAG_ID}"]`);
			if (existing !== null) return () => existing.remove();
			const tag = document.createElement("style");
			tag.dataset.kstock = STYLE_TAG_ID;
			tag.textContent = BACKGROUND_CSS;
			document.head.appendChild(tag);
			return () => tag.remove();
		}
		//#endregion
		//#region src/client/Marks.tsx
		/**
		* KStock 品牌标记：圆角方形 + "K" 三笔（stem 干 / arm 臂 / line 折线），
		* 图形取自 1.x 桌面端 `apps/desktop/src/components/LogoMark.tsx`。
		*
		* 与上游印记同策略：标记自带颜色（品牌图章而非主题图标），明暗表面呈现
		* 一致 —— 绿色渐变底 + 浅绿白 K 纹，挂入引擎的品牌槽位
		* （sidebar.brand.mark / conversation.hero.brand.mark / settings.about.mark）。
		*/
		/** 品牌绿渐变，自上而下：受光的亮绿上缘过渡到深绿下缘。 */
		const BODY_STOPS = [
			"#3ad0ab",
			"#2fc197",
			"#1d8a6e"
		];
		/** K 纹浅绿白，压在品牌绿底上。 */
		const GLYPH_FILL = "#eafff8";
		function LogoSvg({ size, className, title }) {
			const gradientId = `kstock-logo-body-${(0, react.useId)().replace(/[^A-Za-z0-9_-]/gu, "")}`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				className,
				viewBox: "0 0 64 64",
				fill: "none",
				role: "img",
				"aria-label": title,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("linearGradient", {
						id: gradientId,
						x1: "32",
						y1: "4",
						x2: "32",
						y2: "60",
						gradientUnits: "userSpaceOnUse",
						children: BODY_STOPS.map((stop, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
							offset: `${index / (BODY_STOPS.length - 1) * 100}%`,
							stopColor: stop
						}, stop))
					}) }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "4",
						y: "4",
						width: "56",
						height: "56",
						rx: "14",
						fill: `url(#${gradientId})`
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						className: "kstock-logo-stem",
						d: "M21 16h9c2 0 4 2 4 4v24c0 2-2 4-4 4h-9z",
						fill: GLYPH_FILL
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						className: "kstock-logo-arm",
						d: "M34 31 50 16h9L41 34l18 14H47L34 38z",
						fill: GLYPH_FILL
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						className: "kstock-logo-line",
						d: "M15 43 28 38l8 4 12-11 9 3",
						stroke: GLYPH_FILL,
						strokeWidth: "5",
						strokeLinecap: "round",
						strokeLinejoin: "round"
					})
				]
			});
		}
		/**
		* 侧栏品牌名槽位的 KStock 占位：替换 shell 的 QiLin 回退字标。
		* 版本徽章仍由 shell 自绘（构建期烙入的版本号），此处只接管名字。
		* 字号与 shell 回退字标（fallbackBrandName 17px/600）对齐，样式见
		* windowChrome 注入的 `.kstock-brand-wordmark`。
		*/
		function KStockWordmark() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "kstock-brand-wordmark",
				children: "KStock"
			});
		}
		/** 侧栏品牌标记槽位的 KStock 占位。 */
		function KStockMark({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LogoSvg, {
				size,
				title: "KStock"
			});
		}
		/** 会话 hero 品牌标记槽位的 KStock 占位。 */
		function KStockHeroMark({ size, className }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LogoSvg, {
				size,
				className,
				title: "KStock"
			});
		}
		/** 设置关于页品牌标记槽位的 KStock 占位。 */
		function KStockArtistMark({ size = 24, className }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LogoSvg, {
				size,
				className,
				title: "KStock"
			});
		}
		//#endregion
		//#region src/client/tokens.ts
		/**
		* 本品牌层的 source id：一层一源，`ctx.theme` 检查时可见来源，
		* 重复应用为替换而非叠加。
		*/
		const KSTOCK_THEME_SOURCE = "@kstock/client-brand";
		/**
		* KStock 品牌 token。每个值同时给出明/暗两种方案（ThemeTokenOverrides 契约），
		* 按表面家族分组。
		*/
		const KSTOCK_TOKENS = Object.freeze({
			"--dsw-alias-brand-primary": {
				light: "#178267",
				dark: "#31c7a2"
			},
			"--dsw-alias-button-primary-hover": {
				light: "#106b54",
				dark: "#5fd3b0"
			},
			"--dsw-alias-link": {
				light: "#106b54",
				dark: "#5fd3b0"
			},
			"--dsw-alias-bg-base": {
				light: "#f2f7f5",
				dark: "#030d0b"
			},
			"--dsw-alias-bg-layer-1": {
				light: "#f7fbf9",
				dark: "#0e1513"
			},
			"--dsw-alias-bg-layer-2": {
				light: "#fbfdfc",
				dark: "#1b1e22"
			},
			"--dsw-alias-bg-layer-3": {
				light: "#ffffff",
				dark: "#25292e"
			},
			"--dsw-alias-bg-overlay": {
				light: "#e2ebe7",
				dark: "#3a4148"
			},
			"--dsw-alias-bg-skeleton": {
				light: "rgba(23, 60, 50, 0.06)",
				dark: "rgba(232, 234, 237, 0.08)"
			},
			"--dsw-specific-sidebar-fill": {
				light: "#ecf3f0",
				dark: "#05100d"
			},
			"--dsw-specific-sidebar-nav-item-hover": {
				light: "#e3ede9",
				dark: "#0f1a17"
			},
			"--dsw-specific-sidebar-nav-item-active": {
				light: "#dae7e2",
				dark: "#14211d"
			},
			"--dsw-specific-sidebar-nav-item-active-accent": {
				light: "#178267",
				dark: "#31c7a2"
			},
			"--dsw-specific-bubble": {
				light: "#eef5f2",
				dark: "#1d2126"
			},
			"--dsw-specific-input-major": {
				light: "#ffffff",
				dark: "#1b1e22"
			},
			"--dsw-specific-selector": {
				light: "#f4faf7",
				dark: "#22262b"
			},
			"--dsw-specific-tip": {
				light: "#f4faf7",
				dark: "#22262b"
			},
			"--dsw-alias-toast-bg": {
				light: "#1d2b26",
				dark: "#1d2b26"
			},
			"--dsw-alias-tooltip-bg": {
				light: "#1d2b26",
				dark: "#22262b"
			},
			"--dsw-alias-label-primary": {
				light: "#14201c",
				dark: "#e8eaed"
			},
			"--dsw-alias-label-primary-dimmed": {
				light: "#2b3b35",
				dark: "#d5d9de"
			},
			"--dsw-alias-label-secondary": {
				light: "#5b6b64",
				dark: "#aeb7bf"
			},
			"--dsw-alias-label-tertiary": {
				light: "#7d8d86",
				dark: "#8f96a0"
			},
			"--dsw-alias-label-caption": {
				light: "#98a8a1",
				dark: "#7a828c"
			},
			"--dsw-alias-label-dimmed": {
				light: "#c3d2cc",
				dark: "#566068"
			},
			"--dsw-alias-label-primary-inverted": {
				light: "#fbfdfc",
				dark: "#14201c"
			},
			"--dsw-alias-border-l1": {
				light: "rgba(20, 32, 28, 0.07)",
				dark: "rgba(232, 234, 237, 0.06)"
			},
			"--dsw-alias-border-l2": {
				light: "rgba(20, 32, 28, 0.11)",
				dark: "rgba(232, 234, 237, 0.10)"
			},
			"--dsw-alias-border-l2-darkmode-thin": {
				light: "rgba(20, 32, 28, 0.11)",
				dark: "rgba(232, 234, 237, 0.07)"
			},
			"--dsw-alias-border-l3": {
				light: "rgba(20, 32, 28, 0.13)",
				dark: "rgba(232, 234, 237, 0.14)"
			},
			"--dsw-alias-border-l4": {
				light: "rgba(20, 32, 28, 0.17)",
				dark: "rgba(232, 234, 237, 0.18)"
			},
			"--dsw-alias-border-inverted": {
				light: "rgba(20, 32, 28, 0)",
				dark: "rgba(232, 234, 237, 0.05)"
			},
			"--dsw-alias-border-inverted2": {
				light: "rgba(20, 32, 28, 0)",
				dark: "rgba(232, 234, 237, 0.08)"
			},
			"--dsw-alias-interactive-bg-hover": {
				light: "rgba(23, 130, 103, 0.08)",
				dark: "rgba(232, 234, 237, 0.08)"
			},
			"--dsw-alias-interactive-bg-active": {
				light: "rgba(23, 130, 103, 0.13)",
				dark: "rgba(232, 234, 237, 0.14)"
			},
			"--dsw-alias-interactive-bg-hover-accent": {
				light: "rgba(23, 130, 103, 0.14)",
				dark: "rgba(49, 199, 162, 0.20)"
			},
			"--dsw-alias-interactive-bg-hover-solid": {
				light: "#e8f0ec",
				dark: "#25292e"
			},
			"--dsw-alias-button-contrast-fill": {
				light: "#5b6b64",
				dark: "#e8eaed"
			},
			"--dsw-alias-button-elevated-fill": {
				light: "#ffffff",
				dark: "#22262b"
			},
			"--dsw-alias-button-floating-fill": {
				light: "#ffffff",
				dark: "#1d2126"
			},
			"--dsw-alias-button-floating-hover": {
				light: "#eef4f1",
				dark: "#25292e"
			},
			"--dsw-alias-button-ghost-active-fill": {
				light: "#e9f1ed",
				dark: "#23282d"
			},
			"--dsw-alias-button-ghost-active-hover": {
				light: "#dfeae5",
				dark: "#2a3036"
			},
			"--dsw-alias-button-ghost-active-border": {
				light: "#9ab3aa",
				dark: "#4a545c"
			},
			"--dsw-alias-button-tool-bar-fill": {
				light: "rgba(91, 107, 100, 0.5)",
				dark: "rgba(143, 150, 160, 0.4)"
			},
			"--dsw-alias-button-tool-bar-hover": {
				light: "rgba(91, 107, 100, 0.6)",
				dark: "rgba(143, 150, 160, 0.5)"
			},
			"--dsw-alias-button-tool-bar-fill-invisible": {
				light: "rgba(20, 32, 28, 0.36)",
				dark: "rgba(16, 22, 20, 0.36)"
			},
			"--dsw-alias-markdown-code-block": {
				light: "#f0f6f3",
				dark: "#141a18"
			},
			"--dsw-alias-markdown-code-block-banner": {
				light: "#e7efeb",
				dark: "#1b2120"
			},
			"--dsw-alias-markdown-inline-code": {
				light: "#edf4f1",
				dark: "#1d2422"
			},
			"--dsw-alias-markdown-citation": {
				light: "#eef4f1",
				dark: "#1d2126"
			},
			"--dsw-alias-markdown-tag": {
				light: "#edf4f1",
				dark: "#1d2126"
			},
			"--dsw-alias-scrollbar-bg-l1": {
				light: "#d3e0da",
				dark: "#3d454c"
			},
			"--dsw-alias-scrollbar-bg-l2": {
				light: "#d3e0da",
				dark: "#4a535b"
			},
			"--dsw-alias-scrollbar-hover-l1": {
				light: "#c2d3cc",
				dark: "#4a535b"
			},
			"--dsw-alias-scrollbar-hover-l2": {
				light: "#c2d3cc",
				dark: "#59636c"
			},
			"--dsw-specific-brand-seal-fill": {
				light: "#178267",
				dark: "#2fc197"
			}
		});
		//#endregion
		//#region src/client/windowChrome.ts
		/**
		* 桌面壳适配与上游 UI 修正，两层样式表分开发布：
		*
		* 1. `kstock-ui-fixes`（全平台注入）：上游组件里影响浏览器端的布局修正。
		*    目前一处：文件面板「自动换行」开关复用了 28px 定宽的图标按钮 `.tool`，
		*    四字文本标签被逐字折行成竖排——放开定宽并禁止折行
		*    （`data-file-wrap` 是上游模板上的稳定 data 钩子）。
		*    侧栏品牌名 `.kstock-brand-wordmark` 的样式也在这层（浏览器同样渲染）。
		*
		* 2. `kstock-window-chrome`（仅 Electron）：无框窗口的桌面壳避让。
		*    - macOS hiddenInset：红绿灯叠加在画布左上（trafficLightPosition
		*      {13,18}，灯组占 y 18..30、x 13..65，中心正对 48px 顶栏带）。侧栏
		*      品牌行收成 48px（与会话标题栏同高）并留 84px 左肩；折叠轨（56px
		*      宽）容不下左肩，改为整体把轨内容压到灯组下方；设置弹层是全窗口
		*      面板，导航标题行同样压到灯组下方。品牌行/标题行兼作拖拽条
		*      （行内按钮除外）。
		*    - Windows/Linux titleBarOverlay：内容整体避开系统窗控条
		*      （env 回落 0 时无副作用）。
		*
		* 上游 UI 的类名是 CSS Modules 哈希产物（实测形如 `PBw8SG_logoRow`，前缀式
		* 哈希），用 `[class*="logoRow"]` 属性包含匹配稳定命中本地名；层级覆盖
		* （折叠态、设置标题）用同等特异度的组合选择器并靠注入顺序取胜。
		*/
		const UI_FIXES_TAG_ID = "kstock-ui-fixes";
		const WINDOW_CHROME_TAG_ID = "kstock-window-chrome";
		/** 全平台生效的上游布局修正 + KStock 品牌名样式。 */
		const UI_FIXES_CSS = `
button[data-file-wrap] {
  width: auto;
  min-width: 28px;
  padding: 0 8px;
  white-space: nowrap;
}

.kstock-brand-wordmark {
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
  letter-spacing: 0;
  white-space: nowrap;
}
`;
		/** Electron 内注入的窗口壳适配（拖拽条 + 窗控避让）。几何覆盖一律挂
		* `#root` 前缀抬升特异度（ID+类 > 上游任意类组合），不依赖注入顺序。 */
		const WINDOW_CHROME_CSS = `
#root [class*="logoRow"],
#root [class*="navTitle"],
#root [class*="header"]:has(> [class*="headerRight"]) {
  -webkit-app-region: drag;
}

#root [class*="logoRow"] :is(button, a, input),
#root [class*="navTitle"] :is(button, a, input),
#root [class*="header"]:has(> [class*="headerRight"]) :is(button, a, input) {
  -webkit-app-region: no-drag;
}

#root {
  padding-top: env(titlebar-area-height, 0px);
  box-sizing: border-box;
}
`;
		/** macOS 专属：红绿灯左上叠加的避让与顶栏 48px 统一。
		* - 侧栏品牌行收成 48px 并吃掉侧栏列自带的 6px 顶部内边距（margin -6px），
		*   品牌标记中心正对红绿灯中心（y=24）；84px 左肩让开灯组（x 13..65）。
		* - 折叠轨（56px 宽）容不下左肩：轨内容整体压到灯组下方（灯组底 y=30，
		*   折叠轨顶 padding 18 + margin 34 = y 52 起）。
		* - 设置弹层是全窗口面板：导航标题行压到灯组下方（导航顶 padding 22
		*   + margin 26 = y 48 起），标题行兼作拖拽条。 */
		const MACOS_TRAFFIC_LIGHTS_CSS = `
#root [class*="logoRow"] {
  height: 48px;
  padding: 0 0 0 84px;
  margin: -6px 0 8px;
}

#root [class*="collapsed"] [class*="logoRow"] {
  height: 36px;
  padding: 0;
  margin: 34px 0 12px;
}

#root [class*="navTitle"] {
  margin-top: 26px;
}
`;
		function injectStyleTag(tagId, css) {
			const existing = document.querySelector(`style[data-kstock="${tagId}"]`);
			if (existing !== null) return () => existing.remove();
			const tag = document.createElement("style");
			tag.dataset.kstock = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
			return () => tag.remove();
		}
		/** 注入全平台 UI 修正样式表；返回卸用 disposer（幂等：已存在则不再注入）。 */
		function applyUiFixesCss() {
			if (typeof document === "undefined") return () => {};
			return injectStyleTag(UI_FIXES_TAG_ID, UI_FIXES_CSS);
		}
		/**
		* 注入窗口壳适配样式表；返回卸用 disposer（幂等：已存在则不再注入）。
		* 仅 Electron 生效，浏览器直连引擎时不产生任何窗口适配样式；macOS
		* 额外叠加红绿灯避让（Windows/Linux 的窗控条由 overlay env 让位）。
		*/
		function applyWindowChromeCss() {
			if (typeof document === "undefined") return () => {};
			if (!/Electron/.test(navigator.userAgent)) return () => {};
			const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent);
			return injectStyleTag(WINDOW_CHROME_TAG_ID, WINDOW_CHROME_CSS + (isMac ? MACOS_TRAFFIC_LIGHTS_CSS : ""));
		}
		//#endregion
		//#region src/client/index.ts
		/** 必需服务：槽位注册表（品牌标记）、主题注册表（token 覆盖）、locale 注册表（品牌文案）。 */
		const inject = [
			"slots",
			"theme",
			"locale"
		];
		/**
		* KStock 语言策略：不注册任何语言与字典。
		*
		* locale.register 对「同一 namespace + 同一 locale」重复注册直接抛错（上游
		* locale 插件已注册 common/conversation 的 zh/en），addLanguage 则会把
		* 「KStock 中文/English」加进语言菜单——两者都不可用。产品文案以
		* KStockHeroMark 等品牌槽位呈现（上游 web-brand 同款做法：品牌=标记层，
		* 文案烙在出厂字典）。唯一保留的行为：未显式选择语言时产品默认中文。
		*/
		function applyBrandLocale(ctx) {
			const active = ctx.locale.getSnapshot().active;
			if (active !== "zh" && active !== "en") ctx.locale.setLocale("zh");
			return () => {};
		}
		/**
		* 挂载 KStock 品牌层。品牌标记与品牌名的槽位注册方式与上游
		* @qilin/client-ui-brand 同构：侧栏标记/名字与 hero 标记共用一组嵌套
		* 注册（slots.inject 等待 ui-sidebar 的声明），关于页标记独立注册。
		* @param ctx - 客户端根上下文。
		*/
		function apply(ctx) {
			ctx.effect(() => {
				const disposeTokens = ctx.theme.overrideTokens(KSTOCK_THEME_SOURCE, KSTOCK_TOKENS);
				const disposeBackground = applyBackgroundCss();
				const disposeUiFixes = applyUiFixesCss();
				const disposeWindowChrome = applyWindowChromeCss();
				const disposeMarks = ctx.slots.inject("sidebar.brand.mark", () => ctx.slots.inject("sidebar.brand.name", () => ctx.slots.inject("conversation.hero.brand.mark", function* () {
					yield ctx.slots.register({ name: "sidebar.brand.mark" }, KStockMark);
					yield ctx.slots.register({ name: "sidebar.brand.name" }, KStockWordmark);
					yield ctx.slots.register({ name: "conversation.hero.brand.mark" }, KStockHeroMark);
				})));
				const disposeAbout = ctx.slots.inject("settings.about.mark", () => ctx.slots.register({ name: "settings.about.mark" }, KStockArtistMark));
				const disposeLocale = applyBrandLocale(ctx);
				return () => {
					disposeLocale();
					disposeAbout();
					disposeMarks();
					disposeWindowChrome();
					disposeUiFixes();
					disposeBackground();
					disposeTokens();
				};
			}, "kstock: brand layer");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.cjs.map