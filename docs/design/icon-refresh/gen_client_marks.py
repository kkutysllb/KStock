#!/usr/bin/env python3
"""生成客户端插件用的商标几何常量（UI 内的商标与图标同源）。

为什么要生成而不是手写：UI 里的侧栏 / hero / 关于页商标必须与应用图标**几何一致**，
手抄一份路径必然漂移。本脚本从设计源（docs/design/icon-refresh/）算出最终坐标，
输出两样东西：

1. `kstock/client-brand/src/client/marks/geometry.ts` —— 客户端插件用的常量；
2. `zhuan-png/client-*.svg` —— 与 React 组件渲染结果逐字对应的镜像 SVG，
   用 rsvg 渲染即可与设计稿做像素级对照（等价性验证）。

字形路径做**小数位压缩**（1 位小数）：UI 内 24–72px 用不上 6 位精度，
而路径字符串会进客户端 bundle，压缩后体积约减半。

用法：python3 docs/design/icon-refresh/gen_client_marks.py
"""

from __future__ import annotations

import math
import pathlib
import re
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from generate_zhuan import extract, ink_bbox  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parents[2]  # icon-refresh → design → docs → 仓库根
GLYPHS = ROOT / "glyphs"
OUT_TS = REPO / "kstock/client-brand/src/client/marks/geometry.ts"
MIRROR = ROOT / "zhuan-png"

# 与设计源一致的口径
INK_TOP, INK = "#0d1a16", "#030d0b"
GREEN_TOP, GREEN = "#1e9a79", "#178267"
STAMP_TOP, STAMP_BOTTOM = "#d94436", "#b02f22"
RICE = "#fff8f2"
K_STROKE_TIER2 = 96      # ≥48px（Tier 2 口径）
K_STROKE_SMALL = 120     # <48px 光学配重 +25%
STROKE_FIX = 3.2         # 双钩补厚（源坐标 300 单位制）
SEAL_INSET_RATIO = 0.042
SEAL_FRAME_RATIO = 0.026
SEAL_GLYPH_EXTRA = 0.026
SEAL_GAP_RATIO = 0.02


def squircle_points(cx: float, cy: float, size: float, n: float = 5.0, steps: int = 72) -> str:
    a = size / 2
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        ct, st = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(ct) ** (2.0 / n), ct)
        y = a * math.copysign(abs(st) ** (2.0 / n), st)
        pts.append(f"{cx + x:.1f} {cy + y:.1f}")
    return "M " + "L".join(pts) + "Z"


def shrink(d: str, digits: int = 1) -> str:
    """把路径里的小数位压到 digits 位（字符串体积约减半，UI 尺寸下无可见影响）。"""
    def repl(m: re.Match[str]) -> str:
        v = float(m.group(0))
        s = f"{v:.{digits}f}".rstrip("0").rstrip(".")
        return s if s not in ("", "-0") else "0"
    return re.sub(r"-?\d+\.\d+", repl, d)


def place_glyph(name: str, bx: float, by: float, bw: float, bh: float) -> dict[str, object]:
    """与 generate_zhuan.side_by_side 相同的定标：等比缩放居中到目标框。"""
    d, tr = extract(GLYPHS / f"{name}-seal.svg")
    x0, y0, x1, y1 = ink_bbox(d, tr, f"client-{name}")
    iw, ih = x1 - x0, y1 - y0
    s = min(bw / iw, bh / ih)
    ox = bx + (bw - iw * s) / 2 - x0 * s
    oy = by + (bh - ih * s) / 2 - y0 * s
    return {"d": shrink(d), "pre": tr, "place": f"translate({ox:.2f},{oy:.2f}) scale({s:.5f})"}


def seal_lockup(x0: float, y0: float, size: float) -> dict[str, object]:
    """Tier 1b：朱红白文方印（篆书横排，右麒左麟）。"""
    inset = size * SEAL_INSET_RATIO
    inner_extra = size * SEAL_GLYPH_EXTRA
    inner_x = x0 + inset + inner_extra
    inner = size - 2 * (inset + inner_extra)
    bw = (inner - size * SEAL_GAP_RATIO) / 2
    gap = size * SEAL_GAP_RATIO
    # i=0（麒）在右位：篆印自右向左读
    qi = place_glyph("qi", inner_x + bw + gap, inner_x, bw, inner)
    lin = place_glyph("lin", inner_x, inner_x, bw, inner)
    return {
        "x": x0, "y": y0, "size": size,
        "rx": round(size * 0.072, 2),
        "frameInset": round(inset, 2),
        "frameR": round((size - inset * 2) * 0.058, 2),
        "frameStroke": round(size * SEAL_FRAME_RATIO, 2),
        "glyphs": [qi, lin],
    }


def ts_literal(v: object, indent: int = 0) -> str:
    pad = "  " * indent
    if isinstance(v, str):
        return f"'{v}'"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        inner = ", ".join(ts_literal(x, indent) for x in v)
        return f"[{inner}]"
    if isinstance(v, dict):
        items = ",\n".join(f"{pad}  {k}: {ts_literal(val, indent + 1)}" for k, val in v.items())
        return "{\n" + items + f",\n{pad}}}"
    raise TypeError(type(v))


def mirror_svg(kind: str, size: int) -> str:
    """与 React 组件同构的镜像 SVG（用于等价性验证）。"""
    seal = seal_lockup(202.0, 202.0, 620.0)
    glyphs = "".join(
        f'<g transform="{g["place"]}"><g transform="{g["pre"]}">'
        f'<path d="{g["d"]}" fill="{RICE}" stroke="{RICE}" stroke-width="{STROKE_FIX}"/></g></g>'
        for g in seal["glyphs"]  # type: ignore[union-attr]
    )
    if kind == "about":
        body = (
            f'<path d="{SQUIRCLE}" fill="url(#ink)"/>'
            f'<rect x="{seal["x"]}" y="{seal["y"]}" width="{seal["size"]}" height="{seal["size"]}" '
            f'rx="{seal["rx"]}" fill="url(#stamp)"/>'
            f'<rect x="{float(seal["x"]) + float(seal["frameInset"])}" '
            f'y="{float(seal["y"]) + float(seal["frameInset"])}" '
            f'width="{float(seal["size"]) - 2 * float(seal["frameInset"])}" '
            f'height="{float(seal["size"]) - 2 * float(seal["frameInset"])}" '
            f'rx="{seal["frameR"]}" fill="none" stroke="{RICE}" '
            f'stroke-width="{seal["frameStroke"]}" stroke-opacity="0.95"/>{glyphs}'
        )
    else:  # sidebar / hero：Tier 2 口径的绿场 K
        sw = K_STROKE_SMALL
        left, top, box = 340.0, 260.0, 344.0
        body = (
            f'<path d="{SQUIRCLE}" fill="url(#green)"/>'
            + "".join(
                f'<path d="{d}" stroke="#ffffff" stroke-width="{sw}" stroke-linecap="butt" '
                f'stroke-linejoin="round" fill="none"/>'
                for d in (
                    f"M{left} {top}V{top + box}",
                    f"M{left} {top + box / 2}L{left + box} {top}",
                    f"M{left} {top + box / 2}L{left + box} {top + box}",
                )
            )
        )
    defs = (
        f'<linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{INK_TOP}"/><stop offset="1" stop-color="{INK}"/></linearGradient>'
        f'<linearGradient id="green" x1="0.15" y1="0" x2="0.85" y2="1">'
        f'<stop offset="0" stop-color="{GREEN_TOP}"/><stop offset="1" stop-color="{GREEN}"/></linearGradient>'
        f'<linearGradient id="stamp" x1="0.2" y1="0" x2="0.8" y2="1">'
        f'<stop offset="0" stop-color="{STAMP_TOP}"/><stop offset="1" stop-color="{STAMP_BOTTOM}"/></linearGradient>'
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="0 0 1024 1024"><defs>{defs}</defs>{body}</svg>'
    )


SQUIRCLE = squircle_points(512, 512, 824)


def main() -> None:
    seal = seal_lockup(202.0, 202.0, 620.0)
    raw = sum(len(str(g["d"])) for g in seal["glyphs"])  # type: ignore[union-attr]
    ts = f'''/**
 * KStock 商标几何常量 —— **本文件由脚本生成，请勿手改**。
 *
 * 生成器：`docs/design/icon-refresh/gen_client_marks.py`
 * 设计源：`docs/design/icon-refresh/`（篆书字形见 `glyphs/`，授权与触发条件见其 README）
 *
 * UI 内的侧栏 / hero / 关于页商标必须与**应用图标几何一致**，因此坐标全部由设计源算出，
 * 而不是手写一份。坐标系与应用图标同为 1024 画布 / 内容区 824（内缩 100）。
 *
 * 尺寸规则（与图标系统同一套，按尺寸分形制）：
 *   size >= {48} → 朱红白文方印（篆书「麒麟」横排，右麒左麟）
 *   size <  {48} → 品牌绿实色场 K（笔画按小尺寸光学配重加粗）
 */

/** 连续曲率圆角方（超椭圆 |x/a|^5 + |y/a|^5 = 1 采样，中心 512，边长 824）。 */
export const SQUIRCLE_PATH =
  '{SQUIRCLE}'

/** Tier 2 绿场 K 的字形（三条等宽笔画，1024 坐标系）。 */
export const K_MARK = {{
  left: 340,
  top: 260,
  box: 344,
  /** >=48px 的笔画宽度（Tier 2 口径）。 */
  stroke: {K_STROKE_TIER2},
  /** <48px 的笔画宽度（光学配重 +25%）。 */
  strokeSmall: {K_STROKE_SMALL},
}}

/** Tier 1b 朱红白文方印：印面 / 印边 / 篆书两字（含已算好的定位变换）。 */
export const SEAL_LOCKUP = {ts_literal(seal, 0)} as const

/** 双钩笔画补厚量（源坐标系 300 单位制），使空心描边闭合为实笔。 */
export const GLYPH_STROKE_FIX = {STROKE_FIX}

/** 品牌色（与 `tokens.ts` / 设计源同源）。 */
export const MARK_COLORS = {{
  inkTop: '{INK_TOP}',
  ink: '{INK}',
  greenTop: '{GREEN_TOP}',
  green: '{GREEN}',
  stampTop: '{STAMP_TOP}',
  stampBottom: '{STAMP_BOTTOM}',
  rice: '{RICE}',
  white: '#ffffff',
}}

/** 在这个尺寸及以上使用印章形制。 */
export const SEAL_MIN_SIZE = 48
'''
    OUT_TS.parent.mkdir(parents=True, exist_ok=True)
    OUT_TS.write_text(ts, encoding="utf-8")
    print(f"✓ {OUT_TS.relative_to(REPO)}  ({len(ts)/1024:.1f} KB)")
    print(f"  篆书路径原始 {raw/1024:.1f} KB → 压缩后 "
          f"{sum(len(str(g['d'])) for g in seal['glyphs'])/1024:.1f} KB")  # type: ignore[union-attr]

    MIRROR.mkdir(parents=True, exist_ok=True)
    for kind, size in (("about", 72), ("sidebar", 24), ("hero", 34)):
        p = MIRROR / f"client-{kind}-{size}.svg"
        p.write_text(mirror_svg(kind, size), encoding="utf-8")
        subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size),
                        "-o", str(p.with_suffix(".png")), str(p)], check=True)
        print(f"✓ 镜像 {p.name}")


if __name__ == "__main__":
    main()
