#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Locate uv-managed standalone Python runtimes for release packaging."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def _is_executable(path: Path) -> bool:
    return path.is_file() and os.access(path, os.X_OK)


def find_interpreter_in_uv_dir(uv_dir: Path, version: str = "3.12") -> Path | None:
    """Return a Python executable from ``uv python dir``.

    The GitHub ``setup-uv`` action may place installed Python builds under a
    runner/cache-controlled directory, so release packaging must ask uv for its
    Python installation root instead of guessing ``$HOME/.local/share/uv``.
    """
    if not uv_dir.exists():
        return None
    roots = sorted(uv_dir.glob(f"cpython-{version}*"), reverse=True)
    executable_names = (
        f"bin/python{version}",
        "bin/python3",
        "bin/python",
        "python.exe",
        "Scripts/python.exe",
    )
    for root in roots:
        for relative in executable_names:
            candidate = root / relative
            if _is_executable(candidate):
                return candidate
    return None


def uv_python_dir(uv_executable: str = "uv") -> Path:
    output = subprocess.check_output(
        [uv_executable, "python", "dir"],
        text=True,
        stderr=subprocess.DEVNULL,
    ).strip()
    if not output:
        raise RuntimeError("uv python dir returned an empty path")
    return Path(output)


def find_standalone_python(
    version: str = "3.12",
    *,
    uv_executable: str = "uv",
    install_if_missing: bool = False,
) -> Path:
    python_dir = uv_python_dir(uv_executable)
    interpreter = find_interpreter_in_uv_dir(python_dir, version)
    if interpreter is not None:
        return interpreter
    if install_if_missing:
        subprocess.run(
            [uv_executable, "python", "install", version],
            check=True,
            stdout=sys.stderr,
            stderr=sys.stderr,
        )
        python_dir = uv_python_dir(uv_executable)
        interpreter = find_interpreter_in_uv_dir(python_dir, version)
        if interpreter is not None:
            return interpreter
    raise FileNotFoundError(f"未找到 uv standalone Python {version}: {python_dir}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="定位 uv 管理的 standalone Python。")
    parser.add_argument("--version", default="3.12")
    parser.add_argument("--uv", default="uv")
    parser.add_argument("--install-if-missing", action="store_true")
    args = parser.parse_args(argv)
    try:
        print(find_standalone_python(args.version, uv_executable=args.uv, install_if_missing=args.install_if_missing))
    except Exception as exc:
        print(f"!! {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
