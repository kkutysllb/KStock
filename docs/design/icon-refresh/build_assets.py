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
| 16 / 20 / 24 / 32 | Tier 2 加重版（笔画 +17%）；同尺寸亦是麒麟彩印托盘 | `src/c2-field-deep-bold.svg` |
| 托盘（三端彩色） | 上游麒麟彩色印章 | `qilin-tray/color-*.png`（由 `gen_qilin_tray.py` 生成） |

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

# 注意：**不在这里 import PIL**。CI（ubuntu/macos/windows）不装第三方依赖，
# `--check` 必须能在纯标准库下跑通；PIL 只在生成 ICO 与像素级校验时惰性导入。

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parents[2]
SRC = {
    "tier1": ROOT / "zhuan-src" / "db1-zhuan.svg",
    "tier1b": ROOT / "zhuan-src" / "e1-side-zhuan.svg",
    "tier2": ROOT / "src" / "c2-field-deep.svg",
    "tier2bold": ROOT / "src" / "c2-field-deep-bold.svg",
    "tray": ROOT / "qilin-tray",   # 由 gen_qilin_tray.py 生成（color-<size>.png）
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
TRAY_COLOR = [16, 20, 24, 32]                   # 三端统一彩色托盘（macOS 也用彩色，不随深浅色反色）


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


def copy_png(src: pathlib.Path, dest: pathlib.Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dest)


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

    from PIL import Image

    payloads: list[tuple[int, bytes]] = []
    for tier, size in entries:
        buf = io.BytesIO()
        src = (ROOT / "qilin-tray" / f"color-{size}.png") if tier == "trayfile" else render(tier, size)
        Image.open(src).convert("RGBA").save(buf, format="PNG", optimize=True)
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
    write_ico(BUILD / "tray.ico", [("trayfile", s) for s in TRAY_COLOR])
    return f"✓ icon.ico / tray.ico（各 {len(ICO_SIZES)} / {len(TRAY_COLOR)} 档，逐档取形制）"


def build_icons_dir() -> str:
    for name, tier, size in ICONS_DIR:
        write_png(tier, size, ICONS / name)
    # Linux 应用列表用的 icon.png（512）
    write_png("tier1", 512, BUILD / "icon.png")
    return f"✓ icons/ 共 {len(ICONS_DIR)} 档 + icon.png(512)"


def build_tray() -> str:
    for size in TRAY_COLOR:
        copy_png(ROOT / "qilin-tray" / f"color-{size}.png", BUILD / f"tray-{size}.png")
    return f"✓ 麒麟彩印托盘 {TRAY_COLOR}（三端统一彩色）"


def png_size(path: pathlib.Path) -> tuple[int, int]:
    """纯标准库读 PNG 尺寸（IHDR）。"""
    head = path.read_bytes()[:24]
    if head[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path.name} 不是 PNG")
    return struct.unpack(">II", head[16:24])


def ico_sizes(path: pathlib.Path) -> list[int]:
    """纯标准库读 ICO 各档边长（0 表示 256）。"""
    data = path.read_bytes()
    count = struct.unpack("<H", data[4:6])[0]
    sizes = []
    for i in range(count):
        off = 6 + i * 16
        w = data[off] or 256
        sizes.append(w)
    return sizes


def icns_types(path: pathlib.Path) -> list[bytes]:
    """纯标准库遍历 icns 条目类型码。

    iconutil 的布局是「每个条目紧跟自己的数据」（不是开头紧凑 TOC），
    所以必须按结构逐条目走，不能用前缀子串判断。
    """
    data = path.read_bytes()
    total = struct.unpack(">I", data[4:8])[0]
    off, types = 8, []
    while off + 8 <= total:
        types.append(data[off : off + 4])
        off += struct.unpack(">I", data[off + 4 : off + 8])[0]
    return types


def verify_structure() -> list[str]:
    """第一层（纯标准库，CI 必跑）：文件齐全 + 尺寸正确 + 容器档位正确 + 模板图源不变量。"""
    problems: list[str] = []

    # a) 每个应有资产的像素边长
    expected = {name: size for name, _tier, size in ICONS_DIR}
    expected["icon.png"] = 512
    for name, size in expected.items():
        path = (BUILD / "icons" / name) if name.endswith(".png") and name != "icon.png" else BUILD / name
        if not path.exists():
            problems.append(f"缺资产 {path.relative_to(REPO)}")
            continue
        try:
            w, h = png_size(path)
        except ValueError as err:
            problems.append(str(err))
            continue
        if (w, h) != (size, size):
            problems.append(f"{path.name} 尺寸 {w}x{h}（期望 {size}x{size}）")

    # b) 容器档位
    ico = BUILD / "icon.ico"
    if not ico.exists():
        problems.append("缺 icon.ico")
    else:
        got = ico_sizes(ico)
        if got != ICO_SIZES:
            problems.append(f"icon.ico 档位 {got}（期望 {ICO_SIZES}）")

    icns = BUILD / "icon.icns"
    if not icns.exists():
        problems.append("缺 icon.icns")
    else:
        types = icns_types(icns)
        if b"ic10" not in types:
            problems.append(
                f"icon.icns 缺 1024 档（ic10）；实测 {[t.decode('latin1') for t in types]}"
            )

    # c) 麒麟彩印源不变量：源 SVG 必须仍是「彩色印章」——
    #    含朱砂渐变与暖白印文；若被人改成黑白/模板化，托盘三端就不统一了。
    seal_svg = (ROOT / "qilin-tray" / "favicon.svg").read_text(encoding="utf-8")
    if "Gradient" not in seal_svg:
        problems.append("麒麟彩印源 SVG 丢失朱砂渐变（可能被误改成单色）")
    for token in ("#d4503d", "#f3dc9e", "#fff5eb"):
        if token not in seal_svg:
            problems.append(f"麒麟彩印源 SVG 缺品牌色 {token}")
    if seal_svg.count("<path") != 2:
        problems.append(f"麒麟彩印源 SVG 字形数量异常（{seal_svg.count('<path')} 个 path，应为 2：麒/麟）")

    # d) 彩色托盘的像素尺寸
    for size in TRAY_COLOR:
        path = BUILD / f"tray-{size}.png"
        if not path.exists():
            problems.append(f"缺 tray-{size}.png")
        elif png_size(path) != (size, size):
            problems.append(f"tray-{size}.png 尺寸 {png_size(path)}（期望 {size}x{size}）")

    return problems


def verify_pixels() -> tuple[list[str], bool]:
    """第二层（有 Pillow 才跑）：留白一致 + 模板图逐像素纯黑 + 字标分档。

    CI 不装 Pillow，故返回 (问题, 是否执行)；未执行时由调用方打印跳过原因。
    """
    try:
        from PIL import Image
    except ImportError:
        return [], False
    problems: list[str] = []

    def alpha_cover(p: pathlib.Path) -> float:
        im = Image.open(p).convert("RGBA")
        box = im.getchannel("A").getbbox()
        return 0.0 if box is None else (box[2] - box[0]) / im.width

    # 留白一致：squircle 内容区 824/1024 = 80.5%；16px 抗锯齿外扩，故 ≤32px 放宽到 90%
    for name, _tier, size in ICONS_DIR:
        c = alpha_cover(ICONS / name)
        upper = 0.90 if size <= 32 else 0.84
        if not 0.78 <= c <= upper:
            problems.append(f"留白异常 {name}: 内容占比 {c:.1%}（期望 78–{upper:.0%}）")

    # 彩色托盘：必须真的是「彩色」（存在朱砂红系像素），
    # 防止有人误把黑白模板图当彩印发上去（三端统一彩印后这是最容易犯的错）。
    for size in TRAY_COLOR:
        im = Image.open(BUILD / f"tray-{size}.png").convert("RGBA")
        red = sum(1 for r, g, b, a in im.getdata()
                  if a > 200 and r > 120 and r > g + 40 and r > b + 40)
        if red < im.width * im.height * 0.10:
            problems.append(f"tray-{size}.png 朱砂红像素占比过低（{red} 个）——疑似误用了黑白图")

    # 字标分档：256 的 Tier 1 字标区必须非空
    im = Image.open(ICONS / "256x256.png").convert("RGBA")
    band = im.crop((int(256 * 0.28), int(256 * 0.80), int(256 * 0.72), int(256 * 0.87)))
    if len(set(band.getdata())) <= 3:
        problems.append("icons/256x256.png 字标区疑似空白（应含品牌绿 KSTOCK）")

    return problems, True


def verify_regeneration() -> tuple[list[str], bool]:
    """第三层（有 rsvg-convert 才跑）：重渲染关键档并与入库产物**逐字节**比对。

    这是唯一能发现「改了设计源但忘了重出资产」的检查；CI 无 rsvg 时自动跳过。
    """
    if shutil.which("rsvg-convert") is None:
        return [], False
    problems: list[str] = []
    tmp = STAGE / "regen"
    tmp.mkdir(parents=True, exist_ok=True)
    for name, tier, size in ICONS_DIR:
        out = tmp / name
        subprocess.run(
            ["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(out), str(SRC[tier])],
            check=True,
        )
        if out.read_bytes() != (ICONS / name).read_bytes():
            problems.append(f"{name} 与设计源重渲染结果不一致（设计源改了但资产没重出）")
    return problems, True


def verify() -> list[str]:
    problems = verify_structure()

    pixel_problems, pixel_ran = verify_pixels()
    problems += pixel_problems
    if not pixel_ran:
        print("· 跳过像素级校验（未安装 Pillow；CI 环境属正常）")

    regen_problems, regen_ran = verify_regeneration()
    problems += regen_problems
    if not regen_ran:
        print("· 跳过重生成漂移校验（未安装 rsvg-convert）")
    return problems


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只校验已有资产")
    args = ap.parse_args()

    if not args.check:
        try:
            import PIL  # noqa: F401
        except ImportError:
            print("✗ 生成资产需要 Pillow：scripts/python.sh -m pip install pillow")
            return 1
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
    print("\n验证通过：资产齐全且尺寸正确 / icns 含 1024 / ico 7 档 / 麒麟彩印托盘就位 / 字标分档正确")
    if STAGE.exists():
        shutil.rmtree(STAGE)
    return 0


if __name__ == "__main__":
    sys.exit(main())
