#!/usr/bin/env python3
"""UI 商标候选（24 / 34px 小尺寸）——解决「换了但看不出换」的问题。

背景：定稿的尺寸规则是「≥48px 用朱印、<48px 用品牌绿场 K」。但侧栏 24px 与 hero 34px
的「绿场 K」与 1.x 的旧徽标（同样是绿底白 K）在视觉上几乎无法区分——用户实测反馈
「顶部商标没替换过来」。本脚本出两个**观感上确实不同**的候选，供选型：

  B1 印框 K：品牌绿场 + 白印边 + 白 K（把「印章」形制带到小尺寸，K 仍可辨）
  B2 朱印：朱红白文印直填满（篆书「麒麟」横排）——与应用图标同形制，红色一眼可辨
  B0 现状：品牌绿场 K（当前实现，作为对照基线）

用法：python3 docs/design/icon-refresh/generate_uimarks.py
"""

from __future__ import annotations

import math
import pathlib
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from generate_seal import BOX, CANVAS, INSET, RICE, SQ, squircle  # noqa: E402
from generate_zhuan import extract, ink_bbox  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent
GLYPHS = ROOT / "glyphs"
OUT = ROOT / "uimark-png"
SRC = ROOT / "uimark-src"

GREEN_TOP, GREEN = "#1e9a79", "#178267"
STAMP_TOP, STAMP_BOTTOM = "#d94436", "#b02f22"
K_LEFT, K_TOP, K_BOX = 340.0, 260.0, 344.0


def svg(body: str, defs: str = "") -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
        f'viewBox="0 0 {CANVAS} {CANVAS}" fill="none">\n<defs>{defs}</defs>\n{body}\n</svg>\n'
    )


def k_paths(stroke: float) -> str:
    mid = K_TOP + K_BOX / 2
    return (
        f'<g stroke="#ffffff" stroke-width="{stroke}" stroke-linecap="butt" '
        f'stroke-linejoin="round" fill="none">'
        f'<path d="M{K_LEFT:.0f} {K_TOP:.0f}V{K_TOP + K_BOX:.0f}"/>'
        f'<path d="M{K_LEFT:.0f} {mid:.0f}L{K_LEFT + K_BOX:.0f} {K_TOP:.0f}"/>'
        f'<path d="M{K_LEFT:.0f} {mid:.0f}L{K_LEFT + K_BOX:.0f} {K_TOP + K_BOX:.0f}"/>'
        f"</g>"
    )


def defs(tag: str) -> str:
    return f'''
    <linearGradient id="{tag}-green" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="{GREEN_TOP}"/><stop offset="1" stop-color="{GREEN}"/>
    </linearGradient>
    <linearGradient id="{tag}-stamp" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="{STAMP_TOP}"/><stop offset="1" stop-color="{STAMP_BOTTOM}"/>
    </linearGradient>'''


def b0_green_k() -> str:
    """基线与当前实现一致：品牌绿场 + 白 K（小尺寸配重 stroke 120）。"""
    return svg(f'<path d="{SQ}" fill="url(#b0-green)"/>{k_paths(120)}', defs("b0"))


def b1_framed_k() -> str:
    """印框 K：绿场 + 白印边（按印面比例）+ 白 K。把「印章」形制带到 24px。"""
    inset = 824 * 0.042
    frame = f'''
    <rect x="{INSET + inset:.1f}" y="{INSET + inset:.1f}"
          width="{BOX - inset * 2:.1f}" height="{BOX - inset * 2:.1f}"
          rx="{(BOX - inset * 2) * 0.058:.1f}" fill="none"
          stroke="{RICE}" stroke-width="{824 * 0.026:.1f}" stroke-opacity="0.9"/>'''
    return svg(f'<path d="{SQ}" fill="url(#b1-green)"/>{frame}{k_paths(104)}', defs("b1"))


def b2_red_seal() -> str:
    """朱印：朱红白文印直填满（篆书「麒麟」横排，右麒左麟），与 Dock 图标同形制。"""
    inset = 824 * 0.042
    frame = f'''
    <rect x="{INSET + inset:.1f}" y="{INSET + inset:.1f}"
          width="{BOX - inset * 2:.1f}" height="{BOX - inset * 2:.1f}"
          rx="{(BOX - inset * 2) * 0.058:.1f}" fill="none"
          stroke="{RICE}" stroke-width="{824 * 0.026:.1f}" stroke-opacity="0.95"/>'''
    inner_extra = BOX * 0.026
    inner_x = INSET + inset + inner_extra
    inner = BOX - 2 * (inset + inner_extra)
    gap = BOX * 0.02
    bw = (inner - gap) / 2
    glyphs = []
    for name, bx in (("qi", inner_x + bw + gap), ("lin", inner_x)):
        d, tr = extract(GLYPHS / f"{name}-seal.svg")
        x0, y0, x1, y1 = ink_bbox(d, tr, f"uimark-{name}")
        iw, ih = x1 - x0, y1 - y0
        s = min(bw / iw, inner / ih)
        ox = bx + (bw - iw * s) / 2 - x0 * s
        oy = INSET + inset + inner_extra + (inner - ih * s) / 2 - y0 * s
        pre = f'<g transform="{tr}">' if tr else "<g>"
        glyphs.append(
            f'<g transform="translate({ox:.2f},{oy:.2f}) scale({s:.5f})">{pre}'
            f'<path d="{d}" fill="{RICE}" stroke="{RICE}" stroke-width="3.2"/></g></g>'
        )
    return svg(f'<path d="{SQ}" fill="url(#b2-stamp)"/>{frame}{"".join(glyphs)}', defs("b2"))


CASES = {"b0-green-k": (b0_green_k, "b0"), "b1-framed-k": (b1_framed_k, "b1"),
         "b2-red-seal": (b2_red_seal, "b2")}
SIZES = [512, 72, 34, 24]


def main() -> None:
    SRC.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (builder, _tag) in CASES.items():
        p = SRC / f"{name}.svg"
        p.write_text(builder(), encoding="utf-8")
        for size in SIZES:
            subprocess.run(
                ["rsvg-convert", "-w", str(size), "-h", str(size),
                 "-o", str(OUT / f"{name}-{size}.png"), str(p)],
                check=True,
            )
        print(f"✓ {name}")


if __name__ == "__main__":
    main()
