#!/usr/bin/env bash
set -euo pipefail

pnpm -C apps/desktop tauri:build
