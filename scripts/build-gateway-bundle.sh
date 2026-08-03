#!/usr/bin/env bash
# 构建自包含 gateway 分发目录（PyInstaller onedir）。
#
# 产物: dist/kstock-gateway/（可执行文件 + 全部 Python 依赖 + 技能包 + 配置模板）
# 该目录作为 Tauri 桌面端的内置后端随安装包分发（见 tauri.conf.json bundle.resources）。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> PyInstaller 构建 gateway（dist/kstock-gateway/）"
uv run pyinstaller scripts/kstock-gateway.spec --noconfirm --clean
# speech_recognition 的 flac-mac 是上游 wheel 自带的旧 macOS SDK 可执行文件，
# PyInstaller 会提示它可能破坏 code-signing / hardened runtime。KStock
# gateway 不使用本地语音转码能力，发布包中移除该可选二进制，避免 Apple
# notarization 在预签后继续因老 SDK 二进制失败。
rm -f dist/kstock-gateway/_internal/speech_recognition/flac-mac 2>/dev/null || true

# ── 内置 Python 运行时（agent 技能脚本开箱即用）──────────────────────
# 打包版 agent 通过 bash 执行技能脚本（python3 xxx.py），系统 Python 没有
# kk_common/pandas/tushare 等依赖；PyInstaller 产物只有 bootloader，不能当
# 解释器用。因此额外携带 uv 管理的 python-build-standalone（可移植、前缀
# 可移动）作为内置解释器，随包分发到 _internal/python-runtime/，gateway
# 启动时（frozen）把它接入 PATH（见 run_gateway._setup_bundled_python_env）。
PYTHON_RUNTIME="dist/kstock-gateway/_internal/python-runtime"

# 平台差异：解释器实体路径 / 动态库名 / venv 布局（uv venv 在 Windows 无 bin/）
case "$(uname -s)" in
  Darwin)
    RUNTIME_PY="$PYTHON_RUNTIME/bin/python3"
    LIB_RELS=("lib/libpython3.12.dylib")
    LIB_DST="$PYTHON_RUNTIME/lib/"
    ;;
  Linux)
    RUNTIME_PY="$PYTHON_RUNTIME/bin/python3"
    LIB_RELS=("lib/libpython3.12.so" "lib/libpython3.12.so.1.0")
    LIB_DST="$PYTHON_RUNTIME/lib/"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    # Windows venv 的标准解释器位置是 Scripts/python.exe。不能把
    # standalone python.exe 放到 venv 根目录，否则解释器会把 prefix 识别到
    # _internal 上一级，导致依赖被装进/导入自 _internal/Lib/site-packages。
    RUNTIME_PY="$PYTHON_RUNTIME/Scripts/python.exe"
    LIB_RELS=("python312.dll")
    LIB_DST="$PYTHON_RUNTIME/Scripts/"
    ;;
  *)
    echo "!! 不支持平台: $(uname -s)" >&2
    exit 1
    ;;
esac

# 定位 uv standalone Python 3.12 解释器。
# CI 上 setup-uv 可能把安装目录放到 runner 临时/cache 位置，必须以
# ``uv python dir`` 为权威来源，不能猜 ``$HOME/.local/share/uv``。
STANDALONE_PY="$(uv run python scripts/kstock_python_runtime.py --version 3.12 --install-if-missing)"
if command -v cygpath >/dev/null 2>&1; then
    STANDALONE_PY="$(cygpath -u "$STANDALONE_PY" 2>/dev/null || echo "$STANDALONE_PY")"
fi
if [ -z "$STANDALONE_PY" ]; then
    echo "!! 未找到 uv standalone Python 3.12" >&2
    exit 1
fi
case "$STANDALONE_PY" in
  */bin/python*|*/Scripts/python.exe)
    STANDALONE_ROOT="$(cd "$(dirname "$(dirname "$STANDALONE_PY")")" && pwd)"
    ;;
  *)
    STANDALONE_ROOT="$(cd "$(dirname "$STANDALONE_PY")" && pwd)"
    ;;
esac
echo "==> 内置 Python 运行时: $STANDALONE_PY"
rm -rf "$PYTHON_RUNTIME"
# --relocatable: 创建可移动的 venv（解释器按相对路径定位），随包分发后
# 在任意路径可运行，不依赖构建机绝对路径。
uv venv --python "$STANDALONE_PY" --relocatable "$PYTHON_RUNTIME"
# venv 的解释器是指向构建机 standalone 的绝对路径符号链接/拷贝，且 venv 内
# 没有解释器动态库（按 @executable_path/../lib 或同目录规则加载），直接随包
# 分发会在目标机器报 ``tried .../libpython3.12.dylib (no such file)``。
# 这里把解释器实体与动态库复制进 venv，使运行时完全自包含。
rm -f "$PYTHON_RUNTIME"/bin/python "$PYTHON_RUNTIME"/bin/python3 "$PYTHON_RUNTIME"/bin/python3.12 \
    "$PYTHON_RUNTIME"/python.exe "$PYTHON_RUNTIME"/Scripts/python.exe "$PYTHON_RUNTIME"/Scripts/python3.exe
mkdir -p "$(dirname "$RUNTIME_PY")" "$LIB_DST"
cp "$STANDALONE_PY" "$RUNTIME_PY"
LIB_COPIED=0
for LIB_REL in "${LIB_RELS[@]}"; do
    if [ -f "$STANDALONE_ROOT/$LIB_REL" ]; then
        cp "$STANDALONE_ROOT/$LIB_REL" "$LIB_DST"
        LIB_COPIED=1
        break
    fi
done
if [ "$LIB_COPIED" -ne 1 ]; then
    echo "!! standalone Python 动态库缺失: ${LIB_RELS[*]} under $STANDALONE_ROOT" >&2
    exit 1
fi
# Windows bash 技能通常写 ``python3 xxx.py``，随 venv 一起提供 python3.exe
# 别名，避免目标机器依赖系统 PATH。
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    cp "$RUNTIME_PY" "$PYTHON_RUNTIME/Scripts/python3.exe"
    # curl_cffi/_wrapper.pyd 依赖 python3.dll（不是 python312.dll）。
    # uv standalone Python 根目录同时提供 python312.dll + python3.dll，
    # 两者都必须随 venv 分发到解释器同目录。
    if [ -f "$STANDALONE_ROOT/python3.dll" ]; then
        cp "$STANDALONE_ROOT/python3.dll" "$PYTHON_RUNTIME/Scripts/"
    else
        echo "!! standalone Python 缺失 python3.dll: $STANDALONE_ROOT" >&2
        exit 1
    fi
    ;;
esac
# Windows 解释器运行时还依赖 vcruntime140.dll（与 python.exe 同目录查找）
if [ -f "$STANDALONE_ROOT/vcruntime140.dll" ]; then
    cp "$STANDALONE_ROOT/vcruntime140.dll" "$LIB_DST"
fi
# 裁剪不需要的组件（减小体积）
rm -rf "$PYTHON_RUNTIME"/bin/2to3* "$PYTHON_RUNTIME"/bin/idle3* "$PYTHON_RUNTIME"/bin/pydoc3* \
    "$PYTHON_RUNTIME"/Scripts/2to3* "$PYTHON_RUNTIME"/Scripts/idle3* "$PYTHON_RUNTIME"/Scripts/pydoc3* \
    "$PYTHON_RUNTIME"/lib/python3.12/{idlelib,test,tkinter,turtledemo,ensurepip,lib2to3} 2>/dev/null || true
# 技能依赖（kk_common 数据客户端 + 第三方库）
uv pip install --python "$RUNTIME_PY" pandas tushare python-dotenv akshare
uv pip install --python "$RUNTIME_PY" vendor/skills/public/common

# Windows wheels（如 curl_cffi/numpy/pandas）会把二进制 DLL 放在
# site-packages/*.libs。PyInstaller 主程序分析阶段能识别这些目录，但这里
# 额外创建的 python-runtime 是独立解释器，导入 akshare -> curl_cffi 时也
# 必须把这些 DLL 目录加入 PATH。
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    RUNTIME_SITE_PACKAGES="$("$RUNTIME_PY" -c "import site; print(next(p for p in site.getsitepackages() if p.endswith('site-packages')))")"
    RUNTIME_SITE_PACKAGES_POSIX="$RUNTIME_SITE_PACKAGES"
    if command -v cygpath >/dev/null 2>&1; then
        RUNTIME_SITE_PACKAGES_POSIX="$(cygpath -u "$RUNTIME_SITE_PACKAGES")"
    fi
    cat > "$RUNTIME_SITE_PACKAGES_POSIX/sitecustomize.py" <<'PY'
"""KStock bundled Windows runtime DLL search path bootstrap.

Windows wheels such as curl_cffi, numpy and pandas keep dependent DLLs in
site-packages/*.libs.  Register these directories before any user script imports
those packages, so every bundled python/python3 process works out of the box.
"""

from __future__ import annotations

import os
from pathlib import Path

_KSTOCK_DLL_DIRECTORY_HANDLES = []

if os.name == "nt":
    site_packages = Path(__file__).resolve().parent
    for dll_dir in sorted(site_packages.glob("*.libs")):
        if not dll_dir.is_dir():
            continue
        dll_dir_text = str(dll_dir)
        os.environ["PATH"] = dll_dir_text + os.pathsep + os.environ.get("PATH", "")
        add_dll_directory = getattr(os, "add_dll_directory", None)
        if add_dll_directory is not None:
            _KSTOCK_DLL_DIRECTORY_HANDLES.append(add_dll_directory(dll_dir_text))
PY
    DLL_DIR_COUNT=0
    while IFS= read -r DLL_DIR; do
        PATH="$DLL_DIR:$PATH"
        DLL_DIR_COUNT=$((DLL_DIR_COUNT + 1))
    done < <(find "$RUNTIME_SITE_PACKAGES_POSIX" -maxdepth 1 -type d -name "*.libs" 2>/dev/null)
    export PATH
    echo "  Windows runtime DLL dirs: $DLL_DIR_COUNT under $RUNTIME_SITE_PACKAGES"
    ;;
esac
"$RUNTIME_PY" -c "import kk_common, pandas, tushare, akshare, dotenv; print('  python-runtime OK')"
du -sh "$PYTHON_RUNTIME"

python scripts/verify_package_resources.py

# Tauri 只会签外层 .app 和 Rust 主程序，不会递归签 resources/gateway 里
# PyInstaller 收集的 Mach-O 二进制。Apple notarization 会逐个检查这些
# 嵌套二进制，必须在 tauri build 之前用 Developer ID + secure timestamp +
# hardened runtime 预签整个 gateway 分发目录。
case "$(uname -s)" in
  Darwin)
    if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
        echo "==> 签名 macOS gateway 内嵌二进制（Developer ID + timestamp + hardened runtime）"
        SIGN_LIST="$(mktemp)"
        find dist/kstock-gateway -type f -print0 |
          while IFS= read -r -d '' CANDIDATE; do
              if file "$CANDIDATE" | grep -q "Mach-O"; then
                  printf '%s\n' "$CANDIDATE"
              fi
          done |
          awk '{ print length, $0 }' |
          sort -rn |
          cut -d' ' -f2- > "$SIGN_LIST"
        SIGN_COUNT=0
        while IFS= read -r MACHO; do
            codesign --force --timestamp --options runtime --sign "$APPLE_SIGNING_IDENTITY" "$MACHO"
            SIGN_COUNT=$((SIGN_COUNT + 1))
        done < "$SIGN_LIST"
        rm -f "$SIGN_LIST"
        # PyInstaller 在 GitHub macOS runner 上会额外收集 Framework Python：
        #   _internal/Python
        #   _internal/Python.framework/Python
        # notarization 会按这些路径逐个校验。find -type f 不会覆盖符号链接路径；
        # 先显式签顶层 Python 入口，再签整个 framework，避免后续重签内部 binary
        # 破坏 framework seal。
        if [ -e "dist/kstock-gateway/_internal/Python" ]; then
            codesign --force --timestamp --options runtime --sign "$APPLE_SIGNING_IDENTITY" \
                "dist/kstock-gateway/_internal/Python"
        fi
        if [ -d "dist/kstock-gateway/_internal/Python.framework" ]; then
            codesign --force --timestamp --options runtime --sign "$APPLE_SIGNING_IDENTITY" \
                "dist/kstock-gateway/_internal/Python.framework"
        fi
        if [ -e "dist/kstock-gateway/_internal/Python" ]; then
            codesign --verify --strict --verbose=2 "dist/kstock-gateway/_internal/Python"
        fi
        if [ -e "dist/kstock-gateway/_internal/Python.framework/Python" ]; then
            codesign --verify --strict --verbose=2 "dist/kstock-gateway/_internal/Python.framework/Python"
        fi
        codesign --verify --deep --strict --verbose=2 dist/kstock-gateway/kstock-gateway
        echo "  signed Mach-O files: $SIGN_COUNT"
    else
        echo "（跳过 macOS gateway 预签：APPLE_SIGNING_IDENTITY 未设置，本地/未签名构建）"
    fi
    ;;
esac

echo "==> 产物大小:"
du -sh dist/kstock-gateway
ls -lh dist/kstock-gateway/kstock-gateway*
