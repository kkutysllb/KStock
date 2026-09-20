/**
 * KStock 品牌标记：**与应用图标同源**，几何常量由脚本从设计源算出
 * （见 `./marks/geometry.ts` 与 `docs/design/icon-refresh/gen_client_marks.py`）。
 *
 * 尺寸规则（与图标系统同一套「按尺寸分形制」，不是两套设计）：
 *   `size >= 48` → 朱红白文方印：篆书「麒麟」横排（右麒左麟，篆印自右向左读）
 *   `size <  48` → 品牌绿实色场 K：笔画按小尺寸光学配重加粗
 * 依据是实测：小篆两字在 48px 以下退化为纹理，朱印只剩色块；而几何 K 在 24px 仍可辨。
 *
 * 与上游印记同策略：标记自带颜色（品牌图章而非主题图标），明暗表面呈现一致，
 * 挂入引擎的品牌槽位（sidebar.brand.mark / conversation.hero.brand.mark /
 * settings.about.mark，尺寸分别为 24 / 34 / 72）。
 *
 * 历史沿革：1.x 的方形青底 + K 三笔（stem/arm/line）已废弃——它在 24px 下笔画互咬，
 * 与「app 图标在 32px 不可辨」是同一个病根。
 */

import { useId } from 'react'
import type { HeroBrandMarkOwnerProps } from '@qilin/client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@qilin/client-ui-sidebar/client'
import {
  GLYPH_STROKE_FIX,
  K_MARK,
  MARK_COLORS,
  SEAL_LOCKUP,
  SEAL_MIN_SIZE,
  SQUIRCLE_PATH,
} from './marks/geometry.ts'

/** 标记的公共入参：尺寸 + 外部类名（由各槽位 owner props 传入）。 */
interface BrandMarkProps {
  size: number
  className?: string | undefined
}

/** 每实例独立的渐变 id：侧栏与 hero 可能同时渲染，共享 id 会双双取首个定义。 */
function useMarkId(): string {
  return `kstock-mark-${useId().replace(/[^A-Za-z0-9_-]/gu, '')}`
}

/** 三套渐变（墨底 / 品牌绿场 / 朱砂印面），与设计源色值一一对应。 */
function MarkDefs({ uid }: { uid: string }) {
  const c = MARK_COLORS
  return (
    <defs>
      <linearGradient id={`${uid}-ink`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c.inkTop} />
        <stop offset="1" stopColor={c.ink} />
      </linearGradient>
      <linearGradient id={`${uid}-green`} x1="0.15" y1="0" x2="0.85" y2="1">
        <stop offset="0" stopColor={c.greenTop} />
        <stop offset="1" stopColor={c.green} />
      </linearGradient>
      <linearGradient id={`${uid}-stamp`} x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor={c.stampTop} />
        <stop offset="1" stopColor={c.stampBottom} />
      </linearGradient>
    </defs>
  )
}

/** 大尺寸形制：墨底 + 朱红白文方印 + 篆书「麒麟」横排（Tier 1b，无字标）。 */
function SealMark({ uid }: { uid: string }) {
  const { x, y, size, rx, frameInset, frameR, frameStroke, glyphs } = SEAL_LOCKUP
  const inner = size - frameInset * 2
  return (
    <>
      <path d={SQUIRCLE_PATH} fill={`url(#${uid}-ink)`} />
      <path
        d={SQUIRCLE_PATH}
        fill="none"
        stroke={MARK_COLORS.white}
        strokeOpacity={0.1}
        strokeWidth={2.5}
      />
      <rect x={x} y={y} width={size} height={size} rx={rx} fill={`url(#${uid}-stamp)`} />
      <rect
        x={x + frameInset}
        y={y + frameInset}
        width={inner}
        height={inner}
        rx={frameR}
        fill="none"
        stroke={MARK_COLORS.rice}
        strokeWidth={frameStroke}
        strokeOpacity={0.95}
      />
      {glyphs.map((glyph) => (
        <g key={glyph.place} transform={glyph.place}>
          {glyph.pre === '' ? (
            <path
              d={glyph.d}
              fill={MARK_COLORS.rice}
              stroke={MARK_COLORS.rice}
              strokeWidth={GLYPH_STROKE_FIX}
            />
          ) : (
            // 双钩字形自带一层平移（Inkscape 的图层变换），必须保留
            <g transform={glyph.pre}>
              <path
                d={glyph.d}
                fill={MARK_COLORS.rice}
                stroke={MARK_COLORS.rice}
                strokeWidth={GLYPH_STROKE_FIX}
              />
            </g>
          )}
        </g>
      ))}
    </>
  )
}

/** 小尺寸形制：品牌绿实色场 + 白色几何 K（平口），笔画按尺寸配重。 */
function KBadge({ uid, size }: { uid: string; size: number }) {
  const { left, top, box, stroke, strokeSmall } = K_MARK
  const width = size >= SEAL_MIN_SIZE ? stroke : strokeSmall
  const mid = top + box / 2
  return (
    <>
      <path d={SQUIRCLE_PATH} fill={`url(#${uid}-green)`} />
      <g
        stroke={MARK_COLORS.white}
        strokeWidth={width}
        strokeLinecap="butt"
        strokeLinejoin="round"
        fill="none"
      >
        <path d={`M${left} ${top}V${top + box}`} />
        <path d={`M${left} ${mid}L${left + box} ${top}`} />
        <path d={`M${left} ${mid}L${left + box} ${top + box}`} />
      </g>
    </>
  )
}

/** 按尺寸自动选形制的品牌标记。 */
function BrandMark({ size, className }: BrandMarkProps) {
  const uid = useMarkId()
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox="0 0 1024 1024"
      fill="none"
      role="img"
      aria-label="KStock"
    >
      <MarkDefs uid={uid} />
      {size >= SEAL_MIN_SIZE ? <SealMark uid={uid} /> : <KBadge uid={uid} size={size} />}
    </svg>
  )
}

/**
 * 侧栏品牌名槽位的 KStock 占位：替换 shell 的 QiLin 回退字标。
 * 版本徽章仍由 shell 自绘（构建期烙入的版本号），此处只接管名字。
 * 字号与 shell 回退字标（fallbackBrandName 17px/600）对齐，样式见
 * windowChrome 注入的 `.kstock-brand-wordmark`。
 */
export function KStockWordmark() {
  return <span className="kstock-brand-wordmark">KStock</span>
}

/** 侧栏品牌标记槽位（24px → 绿场 K）。 */
export function KStockMark({ size }: SidebarBrandMarkOwnerProps) {
  return <BrandMark size={size} />
}

/** 会话 hero 品牌标记槽位（34px → 绿场 K）。 */
export function KStockHeroMark({ size, className }: HeroBrandMarkOwnerProps) {
  return <BrandMark size={size} className={className} />
}

/** 设置 · 关于页品牌标记槽位（72px → 朱印篆书「麒麟」）。 */
export function KStockArtistMark({ size = 24, className }: { size?: number; className?: string | undefined }) {
  return <BrandMark size={size} className={className} />
}
