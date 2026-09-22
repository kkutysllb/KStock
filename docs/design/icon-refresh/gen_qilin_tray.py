#!/usr/bin/env python3
"""生成托盘用的「上游麒麟彩色印章」资产（用户 2026-09-20 选定，三端统一彩色）。

源：`qilin-tray/favicon.svg` —— 上游 QiLin 品牌印章（朱砂印面 + 金色细环 +
楷体「麒」「麟」白字，字形来自 `vendor/qilin/packages/client/ui-brand/src/client/glyphs.ts`，
不依赖运行时字体）。本脚本按目标尺寸矢量直出彩色托盘图：

  · macOS / Windows / Linux 三端统一用**彩色**印章（不做黑色模板图）。
  · 已知取舍（用户知情确认）：彩色图不随菜单栏深浅色自动反色；
    朱砂红在浅色与深色菜单栏上均可见（已实测）。

用法：python3 docs/design/icon-refresh/gen_qilin_tray.py
"""

from __future__ import annotations

import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
SRC_SVG = ROOT / "qilin-tray" / "favicon.svg"
OUT = ROOT / "qilin-tray"
SIZES = [16, 20, 24, 32]


def main() -> None:
    for s in SIZES:
        subprocess.run(["rsvg-convert", "-w", str(s), "-h", str(s),
                        "-o", str(OUT / f"color-{s}.png"), str(SRC_SVG)], check=True)
    print(f"✓ 麒麟彩色托盘 {SIZES} → {OUT.relative_to(ROOT.parent.parent)}")


if __name__ == "__main__":
    main()
