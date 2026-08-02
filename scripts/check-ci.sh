#!/usr/bin/env bash
set -euo pipefail

# 测试已随「内置 gateway 架构」迁移到根目录 tests/（uv 管理，见 pyproject.toml）
uv run pytest tests -q
python scripts/verify_skill_pack.py
pnpm -C apps/desktop test
pnpm -C apps/desktop exec tsc -p tsconfig.json --noEmit
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
