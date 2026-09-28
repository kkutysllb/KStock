#!/usr/bin/env bash
set -euo pipefail

# 构建 KStock 桌面端发布包（Electron + electron-builder）。
#
# 前置条件：staging 三件套已由 scripts/build-runtime-bundle.sh 构建完成
# （kstock-runtime.tar.gz + plugins + presets），electron-builder 按
# extraResources 把它们打进发布包的 resources/（契约见 docs/开发/发布契约.md §1）。
#
# electron-builder.yml 已按平台指定产物：
#   macOS → dmg + zip
#   Windows → nsis（避免 WiX light.exe 对大包脆弱的问题）
#   Linux → deb + rpm（避免 AppImage linuxdeploy 在 CI 上的 FUSE 依赖）

STAGING_DIR="$(cd "$(dirname "$0")/.." && pwd)/staging"
for required in kstock-runtime.tar.gz plugins presets; do
  if [ ! -e "$STAGING_DIR/$required" ]; then
    echo "ERROR: 闭包产物缺失（${STAGING_DIR}/${required}）" >&2
    echo "请先执行 scripts/build-runtime-bundle.sh 构建运行时闭包。" >&2
    exit 1
  fi
done

cd "$(dirname "$0")/../apps/desktop"

# ── macOS 构建环境调优 ──────────────────────────────────────────────
case "$(uname -s)" in
  Darwin)
    # 1. 文件描述符上限：electron-builder 签名阶段会递归打开 gateway bundle 里
    #    每个文件（PyInstaller 收集的 numpy/pandas 等依赖可达数万文件），
    #    macOS 默认 ulimit -n 256 会触发 EMFILE: too many open files。
    if [ "$(ulimit -n)" -lt 10240 ]; then
      ulimit -n 10240 || echo "WARN: 无法提升 ulimit -n（可能在受限 shell 中）" >&2
    fi
    # 2. 签名 fallback：本地构建（无 CSC_LINK .p12 凭据）时关闭自动签名身份
    #    发现，否则 electron-builder 会尝试用 keychain 里第一个 Developer ID
    #    证书签名，但无对应公证凭据导致构建挂起。CI 上 secrets 注入了 CSC_LINK，
    #    会覆盖此设置启用正式签名。
    if [ -z "${CSC_LINK:-}" ]; then
      export CSC_IDENTITY_AUTO_DISCOVERY=false
      echo "==> macOS 本地构建：CSC_LINK 未设置，跳过代码签名（CSC_IDENTITY_AUTO_DISCOVERY=false）"
    fi
    ;;
esac

# ── electron-builder 构建（macOS 重试 3 次应对 notarize 偶发失败）──────
# Apple notarization 服务偶发 HTTP 500，重试可显著降低发布失败率。
# Linux/Windows 无此问题，单次执行即可。
#
# 本地离线构建：electron-builder.yml 的 publish.provider=github 即便配合
# `--publish never`，在没有 release 产物的机器上仍会去 github.com 拉 release
# 信息（实测 connect ETIMEDOUT 20.205.243.166:443 而 api.github.com 可达），
# 于是三次尝试各等 30s 退避后整体失败。设 KSTOCK_OFFLINE_BUILD=1 即改用
# apps/desktop/electron-builder.local.yml（extends 主配置 + publish: null），
# 完全不触网。CI 不设该变量，仍走主配置 + GitHub 上传。
MAX_ATTEMPTS=1
case "$(uname -s)" in
  Darwin) MAX_ATTEMPTS=3 ;;
esac

BUILD_CONFIG="electron-builder.yml"
if [ "${KSTOCK_OFFLINE_BUILD:-0}" = "1" ]; then
  BUILD_CONFIG="electron-builder.local.yml"
  echo "==> 离线构建模式：使用 $BUILD_CONFIG（publish 已禁用，不触网）"
fi

ATTEMPT=0
until [ $ATTEMPT -ge $MAX_ATTEMPTS ]; do
  ATTEMPT=$((ATTEMPT + 1))
  echo "==> electron-builder 构建（attempt ${ATTEMPT}/${MAX_ATTEMPTS}）"
  # 不用 `pnpm run electron:build -- <args>` 转发参数：pnpm 对含空串参数的
  # 脚本调用有已知转义问题。electron-builder 自身读 ELECTRON_BUILDER_CONFIG
  # （相对 apps/desktop 解析），比 CLI 转发稳。
  if ELECTRON_BUILDER_CONFIG="$BUILD_CONFIG" pnpm run electron:build; then
    echo "==> 桌面端构建成功"
    exit 0
  fi
  if [ $ATTEMPT -lt $MAX_ATTEMPTS ]; then
    echo "WARN: electron-builder 第 $ATTEMPT 次失败，30s 后重试..." >&2
    sleep 30
  fi
done

echo "!! electron-builder 连续 $MAX_ATTEMPTS 次失败" >&2
exit 1
