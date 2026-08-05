#!/usr/bin/env bash
set -euo pipefail

# 测试已随「内置 gateway 架构」迁移到根目录 tests/（uv 管理，见 pyproject.toml）
uv run pytest tests -q
python scripts/verify_skill_pack.py
python scripts/verify_package_resources.py --source-only
pnpm -C apps/desktop test
pnpm -C apps/desktop exec tsc -p tsconfig.json --noEmit
pnpm -C apps/desktop exec tsc -p electron/tsconfig.json --noEmit
