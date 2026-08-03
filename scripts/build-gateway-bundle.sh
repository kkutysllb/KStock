#!/usr/bin/env bash
# 构建自包含 gateway 分发目录（PyInstaller onedir）。
#
# 产物: dist/kstock-gateway/（可执行文件 + 全部 Python 依赖 + 技能包 + 配置模板）
# 该目录作为 Tauri 桌面端的内置后端随安装包分发（见 tauri.conf.json bundle.resources）。
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> PyInstaller 构建 gateway（dist/kstock-gateway/）"
uv run pyinstaller scripts/kstock-gateway.spec --noconfirm --clean

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
    STANDALONE_GLOB=("$HOME"/.local/share/uv/python/cpython-3.12*/bin/python3)
    RUNTIME_PY="$PYTHON_RUNTIME/bin/python3"
    LIB_REL="lib/libpython3.12.dylib"
    LIB_DST="$PYTHON_RUNTIME/lib/"
    ;;
  Linux)
    STANDALONE_GLOB=("$HOME"/.local/share/uv/python/cpython-3.12*/bin/python3)
    RUNTIME_PY="$PYTHON_RUNTIME/bin/python3"
    LIB_REL="lib/libpython3.12.so"
    LIB_DST="$PYTHON_RUNTIME/lib/"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    # Windows 上 uv 的 standalone 安装目录是 %LOCALAPPDATA%\uv\python
    PY_HOME="${LOCALAPPDATA:-$HOME/AppData/Local}/uv/python"
    STANDALONE_GLOB=("$PY_HOME"/cpython-3.12*/python.exe)
    RUNTIME_PY="$PYTHON_RUNTIME/python.exe"
    LIB_REL="python312.dll"
    LIB_DST="$PYTHON_RUNTIME/"
    ;;
  *)
    echo "!! 不支持平台: $(uname -s)" >&2
    exit 1
    ;;
esac

# 优先复用本机已有的 uv standalone Python；CI 首次构建时不存在，自动下载。
STANDALONE_PY=""
for cand in "${STANDALONE_GLOB[@]}"; do
    [ -x "$cand" ] && STANDALONE_PY="$cand"
done
if [ -z "$STANDALONE_PY" ]; then
    echo "==> 未找到 uv standalone Python 3.12，自动下载（uv python install 3.12）…"
    uv python install 3.12
    for cand in "${STANDALONE_GLOB[@]}"; do
        [ -x "$cand" ] && STANDALONE_PY="$cand"
    done
fi
if [ -z "$STANDALONE_PY" ]; then
    echo "!! 自动下载后仍未找到 standalone Python 3.12" >&2
    exit 1
fi
STANDALONE_ROOT="$(cd "$(dirname "$(dirname "$STANDALONE_PY")")" && pwd)"
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
    "$PYTHON_RUNTIME"/python.exe "$PYTHON_RUNTIME"/Scripts/python.exe
cp "$STANDALONE_ROOT/bin/python3.12" "$PYTHON_RUNTIME/bin/python3" 2>/dev/null \
    || cp "$STANDALONE_ROOT/python.exe" "$PYTHON_RUNTIME/python.exe"
mkdir -p "$(dirname "$LIB_DST")"
cp "$STANDALONE_ROOT/$LIB_REL" "$LIB_DST"
# Windows 解释器运行时还依赖 vcruntime140.dll（与 python.exe 同目录查找）
if [ -f "$STANDALONE_ROOT/vcruntime140.dll" ]; then
    cp "$STANDALONE_ROOT/vcruntime140.dll" "$PYTHON_RUNTIME/"
fi
# 裁剪不需要的组件（减小体积）
rm -rf "$PYTHON_RUNTIME"/bin/2to3* "$PYTHON_RUNTIME"/bin/idle3* "$PYTHON_RUNTIME"/bin/pydoc3* \
    "$PYTHON_RUNTIME"/Scripts/2to3* "$PYTHON_RUNTIME"/Scripts/idle3* "$PYTHON_RUNTIME"/Scripts/pydoc3* \
    "$PYTHON_RUNTIME"/lib/python3.12/{idlelib,test,tkinter,turtledemo,ensurepip,lib2to3} 2>/dev/null || true
# 技能依赖（kk_common 数据客户端 + 第三方库）
uv pip install --python "$RUNTIME_PY" pandas tushare python-dotenv akshare
uv pip install --python "$RUNTIME_PY" vendor/skills/public/common
"$RUNTIME_PY" -c "import kk_common, pandas, tushare, akshare, dotenv; print('  python-runtime OK')"
du -sh "$PYTHON_RUNTIME"

echo "==> 产物大小:"
du -sh dist/kstock-gateway
ls -lh dist/kstock-gateway/kstock-gateway*
