#!/usr/bin/env python3
"""方向 E「麒麟印章」候选方案渲染器（设计提案用）。

与 generate.py 同一套 macOS 图标网格（1024 画布 / 824 内容区 / 连续曲率圆角），
额外处理印章特有的三件事：

1. 印面与印边：印章的「外框」画在 squircle 内部（而不是把图标外形做成不规则方），
   这样既保住了 macOS 圆角方规范，又保留了「章」的读法。
2. 字体：本机 fc-list 实测**没有篆书/隶书**可用（只有 Noto Sans CJK SC Black /
   Songti SC / Heiti SC）。所以本稿是「现代粗黑体印」，篆书版本需要字体授权或手工描形。
3. 双形制：大尺寸用完整两字印章；小尺寸与托盘另出简化形（详见 tray_* 与 *_small）。

用法：python3 docs/design/icon-refresh/generate_seal.py
"""

from __future__ import annotations

import math
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "seal-src"
PNG = ROOT / "seal-png"

CANVAS = 1024
INSET = 100
BOX = CANVAS - INSET * 2  # 824
CJK = "Noto Sans CJK SC"

# 印章用色
VERMILION = "#ce3b2e"      # 朱砂
VERMILION_D = "#a62a20"    # 朱砂暗部
RICE = "#fff8f2"           # 宣纸白（印文）
INK = "#030d0b"
GREEN_MID = "#178267"
GREEN_DEEP_TOP = "#1e9a79"
GREEN_DEEP = "#0c5a45"


def squircle(cx: float, cy: float, size: float, n: float = 5.0, steps: int = 288) -> str:
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

# 印边（内框）几何：内容区再内缩 40，线宽 22 → 印框内缘 151..873；
# 两字必须落在这个内缘之内（此前 58/268pt 的排法把印边压在字上）。
FRAME_INSET = 40
FRAME = BOX / 2 - FRAME_INSET  # 半边长：372 → 印框 140..884（贴 squircle 内缘 40）
FRAME_R = 48
FRAME_W = 22
# 竖排两字：字号 300、字心 347 / 677 → 墨迹 215..809，印框内缘 151..873，四周留 64
CHAR_SIZE = 300
CHAR_Y1 = 347
CHAR_Y2 = 677


def frame_path() -> str:
    x0, x1 = CANVAS / 2 - FRAME, CANVAS / 2 + FRAME
    y0, y1 = CANVAS / 2 - FRAME, CANVAS / 2 + FRAME
    r = FRAME_R
    return (
        f"M {x0 + r} {y0} H {x1 - r} A {r} {r} 0 0 1 {x1} {y0 + r} "
        f"V {y1 - r} A {r} {r} 0 0 1 {x1 - r} {y1} H {x0 + r} "
        f"A {r} {r} 0 0 1 {x0} {y1 - r} V {y0 + r} A {r} {r} 0 0 1 {x0 + r} {y0} Z"
    )


def chars(size: float, y_top: float, y_bottom: float, fill: str, family: str = CJK) -> str:
    """竖排两字：上「麒」下「麟」（2 字印的通行排法，见提案说明）。"""
    return (
        f'<text x="512" y="{y_top}" font-family="{family}" font-weight="900" '
        f'font-size="{size}" fill="{fill}" text-anchor="middle" '
        f'dominant-baseline="central">麒</text>\n'
        f'<text x="512" y="{y_bottom}" font-family="{family}" font-weight="900" '
        f'font-size="{size}" fill="{fill}" text-anchor="middle" '
        f'dominant-baseline="central">麟</text>'
    )


def app_svg(body: str, defs: str = "") -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
        f'viewBox="0 0 {CANVAS} {CANVAS}" fill="none">\n<defs>{defs}</defs>\n{body}\n</svg>\n'
    )


def tray_svg(body: str) -> str:
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" '
        'viewBox="0 0 32 32" fill="none">\n' + body + "\n</svg>\n"
    )


def tray_frame() -> str:
    """托盘用印边框：3..29，线宽 2.4，圆角 3.4（16pt 下 1.2pt，与系统图标重量相当）。"""
    return (
        '<path d="M6.4 3 H 25.6 A 3.4 3.4 0 0 1 29 6.4 V 25.6 A 3.4 3.4 0 0 1 25.6 29 '
        'H 6.4 A 3.4 3.4 0 0 1 3 25.6 V 6.4 A 3.4 3.4 0 0 1 6.4 3 Z" '
        'fill="none" stroke="#000000" stroke-width="2.4"/>'
    )


# ── E1 · 朱红白文印（阳刻白文：红底白字 + 白印边）────────────────────────────
def seal_vermilion() -> tuple[str, str]:
    defs = f'''
    <linearGradient id="e1-field" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#d94a3a"/><stop offset="0.5" stop-color="{VERMILION}"/>
      <stop offset="1" stop-color="{VERMILION_D}"/>
    </linearGradient>'''
    body = f'''
    <path d="{SQ}" fill="url(#e1-field)"/>
    <path d="{frame_path()}" fill="none" stroke="{RICE}" stroke-width="{FRAME_W}"/>
    {chars(CHAR_SIZE, CHAR_Y1, CHAR_Y2, RICE)}'''
    # 托盘：印边 + 单字「K」（两字汉字在 16pt 无解，见提案「双形制」说明）
    tray = tray_frame() + (
        '<g stroke="#000000" stroke-width="3" stroke-linecap="round">'
        '<path d="M11.4 8.6 V 23.4"/><path d="M11.4 16 L21 8.6"/>'
        '<path d="M11.4 16 L21 23.4"/></g>'
    )
    return app_svg(body, defs), tray_svg(tray)


# ── E2 · 墨底朱印（深墨底 + 一方朱红印迹，最贴深色 UI）────────────────────────
def seal_on_ink() -> tuple[str, str]:
    defs = f'''
    <linearGradient id="e2-ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d1a16"/><stop offset="1" stop-color="{INK}"/>
    </linearGradient>
    <linearGradient id="e2-stamp" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#d94436"/><stop offset="1" stop-color="#b02f22"/>
    </linearGradient>'''
    # 印面内缩 122、圆角 66：让「朱印」明显是盖在墨底上的一方章，而非满幅底色
    stamp = 'M 292 230 H 732 A 62 62 0 0 1 794 292 V 732 A 62 62 0 0 1 732 794 H 292 A 62 62 0 0 1 230 732 V 292 A 62 62 0 0 1 292 230 Z'
    body = f'''
    <path d="{SQ}" fill="url(#e2-ink)"/>
    <path d="{stamp}" fill="url(#e2-stamp)"/>
    <path d="M 290 262 H 734 A 38 38 0 0 1 772 300 V 724 A 38 38 0 0 1 734 762 H 290 A 38 38 0 0 1 252 724 V 300 A 38 38 0 0 1 290 262 Z"
          fill="none" stroke="{RICE}" stroke-width="16" stroke-opacity="0.92"/>
    {chars(226, 402, 622, RICE)}'''
    tray = tray_frame() + (
        '<g stroke="#000000" stroke-width="3" stroke-linecap="round">'
        '<path d="M11.4 8.6 V 23.4"/><path d="M11.4 16 L21 8.6"/>'
        '<path d="M11.4 16 L21 23.4"/></g>'
    )
    return app_svg(body, defs), tray_svg(tray)


# ── E3 · 品牌绿白文印（与现有品牌同源，白字白印边）──────────────────────────
def seal_green() -> tuple[str, str]:
    defs = f'''
    <linearGradient id="e3-field" x1="0.12" y1="0" x2="0.88" y2="1">
      <stop offset="0" stop-color="{GREEN_DEEP_TOP}"/><stop offset="0.55" stop-color="{GREEN_MID}"/>
      <stop offset="1" stop-color="{GREEN_DEEP}"/>
    </linearGradient>'''
    body = f'''
    <path d="{SQ}" fill="url(#e3-field)"/>
    <path d="{frame_path()}" fill="none" stroke="#ffffff" stroke-width="{FRAME_W}"/>
    {chars(CHAR_SIZE, CHAR_Y1, CHAR_Y2, "#ffffff")}'''
    tray = tray_frame() + (
        '<g stroke="#000000" stroke-width="3" stroke-linecap="round">'
        '<path d="M11.4 8.6 V 23.4"/><path d="M11.4 16 L21 8.6"/>'
        '<path d="M11.4 16 L21 23.4"/></g>'
    )
    return app_svg(body, defs), tray_svg(tray)


# ── 小尺寸专用形（Tier 2）：去掉印边、字放大，32/48/64 用 ────────────────────
def seal_small_variant(field: str, glyph: str, size: float = 352) -> str:
    """小尺寸版：无内框、字放大——用于诚实检验「32px 还能读出什么」。

    size=352 为疏排（字间留白多），size=424 为满格（逼近真实印章的密排）。
    """
    defs = f'''
    <linearGradient id="s-field" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="{field[0]}"/><stop offset="1" stop-color="{field[1]}"/>
    </linearGradient>'''
    body = f'''
    <path d="{SQ}" fill="url(#s-field)"/>
    {chars(size, 316, 708, glyph)}'''
    return app_svg(body, defs)


# ── 托盘对照实验：把「麟」直接塞进 16pt 看会发生什么（作为证据，不作方案）────
def tray_single_char() -> str:
    return tray_svg(
        '<text x="16" y="16" font-family="' + CJK + '" font-weight="900" font-size="26" '
        'fill="#000000" text-anchor="middle" dominant-baseline="central">麟</text>'
    )


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

    variants = {
        "e1-vermilion": seal_vermilion,
        "e2-ink-stamp": seal_on_ink,
        "e3-green": seal_green,
    }
    for name, builder in variants.items():
        app, tray = builder()
        app_path, tray_path = SRC / f"{name}.svg", SRC / f"{name}-tray.svg"
        app_path.write_text(app, encoding="utf-8")
        tray_path.write_text(tray, encoding="utf-8")
        for size in APP_SIZES:
            render(app_path, PNG / f"{name}-{size}.png", size)
        for size in TRAY_SIZES:
            render(tray_path, PNG / f"{name}-tray-{size}.png", size)
        render(app_path, PNG / f"{name}-32-zoom.png", 128)
        render(tray_path, PNG / f"{name}-tray-16-zoom.png", 128)
        print(f"✓ {name}")

    # 小尺寸专用形（以朱红 / 品牌绿两种场色各出一套）
    smalls = {
        "small-vermilion": ("#d94436", "#b02f22", RICE, 352.0),
        "small-green": (GREEN_DEEP_TOP, GREEN_DEEP, "#ffffff", 352.0),
        "tight-vermilion": ("#d94436", "#b02f22", RICE, 424.0),
    }
    for name, (f1, f2, glyph, size) in smalls.items():
        path = SRC / f"{name}.svg"
        path.write_text(seal_small_variant((f1, f2), glyph, size), encoding="utf-8")
        for size in (256, 64, 32):
            render(path, PNG / f"{name}-{size}.png", size)
        print(f"✓ {name}")

    # 托盘反例证据：单字「麟」直接进 16pt
    ev = SRC / "evidence-tray-lin.svg"
    ev.write_text(tray_single_char(), encoding="utf-8")
    for size in TRAY_SIZES:
        render(ev, PNG / f"evidence-tray-lin-{size}.png", size)
    print("✓ evidence-tray-lin")


if __name__ == "__main__":
    main()
