#!/usr/bin/env bash
set -euo pipefail

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    # WiX v3 light.exe 对 KStock 这种 500MB+、大量深层内置 gateway 资源的
    # MSI 非常脆弱，CI 已多次在 light 阶段无有效诊断失败。Windows 发布改
    # 用 NSIS 安装器（.exe）；release.yml/latest.json 已支持 .exe updater。
    pnpm -C apps/desktop exec tauri build --bundles nsis
    ;;
  *)
    pnpm -C apps/desktop tauri:build
    ;;
esac
