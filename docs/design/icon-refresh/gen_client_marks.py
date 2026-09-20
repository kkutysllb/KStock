#!/usr/bin/env python3
"""生成客户端插件用的商标几何常量（UI 内的商标与图标同源）。

为什么要生成而不是手写：UI 里的侧栏 / hero / 关于页商标必须与应用图标**几何一致**，
手抄一份路径必然漂移。本脚本从设计源（docs/design/icon-refresh/）算出最终坐标，
输出两样东西：

1. `kstock/client-brand/src/client/marks/geometry.ts` —— 客户端插件用的常量；
2. `zhuan-png/client-*.svg` —— 与 React 组件渲染结果逐字对应的镜像 SVG，
   用 rsvg 渲染即可与设计稿做像素级对照（等价性验证）。

两种形制（用户 2026-09-20 选定 B2 后的口径）：

  · `SEAL_FULL`（< 48px：侧栏 24 / hero 34）—— 朱印**直填满**徽标（篆书「麒麟」横排）
  · `SEAL_ON_INK`（>= 48px：设置·关于 72）—— 墨底 squircle + 内嵌朱印（= 应用图标 Tier 1b）

之所以小尺寸不用「品牌绿场 K」：它在 24px 下与 1.x 旧徽标（同为绿底白 K）几乎无法区分，
用户实测反馈「顶部商标没换过来」。绿场 K 仍作为**应用图标**的 16–48px 档（见 build_assets.py），
只是不再用于 UI 商标。

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
STAMP_TOP, STAMP_BOTTOM = "#d94436", "#b02f22"
RICE = "#fff8f2"
STROKE_FIX = 3.2                 # 双钩补厚（源坐标 300 单位制）
CONTENT = 824.0                  # 内容区边长（1024 画布，内缩 100）
SEAL_INSET_R = 0.042             # 印边内缩比例（相对印面边长）
FRAME_STROKE_R = 0.026           # 印边描边比例
GLYPH_EXTRA_R = 0.026            # 印边内缘再内缩
GLYPH_GAP_R = 0.02               # 两字间距
SEAL_MIN_SIZE = 48               # 该尺寸及以上用「墨底 + 内嵌朱印」


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


def place_glyph(name: str, bx: float, by: float, bw: float, bh: float) -> str:
    """与 generate_zhuan.side_by_side 相同的定标：等比缩放居中到目标框。

    只返回放置变换字符串——字形路径本身单独去重导出（GLYPH_PATHS），
    否则两种形制会把同一份 11KB 路径各存一遍，白涨一倍 bundle。
    """
    d, tr = extract(GLYPHS / f"{name}-seal.svg")
    x0, y0, x1, y1 = ink_bbox(d, tr, f"client-{name}")
    iw, ih = x1 - x0, y1 - y0
    s = min(bw / iw, bh / ih)
    ox = bx + (bw - iw * s) / 2 - x0 * s
    oy = by + (bh - ih * s) / 2 - y0 * s
    return f"translate({ox:.2f},{oy:.2f}) scale({s:.5f})"


def seal_lockup(x0: float, y0: float, size: float) -> dict[str, object]:
    """一方朱红白文印的参数（篆书横排，右麒左麟）。"""
    inset = size * SEAL_INSET_R
    inner_extra = size * GLYPH_EXTRA_R
    inner_x = x0 + inset + inner_extra
    inner_y = y0 + inset + inner_extra
    inner = size - 2 * (inset + inner_extra)
    gap = size * GLYPH_GAP_R
    bw = (inner - gap) / 2
    # i=0（麒）在右位：篆印自右向左读
    qi = place_glyph("qi", inner_x + bw + gap, inner_y, bw, inner)
    lin = place_glyph("lin", inner_x, inner_y, bw, inner)
    return {
        "x": x0, "y": y0, "size": size,
        "rx": round(size * 0.072, 2),
        "frameInset": round(inset, 2),
        "frameR": round((size - inset * 2) * 0.058, 2),
        "frameStroke": round(size * FRAME_STROKE_R, 2),
        "glyphs": [{"key": "qi", "place": qi}, {"key": "lin", "place": lin}],
    }


def ts_literal(v: object, indent: int = 0) -> str:
    pad = "  " * indent
    if isinstance(v, str):
        return f"'{v}'"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return "[" + ", ".join(ts_literal(x, indent) for x in v) + "]"
    if isinstance(v, dict):
        items = ",\n".join(f"{pad}  {k}: {ts_literal(val, indent + 1)}" for k, val in v.items())
        return "{\n" + items + f",\n{pad}}}"
    raise TypeError(type(v))


def frame_and_glyphs(lockup: dict[str, object]) -> str:
    inset = float(lockup["frameInset"])  # type: ignore[arg-type]
    size = float(lockup["size"])  # type: ignore[arg-type]
    x, y = float(lockup["x"]), float(lockup["y"])  # type: ignore[arg-type]
    body = (
        f'<rect x="{x + inset:.1f}" y="{y + inset:.1f}" width="{size - inset * 2:.1f}" '
        f'height="{size - inset * 2:.1f}" rx="{lockup["frameR"]}" fill="none" stroke="{RICE}" '
        f'stroke-width="{lockup["frameStroke"]}" stroke-opacity="0.95"/>'
    )
    for g in lockup["glyphs"]:  # type: ignore[union-attr]
        path = GLYPH_PATHS[str(g["key"])]
        inner = (
            f'<path d="{path["d"]}" fill="{RICE}" stroke="{RICE}" '
            f'stroke-width="{STROKE_FIX}"/>'
        )
        if path["pre"]:
            inner = f'<g transform="{path["pre"]}">{inner}</g>'
        body += f'<g transform="{g["place"]}">{inner}</g>'
    return body


def build_glyph_paths() -> dict[str, dict[str, str]]:
    """两个篆字的路径与自带图层变换（只存一份，供两种形制共用）。"""
    out = {}
    for name in ("qi", "lin"):
        d, tr = extract(GLYPHS / f"{name}-seal.svg")
        ink_bbox(d, tr, f"glyphpath-{name}")   # 校验字形可渲染（顺带缓存）
        out[name] = {"d": shrink(d), "pre": tr}
    return out


SQUIRCLE = squircle_points(512, 512, CONTENT)
GLYPH_PATHS = build_glyph_paths()
SEAL_FULL = seal_lockup(100.0, 100.0, CONTENT)      # 朱印直填满内容区
SEAL_ON_INK = seal_lockup(202.0, 202.0, 620.0)      # 墨底内嵌朱印


def mirror_svg(kind: str, size: int) -> str:
    """与 React 组件同构的镜像 SVG（用于等价性验证）。"""
    defs = (
        f'<linearGradient id="ink" x1="0" y1="0" x2="0" y2="1">'
        f'<stop offset="0" stop-color="{INK_TOP}"/><stop offset="1" stop-color="{INK}"/></linearGradient>'
        f'<linearGradient id="stamp" x1="0.2" y1="0" x2="0.8" y2="1">'
        f'<stop offset="0" stop-color="{STAMP_TOP}"/><stop offset="1" stop-color="{STAMP_BOTTOM}"/></linearGradient>'
    )
    if kind in ("sidebar", "hero"):
        body = f'<path d="{SQUIRCLE}" fill="url(#stamp)"/>' + frame_and_glyphs(SEAL_FULL)
    else:
        body = (
            f'<path d="{SQUIRCLE}" fill="url(#ink)"/>'
            f'<path d="{SQUIRCLE}" fill="none" stroke="#ffffff" stroke-opacity="0.1" stroke-width="2.5"/>'
            f'<rect x="{SEAL_ON_INK["x"]}" y="{SEAL_ON_INK["y"]}" width="{SEAL_ON_INK["size"]}" '
            f'height="{SEAL_ON_INK["size"]}" rx="{SEAL_ON_INK["rx"]}" fill="url(#stamp)"/>'
            + frame_and_glyphs(SEAL_ON_INK)
        )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
        f'viewBox="0 0 1024 1024"><defs>{defs}</defs>{body}</svg>'
    )


def main() -> None:
    glyph_bytes = sum(len(v["d"]) for v in GLYPH_PATHS.values())
    ts = f'''/**
 * KStock 商标几何常量 —— **本文件由脚本生成，请勿手改**。
 *
 * 生成器：`docs/design/icon-refresh/gen_client_marks.py`
 * 设计源：`docs/design/icon-refresh/`（篆书字形见 `glyphs/`，授权与触发条件见其 README）
 *
 * UI 内的侧栏 / hero / 关于页商标必须与**应用图标几何一致**，因此坐标全部由设计源算出，
 * 而不是手写一份。坐标系与应用图标同为 1024 画布 / 内容区 824（内缩 100）。
 *
 * 两种形制（按尺寸切换，用户 2026-09-20 选定）：
 *   size >= {SEAL_MIN_SIZE} → `SEAL_ON_INK`：墨底 squircle + 内嵌朱印（= 应用图标 Tier 1b）
 *   size <  {SEAL_MIN_SIZE} → `SEAL_FULL`：朱印直填满徽标
 * 两者都是**朱红白文印 + 篆书「麒麟」横排（右麒左麟）**，只是印面占比不同。
 *
 * 为什么小尺寸不用「品牌绿场 K」：它在 24px 下与 1.x 旧徽标（同为绿底白 K）几乎无法区分，
 * 实测反馈「顶部商标没换过来」。绿场 K 仍是**应用图标** 16–48px 档的形制
 * （见 `build_assets.py`），只是不再用于 UI 商标。
 */

/** 连续曲率圆角方（超椭圆 |x/a|^5 + |y/a|^5 = 1 采样，中心 512，边长 {CONTENT:.0f}）。 */
export const SQUIRCLE_PATH =
  '{SQUIRCLE}'

/** 篆书字形路径（只存一份，两种形制共用；`pre` 是字形自带的图层变换）。 */
export const GLYPH_PATHS = {ts_literal(GLYPH_PATHS, 0)} as const

/** 小尺寸（< {SEAL_MIN_SIZE}px）：朱印直填满徽标。 */
export const SEAL_FULL = {ts_literal(SEAL_FULL, 0)} as const

/** 大尺寸（>= {SEAL_MIN_SIZE}px）：墨底 squircle + 内嵌朱印。 */
export const SEAL_ON_INK = {ts_literal(SEAL_ON_INK, 0)} as const

/** 双钩笔画补厚量（源坐标系 300 单位制），使空心描边闭合为实笔。 */
export const GLYPH_STROKE_FIX = {STROKE_FIX}

/** 品牌色（与设计源同源）。 */
export const MARK_COLORS = {{
  inkTop: '{INK_TOP}',
  ink: '{INK}',
  stampTop: '{STAMP_TOP}',
  stampBottom: '{STAMP_BOTTOM}',
  rice: '{RICE}',
  white: '#ffffff',
}}

/** 该尺寸及以上用「墨底 + 内嵌朱印」，否则用「朱印直填」。 */
export const SEAL_MIN_SIZE = {SEAL_MIN_SIZE}
'''
    OUT_TS.parent.mkdir(parents=True, exist_ok=True)
    OUT_TS.write_text(ts, encoding="utf-8")
    print(f"✓ {OUT_TS.relative_to(REPO)}  ({len(ts)/1024:.1f} KB，篆书路径 {glyph_bytes/1024:.1f} KB)")

    MIRROR.mkdir(parents=True, exist_ok=True)
    for kind, size in (("about", 72), ("sidebar", 24), ("hero", 34)):
        p = MIRROR / f"client-{kind}-{size}.svg"
        p.write_text(mirror_svg(kind, size), encoding="utf-8")
        subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size),
                        "-o", str(p.with_suffix(".png")), str(p)], check=True)
        print(f"✓ 镜像 {p.name}")


if __name__ == "__main__":
    main()
