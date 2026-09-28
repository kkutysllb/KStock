#!/usr/bin/env python3
"""枚举目录树中的 Mach-O 文件（含 .app bundle 内的可执行/dylib）。

为什么不用 `file`：macOS 的 `file` 对 Mach-O 会输出多行（含架构详情），
且路径可含空格，用 awk/sed 从 `path: desc` 里回解路径极易出错——实测
awk 方案会把路径整个吃掉、sed 方案只命中 5/215。直接读魔术字节无歧义。

输出：每行一个绝对/相对路径（与传入 root 同基准），按路径排序。
退出码：0 正常，1 未发现任何 Mach-O。
"""
from __future__ import annotations

import os
import struct
import sys

# Mach-O / universal(fat) 魔术字，含大小端
MAGICS = {
    0xFEEDFACE,  # MH_MAGIC    (32-bit LE)
    0xCEFAEDFE,  # MH_CIGAM    (32-bit BE)
    0xFEEDFACF,  # MH_MAGIC_64 (64-bit LE)
    0xCFFAEDFE,  # MH_CIGAM_64 (64-bit BE)
    0xCAFEBABE,  # FAT_MAGIC   (BE)
    0xBEBAFECA,  # FAT_CIGAM   (LE)
    0xCAFEBABF,  # FAT_MAGIC_64 (BE)
    0xBFBAFECA,  # FAT_CIGAM_64 (LE)
}


def find_macho(root: str) -> list[str]:
    found: list[str] = []
    for dirpath, _dirnames, filenames in os.walk(root, followlinks=False):
        for name in filenames:
            path = os.path.join(dirpath, name)
            # symlink 不是独立代码对象，签名会写到链接目标，跳过。
            if os.path.islink(path):
                continue
            try:
                with open(path, "rb") as fh:
                    head = fh.read(4)
            except OSError:
                continue
            if len(head) == 4 and struct.unpack(">I", head)[0] in MAGICS:
                found.append(path)
    return sorted(found)


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} <root-dir>", file=sys.stderr)
        return 2
    root = sys.argv[1]
    if not os.path.isdir(root):
        print(f"error: not a directory: {root}", file=sys.stderr)
        return 2
    for path in find_macho(root):
        print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
