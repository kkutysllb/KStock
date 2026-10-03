#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# 全仓库 pre-push 门（发版前置）——对齐 KCoder scripts/release.sh prepush 口径：
# 审计（三门 + 两报告）→ 引擎契约 → 打包资源契约 → CI 全量车道（插件构建 /
# 类型检查 / 单测 / 技能包 / 图标资产）。
#
# 与 KCoder 的对应关系：
#   cmd_audit      → node scripts/audit.mjs
#   cmd_patchgate  → scripts/verify_package_resources.py（插件清单 / bundle patch /
#                    技能接线；本仓没有「插件热补丁链」形态，对应面就是打包资源契约）
#   cmd_bundleline → 引擎契约的「产品提交数 == 7，集成分支无裸提交」断言
#                    （scripts/verify_engine_contract.py）
#   cmd_prepush 末端 → bash scripts/check-ci.sh
#
# 用法：bash scripts/prepush.sh
#   build-release.sh 的 run_checks 调用的就是本脚本（发版前的唯一入口）。

log() { printf '\033[1;34m[prepush]\033[0m %s\n' "$*"; }

# 0) 引擎克隆就绪（可弃克隆：--prune 之后发布前需重新引导）。
#    缺克隆时只做「克隆 + 契约校验」，不装依赖不构建（那是发布链/CI 的事）。
if [ ! -d vendor/qilin/.git ]; then
  log "引擎克隆缺失（vendor/qilin），先引导"
  bash scripts/engine-bootstrap.sh
fi

# 1) 全仓库审计：TYPECHECK / LINT / SECURITY 三门 + DEAD EXPORTS / UNUSED DEPS 两报告。
log "全仓库审计（scripts/audit.mjs）"
node scripts/audit.mjs

# 2) 引擎契约：HEAD == lock.commit、分支、基线祖先、产品提交数 7、7 处补丁标记、工作树干净。
log "引擎契约（13 项断言）"
bash scripts/engine-bootstrap.sh --check-only

# 3) 打包资源契约（源形态）：插件清单 / bundle patch / 技能接线 / 壳模块 / 无遗留模块。
log "打包资源契约（源形态）"
scripts/python.sh scripts/verify_package_resources.py --source-only

# 4) CI 全量车道。
log "CI 全量车道（插件构建 + 类型检查 + 单测 + 技能包 + 图标资产）"
bash scripts/check-ci.sh

log "pre-push 门通过"
