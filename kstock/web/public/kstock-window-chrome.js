/**
 * KStock 自有静态页（登录 / 初始化 / 落地）的窗口壳适配。
 *
 * 为什么单独一份：这些页不走引擎 UI，拿不到 @kstock/client-brand 的窗口适配层
 * （那边的让位是逐元素实测，因为引擎 UI 顶栏挂在哪由上游决定）；静态页结构固定，
 * 只需把「壳占了多少」告诉 CSS 即可。
 *
 * 做三件事：
 * 1. **自报画布底色**（`__kstock_page_theme__:dark`）：本页恒为暗色画布，而壳的
 *    WCO 按钮簇底色默认跟随引擎 UI 上报的持久化主题——不自报就会在右上压一整块白。
 *    消费方见 apps/desktop/electron/lib/chrome.ts（只切配色，不写持久化）。
 * 2. **打上 `os-windows` 平台类**：kstock-pages.css 里所有「给窗控让位」的规则都
 *    以它为前缀，而此前仓库里**没有任何代码设置过这个类**——整组规则是死代码
 *    （落地页右上状态标签被按钮簇遮住就是这么来的）。
 * 3. **把按钮簇宽度写进 `--kstock-caption-inset`**：让 CSS 按实测值让位，而不是
 *    写死像素（不同 DPI 缩放下按钮簇宽度不同）。
 *
 * 浏览器直连引擎时（非 Electron）三件事都不做。
 */
(function () {
  var isElectron = /Electron/.test(navigator.userAgent);
  if (!isElectron) return;

  // 1) 自报底色（壳据此切按钮簇配色）
  console.log('__kstock_page_theme__:dark');

  // 右侧按钮簇只存在于 Windows/Linux 的 WCO；macOS 红绿灯在左上，无需右侧让位
  if (/Macintosh|Mac OS X/.test(navigator.userAgent)) return;
  if (document.documentElement === null) return;

  // 2) 平台类（CSS 的 .os-windows 前缀全靠它生效）
  document.documentElement.classList.add('os-windows');

  /** 按钮簇宽度：优先 WCO 实测（本版 Electron 上它会失效/滞后，故只采信合理读数），
   *  否则回落 Windows 标准三按钮宽 138 × 显示缩放（100%/125%/150% → 138/172/207）。
   *  宁可多留一点（内容左移几个 px）也不能少留——少留会被按钮压住点不动。 */
  function captionInset() {
    try {
      var probe = document.createElement('div');
      // head 阶段 body 尚未生成，探针挂 documentElement 即可（env 按 frame 解析）
      probe.style.cssText =
        'position:fixed;left:0;top:0;height:1px;width:env(titlebar-area-width,100vw);' +
        'visibility:hidden;pointer-events:none';
      document.documentElement.appendChild(probe);
      var areaWidth = probe.getBoundingClientRect().width;
      probe.remove();
      var measured = Math.round(window.innerWidth - areaWidth);
      if (measured > 0 && measured < window.innerWidth / 2) return measured;
    } catch {
      /* 探针失败按回落值处理 */
    }
    return Math.round(138 * (window.devicePixelRatio || 1));
  }

  function apply() {
    document.documentElement.style.setProperty('--kstock-caption-inset', captionInset() + 'px');
  }

  // 3) 立即写一次（首帧就要让位），窗口尺寸变化时复算
  apply();
  window.addEventListener('resize', apply);
})();
