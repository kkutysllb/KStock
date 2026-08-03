#!/usr/bin/env bash
set -euo pipefail

# 测试已随「内置 gateway 架构」迁移到根目录 tests/（uv 管理，见 pyproject.toml）
uv run pytest tests -q
python scripts/verify_skill_pack.py
pnpm -C apps/desktop test
pnpm -C apps/desktop exec tsc -p tsconfig.json --noEmit
# cargo check 会执行 tauri 的 build.rs，而 build.rs 构建时校验
# resources（dist/kstock-gateway）必须存在。CI 干净环境没有该产物，
# 此时跳过检查——Rust 完整编译由发布链路的 tauri build（build-desktop.sh）负责。
if [ -d dist/kstock-gateway ]; then
    cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
else
    echo "（跳过 cargo check：dist/kstock-gateway 不存在，Rust 编译由 tauri build 负责）"
fi
