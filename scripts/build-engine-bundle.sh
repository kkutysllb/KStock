#!/usr/bin/env bash
# 构建引擎分发束（2.0：QiLin 3.x 单文件引擎 + KStock 插件包 + 技能目录）。
#
# 产物: dist-exe/
#   kstock-engine(.exe)        引擎单文件可执行（含 Node 24 运行时与全部依赖，
#                              上游 build-exe-for-python-sdk 产物改名）
#   kstock-engine-*-rg 等       引擎伴随二进制（ripgrep / spawn-helper）
#   plugins/{web,quant,client-brand}/   KStock 插件包（lib 产物 + 清单）
#   presets/                   KStock agent preset 目录（kstock/presets 原样拷贝，
#                              含随行技能目录 kstock-investor/skills/）
#
# 该目录整体作为 Electron 桌面端的内置引擎随安装包分发
# （见 apps/desktop/electron-builder.yml extraResources → resources/engine），
# 其中 kstock-engine 与 plugins 亦作为 dev 态的直接产物（壳优先使用）。
set -euo pipefail
cd "$(dirname "$0")/.."

REPO_ROOT="$(pwd)"
ENGINE_REPO="$REPO_ROOT/vendor/qilin"
OUT_DIR="$REPO_ROOT/dist-exe"
SKIP_EXE_BUILD=0
FORCE_EXE_BUILD=0
[ "${1:-}" = "--skip-exe-build" ] && SKIP_EXE_BUILD=1
[ "${1:-}" = "--force-exe-build" ] && FORCE_EXE_BUILD=1

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) TARGET="macos-arm64" ;;
  Darwin-x86_64) TARGET="macos-x64" ;;
  Linux-x86_64) TARGET="linux-x64" ;;
  Linux-aarch64) TARGET="linux-arm64" ;;
  MINGW*|MSYS*) TARGET="win-x64" ;;
  *) echo "!! 不支持平台: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac
UPSTREAM_EXE_BASE="deepseek-harness-sdk-runtime-$TARGET"

# ── 1. KStock 插件包构建（宿主 + 四库界面 + 品牌 + 账户）──────────────
echo "==> 构建 KStock 插件包"
for pkg in accounts client-brand presets-ui datasources-ui web quant quant-strategies quant-factors quant-selections quant-reports; do
  # 前置：kstock/* 已并入根 workspace，一次根 pnpm install 全装。缺
  # node_modules 时 npx 静默失败 + set -e 无声中止（Windows 实机踩坑：
  # 脚本死在本步零报错，dev 侧只见「lib 未构建」无从定位），显式拦截。
  if [ ! -d "$REPO_ROOT/kstock/$pkg/node_modules" ]; then
    echo "!! kstock/$pkg 缺 node_modules——请先在仓库根执行 pnpm install" >&2
    exit 1
  fi
  log="$(mktemp)"
  if ! (cd "$REPO_ROOT/kstock/$pkg" && npx tsdown > "$log" 2>&1); then
    echo "!! kstock/$pkg 构建失败（tsdown 尾部输出）：" >&2
    tail -20 "$log" >&2
    rm -f "$log"
    exit 1
  fi
  rm -f "$log"
done

# ── 2. 引擎单文件（缺失或 --force-exe-build 时才构建，约数分钟）─────
if [ "$SKIP_EXE_BUILD" -ne 1 ] && { [ "$FORCE_EXE_BUILD" -eq 1 ] || [ ! -f "$ENGINE_REPO/dist-exe/$UPSTREAM_EXE_BASE" ]; }; then
  echo "==> 构建引擎单文件（上游 '"$UPSTREAM_EXE_BASE"'，首次约 3-10 分钟）"
  (cd "$ENGINE_REPO" && "$REPO_ROOT/scripts/qilin-pnpm.sh" exec tsx scripts/build-exe-for-python-sdk.ts --skip-build)
fi

# ── 3. 技能补丁 + preset 随行技能目录发布（幂等）────────────────────
# 上游同步后本地修复重放 + 各角色 preset 的 skills/ 子集镜像（生成物不入库，
# 任何环境构建时重建）。python 经解析器调用（Windows Store 桩问题）。
"$REPO_ROOT/scripts/python.sh" "$REPO_ROOT/scripts/patch_vendor_skills.py"

# ── 4. 组装 dist-exe/ ───────────────────────────────────────────────
echo "==> 组装 $OUT_DIR"
mkdir -p "$OUT_DIR/plugins" "$OUT_DIR/skills"

# 引擎可执行 + 伴随二进制，统一改名为 kstock-engine*（壳按此名解析）。
rm -f "$OUT_DIR"/kstock-engine*
for suffix_file in "$ENGINE_REPO/dist-exe/$UPSTREAM_EXE_BASE" "$ENGINE_REPO/dist-exe/$UPSTREAM_EXE_BASE"-*; do
  [ -e "$suffix_file" ] || continue
  base="$(basename "$suffix_file")"
  suffix="${base#"$UPSTREAM_EXE_BASE"}"
  cp "$suffix_file" "$OUT_DIR/kstock-engine""$suffix"
  chmod +x "$OUT_DIR/kstock-engine""$suffix"
done
[ -f "$OUT_DIR/kstock-engine" ] || { echo "!! 引擎可执行缺失：$ENGINE_REPO/dist-exe/$UPSTREAM_EXE_BASE" >&2; exit 1; }

# KStock 插件包：清单 + lib 产物 + 静态资源（不含 node_modules / ts 源配置）。
rm -rf "$OUT_DIR/plugins"
mkdir -p "$OUT_DIR/plugins"
for pkg in accounts client-brand presets-ui datasources-ui web quant quant-strategies quant-factors quant-selections quant-reports; do
  target="$OUT_DIR/plugins/$pkg"
  mkdir -p "$target"
  cp "$REPO_ROOT/kstock/$pkg/package.json" "$target/"
  cp -R "$REPO_ROOT/kstock/$pkg/lib" "$target/lib"
  if [ -d "$REPO_ROOT/kstock/$pkg/public" ]; then
    cp -R "$REPO_ROOT/kstock/$pkg/public" "$target/public"
  fi
done

# agent preset 目录原样拷贝（preset.yml + agent.cordis.yml + 随行技能目录
# skills/；引擎经 KSTOCK_PRESETS_DIR 挂载为 @qilin/agent-presets 的 system
# root，技能随 preset 走，无独立技能目录）。
rm -rf "$OUT_DIR/skills"  # 旧版独立技能目录残留清理
rm -rf "$OUT_DIR/presets"
mkdir -p "$OUT_DIR/presets"
if [ -d "$REPO_ROOT/kstock/presets" ]; then
  (cd "$REPO_ROOT/kstock/presets" && tar cf - .) | (cd "$OUT_DIR/presets" && tar xf -)
fi

# ── 5. macOS 预签（公证前置条件）────────────────────────────────────
# electron-builder 不会递归签 extraResources；引擎 Mach-O 不预签会导致
# Apple 公证 HARDFAIL。与旧 gateway 流程同策略：Developer ID + timestamp
# + hardened runtime（identity 由 CI 的 APPLE_SIGNING_IDENTITY 注入）。
case "$(uname -s)" in
  Darwin)
    if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
      echo "==> 签名 macOS 引擎二进制（Developer ID + timestamp + hardened runtime）"
      for MACHO in "$OUT_DIR"/kstock-engine*; do
        codesign --force --timestamp --options runtime --sign "$APPLE_SIGNING_IDENTITY" "$MACHO"
      done
      codesign --verify --strict "$OUT_DIR/kstock-engine"
      echo "  signed: kstock-engine{,-rg,-spawn-helper}"
    else
      echo "（跳过 macOS 引擎预签：APPLE_SIGNING_IDENTITY 未设置，本地/未签名构建）"
    fi
    ;;
esac

echo "==> 完成：$(du -sh "$OUT_DIR" | cut -f1)  $OUT_DIR"
ls -la "$OUT_DIR" | grep kstock-engine
