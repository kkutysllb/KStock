#!/usr/bin/env bash
set -euo pipefail

bash scripts/check-ci.sh
bash scripts/build-sidecar.sh
bash scripts/build-desktop.sh
