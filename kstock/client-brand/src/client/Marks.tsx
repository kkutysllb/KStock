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

import { useId } from 'react'
import type { HeroBrandMarkOwnerProps } from '@qilin/client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@qilin/client-ui-sidebar/client'
import {
  GLYPH_PATHS,
  GLYPH_STROKE_FIX,
  MARK_COLORS,
  SEAL_FULL,
  SEAL_MIN_SIZE,
  SEAL_ON_INK,
  SQUIRCLE_PATH,
} from './marks/geometry.ts'

/**
 * 印面参数。两种形制结构相同、只是数值不同，所以用**结构化接口**声明，
 * 不能写 `typeof SEAL_FULL`——生成物带 `as const`，字面量类型之间互不兼容。
 */
interface SealLockup {
  readonly x: number
  readonly y: number
  readonly size: number
  readonly rx: number
  readonly frameInset: number
  readonly frameR: number
  readonly frameStroke: number
  readonly glyphs: readonly { readonly key: 'qi' | 'lin'; readonly place: string }[]
}

/** 标记的公共入参：尺寸 + 外部类名（由各槽位 owner props 传入）。 */
interface BrandMarkProps {
  size: number
  className?: string | undefined
}

/** 每实例独立的渐变 id：侧栏与 hero 可能同时渲染，共享 id 会双双取首个定义。 */
function useMarkId(): string {
  return `kstock-mark-${useId().replace(/[^A-Za-z0-9_-]/gu, '')}`
}

/** 两套渐变（墨底 / 朱砂印面），与设计源色值一一对应。 */
function MarkDefs({ uid }: { uid: string }) {
  const c = MARK_COLORS
  return (
    <defs>
      <linearGradient id={`${uid}-ink`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={c.inkTop} />
        <stop offset="1" stopColor={c.ink} />
      </linearGradient>
      <linearGradient id={`${uid}-stamp`} x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor={c.stampTop} />
        <stop offset="1" stopColor={c.stampBottom} />
      </linearGradient>
    </defs>
  )
}

/** 印边 + 篆书「麒麟」（横排，右麒左麟）。两种形制共用。 */
function SealImprint({ lockup }: { lockup: SealLockup }) {
  const { x, y, size, frameInset, frameR, frameStroke, glyphs } = lockup
  const inner = size - frameInset * 2
  return (
    <>
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
      {glyphs.map((glyph) => {
        // 字形路径只存一份（GLYPH_PATHS），两种形制共用；这里按 key 取用
        const source = GLYPH_PATHS[glyph.key]
        const shape = (
          <path
            d={source.d}
            fill={MARK_COLORS.rice}
            stroke={MARK_COLORS.rice}
            strokeWidth={GLYPH_STROKE_FIX}
          />
        )
        return (
          <g key={glyph.place} transform={glyph.place}>
            {/* 双钩字形自带一层平移（Inkscape 的图层变换），必须保留 */}
            {source.pre === '' ? shape : <g transform={source.pre}>{shape}</g>}
          </g>
        )
      })}
    </>
  )
}

/** 小尺寸：朱印直填满徽标（侧栏 24 / hero 34）。 */
function SealFullMark({ uid }: { uid: string }) {
  return (
    <>
      <path d={SQUIRCLE_PATH} fill={`url(#${uid}-stamp)`} />
      <SealImprint lockup={SEAL_FULL} />
    </>
  )
}

/** 大尺寸：墨底 squircle + 内嵌朱印（设置·关于 72，= 应用图标 Tier 1b）。 */
function SealOnInkMark({ uid }: { uid: string }) {
  const { x, y, size, rx } = SEAL_ON_INK
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
      <SealImprint lockup={SEAL_ON_INK} />
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
      {size >= SEAL_MIN_SIZE ? <SealOnInkMark uid={uid} /> : <SealFullMark uid={uid} />}
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

/** 侧栏品牌标记槽位（24px → 朱印直填）。 */
export function KStockMark({ size }: SidebarBrandMarkOwnerProps) {
  return <BrandMark size={size} />
}

/** 会话 hero 品牌标记槽位（34px → 朱印直填）。 */
export function KStockHeroMark({ size, className }: HeroBrandMarkOwnerProps) {
  return <BrandMark size={size} className={className} />
}

/** 设置 · 关于页品牌标记槽位（72px → 墨底 + 内嵌朱印）。 */
export function KStockArtistMark({ size = 24, className }: { size?: number; className?: string | undefined }) {
  return <BrandMark size={size} className={className} />
}
