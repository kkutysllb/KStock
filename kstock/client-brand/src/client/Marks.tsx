/**
 * KStock 品牌标记：圆角方形 + "K" 三笔（stem 干 / arm 臂 / line 折线），
 * 图形取自 1.x 桌面端 `apps/desktop/src/components/LogoMark.tsx`。
 *
 * 与上游印记同策略：标记自带颜色（品牌图章而非主题图标），明暗表面呈现
 * 一致 —— 绿色渐变底 + 浅绿白 K 纹，挂入引擎的品牌槽位
 * （sidebar.brand.mark / conversation.hero.brand.mark / settings.about.mark）。
 */

import { useId } from 'react'
import type { HeroBrandMarkOwnerProps } from '@qilin/client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@qilin/client-ui-sidebar/client'

/** 品牌绿渐变，自上而下：受光的亮绿上缘过渡到深绿下缘。 */
const BODY_STOPS = ['#3ad0ab', '#2fc197', '#1d8a6e'] as const
/** K 纹浅绿白，压在品牌绿底上。 */
const GLYPH_FILL = '#eafff8'

function LogoSvg({ size, className, title }: { size: number; className?: string | undefined; title: string }) {
  // 每实例独立渐变 id：侧栏与 hero 可能同时渲染，共享 id 会双双取首个定义。
  const gradientId = `kstock-logo-body-${useId().replace(/[^A-Za-z0-9_-]/gu, '')}`
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={gradientId} x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          {BODY_STOPS.map((stop, index) => (
            <stop key={stop} offset={`${(index / (BODY_STOPS.length - 1)) * 100}%`} stopColor={stop} />
          ))}
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="56" height="56" rx="14" fill={`url(#${gradientId})`} />
      <path className="kstock-logo-stem" d="M21 16h9c2 0 4 2 4 4v24c0 2-2 4-4 4h-9z" fill={GLYPH_FILL} />
      <path className="kstock-logo-arm" d="M34 31 50 16h9L41 34l18 14H47L34 38z" fill={GLYPH_FILL} />
      <path
        className="kstock-logo-line"
        d="M15 43 28 38l8 4 12-11 9 3"
        stroke={GLYPH_FILL}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 侧栏品牌标记槽位的 KStock 占位。 */
export function KStockMark({ size }: SidebarBrandMarkOwnerProps) {
  return <LogoSvg size={size} title="KStock" />
}

/** 会话 hero 品牌标记槽位的 KStock 占位。 */
export function KStockHeroMark({ size, className }: HeroBrandMarkOwnerProps) {
  return <LogoSvg size={size} className={className} title="KStock" />
}

/** 设置关于页品牌标记槽位的 KStock 占位。 */
export function KStockArtistMark({ size = 24, className }: { size?: number; className?: string | undefined }) {
  return <LogoSvg size={size} className={className} title="KStock" />
}
