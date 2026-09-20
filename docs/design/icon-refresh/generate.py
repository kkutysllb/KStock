#!/usr/bin/env python3
"""KStock 图标重构候选方案的矢量源生成器（设计提案用）。

只产出「设计提案稿」到 docs/design/icon-refresh/，不覆盖 apps/desktop/build/ 下的
生产资产；方案定稿后再由本脚本升级为生产图标生成器。

用法：python3 docs/design/icon-refresh/generate.py
依赖：rsvg-convert（brew install librsvg）
"""

from __future__ import annotations

import math
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
PNG = ROOT / "png"

# ── 画布几何 ────────────────────────────────────────────────────────────────
# macOS 图标网格：1024 画布，内容 824（留 100 边距，约 80.5%，与 Apple 官方
# 模板 824/1024 一致），圆角用连续曲率近似（Apple 圆角半径 ≈ 0.2237×内容）。
CANVAS = 1024
INSET = 100
BOX = CANVAS - INSET * 2  # 824

# ── 品牌色（取自 kstock/client-brand 的 tokens.ts）────────────────────────────
INK_TOP = "#0d1a16"     # 暗色画布上缘（#030d0b 的提亮过渡）
INK = "#030d0b"         # --dsw-alias-bg-base (dark)
GREEN = "#31c7a2"       # --dsw-alias-brand-primary (dark)
GREEN_LIGHT = "#5fd3b0"  # hover / 渐变上端
GREEN_DARK = "#178267"  # --dsw-alias-brand-primary (light) / 渐变下端
MINT = "#eafff8"        # 品牌印记的 K 纹浅绿白（Marks.tsx GLYPH_FILL）


def squircle(cx: float, cy: float, size: float, n: float = 5.0, steps: int = 288) -> str:
    """Apple 风格连续曲率圆角方（squircle）：超椭圆 |x/a|^n + |y/a|^n = 1 采样。

    n=5 是 iOS/macOS 图标遮罩的常用近似（45° 处约 0.87a，圆为 0.707a），
    边近似平直、四角连续收圆——用贝塞尔控制点手写极易退化成圆形。
    """
    a = size / 2
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        ct, st = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(ct) ** (2.0 / n), ct)
        y = a * math.copysign(abs(st) ** (2.0 / n), st)
        pts.append(f"{cx + x:.1f} {cy + y:.1f}")
    return "M " + " L ".join(pts) + " Z"


SQ = squircle(CANVAS / 2, CANVAS / 2, BOX)


def svg(body: str, defs: str = "") -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
        f'viewBox="0 0 {CANVAS} {CANVAS}" fill="none">\n'
        f"<defs>{defs}</defs>\n{body}\n</svg>\n"
    )


def tray_svg(body: str, defs: str = "") -> str:
    """托盘模板图标：32×32 画布（= macOS 16pt@2x），纯黑 + alpha。"""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" '
        'viewBox="0 0 32 32" fill="none">\n'
        f"<defs>{defs}</defs>\n{body}\n</svg>\n"
    )


def edge_light() -> str:
    """squircle 内缘 1px 高光：模拟受光上缘，让实色块不呆板。"""
    return (
        f'<path d="{SQ}" fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="2.5"/>'
    )


# ───────────────────────────────────────────────────────────────────────────
# A · 一笔 K（Monoline）—— 深色底 + 单色描边字母，最克制的品牌延续
# ───────────────────────────────────────────────────────────────────────────
def direction_a() -> tuple[str, str]:
    defs = f'''
    <linearGradient id="a-ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{INK_TOP}"/><stop offset="1" stop-color="{INK}"/>
    </linearGradient>
    <clipPath id="a-clip"><path d="{SQ}"/></clipPath>'''
    body = f'''
    <g clip-path="url(#a-clip)">
      <rect x="{INSET}" y="{INSET}" width="{BOX}" height="{BOX}" fill="url(#a-ink)"/>
    </g>
    {edge_light()}
    <g stroke="{GREEN}" stroke-width="84" stroke-linecap="round" stroke-linejoin="round">
      <path d="M372 288 V 736"/>
      <path d="M372 512 L648 288"/>
      <path d="M372 512 L648 736"/>
    </g>
    <circle cx="648" cy="288" r="46" fill="{MINT}"/>'''
    # 托盘：去掉数据点、描边加重到 3.4/32（16pt 下约 1.7pt，线条才立得住）
    tray = f'''
    <g stroke="#000000" stroke-width="3.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11.2 5.6 V 26.4"/>
      <path d="M11.2 16 L20.6 5.6"/>
      <path d="M11.2 16 L20.6 26.4"/>
    </g>'''
    return svg(body, defs), tray_svg(tray)


# ───────────────────────────────────────────────────────────────────────────
# B · 蜡烛 K（Candlestick）—— 市场语义最重：K 由三根蜡烛拼成
# ───────────────────────────────────────────────────────────────────────────
def direction_b() -> tuple[str, str]:
    defs = f'''
    <linearGradient id="b-ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{INK_TOP}"/><stop offset="1" stop-color="{INK}"/>
    </linearGradient>
    <linearGradient id="b-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{GREEN_LIGHT}"/><stop offset="1" stop-color="#1d8a6e"/>
    </linearGradient>
    <clipPath id="b-clip"><path d="{SQ}"/></clipPath>'''
    body = f'''
    <g clip-path="url(#b-clip)">
      <rect x="{INSET}" y="{INSET}" width="{BOX}" height="{BOX}" fill="url(#b-ink)"/>
    </g>
    {edge_light()}
    <!-- 干支 = 一根竖蜡烛：上下影线 + 实体（受光最亮，是图标的视觉主角） -->
    <g stroke="{GREEN_LIGHT}" stroke-width="40" stroke-linecap="round">
      <path d="M369 266 V 344"/><path d="M369 682 V 760"/>
    </g>
    <rect x="313" y="328" width="112" height="368" rx="30" fill="url(#b-body)"/>
    <!-- 两臂一笔折线（同轴同色，避免双色圆头在交点叠出「折纸缝」） -->
    <path d="M669 330 L393 512 L669 694" stroke="#24a884" stroke-width="84"
          stroke-linecap="round" stroke-linejoin="round"/>'''
    # 托盘：砍掉装饰、只留「蜡烛干支 + 折臂」；影线加重到 2.2/32 才在 16pt 立得住
    tray = f'''
    <g stroke="#000000" stroke-width="2" stroke-linecap="round">
      <path d="M12.5 2.4 V 7.4"/><path d="M12.5 24.6 V 29.6"/>
    </g>
    <rect x="9.8" y="7.6" width="5.4" height="16.8" rx="2.3" fill="#000000"/>
    <g stroke="#000000" stroke-width="3.4" stroke-linecap="round">
      <path d="M15 16 L26.6 8"/><path d="M15 16 L26.6 24"/>
    </g>'''
    return svg(body, defs), tray_svg(tray)


# ───────────────────────────────────────────────────────────────────────────
# C · 实色场 K（Color Field）—— 品牌绿整块场 + 白色 K，最接近 macOS 原生观感
# ───────────────────────────────────────────────────────────────────────────
def direction_c() -> tuple[str, str]:
    defs = f'''
    <linearGradient id="c-field" x1="0.12" y1="0" x2="0.88" y2="1">
      <stop offset="0" stop-color="#2ec39f"/><stop offset="0.55" stop-color="{GREEN}"/>
      <stop offset="1" stop-color="#157a60"/>
    </linearGradient>
    <radialGradient id="c-sheen" cx="0.28" cy="0.16" r="0.92">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.035"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="c-clip"><path d="{SQ}"/></clipPath>'''
    body = f'''
    <path d="{SQ}" fill="url(#c-field)"/>
    <g clip-path="url(#c-clip)">
      <!-- 场内的受光用径向渐变（无硬边）；硬边椭圆会在 K 上切出一道弧 -->
      <rect x="{INSET}" y="{INSET}" width="{BOX}" height="{BOX}" fill="url(#c-sheen)"/>
    </g>
    {edge_light()}
    <!-- 平口（butt cap）几何 K：白色字形直接压在场色上，无深色底 -->
    <g stroke="#ffffff" stroke-width="96">
      <path d="M368 272 V 752"/>
      <path d="M368 512 L652 272"/>
      <path d="M368 512 L652 752"/>
    </g>'''
    # 托盘：同字形，加重到 3.6、平口，小尺寸下笔画不相融
    tray = '''
    <g stroke="#000000" stroke-width="3.6">
      <path d="M11.6 3.6 V 28.4"/>
      <path d="M11.6 16 L24.6 3.6"/>
      <path d="M11.6 16 L24.6 28.4"/>
    </g>'''
    return svg(body, defs), tray_svg(tray)


# ───────────────────────────────────────────────────────────────────────────
# D · 数据地平线（Abstract / 去字母化）—— 网格 + 折线 + 节点，智能体「看盘」
# ───────────────────────────────────────────────────────────────────────────
def direction_d() -> tuple[str, str]:
    defs = f'''
    <radialGradient id="d-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="{GREEN}" stop-opacity="0.40"/>
      <stop offset="1" stop-color="{GREEN}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="d-line" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="#1d8a6e"/><stop offset="0.5" stop-color="{GREEN}"/>
      <stop offset="1" stop-color="{GREEN_LIGHT}"/>
    </linearGradient>
    <linearGradient id="d-ink" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{INK_TOP}"/><stop offset="1" stop-color="{INK}"/>
    </linearGradient>
    <clipPath id="d-clip"><path d="{SQ}"/></clipPath>'''
    body = f'''
    <g clip-path="url(#d-clip)">
      <rect x="{INSET}" y="{INSET}" width="{BOX}" height="{BOX}" fill="url(#d-ink)"/>
      <circle cx="700" cy="278" r="330" fill="url(#d-glow)"/>
      <!-- 环境网格：呼应 client-brand 的 52px 网格背景，只留横向三道发丝 -->
      <g stroke="{GREEN}" stroke-opacity="0.16" stroke-width="3">
        <path d="M120 400 H 904"/><path d="M120 560 H 904"/><path d="M120 720 H 904"/>
      </g>
    </g>
    {edge_light()}
    <path d="M212 712 L372 466 L474 578 L712 268"
          stroke="url(#d-line)" stroke-width="86"
          stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="706" cy="274" r="48" fill="{MINT}"/>'''
    # 托盘：网格与光晕全砍，只留折线 + 端点实心节点
    tray = '''
    <path d="M4.2 25.4 L11.6 15.4 L15.8 20.4 L24.4 7.4"
          stroke="#000000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="25.2" cy="6.6" r="3" fill="#000000"/>'''
    return svg(body, defs), tray_svg(tray)


def direction_c_deep() -> tuple[str, str]:
    """C2 深绿调：把场色整体压深，白色字形全图 ≥3:1（WCAG 非文本图形门槛）。

    代价是放弃品牌亮绿 #31c7a2 作场色，图标整体更暗、更「沉稳」。
    """
    defs = f'''
    <linearGradient id="c2-field" x1="0.12" y1="0" x2="0.88" y2="1">
      <stop offset="0" stop-color="#1e9a79"/><stop offset="0.55" stop-color="#14775e"/>
      <stop offset="1" stop-color="#0c5a45"/>
    </linearGradient>
    <radialGradient id="c2-sheen" cx="0.28" cy="0.16" r="0.92">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.015"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="c2-clip"><path d="{SQ}"/></clipPath>'''
    body = f'''
    <path d="{SQ}" fill="url(#c2-field)"/>
    <g clip-path="url(#c2-clip)">
      <rect x="{INSET}" y="{INSET}" width="{BOX}" height="{BOX}" fill="url(#c2-sheen)"/>
    </g>
    {edge_light()}
    <g stroke="#ffffff" stroke-width="96">
      <path d="M368 272 V 752"/>
      <path d="M368 512 L652 272"/>
      <path d="M368 512 L652 752"/>
    </g>'''
    tray = '''
    <g stroke="#000000" stroke-width="3.6">
      <path d="M11.6 3.6 V 28.4"/>
      <path d="M11.6 16 L24.6 3.6"/>
      <path d="M11.6 16 L24.6 28.4"/>
    </g>'''
    return svg(body, defs), tray_svg(tray)


def direction_c_bold() -> tuple[str, str]:
    """C2 的小尺寸加重版：场色不变，K 描边 96 → 112（光学配重 +17%）。

    16 / 24px 下 96/1024 的笔画只有 1.5–2.3px，小像素抗锯齿会把笔画磨灰；
    加重版按 spec §4.3 用于 Windows 16/24 与托盘彩色版。
    """
    defs = f'''
    <linearGradient id="c3-field" x1="0.12" y1="0" x2="0.88" y2="1">
      <stop offset="0" stop-color="#1e9a79"/><stop offset="0.55" stop-color="{GREEN_DARK}"/>
      <stop offset="1" stop-color="#0c5a45"/>
    </linearGradient>
    <radialGradient id="c3-sheen" cx="0.28" cy="0.16" r="0.92">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.015"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="c3-clip"><path d="{SQ}"/></clipPath>'''
    body = f'''
    <path d="{SQ}" fill="url(#c3-field)"/>
    <g clip-path="url(#c3-clip)">
      <rect x="{INSET}" y="{INSET}" width="{BOX}" height="{BOX}" fill="url(#c3-sheen)"/>
    </g>
    {edge_light()}
    <g stroke="#ffffff" stroke-width="112">
      <path d="M368 272 V 752"/>
      <path d="M368 512 L652 272"/>
      <path d="M368 512 L652 752"/>
    </g>'''
    tray = '''
    <g stroke="#000000" stroke-width="3.6">
      <path d="M11.6 3.6 V 28.4"/>
      <path d="M11.6 16 L24.6 3.6"/>
      <path d="M11.6 16 L24.6 28.4"/>
    </g>'''
    return svg(body, defs), tray_svg(tray)


DIRECTIONS = {
    "a-monoline": direction_a,
    "b-candle": direction_b,
    "c-field": direction_c,
    "c2-field-deep": direction_c_deep,
    "c2-field-deep-bold": direction_c_bold,
    "d-horizon": direction_d,
}

# 渲染尺寸：app 图标取 macOS/Windows/Linux 关键档；托盘取 16/22/32
APP_SIZES = [1024, 512, 256, 128, 64, 32]
TRAY_SIZES = [32, 22, 16]


def render(svg_path: pathlib.Path, out: pathlib.Path, size: int) -> None:
    subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(out), str(svg_path)],
        check=True,
    )


def main() -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    PNG.mkdir(parents=True, exist_ok=True)
    for name, builder in DIRECTIONS.items():
        app_svg, tray_svg_text = builder()
        app_path = SRC / f"{name}.svg"
        tray_path = SRC / f"{name}-tray.svg"
        app_path.write_text(app_svg, encoding="utf-8")
        tray_path.write_text(tray_svg_text, encoding="utf-8")
        for size in APP_SIZES:
            render(app_path, PNG / f"{name}-{size}.png", size)
        for size in TRAY_SIZES:
            render(tray_path, PNG / f"{name}-tray-{size}.png", size)
        # 小尺寸放大对照（最近邻放大在 HTML 里用 CSS image-rendering 处理，
        # 这里只额外出一张 4x 平滑放大，便于看结构是否糊）
        render(app_path, PNG / f"{name}-32-zoom.png", 128)
        render(tray_path, PNG / f"{name}-tray-16-zoom.png", 128)
        print(f"✓ {name}")


if __name__ == "__main__":
    main()
