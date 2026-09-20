#!/usr/bin/env python3
"""双品牌执行稿（Tier 1）：麒麟印章 + KStock 产品标。

用户已定：走双品牌（麒麟 = 引擎／中文品牌，KStock = 产品），托盘接受拉丁 K。
双品牌让此前的「一张图两张面孔」变成「两个品牌各自的面孔」——系统反而更自洽：
  · 麒麟朱印只出现在大尺寸（Dock / 关于页 / 物料）
  · K 只出现在小尺寸与托盘（任务栏 / 菜单栏 / 通知）
本文件出三个 Tier 1 版式，等篆书字形来源定了再把「麒麟」两字的填充替换为篆书轮廓。

用法：python3 docs/design/icon-refresh/generate_dual.py
"""

from __future__ import annotations

import math
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from generate_seal import (  # noqa: E402
    BOX,
    CANVAS,
    INSET,
    RICE,
    SQ,
    VERMILION,
    VERMILION_D,
    squircle,
)

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "dual-src"
PNG = ROOT / "dual-png"

INK_TOP = "#0d1a16"
INK = "#030d0b"
GREEN = "#178267"
GREEN_TOP = "#1e9a79"
WORDMARK_FONT = "Avenir"
CJK = "Noto Sans CJK SC"


def app_svg(body: str, defs: str = "") -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
        f'viewBox="0 0 {CANVAS} {CANVAS}" fill="none">\n<defs>{defs}</defs>\n{body}\n</svg>\n'
    )


def ink_ground() -> str:
    return f'''
    <path d="{SQ}" fill="url(#d-ink)"/>
    <path d="{SQ}" fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="2.5"/>'''


def seal_block(x0: float, y0: float, size: float, *, frame_inset: float, frame_w: float,
               font: float, half_gap: float, idp: str) -> str:
    """一方朱红白文印：印面 + 白印边 + 竖排「麒麟」。"""
    x1, y1 = x0 + size, y0 + size
    rx = size * 0.072
    fx0, fy0 = x0 + frame_inset, y0 + frame_inset
    fs = size - frame_inset * 2
    frx = fs * 0.058
    cx, cy = x0 + size / 2, y0 + size / 2
    return f'''
    <rect x="{x0}" y="{y0}" width="{size}" height="{size}" rx="{rx}" fill="url(#{idp}-stamp)"/>
    <rect x="{fx0}" y="{fy0}" width="{fs}" height="{fs}" rx="{frx}" fill="none"
          stroke="{RICE}" stroke-width="{frame_w}" stroke-opacity="0.95"/>
    <text x="{cx}" y="{cy - half_gap}" font-family="{CJK}" font-weight="900"
          font-size="{font}" fill="{RICE}" text-anchor="middle"
          dominant-baseline="central">麒</text>
    <text x="{cx}" y="{cy + half_gap}" font-family="{CJK}" font-weight="900"
          font-size="{font}" fill="{RICE}" text-anchor="middle"
          dominant-baseline="central">麟</text>
    <title>{x1:.0f}x{y1:.0f}</title>'''


def k_mark(cx: float, cy: float, size: float, stroke: float, color: str, cap: str = "butt") -> str:
    """几何 K：以 (cx,cy) 为中心的方形字面，平口或圆口。"""
    left = cx - size / 2
    top = cy - size / 2
    mid = cy
    return (
        f'<g stroke="{color}" stroke-width="{stroke}" stroke-linecap="{cap}" '
        f'stroke-linejoin="round">'
        f'<path d="M{left:.0f} {top:.0f} V{top + size:.0f}"/>'
        f'<path d="M{left:.0f} {mid:.0f} L{left + size:.0f} {top:.0f}"/>'
        f'<path d="M{left:.0f} {mid:.0f} L{left + size:.0f} {top + size:.0f}"/>'
        f"</g>"
    )


def defs_common(extra: str = "") -> str:
    return f'''
    <linearGradient id="d-ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{INK_TOP}"/><stop offset="1" stop-color="{INK}"/>
    </linearGradient>
    <linearGradient id="d1-stamp" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#d94436"/><stop offset="1" stop-color="#b02f22"/>
    </linearGradient>
    <linearGradient id="d2-stamp" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#d94436"/><stop offset="1" stop-color="#b02f22"/>
    </linearGradient>
    <linearGradient id="d3-stamp" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#d94436"/><stop offset="1" stop-color="#b02f22"/>
    </linearGradient>
    <linearGradient id="d-green" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="{GREEN_TOP}"/><stop offset="1" stop-color="{GREEN}"/>
    </linearGradient>{extra}'''


# ── DB1 · 印下字标：朱印（麒麟）+ 底部 KSTOCK 字标 ──────────────────────────
def db1_wordmark() -> str:
    body = f'''
    {ink_ground()}
    {seal_block(202, 128, 620, frame_inset=26, frame_w=16, font=210, half_gap=112, idp="d1")}
    <text x="512" y="844" font-family="{WORDMARK_FONT}" font-weight="900" font-size="90"
          letter-spacing="22" fill="{RICE}" text-anchor="middle"
          dominant-baseline="central">KSTOCK</text>'''
    return app_svg(body, defs_common())


# ── DB2 · 角标 K 印：朱印（麒麟）+ 右下品牌绿 K 印（压角）────────────────────
def db2_corner_k() -> str:
    kx, ky, ks = 752, 742, 178
    body = f'''
    {ink_ground()}
    {seal_block(200, 130, 620, frame_inset=26, frame_w=16, font=208, half_gap=112, idp="d2")}
    <rect x="{kx - ks / 2 - 8}" y="{ky - ks / 2 - 8}" width="{ks + 16}" height="{ks + 16}"
          rx="30" fill="{INK}"/>
    <rect x="{kx - ks / 2}" y="{ky - ks / 2}" width="{ks}" height="{ks}" rx="26" fill="url(#d-green)"/>
    {k_mark(kx, ky, 98, 24, "#ffffff")}'''
    return app_svg(body, defs_common())


# ── DB3 · 对印：朱印（麒麟）在上、绿印 K 在下 ────────────────────────────────
def db3_paired() -> str:
    sx0, sy0, ss = 252, 140, 520
    gx0, gy0, gs = 420, 700, 184
    gcx, gcy = gx0 + gs / 2, gy0 + gs / 2
    body = f'''
    {ink_ground()}
    {seal_block(sx0, sy0, ss, frame_inset=22, frame_w=14, font=188, half_gap=98, idp="d3")}
    <rect x="{gx0}" y="{gy0}" width="{gs}" height="{gs}" rx="28" fill="url(#d-green)"/>
    <rect x="{gx0 + 11}" y="{gy0 + 11}" width="{gs - 22}" height="{gs - 22}" rx="20"
          fill="none" stroke="{RICE}" stroke-width="6" stroke-opacity="0.9"/>
    {k_mark(gcx, gcy, 96, 24, "#ffffff")}'''
    return app_svg(body, defs_common())


VARIANTS = {"db1-wordmark": db1_wordmark, "db2-corner-k": db2_corner_k, "db3-paired": db3_paired}
APP_SIZES = [1024, 512, 256, 128, 64, 32]


def render(svg_path: pathlib.Path, out: pathlib.Path, size: int) -> None:
    subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(out), str(svg_path)],
        check=True,
    )


def main() -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    PNG.mkdir(parents=True, exist_ok=True)
    for name, builder in VARIANTS.items():
        path = SRC / f"{name}.svg"
        path.write_text(builder(), encoding="utf-8")
        for size in APP_SIZES:
            render(path, PNG / f"{name}-{size}.png", size)
        print(f"✓ {name}")


if __name__ == "__main__":
    main()
