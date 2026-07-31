#!/usr/bin/env bash
set -euo pipefail

python -m pytest sidecar/tests -q
python scripts/verify_skill_pack.py
pnpm -C apps/desktop test
pnpm -C apps/desktop exec tsc -p tsconfig.json --noEmit
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
