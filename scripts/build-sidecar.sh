#!/usr/bin/env bash
set -euo pipefail

mkdir -p dist
staging_dir="$(mktemp -d)"
trap 'rm -rf "$staging_dir"' EXIT

cp -R sidecar/src/kstock_sidecar "$staging_dir/kstock_sidecar"
cp -R vendor/qilin/qilin "$staging_dir/qilin"

python -m zipapp "$staging_dir" -m kstock_sidecar.__main__:main -o dist/kstock-sidecar.pyz
