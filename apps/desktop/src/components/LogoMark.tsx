/**
 * KStock 品牌 Logo（SVG）。
 *
 * 设计：rounded square + K 字三笔（stem 干、arm 臂、line 折线）。
 * ``compact`` 用于侧栏顶部（24×24），无 compact 用于启动页 / 登录页（30×30）。
 *
 * 颜色绑定通过 ``.logo-mark rect/.logo-stem/.logo-arm/.logo-line`` 在 styles.css 内
 * 集中控制，便于深/浅主题切换与品牌色微调。
 */
export function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      className={compact ? "logo-mark compact" : "logo-mark"}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4" width="56" height="56" rx="14" />
      <path className="logo-stem" d="M21 16h9c2 0 4 2 4 4v24c0 2-2 4-4 4h-9z" />
      <path className="logo-arm" d="M34 31 50 16h9L41 34l18 14H47L34 38z" />
      <path className="logo-line" d="M15 43 28 38l8 4 12-11 9 3" />
    </svg>
  );
}