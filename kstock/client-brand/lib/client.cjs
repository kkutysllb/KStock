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
		//#region src/client/marks/geometry.ts
		/**
		* KStock 商标几何常量 —— **本文件由脚本生成，请勿手改**。
		*
		* 生成器：`docs/design/icon-refresh/gen_client_marks.py`
		* 设计源：`docs/design/icon-refresh/`（篆书字形见 `glyphs/`，授权与触发条件见其 README）
		*
		* UI 内的侧栏 / hero / 关于页商标必须与**应用图标几何一致**，因此坐标全部由设计源算出，
		* 而不是手写一份。坐标系与应用图标同为 1024 画布 / 内容区 824（内缩 100）。
		*
		* 两种形制（按尺寸切换，用户 2026-09-20 选定）：
		*   size >= 48 → `SEAL_ON_INK`：墨底 squircle + 内嵌朱印（= 应用图标 Tier 1b）
		*   size <  48 → `SEAL_FULL`：朱印直填满徽标
		* 两者都是**朱红白文印 + 篆书「麒麟」横排（右麒左麟）**，只是印面占比不同。
		*
		* 为什么小尺寸不用「品牌绿场 K」：它在 24px 下与 1.x 旧徽标（同为绿底白 K）几乎无法区分，
		* 实测反馈「顶部商标没换过来」。绿场 K 仍是**应用图标** 16–48px 档的形制
		* （见 `build_assets.py`），只是不再用于 UI 商标。
		*/
		/** 连续曲率圆角方（超椭圆 |x/a|^5 + |y/a|^5 = 1 采样，中心 512，边长 824）。 */
		const SQUIRCLE_PATH = "M 924.0 512.0L923.4 667.2L921.5 716.5L918.3 751.9L913.9 780.2L908.1 803.9L901.0 824.2L892.4 841.9L882.3 857.2L870.7 870.7L857.2 882.3L841.9 892.4L824.2 901.0L803.9 908.1L780.2 913.9L751.9 918.3L716.5 921.5L667.2 923.4L512.0 924.0L356.8 923.4L307.5 921.5L272.1 918.3L243.8 913.9L220.1 908.1L199.8 901.0L182.1 892.4L166.8 882.3L153.3 870.7L141.7 857.2L131.6 841.9L123.0 824.2L115.9 803.9L110.1 780.2L105.7 751.9L102.5 716.5L100.6 667.2L100.0 512.0L100.6 356.8L102.5 307.5L105.7 272.1L110.1 243.8L115.9 220.1L123.0 199.8L131.6 182.1L141.7 166.8L153.3 153.3L166.8 141.7L182.1 131.6L199.8 123.0L220.1 115.9L243.8 110.1L272.1 105.7L307.5 102.5L356.8 100.6L512.0 100.0L667.2 100.6L716.5 102.5L751.9 105.7L780.2 110.1L803.9 115.9L824.2 123.0L841.9 131.6L857.2 141.7L870.7 153.3L882.3 166.8L892.4 182.1L901.0 199.8L908.1 220.1L913.9 243.8L918.3 272.1L921.5 307.5L923.4 356.8Z";
		/** 篆书字形路径（只存一份，两种形制共用；`pre` 是字形自带的图层变换）。 */
		const GLYPH_PATHS = {
			qi: {
				d: "m 65.4,1031.5 c 0,-6.3 1.3,-46.3 2.9,-88.9 3.2,-83.3 3.9,-86.8 17.2,-86.8 5.3,0 6.2,-1.3 6.2,-9.4 l 0,-9.4 -11.2,0.8 c -8.5,0.6 -11.2,-0.1 -11.2,-3.1 0,-2.4 3,-4.3 7.9,-4.8 9.7,-1.1 14.5,-4.8 14.5,-11.3 0,-3.5 -1.9,-4.9 -6.6,-4.9 -4.5,0 -7.3,-1.9 -8.8,-5.9 -3.7,-10 -5.4,-25.6 -2.8,-25.6 1.4,0 3.4,0 4.4,-0.1 1.1,-0.1 2.6,3.7 3.3,8.3 1.5,9.3 7.6,14.6 14.1,12 3.4,-1.3 4.3,-5.3 4.3,-18.8 0,-15.4 0.5,-17.2 5.3,-17.2 4.6,0 5.3,1.8 5.3,14.2 0,18.3 1.8,22.6 9.4,22.6 6.3,0 7.8,-2.9 9.5,-18.4 0.4,-3.8 2.7,-6.9 5.3,-7.4 4,-0.8 4.6,1.3 4.6,15.3 0,14 -0.7,16.4 -5.3,17.6 -3.4,0.9 -5.3,3.6 -5.3,7.6 0,5.4 1.3,6.3 9.2,6.3 10.4,0 12.9,4.8 11.4,22.5 -0.8,9.4 -1.6,10.4 -10.7,12.5 -13.2,3.1 -13.1,10.6 0.5,23.3 11.3,10.6 15.7,25.9 12,42.2 -2.6,11.8 -1.6,45.2 1.5,46.2 1.4,0.5 2.5,3.6 2.5,6.8 0,3.3 2.3,12.9 5.1,21.4 3.7,11.1 4.3,16.4 2.3,18.8 -1.5,1.8 -3.6,3.4 -4.7,3.4 -3,0 -8,-12.7 -8,-20.2 0,-11.5 -10.3,-48.2 -13.6,-48.2 -3.6,0 -2.5,27.3 1.9,46.2 4,17.4 3.7,24.8 -1.2,24.8 -4.1,0 -7.8,-15.6 -9.8,-40.7 -1,-13 -2,-25.4 -2.3,-27.6 -0.3,-2.2 2.3,-8.7 5.7,-14.5 13,-21.9 14.7,-26.8 13,-36.1 -0.9,-5 -4.1,-11.6 -7,-14.8 -5,-5.4 -5.8,-5.5 -13,-1.8 -4.2,2.2 -11.4,3.7 -16,3.3 -10.7,-0.9 -15.3,5.3 -10.9,14.9 2.5,5.4 4.9,6.8 12.5,6.8 15.7,0 27,9.1 13.7,11 -4.5,0.6 -5.7,2.3 -5.1,6.9 0.5,3.3 -0.6,7.8 -2.3,9.9 -3,3.6 -2.3,26.2 1.6,55 2.4,17.7 2.4,20.5 -0.5,21.5 -4.2,1.5 -6.3,-7.4 -8.6,-36.7 -2.1,-27.3 -5.5,-35.5 -10.7,-25.8 -4.3,8.1 -5.4,30.8 -2.2,46.8 2.1,10.7 2,14.7 -0.6,17.9 -6,7.2 -7.7,0.4 -8.2,-33.4 -0.5,-35.6 -0.4,-35.8 14.1,-45.3 8.5,-5.6 10.2,-17.3 2.4,-17.3 -12.7,0 -22.1,-26.1 -12.3,-34.2 4.1,-3.4 5.1,-12.2 2.3,-19.5 -2.2,-5.7 -11.5,-5.3 -11.9,0.4 -0.2,2.5 -0.7,7.6 -1.1,11.2 -0.4,3.6 -1.6,37.9 -2.7,76.2 -2,71.4 -3,81.7 -8.5,83.5 -2.1,0.7 -3.2,-2.7 -3.2,-10.3 z M 114.3,880.1 c 4,-2.7 6.5,-10.5 4.8,-14.8 -1,-2.6 -3.5,-3.1 -8.5,-1.8 -7.9,2.1 -10.5,9 -5.6,14.8 3.6,4.3 5.2,4.6 9.3,1.8 z m 3.3,-35.5 c -0.7,-7.4 -1.8,-8.5 -8.1,-8.5 -4,0 -7.2,0.9 -7.2,2 0,1.1 0,4.9 0,8.5 0,5.6 1.2,6.6 8.1,6.6 7.5,0 8,-0.6 7.2,-8.5 z m 20.2,-2 c 0,-4.1 -1.7,-6.8 -4.6,-7.4 -3.6,-0.7 -4.6,0.9 -4.6,7.4 0,6.5 1,8.1 4.6,7.4 2.9,-0.6 4.6,-3.3 4.6,-7.4 z m -19.7,-23.7 c 0,-4.3 -1.8,-5.3 -9.2,-5.3 -7.4,0 -9.2,1 -9.2,5.3 0,4.3 1.8,5.3 9.2,5.3 7.4,0 9.2,-1 9.2,-5.3 z m 104,213.6 c -1,-4 -2.9,-12 -4.2,-17.7 -3.9,-16.8 -10.3,-72.1 -10.4,-90 l -0.1,-16.4 -7.9,0 c -9,0 -8.2,-5.8 -8.1,57 0.1,52.3 -4.8,78.4 -13.1,70.1 -2,-2 -1.9,-19.6 0.4,-61.1 1.9,-34.9 2.3,-59.2 0.8,-60.7 -1.3,-1.3 -6.5,-3.1 -11.5,-4 -10.9,-1.9 -10.9,-1.9 -8.3,-6.1 2.2,-3.6 70.5,-7.6 78.2,-4.7 6.5,2.5 -0.7,9.4 -9.9,9.4 -6,0 -7.6,1.2 -8,5.9 -1.4,20.9 2.3,59.1 8.3,86.2 6.3,28.4 6.5,35.6 1.1,37.7 -5.8,2.2 -5.6,2.4 -7.5,-5.6 z M 177.8,876.9 c -7.2,-5.7 -12.5,-27.1 -12.5,-50.8 0,-11.3 -0.5,-12.3 -7.9,-14.2 -8.8,-2.3 -10.7,-6.8 -3.4,-8.2 8.7,-1.7 11.3,-6.1 11.3,-19.4 0,-10.9 0.7,-12.8 4.2,-11.5 2.3,0.9 4.7,1.6 5.3,1.6 0.6,0 1.1,6 1.1,13.4 l 0,13.4 16.4,-1.9 c 9,-1 17.2,-2.3 18.1,-2.9 0.9,-0.5 1.7,-7 1.7,-14.3 0,-14.9 0.7,-16.5 6.7,-14.2 2.8,1.1 4.4,5.6 5,13.9 0.7,11.3 1.4,12.3 8.7,13.6 11.1,1.9 12.8,12.4 2.1,13.6 l -7.4,0.8 0.7,19.7 c 0.9,28.2 -3.1,45.8 -11.4,49.6 -10.8,4.9 -31,3.7 -38.6,-2.2 z m 27.7,-6.9 c 2.3,-2.3 -6,-14.2 -9.9,-14.2 -1.8,0 -4.1,2.1 -5,4.6 -0.9,2.5 -2.3,6.1 -3.2,7.9 -1.1,2.3 1.2,3.3 7.5,3.3 4.9,0 9.7,-0.7 10.6,-1.6 z m -18.5,-19.2 c 4.7,-8.4 4.7,-8.8 -0.7,-17.6 -3.1,-4.9 -6.6,-9 -8,-9 -1.3,0 -2.4,8.4 -2.4,18.6 0,20.6 2.9,22.7 11.1,7.9 z m 28.3,-8.1 c 0,-7.2 0.1,-14 0.2,-15.1 0.6,-5.7 -5.5,-2.4 -9.2,4.9 -3.5,7.1 -3.7,9.7 -0.9,15.9 5.3,11.9 9.9,9.3 9.9,-5.7 z m -12.3,-22.4 c 2.4,-5.1 4.4,-9.8 4.4,-10.5 0,-0.7 -5.3,-1.2 -11.8,-1.2 -13.1,0 -14.1,1.9 -7.3,13.4 5.9,10 9.3,9.6 14.7,-1.7 z",
				pre: "translate(0,-752.36218)"
			},
			lin: {
				d: "m 158.5,289.2 c -1,-3.9 -1.2,-12.4 -0.9,-40.5 0.4,-39.8 0.3,-43.7 -1.3,-46.3 -0.9,-1.5 -2.2,-1.8 -6.4,-1.5 -5.4,0.4 -7.1,0 -7.7,-2.1 -1,-3.7 1,-5.1 8.1,-5.6 6.1,-0.4 9.1,-2.3 10.9,-6.7 0.8,-2 0.9,-2.8 0.9,-7.6 0,-4.9 -0.1,-5.5 -0.8,-7 -0.7,-1.3 -1.3,-1.8 -3,-2.5 -4.1,-1.7 -5.5,-2.6 -5.8,-3.6 -0.3,-0.9 -0.2,-1.2 1.3,-2.7 0.9,-0.9 2.5,-2.2 3.6,-2.9 3.5,-2.1 4.5,-4.4 5.3,-12 0.4,-4.1 1.1,-5.6 2.6,-5.6 1.3,0 2.2,1.6 2.6,4.7 0.5,3.6 2,6.5 4.1,8 1.3,1 1.9,1.1 3.9,1.1 4.1,0 6.6,-2.1 7.2,-5.9 0.3,-1.7 1.4,-3 2.5,-2.8 1.2,0.2 2,3.1 2.5,9.3 0.7,9.2 -0.2,26 -1.7,31.1 -0.9,3.1 -3.7,5 -8,5.6 -3.6,0.5 -5.4,2 -6.9,5.7 -1,2.7 -2.3,4.6 -3,4.6 -1.2,0 -1.9,9 -2.2,27.2 -0.5,33.3 -1.7,53.8 -3.2,56.8 -0.7,1.4 -2.3,2.8 -3.2,2.8 -0.7,0 -0.9,-0.3 -1.2,-1.4 z m 17.7,-105.3 c 2.7,-1.2 4.4,-2.9 5.4,-5.2 0.8,-1.8 0.9,-2.5 0.9,-7.4 0,-7.5 -0.5,-8.2 -6,-8.3 -3.3,0 -4.7,0.7 -5.9,3 -2.1,4.2 -3,13.8 -1.4,16.4 1.4,2.4 3.8,2.9 7.1,1.4 z m 41.6,106.2 c -0.2,-0.3 -0.7,-1.2 -1,-2 -0.5,-1.3 -0.7,-3.8 -0.9,-18.6 -0.2,-9.4 -0.4,-19.2 -0.5,-21.6 -0.1,-2.5 -0.6,-11.3 -1,-19.8 -1,-20.9 -1.8,-27.8 -3.6,-31.4 -0.3,-0.7 -2.1,-2.7 -3.8,-4.5 -3.7,-3.8 -4.8,-5.8 -5.9,-10.9 -1.1,-5.2 -2,-16.1 -2,-25.1 0,-8.9 0.2,-10.1 2.2,-10.1 1.2,0 1.6,0.6 3.5,5 0.5,1.1 1.5,2.6 2.3,3.4 1.1,1.2 1.6,1.5 2.8,1.5 2.6,0 4.3,-1.3 9.9,-7.7 1.3,-1.5 2.7,-2.8 3.1,-2.9 1,-0.3 1.8,0.7 3.3,4.3 2.3,5.4 4.2,7.3 8.1,7.8 2.8,0.4 5.1,1.4 7.1,3.2 2.9,2.6 2.8,5.3 -0.2,6.1 -0.8,0.2 -3.5,0.4 -6.1,0.4 -5,0 -5.5,0.2 -6.4,2 -0.8,1.5 -1.5,6.9 -1.5,11.6 0,3.4 0,4 0.7,4.9 1.1,1.5 2.7,2.5 5.9,3.7 4.2,1.6 7.6,3.5 9,5 2.3,2.5 2.6,6.2 0.7,8.1 -0.9,0.9 -1,0.9 -6.3,0.8 l -5.4,-0.1 -0.9,1 c -1.8,2.1 -1.8,2.6 -1.7,27.5 0.1,30.6 -0.4,42.9 -2.3,50.2 -1.1,4.2 -2,6 -3.7,7.5 -1.1,0.9 -1.7,1.2 -3,1.2 -0.9,0 -1.8,-0.2 -2,-0.5 z m -3.2,-107.4 c 1.7,-1.8 2.8,-5.8 3.5,-11.8 0.7,-6 -0.5,-7.9 -4.8,-7.8 -2.8,0 -4.7,0.9 -5.5,2.4 -1.3,2.4 -0.4,10.2 1.7,14.9 1.5,3.4 3.4,4.2 5.2,2.3 z M 56.3,287.6 c -0.6,-0.6 -0.7,-1.2 -0.7,-4 0,-3.7 0.5,-9.9 1.3,-16.9 1.3,-11.1 2.4,-23.9 2.8,-32 0.6,-13.3 1.1,-19.2 1.7,-20.9 1.2,-3.6 2.1,-15.1 3,-39.4 2.5,-66.5 4.4,-74.4 18.6,-78.8 5.3,-1.7 5.7,-1.9 6.7,-3.7 0.7,-1.3 0.8,-2.3 0.9,-6.5 0.2,-5.9 -0.2,-7.6 -1.8,-8.4 -0.8,-0.4 -3.1,-0.7 -7.9,-0.9 -7.2,-0.4 -9.1,-0.7 -10.1,-1.8 -0.6,-0.6 -0.5,-0.8 0.2,-2.2 0.9,-1.7 3.5,-4.2 5.6,-5.3 1.1,-0.6 2.2,-0.7 6,-0.7 3.9,0 4.8,-0.1 5.8,-0.7 1.7,-1 2.4,-2.6 2.4,-5.4 0,-4.2 -1.4,-6.4 -5.5,-8.4 -5,-2.5 -8.4,-8.9 -9,-16.9 -0.3,-4 0.3,-7 2.1,-11 1.4,-3.1 2.1,-3.8 3.4,-3.8 2,0 2.9,2.1 4.5,10.7 1.8,9.7 3.5,13.2 7,14.2 3.5,1 6.4,0.2 7.9,-2.3 1.5,-2.5 1.9,-4.7 2.4,-14.3 0.7,-12.4 1,-14.3 2.9,-16.4 1.7,-1.9 3.9,-2.8 5.3,-2 1.7,0.9 1.8,1.7 2.1,15.3 0.3,13.5 0.5,15.7 2.1,17.8 1.5,2.1 5.2,2.9 7.5,1.8 3.9,-2 7.5,-9.3 8.3,-16.8 0.4,-4 1.1,-5.2 3.1,-5.4 1.1,-0.1 1.6,0.1 3,1.4 4.1,3.8 4.6,11.5 1.1,18.6 -2,4 -4.6,6.7 -8.8,8.7 -3.7,1.8 -4.5,2.7 -5.6,6.1 -0.4,1.1 -0.6,3 -0.6,4.2 0,4.2 2.8,8.1 5.8,8.1 0.8,0 1.9,-0.5 3.3,-1.5 1.5,-1.1 2.7,-1.6 3.8,-1.7 1.5,-0.2 1.7,-0.1 3.1,1.3 2.1,2.1 2.5,3.8 2.5,10.2 0,5.9 -0.6,8.9 -2.4,13.5 -1.3,3 -2.8,5.3 -4.8,7.1 -2.3,2.1 -4.2,2.9 -7.6,3.3 -1.7,0.2 -3.3,0.4 -3.7,0.6 -1.2,0.5 -1.7,2.1 -2.1,7.1 -0.2,2.7 -0.7,6.1 -1.1,7.6 -0.4,1.5 -0.7,3 -0.7,3.2 0,0.8 1.1,1.6 2.2,1.6 4.9,4.2e-4 19.9,14.6 23.5,22.9 1,2.3 1.6,6.1 1.3,8.1 -0.8,5.6 -4.9,16.8 -8.4,23.3 -2.4,4.4 -2.8,5.8 -3.5,10.2 -0.7,4.6 -0.7,9.5 0,16.7 0.9,9.9 1.2,11.3 5.2,32.2 2.5,13 3.5,19.3 3.5,21.7 0,4 -3.8,4.3 -6.6,0.4 -3.4,-4.7 -5.6,-11.8 -7.7,-24.7 -1.2,-7.5 -1.7,-11.7 -2.3,-22.9 -0.6,-10.4 -0.8,-11.9 -1.6,-12.2 -0.3,-0.1 -1,0.2 -1.5,0.7 -2.5,2.5 -3.1,10.2 -3.1,38.7 0,21.2 -0.3,27.7 -1.1,31 -0.3,1.3 -0.5,1.5 -1.4,1.5 -1.5,0 -2.6,-1.2 -3,-3.4 -1,-4.8 -2.2,-24.2 -2.5,-39.4 -0.2,-11.9 0.1,-18.3 1.6,-24.8 1.8,-8.3 4.2,-13.6 10.9,-24.4 7.2,-11.6 9.8,-17.4 10.5,-23.6 0.9,-7.9 -2.5,-17.6 -7.5,-21.3 -3.7,-2.7 -7.7,-3.1 -12.3,-1.2 -4.2,1.8 -6.1,2.1 -9.7,1.6 -4.1,-0.6 -8.8,0 -11.7,1.4 -1.5,0.7 -2,1.2 -2.5,2.4 -1.1,2.8 -0.6,13.3 0.9,18.4 0.6,2.1 1.1,2.9 2.7,4.5 3.6,3.6 10.8,6.8 17.1,7.8 5.3,0.8 6.4,1.5 6.2,3.5 -0.2,1.3 -1.5,2 -4.6,2.3 -5.3,0.6 -6.9,3.1 -7.8,12.7 -0.6,5.8 -0.9,6.7 -3,7.9 -2.1,1.2 -2.1,3.9 0,26.9 2.7,29.6 3,37.1 1.3,38.8 -1,1 -3,0.9 -4.4,-0.2 -3.2,-2.7 -4,-8.5 -4.5,-31.7 -0.3,-14.7 -0.9,-22.5 -1.8,-23.4 -0.6,-0.6 -2.6,0.7 -3.6,2.4 -1.9,3.3 -3.5,9.8 -4.3,17.8 -0.2,1.9 -0.5,8.2 -0.8,13.8 -0.7,18.6 -1.2,25 -2.4,29.3 -0.7,2.3 -1.5,2.8 -2.7,1.5 -1.8,-1.8 -2.7,-8.1 -2.7,-19.3 -7.7e-4,-14.9 2.4,-35.5 4.8,-41.6 1.3,-3.2 4,-7 9,-12.3 5.4,-5.8 8.1,-10 9.2,-14.4 1.1,-4.3 -0.4,-7.8 -3.8,-9.1 -5.2,-1.9 -9.6,-7.5 -12.3,-15.6 -1.3,-3.9 -1.4,-4.3 -1.4,-9.3 0,-4.4 0.1,-5.7 0.9,-8.3 1.1,-3.8 2.7,-6.4 4.4,-6.9 1.5,-0.4 2.2,-1.8 2.5,-5 0.3,-3 1.6,-6 3.2,-7.1 0.6,-0.5 1.2,-1 1.2,-1.3 0,-0.3 -0.6,-1.2 -1.2,-2.1 -1.9,-2.5 -2.4,-3.7 -3,-7.1 -0.7,-3.8 -1.5,-4.8 -4.2,-5.1 -3.4,-0.3 -6.8,1.4 -8.1,4.1 -1.4,3 -3.3,24.5 -4.4,50.8 -1.1,25.6 -2.5,45.5 -3.9,55.3 -0.9,6.2 -1.5,8.3 -2.8,9.3 l -1.1,1 0.8,1.5 c 2.6,4.8 2.6,4.7 2.6,7.4 0,1.5 -0.6,5.9 -1.3,9.9 -1.9,10.7 -2.4,14.7 -2.8,23 -0.4,7.6 -0.9,11.4 -2.1,14.8 -1.8,5.4 -5.2,8.2 -7.3,6.1 z M 108.9,120.8 c 4,-2.6 6,-11.2 3.5,-15.6 -1.3,-2.2 -3.5,-3.3 -7,-3.3 -2.5,0 -3,0.1 -3.8,0.9 -1.2,1.2 -1.7,2.9 -1.7,6.4 0,3.5 1,10.8 1.5,11.3 0.7,0.7 2.7,1.3 4.3,1.3 1.1,0 2,-0.3 3.2,-1 z m -1,-28.1 c 3.6,-1.9 5.9,-7.7 4.7,-12 -0.9,-3.5 -4.3,-6.9 -6.8,-6.9 -2.7,0 -6.9,4.3 -8.3,8.5 -0.6,1.8 -0.6,2 0.1,4.4 0.4,1.4 0.9,3.2 1,3.9 0.3,1.7 1.2,2.4 3.9,2.8 2.2,0.3 3.7,0.1 5.4,-0.8 z m 20.7,-1.3 c 1.4,-1.4 2.2,-4.3 2.5,-9 0.2,-3.8 0.2,-4 -0.7,-4.9 -1.1,-1.2 -3.9,-1.7 -6.1,-1 -2.5,0.8 -2.9,2.9 -1.9,9 1,6.2 3.5,8.7 6.2,6 z m -20.8,-26.2 c 3.4,-0.9 6.5,-4.7 6.9,-8.3 0.2,-2 0.2,-2.1 -1,-2.7 -0.9,-0.5 -2.4,-0.7 -5.4,-0.8 -7.2,-0.2 -9,1.1 -9.4,6.5 -0.2,2.2 -0.1,2.6 0.7,3.5 0.5,0.6 1.4,1.3 2,1.6 1.4,0.6 4.4,0.7 6.3,0.1 z m 126.1,77.7 c -0.4,-0.1 -2.3,-0.7 -4.1,-1.3 -3.6,-1.2 -4.8,-1.8 -11.1,-5.7 -3.7,-2.2 -5.8,-3.2 -8.6,-3.8 -0.7,-0.2 -1.2,-0.7 -1.9,-2 -0.7,-1.5 -1.3,-2 -3.9,-3.5 -4.4,-2.5 -8.8,-3.9 -11.5,-3.6 -2.7,0.3 -6.9,2.1 -13.4,5.6 -9.7,5.2 -18.5,9.1 -23.2,10.3 -5.8,1.5 -8.5,1.3 -9.1,-0.8 -0.6,-1.8 3.5,-4.4 18.2,-12 5.9,-3 12.2,-6.5 14.1,-7.8 6.5,-4.5 8.5,-9.1 8.6,-19.8 0,-7.3 1,-13.8 2.6,-16.4 0.8,-1.3 2.6,-2.5 3.9,-2.5 1.1,0 2,0.9 2.8,3 0.6,1.4 0.7,3.2 0.7,13.2 0,12.6 0.1,13 2.3,16.3 1.3,1.8 3.4,3.8 7.7,7 3.5,2.6 5,3.3 9,4.3 3.3,0.8 6.4,2 14.9,5.9 2.1,1 4.8,1.9 6.1,2.1 5.8,1 6.1,1.2 5.8,5.8 -0.2,3.4 -0.8,4.8 -2.4,5.4 -0.9,0.4 -6,0.4 -7.4,0.1 z m -86.6,-25 c -1,-0.5 -1.3,-0.9 -1.4,-1.9 -0.2,-1.6 0.2,-2 4,-4.5 6,-3.9 11.1,-8.8 14.8,-14.2 1.5,-2.2 2.6,-5.2 3.1,-8.3 0.3,-2 0.6,-2.8 1.4,-3.6 1.9,-2 4,-1.1 5,2.1 1.1,3.3 -0.6,13.8 -2.8,17.5 -2.1,3.6 -5.5,6.4 -11.8,9.8 -5.9,3.2 -10.1,4.3 -12.3,3.2 z m 81.3,-1.2 c -2.8,-0.6 -6.4,-2.7 -9,-5.2 -4.3,-4.2 -6.1,-8.5 -6.1,-14.3 0,-6.4 1.3,-9.9 3.5,-9.9 2.1,0 3.1,1.9 3.7,6.9 0.2,1.8 0.6,3.8 0.8,4.4 0.6,1.6 4.1,4.6 9.5,8.2 7.5,5 9.3,7.5 6.8,9.3 -1.1,0.8 -6.6,1.2 -9.2,0.7 z m 3.4,-33.2 c -3.4,-1.1 -16.3,-7.5 -23.1,-11.3 -2,-1.2 -4.6,-2.9 -5.7,-3.8 -2.6,-2.2 -4.2,-2.8 -7.2,-2.8 -3.4,0 -6.2,0.9 -14.6,4.8 -7.7,3.6 -12.5,5.4 -15.3,5.9 -2.3,0.4 -2.9,0.8 -3.6,2.3 -1.4,2.9 -6.6,3.7 -9.4,1.3 -1.6,-1.3 -1.5,-2.7 0.2,-4.6 1.7,-1.8 7.1,-4.6 19.7,-9.9 10.5,-4.4 12.1,-5.3 13.5,-7.4 2.6,-3.7 3.3,-8.2 3.8,-23.3 0.4,-11.4 0.9,-15.4 2,-16.2 1,-0.8 3.1,-1 4.2,-0.5 2.5,1.2 3.5,6.2 4.2,21.9 0.4,10.1 1.1,14.1 2.6,16.6 2,3.3 22.7,14.3 26.9,14.3 2.5,0 7,3.8 9,7.5 1.3,2.4 1.5,5 0.4,5.8 -1.2,0.9 -4.2,0.6 -7.8,-0.6 z m 0.5,-24 c -4,-1.7 -10.7,-6.3 -13.9,-9.4 -1.9,-1.9 -2.8,-3 -3.3,-4.4 -1.2,-3.6 -1.8,-8 -1.8,-14 0,-9 0.9,-11.9 3.7,-11.9 4.1,0 6,4.1 6.7,14.4 0.2,3.4 0.5,5.3 1,6.3 0.9,1.9 3.4,4.4 6.8,6.6 3.3,2.2 5,4.1 6.5,7.1 1.4,2.8 1.4,5.1 0.2,5.9 -1.3,0.9 -2.8,0.7 -6,-0.7 z m -82,-4.7 c -0.6,-0.5 -1,-1.1 -1,-1.7 0,-1.3 2.6,-3.8 6.7,-6.2 5.6,-3.3 7.8,-5.3 9.4,-8.5 1.3,-2.5 1.4,-3.2 1.8,-7 0.4,-4.9 0.9,-6 2.6,-6 3.7,0 6.6,13.8 4,18.9 -1.6,3 -9.3,8 -15.8,10.2 -4.1,1.4 -6.3,1.5 -7.7,0.4 z",
				pre: ""
			}
		};
		/** 小尺寸（< 48px）：朱印直填满徽标。 */
		const SEAL_FULL = {
			x: 100,
			y: 100,
			size: 824,
			rx: 59.33,
			frameInset: 34.61,
			frameR: 43.78,
			frameStroke: 21.42,
			glyphs: [{
				key: "qi",
				place: "translate(396.65,217.84) scale(1.93720)"
			}, {
				key: "lin",
				place: "translate(58.23,240.34) scale(1.81108)"
			}]
		};
		/** 大尺寸（>= 48px）：墨底 squircle + 内嵌朱印。 */
		const SEAL_ON_INK = {
			x: 202,
			y: 202,
			size: 620,
			rx: 44.64,
			frameInset: 26.04,
			frameR: 32.94,
			frameStroke: 16.12,
			glyphs: [{
				key: "qi",
				place: "translate(425.20,290.66) scale(1.45760)"
			}, {
				key: "lin",
				place: "translate(170.57,307.59) scale(1.36271)"
			}]
		};
		/** 双钩笔画补厚量（源坐标系 300 单位制），使空心描边闭合为实笔。 */
		const GLYPH_STROKE_FIX = 3.2;
		/** 品牌色（与设计源同源）。 */
		const MARK_COLORS = {
			inkTop: "#0d1a16",
			ink: "#030d0b",
			stampTop: "#d94436",
			stampBottom: "#b02f22",
			rice: "#fff8f2",
			white: "#ffffff"
		};
		//#endregion
		//#region src/client/Marks.tsx
		/**
		* KStock 品牌标记：**与应用图标同源**，几何常量由脚本从设计源算出
		* （见 `./marks/geometry.ts` 与 `docs/design/icon-refresh/gen_client_marks.py`）。
		*
		* 两种形制（按尺寸切换，用户 2026-09-20 选定）：
		*   `size >= 48` → 墨底 squircle + 内嵌朱印（= 应用图标 Tier 1b，关于页 72px）
		*   `size <  48` → 朱印直填满徽标（侧栏 24 / hero 34）
		* 两者都是**朱红白文印 + 篆书「麒麟」横排（右麒左麟）**，只是印面占比不同。
		*
		* 为什么小尺寸不是「品牌绿场 K」：那一版在 24px 下与 1.x 旧徽标（同为绿底白 K）
		* 几乎无法区分，实测反馈「顶部商标没换过来」。绿场 K 仍是**应用图标** 16–48px 档的形制
		* （`scripts/build-icons.sh`），只是不再用于 UI 商标。
		*
		* 与上游印记同策略：标记自带颜色（品牌图章而非主题图标），明暗表面呈现一致，
		* 挂入引擎的品牌槽位（sidebar.brand.mark / conversation.hero.brand.mark /
		* settings.about.mark，尺寸分别为 24 / 34 / 72）。
		*/
		/** 每实例独立的渐变 id：侧栏与 hero 可能同时渲染，共享 id 会双双取首个定义。 */
		function useMarkId() {
			return `kstock-mark-${(0, react.useId)().replace(/[^A-Za-z0-9_-]/gu, "")}`;
		}
		/** 两套渐变（墨底 / 朱砂印面），与设计源色值一一对应。 */
		function MarkDefs({ uid }) {
			const c = MARK_COLORS;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("defs", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("linearGradient", {
				id: `${uid}-ink`,
				x1: "0",
				y1: "0",
				x2: "0",
				y2: "1",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
					offset: "0",
					stopColor: c.inkTop
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
					offset: "1",
					stopColor: c.ink
				})]
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("linearGradient", {
				id: `${uid}-stamp`,
				x1: "0.2",
				y1: "0",
				x2: "0.8",
				y2: "1",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
					offset: "0",
					stopColor: c.stampTop
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
					offset: "1",
					stopColor: c.stampBottom
				})]
			})] });
		}
		/** 印边 + 篆书「麒麟」（横排，右麒左麟）。两种形制共用。 */
		function SealImprint({ lockup }) {
			const { x, y, size, frameInset, frameR, frameStroke, glyphs } = lockup;
			const inner = size - frameInset * 2;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
				x: x + frameInset,
				y: y + frameInset,
				width: inner,
				height: inner,
				rx: frameR,
				fill: "none",
				stroke: MARK_COLORS.rice,
				strokeWidth: frameStroke,
				strokeOpacity: .95
			}), glyphs.map((glyph) => {
				const source = GLYPH_PATHS[glyph.key];
				const shape = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: source.d,
					fill: MARK_COLORS.rice,
					stroke: MARK_COLORS.rice,
					strokeWidth: GLYPH_STROKE_FIX
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
					transform: glyph.place,
					children: source.pre === "" ? shape : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("g", {
						transform: source.pre,
						children: shape
					})
				}, glyph.place);
			})] });
		}
		/** 小尺寸：朱印直填满徽标（侧栏 24 / hero 34）。 */
		function SealFullMark({ uid }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: SQUIRCLE_PATH,
				fill: `url(#${uid}-stamp)`
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SealImprint, { lockup: SEAL_FULL })] });
		}
		/** 大尺寸：墨底 squircle + 内嵌朱印（设置·关于 72，= 应用图标 Tier 1b）。 */
		function SealOnInkMark({ uid }) {
			const { x, y, size, rx } = SEAL_ON_INK;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: SQUIRCLE_PATH,
					fill: `url(#${uid}-ink)`
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: SQUIRCLE_PATH,
					fill: "none",
					stroke: MARK_COLORS.white,
					strokeOpacity: .1,
					strokeWidth: 2.5
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x,
					y,
					width: size,
					height: size,
					rx,
					fill: `url(#${uid}-stamp)`
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SealImprint, { lockup: SEAL_ON_INK })
			] });
		}
		/** 按尺寸自动选形制的品牌标记。 */
		function BrandMark({ size, className }) {
			const uid = useMarkId();
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				className,
				viewBox: "0 0 1024 1024",
				fill: "none",
				role: "img",
				"aria-label": "KStock",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MarkDefs, { uid }), size >= 48 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SealOnInkMark, { uid }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SealFullMark, { uid })]
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
		/** 侧栏品牌标记槽位（24px → 朱印直填）。 */
		function KStockMark({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, { size });
		}
		/** 会话 hero 品牌标记槽位（34px → 朱印直填）。 */
		function KStockHeroMark({ size, className }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {
				size,
				className
			});
		}
		/** 设置 · 关于页品牌标记槽位（72px → 墨底 + 内嵌朱印）。 */
		function KStockArtistMark({ size = 24, className }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandMark, {
				size,
				className
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
		*    - macOS hiddenInset：红绿灯独立一行（引擎 topStrip 48px 拖拽条，
		*      trafficLightPosition {13,17} 灯组居中其内），品牌行保持自然行距
		*      落在灯条之下——与 KCoder 桌面端头部同款双行布局；品牌行/标题行
		*      兼作拖拽条（行内按钮除外）。
		*    - Windows/Linux（WCO 模型，参考 KCoder 桌面壳）：原生层只画右上
		*      按钮簇（titleBarOverlay height 48），标题栏本体是引擎 UI 自己的
		*      48px 顶栏带——内容不下推（旧版 `#root { padding-top:
		*      env(titlebar-area-height) }` 会产生 40px 空带 + 双栏），品牌行统一
		*      48px，主列顶行的右上控件让位按钮簇（138px = 三按钮宽，KCoder
		*      实测值）。整带 `-webkit-app-region: drag`（本层公共规则）。
		*
		* 另有主题探测器（applyThemeWatcher）：引擎 UI 明暗切换经 console 前缀
		* `__kstock_theme__:` 上报主进程（chrome.ts 壳主题桥），驱动窗口底色与
		* WCO overlay 配色热切换——亮色主题不再吃深色壳。
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
		* `#root` 前缀抬升特异度（ID+类 > 上游任意类组合），不依赖注入顺序。
		* 注意：不做内容下推——macOS 灯组与 Windows 按钮簇都叠在引擎 UI 自己
		* 的顶栏带上（标题栏本体 = 页面绘制，WCO 原生层只画右上按钮簇）。 */
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
`;
		/** macOS 专属：红绿灯独立一行（引擎 topStrip 48px，补丁 24），品牌行
		* 在灯条之下累计下移 30px 落于其下——对齐 KCoder 桌面端头部布局，不再与
		* 红绿灯同排（原 84px 左肩设计随双行布局退役）。折叠轨（56px 宽）容不下
		* 品牌，轨内容整体压到灯组下方（灯组底 y=30，折叠轨顶 margin 34 = y 52 起）。
		* 壳未注入 data-platform="darwin"，上游 topStrip（灯组行）不渲染，折叠按钮
		* 回落进品牌行——这里把它提回灯组行：品牌行作定位锚并放行溢出，按钮绝对
		* 定位到行上方 26px（y 10..38，中心 24 对齐灯组中心 23.5），折叠轨恢复流内。
		* 设置弹层是全窗口面板，且经 portal 挂在 document.body（#root 前缀够不到）：
		* 「返回工作区」行下移 30px 让开灯组。 */
		const MACOS_TRAFFIC_LIGHTS_CSS = `
#root [class*="logoRow"] {
  height: 48px;
  padding: 0 0 0 16px;
  margin: 30px 0 8px;
  position: relative;
  overflow: visible;
}

#root [class*="logoRow"] > [class*="toggle"] {
  position: absolute;
  top: -26px;
  right: 0;
}

#root [class*="collapsed"] [class*="logoRow"] {
  height: 36px;
  padding: 0;
  margin: 34px 0 12px;
  position: static;
  overflow: hidden;
}

#root [class*="collapsed"] [class*="logoRow"] > [class*="toggle"] {
  position: relative;
  top: auto;
  right: auto;
}

body [class*="navBack"] {
  margin-top: 30px;
}
`;
		/** Windows/Linux 专属：WCO 按钮簇（右上，y 0..48）避让。标题栏本体 =
		* 引擎 UI 顶栏带（与 macOS 同款 48px 统一），避让方向相反——不躲左上
		* 灯组，而是让主列顶行的右上控件让位按钮簇。138px = 三按钮实测宽
		* （KCoder 桌面壳同值）。折叠轨在左下无碰撞，保持原生形态。 */
		const WINDOWS_TITLEBAR_CSS = `
#root [class*="logoRow"] {
  height: 48px;
  margin: -6px 0 8px;
}

#root [class*="header"]:has(> [class*="headerRight"]) {
  padding-right: 138px;
}

#root [class*="navTitle"] {
  padding-right: 138px;
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
		* 仅 Electron 生效，浏览器直连引擎时不产生任何窗口适配样式；macOS 叠加
		* 红绿灯避让，Windows/Linux 叠加 WCO 按钮簇避让。
		*/
		function applyWindowChromeCss() {
			if (typeof document === "undefined") return () => {};
			if (!/Electron/.test(navigator.userAgent)) return () => {};
			const isMac = /Macintosh|Mac OS X/.test(navigator.userAgent);
			return injectStyleTag(WINDOW_CHROME_TAG_ID, WINDOW_CHROME_CSS + (isMac ? MACOS_TRAFFIC_LIGHTS_CSS : WINDOWS_TITLEBAR_CSS));
		}
		/** 壳主题上报前缀（chrome.ts attachChromeThemeBridge 消费）。 */
		const THEME_REPORT_PREFIX = "__kstock_theme__:";
		/** 读当前壳主题；主题系统未落属性时返回 undefined（启动初态，
		* 缺席 ≠ 亮色——KCoder 同款判据的否定面：body[data-ds-dark-theme] 或
		* html colorScheme 任一落定才可判）。 */
		function readChromeTheme() {
			if (document.body === null) return void 0;
			const scheme = document.documentElement.style.colorScheme;
			if (scheme === "dark" || scheme === "light") return scheme;
			if (document.body.hasAttribute("data-ds-dark-theme")) return "dark";
		}
		/**
		* 主题探测器（仅 Electron）：引擎 UI 明暗切换时经 console 前缀上报主进程，
		* 驱动窗口底色与 WCO overlay 热切换。
		*
		* 首报对齐 KCoder 的注入点语义（did-finish-load 后注入）：等页面 load
		* 完成再报——实测上游主题系统启动会先落 colorScheme=light、随后才应用
		* 用户持久化的 dark（DOM 自带启动瞬态），首报过早会让壳配色闪中间态。
		* load 前一切上报（观察器/系统翻转）都被压住；load 后 80ms 去抖收敛
		* 连跳；1s 兜底：load 迟迟不来时按当前 DOM 猜一次，防壳配色停在旧值。
		* 返回卸用 disposer（幂等）。
		*/
		function applyThemeWatcher() {
			if (typeof document === "undefined") return () => {};
			if (!/Electron/.test(navigator.userAgent)) return () => {};
			let primed = false;
			let settled = false;
			let settleTimer;
			let reportTimer;
			const emit = (value) => {
				console.log(THEME_REPORT_PREFIX + value);
			};
			const emitNow = () => {
				const value = readChromeTheme();
				if (value !== void 0) emit(value);
			};
			const schedule = () => {
				if (!settled) return;
				if (reportTimer !== void 0) clearTimeout(reportTimer);
				reportTimer = setTimeout(() => {
					reportTimer = void 0;
					emitNow();
				}, 80);
			};
			const prime = () => {
				if (primed) return;
				primed = true;
				settleTimer = setTimeout(() => {
					settled = true;
					emitNow();
				}, 400);
			};
			const disposers = [() => {
				if (settleTimer !== void 0) clearTimeout(settleTimer);
				if (reportTimer !== void 0) clearTimeout(reportTimer);
			}];
			const observe = () => {
				if (document.body !== null) {
					const bodyObserver = new MutationObserver(schedule);
					bodyObserver.observe(document.body, {
						attributes: true,
						attributeFilter: ["data-ds-dark-theme", "class"]
					});
					disposers.push(() => bodyObserver.disconnect());
				}
				const htmlObserver = new MutationObserver(schedule);
				htmlObserver.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ["style", "class"]
				});
				disposers.push(() => htmlObserver.disconnect());
			};
			if (document.body !== null) observe();
			else document.addEventListener("DOMContentLoaded", observe, { once: true });
			if (document.readyState === "complete") prime();
			else window.addEventListener("load", prime, { once: true });
			const fallback = setTimeout(() => prime(), 1e3);
			disposers.push(() => clearTimeout(fallback));
			try {
				const media = matchMedia("(prefers-color-scheme: dark)");
				const onScheme = () => schedule();
				media.addEventListener("change", onScheme);
				disposers.push(() => media.removeEventListener("change", onScheme));
			} catch {}
			return () => {
				for (const dispose of disposers) dispose();
			};
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
				const disposeThemeWatcher = applyThemeWatcher();
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
					disposeThemeWatcher();
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