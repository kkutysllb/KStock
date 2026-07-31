#!/usr/bin/env bash
set -euo pipefail

mkdir -p dist
python -m zipapp sidecar/src -m kstock_sidecar.__main__:main -o dist/kstock-sidecar.pyz
