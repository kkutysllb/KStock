#!/usr/bin/env python3
"""方向 E「麒麟印章」的对照拼版：256 大图、32px 真实像素、托盘实测（含反例）。"""

from __future__ import annotations

import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent
PNG = ROOT / "seal-png"
APP3 = ["e1-vermilion", "e2-ink-stamp", "e3-green"]
BAR_LIGHT = (236, 236, 236, 255)
BAR_DARK = (28, 28, 30, 255)


def nearest(img: Image.Image, factor: int) -> Image.Image:
    return img.resize((img.width * factor, img.height * factor), Image.NEAREST)


def invert(img: Image.Image) -> Image.Image:
    out = img.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            px[x, y] = (255, 255, 255, px[x, y][3])
    return out


def sheet_256() -> None:
    sheet = Image.new("RGBA", (3 * 286 + 10, 300), (255, 255, 255, 255))
    for i, name in enumerate(APP3):
        sheet.alpha_composite(Image.open(PNG / f"{name}-256.png").convert("RGBA"), (10 + i * 286, 22))
    sheet.save(ROOT / "sheet-seal-256.png")


def sheet_32() -> None:
    """三执行 + 两个小尺寸专用形，32px 真实像素与 4× 放大。"""
    names = APP3 + ["small-vermilion", "small-green"]
    cell = 176
    sheet = Image.new("RGBA", (len(names) * cell + 20, 190), (255, 255, 255, 255))
    for i, name in enumerate(names):
        im32 = Image.open(PNG / f"{name}-32.png").convert("RGBA")
        x = 20 + i * cell
        sheet.alpha_composite(im32, (x + 6, 70))
        sheet.alpha_composite(nearest(im32, 4), (x + 50, 10))
    sheet.save(ROOT / "sheet-seal-32.png")


def sheet_tray() -> None:
    """托盘实测：印章外框 + K（方案）与单字「麟」（反例证据）。"""
    items = [("印章框 + K", "e1-vermilion-tray"), ("印章框 + K", "e2-ink-stamp-tray"),
             ("印章框 + K", "e3-green-tray"), ("反例：单字「麟」", "evidence-tray-lin")]
    row_h, cell = 56, 200
    sheet = Image.new("RGBA", (len(items) * cell + 20, row_h * 2 + 30), (255, 255, 255, 255))
    for r, bar in enumerate([BAR_LIGHT, BAR_DARK]):
        y = 10 + r * row_h
        sheet.paste(bar, (10, y, 10 + len(items) * cell, y + row_h - 6))
        for i, (_label, name) in enumerate(items):
            im16 = Image.open(PNG / f"{name}-16.png").convert("RGBA")
            im22 = Image.open(PNG / f"{name}-22.png").convert("RGBA")
            if bar == BAR_DARK:
                im16, im22 = invert(im16), invert(im22)
            x = 20 + i * cell
            sheet.alpha_composite(im16, (x + 12, y + 8))
            sheet.alpha_composite(im22, (x + 40, y + 5))
            sheet.alpha_composite(nearest(im16, 2), (x + 76, y + 4))
    sheet.save(ROOT / "sheet-seal-tray.png")


if __name__ == "__main__":
    sheet_256()
    sheet_32()
    sheet_tray()
    print("✓ seal sheets")
