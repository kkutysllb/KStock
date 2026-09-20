#!/usr/bin/env python3
"""篆书版印章（Tier 1 定稿方向）：把《说文》小篆「麒 / 麟」合成进朱印。

字形来源（已复制进本仓库供设计用）：
  glyphs/qi-seal.svg · glyphs/lin-seal.svg
  来自 Wikimedia Commons 的「<字>-seal.svg」小篆字形系列（Inkscape 描摹，单 path）。
  ⚠ 落地前必须确认该文件页的授权（本机网络不稳定，未能取到 extmetadata）；
  生产建议按 spec §3.2 改为自有轮廓。

原字形是「双钩」（空心描边）的印刷篆形，直接用在图标上会在 256px 以下消失。
本脚本用「同色 stroke 补厚」把它实体化，并测量真实墨迹包围盒来定标——
所有定位都是量出来的，不靠肉眼调。

用法：python3 docs/design/icon-refresh/generate_zhuan.py
"""

from __future__ import annotations

import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from generate_seal import (  # noqa: E402
    BOX,
    CANVAS,
    INSET,
    RICE,
    SQ,
    squircle,
)

from PIL import Image  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent
GLYPHS = ROOT / "glyphs"
SRC = ROOT / "zhuan-src"
TMP = ROOT / "zhuan-tmp"
PNG = ROOT / "zhuan-png"

INK_TOP = "#0d1a16"
INK = "#030d0b"
GREEN_TOP = "#1e9a79"
GREEN = "#178267"
STROKE_FIX = 3.2  # 双钩补厚量（源坐标系 300 单位下的宽度），实测使笔画实体化


def extract(path: pathlib.Path) -> tuple[str, str]:
    """取出单 path 的 d 与其所在 g 的 transform。"""
    s = path.read_text(encoding="utf-8")
    d = re.search(r'<path[^>]*\sd="([^"]+)"', s, re.S)
    if d is None:
        raise SystemExit(f"{path} 未找到 path d")
    g = re.search(r'<g[^>]*transform="([^"]+)"', s)
    return d.group(1), (g.group(1) if g else "")


def lone_svg(d: str, transform: str) -> str:
    inner = f'<path d="{d}" style="fill:#000;stroke:#000;stroke-width:{STROKE_FIX}"/>'
    if transform:
        inner = f'<g transform="{transform}">{inner}</g>'
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="3000" '
        f'viewBox="0 0 300 300">{inner}</svg>'
    )


def ink_bbox(d: str, transform: str, name: str) -> tuple[float, float, float, float]:
    """渲染 10x 后量 alpha 包围盒，换算回源坐标（300 单位制）。"""
    TMP.mkdir(parents=True, exist_ok=True)
    svg = TMP / f"{name}.svg"
    svg.write_text(lone_svg(d, transform), encoding="utf-8")
    out = TMP / f"{name}.png"
    subprocess.run(["rsvg-convert", "-w", "3000", "-h", "3000", "-o", str(out), str(svg)], check=True)
    im = Image.open(out).convert("RGBA")
    box = im.getchannel("A").getbbox()
    if box is None:
        raise SystemExit(f"{name} 渲染为空")
    k = 300 / 3000
    return box[0] * k, box[1] * k, box[2] * k, box[3] * k


def glyph_group(name: str, d: str, transform: str, bbox, tx: float, ty: float,
                box_w: float, box_h: float, color: str) -> str:
    """把字形以等比缩放放进 (tx,ty,box_w,box_h) 的目标框并居中。"""
    x0, y0, x1, y1 = bbox
    iw, ih = x1 - x0, y1 - y0
    s = min(box_w / iw, box_h / ih)
    ox = tx + (box_w - iw * s) / 2 - x0 * s
    oy = ty + (box_h - ih * s) / 2 - y0 * s
    inner = f'<path d="{d}" style="fill:{color};stroke:{color};stroke-width:{STROKE_FIX}"/>'
    if transform:
        inner = f'<g transform="{transform}">{inner}</g>'
    return f'<g transform="translate({ox:.2f},{oy:.2f}) scale({s:.5f})">{inner}</g>'


def app_svg(body: str, defs: str = "") -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{CANVAS}" height="{CANVAS}" '
        f'viewBox="0 0 {CANVAS} {CANVAS}" fill="none">\n<defs>{defs}</defs>\n{body}\n</svg>\n'
    )


def defs_common(tag: str) -> str:
    return f'''
    <linearGradient id="{tag}-ink" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{INK_TOP}"/><stop offset="1" stop-color="{INK}"/>
    </linearGradient>
    <linearGradient id="{tag}-stamp" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#d94436"/><stop offset="1" stop-color="#b02f22"/>
    </linearGradient>
    <linearGradient id="{tag}-green" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="{GREEN_TOP}"/><stop offset="1" stop-color="{GREEN}"/>
    </linearGradient>'''


def ink_ground(tag: str) -> str:
    return f'''
    <path d="{SQ}" fill="url(#{tag}-ink)"/>
    <path d="{SQ}" fill="none" stroke="#ffffff" stroke-opacity="0.10" stroke-width="2.5"/>'''


def red_seal(tag: str, x0: float, y0: float, size: float, glyphs: list[str]) -> str:
    """朱红白文印：印面 + 白印边 + 竖排篆书两字（字形由调用方排好）。"""
    inset = size * 0.042
    frx = (size - inset * 2) * 0.058
    rx = size * 0.072
    return f'''
    <rect x="{x0}" y="{y0}" width="{size}" height="{size}" rx="{rx}" fill="url(#{tag}-stamp)"/>
    <rect x="{x0 + inset}" y="{y0 + inset}" width="{size - inset * 2}" height="{size - inset * 2}"
          rx="{frx}" fill="none" stroke="{RICE}" stroke-width="{size * 0.026}" stroke-opacity="0.95"/>
    {"".join(glyphs)}'''


def green_k_seal(tag: str, x0: float, y0: float, size: float) -> str:
    cx, cy = x0 + size / 2, y0 + size / 2
    ks = size * 0.52
    sw = size * 0.13
    left, top = cx - ks / 2, cy - ks / 2
    inset = size * 0.06
    return f'''
    <rect x="{x0}" y="{y0}" width="{size}" height="{size}" rx="{size * 0.15}" fill="url(#{tag}-green)"/>
    <rect x="{x0 + inset}" y="{y0 + inset}" width="{size - inset * 2}" height="{size - inset * 2}"
          rx="{size * 0.11}" fill="none" stroke="{RICE}" stroke-width="{size * 0.033}" stroke-opacity="0.9"/>
    <g stroke="#ffffff" stroke-width="{sw:.1f}" stroke-linecap="butt" stroke-linejoin="round">
      <path d="M{left:.1f} {top:.1f} V{top + ks:.1f}"/>
      <path d="M{left:.1f} {cy:.1f} L{left + ks:.1f} {top:.1f}"/>
      <path d="M{left:.1f} {cy:.1f} L{left + ks:.1f} {top + ks:.1f}"/>
    </g>'''


def build() -> None:
    jobs = {"qi": GLYPHS / "qi-seal.svg", "lin": GLYPHS / "lin-seal.svg"}
    data = {}
    for name, path in jobs.items():
        d, tr = extract(path)
        data[name] = (d, tr, ink_bbox(d, tr, name))
        x0, y0, x1, y1 = data[name][2]
        print(f"  {name} 墨迹包围盒(源坐标) = ({x0:.1f},{y0:.1f})-({x1:.1f},{y1:.1f})  宽高比 {(x1-x0)/(y1-y0):.3f}")

    def placed(tag: str, cx: float, cy: float, bw: float, bh: float, gap: float, color: str) -> list[str]:
        top_y = cy - gap - bh / 2 - bh / 2  # 上字顶
        out = []
        for i, name in enumerate(("qi", "lin")):
            d, tr, bb = data[name]
            ty = cy - gap / 2 - bh if i == 0 else cy + gap / 2
            out.append(glyph_group(name, d, tr, bb, cx - bw / 2, ty, bw, bh, color))
        del top_y
        return out

    # ── A · DB3 对印（推荐版式）：朱印 520 + 绿 K 印 184 ──────────────────
    seal_x, seal_y, seal_s = 252, 140, 520
    gly = placed("db3", seal_x + seal_s / 2, seal_y + seal_s / 2,
                 seal_s * 0.34, seal_s * 0.335, seal_s * 0.052, RICE)
    db3 = ink_ground("db3") + red_seal("db3", seal_x, seal_y, seal_s, gly) + green_k_seal("db3", 420, 700, 184)

    # ── B · 单印（最大篆书）：朱印 640 居中，无副印 ─────────────────────────
    s2, x2, y2 = 640, 192, 192
    gly2 = placed("e1", 512, 512, s2 * 0.34, s2 * 0.335, s2 * 0.05, RICE)
    e1 = ink_ground("e1") + red_seal("e1", x2, y2, s2, gly2)

    # ── C · 方印横排（右麒左麟，篆书本来瘦长，横排才填得满印面）────────────
    def side_by_side(tag: str, x0: float, y0: float, size: float, color: str,
                     order: tuple[str, str] = ("qi", "lin")) -> list[str]:
        inset = size * 0.042
        inner_x, inner_y = x0 + inset + size * 0.026, y0 + inset + size * 0.026
        inner = size - 2 * (inset + size * 0.026)
        bw, bh = (inner - size * 0.02) / 2, inner
        out = []
        for i, name in enumerate(order):
            d, tr, bb = data[name]
            # order[0] 放在右侧（篆印自右向左读）
            bx = inner_x + (1 - i) * (bw + size * 0.02)
            out.append(glyph_group(name, d, tr, bb, bx, inner_y, bw, bh, color))
        return out

    s3 = 560
    gly3 = side_by_side("db5", 232, 120, s3, RICE)
    db5 = ink_ground("db5") + red_seal("db5", 232, 120, s3, gly3) + green_k_seal("db5", 420, 710, 184)

    s4, x4, y4 = 620, 202, 202
    gly4 = side_by_side("e2", x4, y4, s4, RICE)
    e1side = ink_ground("e2") + red_seal("e2", x4, y4, s4, gly4)

    # ── D · DB1 印下字标（用户选定）：朱印横排篆书 + KSTOCK 字标，无绿 K 印 ──
    def db1(wordmark: str, tag: str) -> str:
        s5, x5, y5 = 620, 202, 130
        gly5 = side_by_side(tag, x5, y5, s5, RICE)
        return (
            ink_ground(tag)
            + red_seal(tag, x5, y5, s5, gly5)
            + f'<text x="512" y="846" font-family="Avenir" font-weight="900" font-size="90" '
              f'letter-spacing="22" fill="{wordmark}" text-anchor="middle" '
              f'dominant-baseline="central">KSTOCK</text>'
        )

    db1_white = db1(RICE, "db1")
    db1_green = db1("#31c7a2", "db1g")

    for name, body, tag in (
        ("db3-zhuan", db3, "db3"),
        ("e1-zhuan", e1, "e1"),
        ("db5-side", db5, "db5"),
        ("e1-side-zhuan", e1side, "e2"),
        ("db1-zhuan", db1_white, "db1"),
        ("db1-zhuan-greenmark", db1_green, "db1g"),
    ):
        svg = app_svg(body, defs_common(tag))
        p = SRC / f"{name}.svg"
        SRC.mkdir(parents=True, exist_ok=True)
        p.write_text(svg, encoding="utf-8")
        for size in (1024, 512, 256, 128, 64, 32):
            PNG.mkdir(parents=True, exist_ok=True)
            subprocess.run(
                ["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(PNG / f"{name}-{size}.png"), str(p)],
                check=True,
            )
        print(f"✓ {name}")


if __name__ == "__main__":
    build()
