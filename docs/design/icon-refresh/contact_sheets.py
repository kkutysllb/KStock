#!/usr/bin/env python3
"""设计看板用的对照图拼版：小尺寸「真实像素 + 放大」与托盘双底色带。

托盘模板图标（纯黑 + alpha）在不同菜单栏底色上的表现必须分别复核，
所以这里把 16px 真实像素贴在浅色 (#ececec) 与深色 (#1c1c1e) 两条菜单栏带上，
右边再给 8x 最近邻放大，用来看笔画是否糊/相融。

用法：python3 docs/design/icon-refresh/contact_sheets.py
"""

from __future__ import annotations

import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent
PNG = ROOT / "png"
NAMES = ["a-monoline", "b-candle", "c-field", "d-horizon"]
LABELS = ["A 一笔K", "B 蜡烛K", "C 实色场K", "D 数据地平线"]

BAR_LIGHT = (236, 236, 236, 255)
BAR_DARK = (28, 28, 30, 255)


def nearest(img: Image.Image, factor: int) -> Image.Image:
    return img.resize((img.width * factor, img.height * factor), Image.NEAREST)


def app_small_sheet() -> None:
    """app 图标 32px 真实像素 + 4x 放大。"""
    cols = len(NAMES)
    cell_w, cell_h = 168, 200
    sheet = Image.new("RGBA", (cols * cell_w + 20, cell_h + 20), (255, 255, 255, 255))
    for i, name in enumerate(NAMES):
        im32 = Image.open(PNG / f"{name}-32.png").convert("RGBA")
        zoom = nearest(im32, 4)
        x = 20 + i * cell_w
        sheet.alpha_composite(im32, (x + 8, 30))
        sheet.alpha_composite(zoom, (x + 52, 6))
    sheet.save(ROOT / "sheet-app-32.png")


def tray_sheet() -> None:
    """托盘 16px 真实像素 × 浅/深菜单栏 + 8x 放大。"""
    row_h = 56
    cell_w = 200
    sheet = Image.new(
        "RGBA", (len(NAMES) * cell_w + 20, row_h * 2 + 30), (255, 255, 255, 255)
    )
    for r, bar in enumerate([BAR_LIGHT, BAR_DARK]):
        y = 10 + r * row_h
        sheet.paste(bar, (10, y, 10 + len(NAMES) * cell_w, y + row_h - 6))
        for i, name in enumerate(NAMES):
            im16 = Image.open(PNG / f"{name}-tray-16.png").convert("RGBA")
            if bar == BAR_DARK:
                # 深色菜单栏上模板图标会被系统反白；预览里同样反白以还原真实观感
                px = im16.load()
                for yy in range(im16.height):
                    for xx in range(im16.width):
                        rr, gg, bb, aa = px[xx, yy]
                        px[xx, yy] = (255, 255, 255, aa)
            im22 = Image.open(PNG / f"{name}-tray-22.png").convert("RGBA")
            if bar == BAR_DARK:
                px = im22.load()
                for yy in range(im22.height):
                    for xx in range(im22.width):
                        rr, gg, bb, aa = px[xx, yy]
                        px[xx, yy] = (255, 255, 255, aa)
            x = 20 + i * cell_w
            sheet.alpha_composite(im16, (x + 12, y + 8))
            sheet.alpha_composite(im22, (x + 40, y + 5))
            sheet.alpha_composite(nearest(im16, 2), (x + 76, y + 4))
    sheet.save(ROOT / "sheet-tray.png")


def c_tone_sheet() -> None:
    """C 的两种调性：品牌亮绿 vs 深绿保对比（256 + 32 真实 + 白字对比实测）。"""
    sheet = Image.new("RGBA", (2 * 300 + 20, 340), (255, 255, 255, 255))
    for i, name in enumerate(["c-field", "c2-field-deep"]):
        big = Image.open(PNG / f"{name}-256.png").convert("RGBA")
        small = Image.open(PNG / f"{name}-32.png").convert("RGBA")
        x = 10 + i * 300
        sheet.alpha_composite(big, (x + 22, 10))
        sheet.alpha_composite(small, (x + 40, 290))
        sheet.alpha_composite(nearest(small, 3), (x + 90, 282))
    sheet.save(ROOT / "sheet-c-tones.png")


if __name__ == "__main__":
    app_small_sheet()
    tray_sheet()
    c_tone_sheet()
    print("✓ contact sheets")
