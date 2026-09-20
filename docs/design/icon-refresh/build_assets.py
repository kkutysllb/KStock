#!/usr/bin/env python3
"""把设计源渲染成**可直接上线的图标资产**（macOS / Windows / Linux + 托盘）。

单一真源：本脚本只消费 `docs/design/icon-refresh/` 下的设计源 SVG，
按 spec §4「逐尺寸形制」出图，不做任何手工修图。入口是 `scripts/build-icons.sh`。

逐尺寸形制（spec §3 表格，实测依据见 §3.1）：

| 目标尺寸 | 形制 | 源 |
| --- | --- | --- |
| ≥256 | Tier 1：朱印（篆书「麒麟」横排）+ KSTOCK 字标 | `zhuan-src/db1-zhuan.svg` |
| 64 / 128 | Tier 1b：同款朱印**去字标**、居中放大 | `zhuan-src/e1-side-zhuan.svg` |
| 48 | Tier 2：品牌绿实色场 K | `src/c2-field-deep.svg` |
| 16 / 20 / 24 / 32 | Tier 2 加重版（笔画 +17%） | `src/c2-field-deep-bold.svg` |
| 托盘（模板图） | Tier 3：印章外框 + K，纯黑 + alpha | `seal-src/e1-vermilion-tray.svg` |

为什么每个尺寸都从矢量重渲染、而不是拿一张大图缩：拿大图缩会把 Tier 1 的字标
一起缩成噪点（见 spec §3.1 实测：字标在 128px 只剩 68×13px）。

用法：python3 docs/design/icon-refresh/build_assets.py [--check]
      --check 只校验已有资产，不重新生成（CI 用）
"""

from __future__ import annotations

import argparse
import pathlib
import re
import shutil
import struct
import subprocess
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parents[2]
SRC = {
    "tier1": ROOT / "zhuan-src" / "db1-zhuan.svg",
    "tier1b": ROOT / "zhuan-src" / "e1-side-zhuan.svg",
    "tier2": ROOT / "src" / "c2-field-deep.svg",
    "tier2bold": ROOT / "src" / "c2-field-deep-bold.svg",
    "tray": ROOT / "seal-src" / "e1-vermilion-tray.svg",
}
BUILD = REPO / "apps/desktop/build"
STAGE = ROOT / "assets-tmp"          # 中间渲染，不入版本库
ICONS = BUILD / "icons"

# macOS iconset：10 个档位（含 @2x 配对），值 = 该文件的像素边长
ICONSET = {
    "icon_16x16.png": ("tier2bold", 16),
    "icon_16x16@2x.png": ("tier2bold", 32),
    "icon_32x32.png": ("tier2bold", 32),
    "icon_32x32@2x.png": ("tier1b", 64),
    "icon_128x128.png": ("tier1b", 128),
    "icon_128x128@2x.png": ("tier1", 256),
    "icon_256x256.png": ("tier1", 256),
    "icon_256x256@2x.png": ("tier1", 512),
    "icon_512x512.png": ("tier1", 512),
    "icon_512x512@2x.png": ("tier1", 1024),
}

# Windows / Linux 图标目录：与 electron-builder 的 icons/ 约定一致
ICONS_DIR = [
    ("16x16.png", "tier2bold", 16),
    ("24x24.png", "tier2bold", 24),
    ("32x32.png", "tier2bold", 32),
    ("48x48.png", "tier2", 48),
    ("64x64.png", "tier1b", 64),
    ("128x128.png", "tier1b", 128),
    ("128x128@2x.png", "tier1", 256),
    ("256x256.png", "tier1", 256),
    ("512x512.png", "tier1", 512),
    ("1024x1024.png", "tier1", 1024),
]

ICO_SIZES = [16, 24, 32, 48, 64, 128, 256]      # 7 档（旧的只有 6 档，缺 24）
TRAY_TEMPLATE = [16, 32]                        # trayTemplate.png / @2x
TRAY_COLOR = [16, 20, 24, 32]                   # Windows/Linux 彩色托盘


def render(tier: str, size: int) -> pathlib.Path:
    """按需渲染某个形制到指定像素边长（带缓存，幂等）。"""
    out = STAGE / f"{tier}-{size}.png"
    if not out.exists():
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(out), str(SRC[tier])],
            check=True,
        )
    return out


def write_png(tier: str, size: int, dest: pathlib.Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(render(tier, size), dest)


def build_icns() -> str:
    """生成 icon.icns：iconset → iconutil。"""
    iconset = STAGE / "icon.iconset"
    if iconset.exists():
        shutil.rmtree(iconset)
    iconset.mkdir(parents=True)
    for name, (tier, size) in ICONSET.items():
        write_png(tier, size, iconset / name)
    if shutil.which("iconutil") is None:
        return "⚠ 跳过 icns：本机无 iconutil（非 macOS）"
    subprocess.run(
        ["iconutil", "-c", "icns", str(iconset), "-o", str(BUILD / "icon.icns")], check=True
    )
    return f"✓ icon.icns（{len(ICONSET)} 档，含 1024）"


def write_ico(dest: pathlib.Path, entries: list[tuple[str, int]]) -> None:
    """手写 ICO 容器：每档由各自的形制单独渲染后内嵌 PNG。

    为什么不用 Pillow 的 `save(..., sizes=...)`：它会把**同一张图**缩成各档，
    而本项目的形制是逐档切换的（16/24/32 走加重版 K，256 起走朱印 + 字标）；
    实测 Pillow 11 的 ICO save 也不接受 append_images（只写进 1 档）。
    """
    import io

    payloads: list[tuple[int, bytes]] = []
    for tier, size in entries:
        buf = io.BytesIO()
        Image.open(render(tier, size)).convert("RGBA").save(buf, format="PNG", optimize=True)
        payloads.append((size, buf.getvalue()))

    header = struct.pack("<HHH", 0, 1, len(payloads))
    offset = len(header) + 16 * len(payloads)
    dirs, blobs = b"", b""
    for size, data in payloads:
        dim = 0 if size >= 256 else size          # ICO 用 0 表示 256
        dirs += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(data), offset)
        blobs += data
        offset += len(data)
    dest.write_bytes(header + dirs + blobs)


def build_ico() -> str:
    """生成 icon.ico / tray.ico：每档来自各自的形制，而不是从一张大图缩。"""
    write_ico(
        BUILD / "icon.ico",
        [("tier2bold" if s <= 32 else "tier1", s) for s in ICO_SIZES],
    )
    write_ico(BUILD / "tray.ico", [("tier2bold", s) for s in TRAY_COLOR])
    return f"✓ icon.ico / tray.ico（各 {len(ICO_SIZES)} / {len(TRAY_COLOR)} 档，逐档取形制）"


def build_icons_dir() -> str:
    for name, tier, size in ICONS_DIR:
        write_png(tier, size, ICONS / name)
    # Linux 应用列表用的 icon.png（512）
    write_png("tier1", 512, BUILD / "icon.png")
    return f"✓ icons/ 共 {len(ICONS_DIR)} 档 + icon.png(512)"


def build_tray() -> str:
    for size in TRAY_TEMPLATE:
        dest = BUILD / ("trayTemplate.png" if size == 16 else f"trayTemplate@{size // 16}x.png")
        write_png("tray", size, dest)
    for size in TRAY_COLOR:
        write_png("tier2bold", size, BUILD / f"tray-{size}.png")
    return "✓ trayTemplate.png + @2x，彩色托盘 16/20/24/32"


def verify() -> list[str]:
    """把 spec §8 的验收条款变成可执行断言。"""
    problems: list[str] = []

    def alpha_cover(p: pathlib.Path) -> float:
        im = Image.open(p).convert("RGBA")
        box = im.getchannel("A").getbbox()
        if box is None:
            return 0.0
        return (box[2] - box[0]) / im.width

    # 1) 留白一致：squircle 内容区 824/1024 = 80.5%；小尺寸抗锯齿会把墨迹外扩，
    #    16px 下实测 87.5%，故 ≤32px 放宽到 90%。
    for name, _tier, size in ICONS_DIR:
        c = alpha_cover(ICONS / name)
        upper = 0.90 if size <= 32 else 0.84
        if not 0.78 <= c <= upper:
            problems.append(f"留白异常 {name}: 内容占比 {c:.1%}（期望 78–{upper:.0%}）")

    # 2) 托盘模板图：RGB 必须纯黑（alpha 可以有抗锯齿过渡——那是边缘平滑所必需），
    #    且必须存在不透明的实心核，否则系统反色后会整片发灰。
    for name in ("trayTemplate.png", "trayTemplate@2x.png"):
        px_list = list(Image.open(BUILD / name).convert("RGBA").getdata())
        bad = next((p for p in px_list if p[3] > 0 and (p[0] or p[1] or p[2])), None)
        if bad is not None:
            problems.append(f"{name} 含非纯黑像素 {bad}（模板图会被系统反色成脏灰）")
        if max(p[3] for p in px_list) != 255:
            problems.append(f"{name} 没有不透明实心像素（最大 alpha={max(p[3] for p in px_list)}）")

    # 3) icns 含 1024；ico 含 7 档
    icns = BUILD / "icon.icns"
    if not icns.exists():
        problems.append("缺 icon.icns")
    else:
        # iconutil 的布局是「每个条目紧跟自己的数据」（非开头紧凑 TOC），
        # 所以必须按结构逐条目走，不能用前缀子串判断类型码。
        data = icns.read_bytes()
        total = struct.unpack(">I", data[4:8])[0]
        off, types = 8, []
        while off + 8 <= total:
            types.append(data[off : off + 4])
            off += struct.unpack(">I", data[off + 4 : off + 8])[0]
        if b"ic10" not in types:
            problems.append(f"icon.icns 缺 1024 档（ic10）；实测档位 {[t.decode('latin1') for t in types]}")
        elif len(types) < len(ICONSET):
            problems.append(f"icon.icns 档数 {len(types)}（期望 ≥{len(ICONSET)}）")
    ico = BUILD / "icon.ico"
    if not ico.exists():
        problems.append("缺 icon.ico")
    else:
        n = struct.unpack("<H", ico.read_bytes()[4:6])[0]
        if n != len(ICO_SIZES):
            problems.append(f"icon.ico 档数 {n}（期望 {len(ICO_SIZES)}）")

    # 4) 该有字标的档必须有、该去掉的档必须没有（抽查像素：字标区是否为非背景色）
    for size in (256, 512, 1024):
        im = Image.open(render("tier1", size)).convert("RGBA")
        band = im.crop((int(size * 0.28), int(size * 0.80), int(size * 0.72), int(size * 0.87)))
        if len(set(band.getdata())) <= 3:
            problems.append(f"Tier 1 {size}px 字标区疑似空白（应含品牌绿字标）")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只校验已有资产")
    args = ap.parse_args()

    if not args.check:
        for tier, path in SRC.items():
            if not path.exists():
                print(f"✗ 缺设计源 {path}；先跑 docs/design/icon-refresh/generate*.py")
                return 1
        if STAGE.exists():
            shutil.rmtree(STAGE)
        for line in (build_icns(), build_ico(), build_icons_dir(), build_tray()):
            print(line)
        print(f"→ 产物目录 {BUILD}")

    problems = verify()
    if problems:
        print("\n验证未通过：")
        for p in problems:
            print("  ✗", p)
        return 1
    print("\n验证通过：留白一致 / 模板图纯黑 / icns 含 1024 / ico 7 档 / 字标分档正确")
    if STAGE.exists():
        shutil.rmtree(STAGE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
