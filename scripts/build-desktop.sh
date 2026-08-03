#!/usr/bin/env bash
set -euo pipefail

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    # WiX v3 light.exe 对 KStock 这种 500MB+、大量深层内置 gateway 资源的
    # MSI 非常脆弱，CI 已多次在 light 阶段无有效诊断失败。Windows 发布改
    # 用 NSIS 安装器（.exe）；release.yml/latest.json 已支持 .exe updater。
    pnpm -C apps/desktop exec tauri build --bundles nsis --verbose
    ;;
  Linux)
    # AppImage 依赖 linuxdeploy，GitHub Actions 上对宿主 FUSE/镜像环境较脆；
    # v0.1.1 已确认 deb/rpm 成功、仅 AppImage 失败。Linux 发布保留 deb/rpm，
    # 避免非必需的 AppImage 阻断跨平台发版。
    pnpm -C apps/desktop exec tauri build --bundles deb,rpm --verbose
    ;;
  *)
    pnpm -C apps/desktop tauri:build -- --verbose
    ;;
esac
