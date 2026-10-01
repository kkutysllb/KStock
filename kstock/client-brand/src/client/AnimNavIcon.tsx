/**
 * 动效技能库侧栏入口图标（anim-panel 遮蔽条目用）。
 *
 * 与 dsh-animations `lib/client.js` 的 `PanelIcon`（MIT，自家包）同款
 * sparkle——被遮蔽的原条目不再渲染，入口视觉零变化；尺寸/激活态由
 * 侧栏按 `SidebarPanelIconOwnerProps` 传入（同 TaskManagerIcon 模式）。
 */
export function AnimNavIcon({ size }: { size: number; active?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 0-1.3-1.3Z" />
    </svg>
  )
}
