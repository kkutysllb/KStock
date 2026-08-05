#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把方形满版的 KStock 图标裁剪为 macOS 圆角矩形（squircle）。

原 ``src-tauri/icons`` 迁出的图标是 128×128 等方形满版（四角也是墨绿色
背景，alpha=255），在 macOS Dock 中显示为方块。此脚本只做外形裁剪：
  - 保留原图所有像素内容（K 字母、渐变、趋势线等完全不变）
  - 把 macOS squircle 圆角矩形（半径比 22.37%）外部的像素 alpha 置 0
  - 4× 超采样 mask + LANCZOS 缩小，保证圆角边缘平滑无锯齿

处理后覆盖：
  - build/icons/{32x32, 128x128, 128x128@2x}.png
  - build/icon.icns（iconutil 重新打包）
  - build/icon.ico（Pillow 多分辨率重写）
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

# macOS squircle 圆角比例（Apple Human Interface Guidelines）。
RADIUS_RATIO = 0.2237
# 透明边距比例：squircle 整体内缩占画布边长的比例，扩大透明区域。
# 原图内容贴近画布边缘，直接套 squircle 后边缘中段仍顶满；加 padding
# 让图标四周都留出透明呼吸空间（对齐 macOS 视觉规范）。
PADDING_RATIO = 0.10
# 超采样倍数（让圆角 mask 边缘在缩小时平滑无锯齿）。
SUPERSAMPLE = 4


def squircle_mask(size: int) -> Image.Image:
    """生成指定尺寸的 squircle（圆角矩形）alpha mask。

    mask 内部为 255（保留原图），外部为 0（变透明）。squircle 整体内缩
    ``PADDING_RATIO`` 比例，让图标四周留出更大的透明区域。
    """
    canvas = size * SUPERSAMPLE
    mask = Image.new("L", (canvas, canvas), 0)
    radius = int(canvas * RADIUS_RATIO)
    # 内缩 padding：画布边长 × PADDING_RATIO
    pad = int(canvas * PADDING_RATIO)
    ImageDraw.Draw(mask).rounded_rectangle(
        [(pad, pad), (canvas - 1 - pad, canvas - 1 - pad)],
        radius=radius,
        fill=255,
    )
    return mask.resize((size, size), Image.LANCZOS)


def apply_squircle(src: Image.Image) -> Image.Image:
    """给方形满版图标叠加 squircle alpha mask（原图像素内容不变）。"""
    if src.mode != "RGBA":
        src = src.convert("RGBA")
    size = src.size[0]
    if src.size[0] != src.size[1]:
        raise ValueError(f"图标必须正方形，当前 {src.size}")
    mask = squircle_mask(size)
    # 把 mask 作为 alpha 通道叠加到原图（保留 RGB，只改 alpha）。
    r, g, b, _ = src.split()
    return Image.merge("RGBA", (r, g, b, mask))


# 处理清单：源文件 → 输出文件（同路径覆盖）。
PNG_TARGETS = [
    "icons/32x32.png",
    "icons/128x128.png",
    "icons/128x128@2x.png",
]

# macOS iconset 标准尺寸（用于重建 .icns）。
ICNS_SIZES = {
    "icon_16x16.png": 16,
    "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024,
}

# Windows .ico 多分辨率。
ICO_SIZES = [16, 32, 48, 64, 128, 256]


def main() -> None:
    build_dir = Path(__file__).resolve().parents[1] / "apps" / "desktop" / "build"
    if not build_dir.exists():
        raise SystemExit(f"build 目录不存在：{build_dir}")

    # 1. 裁剪 PNG 图标（保留原图内容，只把 squircle 外部变透明）。
    print("裁剪 PNG 图标（叠加 squircle mask）…")
    for rel in PNG_TARGETS:
        path = build_dir / rel
        if not path.exists():
            print(f"  [skip] {rel}（不存在）")
            continue
        original = Image.open(path)
        # 用最大尺寸原图作为高质量源（避免重复压缩）
        ref = Image.open(build_dir / "icons" / "128x128@2x.png")
        ref_rgba = ref.convert("RGBA") if ref.mode != "RGBA" else ref
        target_size = original.size[0]
        # 若目标小于参考图，缩小参考图后裁剪；否则直接裁剪原图。
        source = ref_rgba.resize((target_size, target_size), Image.LANCZOS) \
            if target_size <= ref_rgba.size[0] else original.convert("RGBA")
        masked = apply_squircle(source)
        masked.save(path, "PNG", optimize=True)
        print(f"  {rel}: {target_size}×{target_size}（squircle mask 已叠加）")

    # 2. 重建 .icns（从最大尺寸参考图生成全套尺寸 + mask）。
    build_icns(build_dir)

    # 3. 重建 .ico。
    build_ico(build_dir)

    print("\n图标外形裁剪完成：原图像素内容保留，squircle 外部已透明。")


def build_icns(build_dir: Path) -> None:
    """用 iconutil 重建 macOS .icns（所有尺寸都套 squircle mask）。"""
    # 用最大尺寸原图（128x128@2x = 256）作为源，放大到 1024 保证 icns 高清。
    ref = Image.open(build_dir / "icons" / "128x128@2x.png")
    if ref.mode != "RGBA":
        ref = ref.convert("RGBA")

    iconset = Path(tempfile.mkdtemp()) / "icon.iconset"
    iconset.mkdir(parents=True)
    try:
        for name, size in ICNS_SIZES.items():
            resized = ref.resize((size, size), Image.LANCZOS)
            masked = apply_squircle(resized)
            masked.save(iconset / name, "PNG", optimize=True)
        out = build_dir / "icon.icns"
        result = subprocess.run(
            ["iconutil", "-c", "icns", str(iconset), "-o", str(out)],
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            print(f"  icon.icns（iconutil 重建成功）")
        else:
            print(f"  [WARN] iconutil 失败: {result.stderr.strip()}")
    finally:
        shutil.rmtree(iconset.parent, ignore_errors=True)


def build_ico(build_dir: Path) -> None:
    """重建 Windows 多分辨率 .ico（每个尺寸都套 squircle mask）。"""
    ref = Image.open(build_dir / "icons" / "128x128@2x.png")
    if ref.mode != "RGBA":
        ref = ref.convert("RGBA")
    out = build_dir / "icon.ico"
    # Pillow ICO 要求 base image + sizes 参数；先准备最大尺寸作为 base。
    largest = max(ICO_SIZES)
    base = apply_squircle(ref.resize((largest, largest), Image.LANCZOS))
    # 把每个尺寸编码进 ICO（Pillow 自动缩放 base image）。
    base.save(out, format="ICO", sizes=[(s, s) for s in ICO_SIZES])
    print(f"  icon.ico（{len(ICO_SIZES)} 个尺寸）")


if __name__ == "__main__":
    main()
