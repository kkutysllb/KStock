# KStock

KStock 是一个跨平台桌面端 A 股量化研究智能体，构建在 **QiLin 3.x 引擎**的
「一切皆插件」平台之上：品牌、公共页、量化四库（策略/因子/选股/报告）、
量化工作台 UI 全部是引擎插件，桌面端只是一个轻量 Electron 壳。

## 架构（2.0）

```
Electron 壳（进程托管 / token 引导 / 托盘 / 更新器）
└─ 引擎 kstock profile（单进程，loopback:18001）
   ├─ 上游 base + web-app（对话工作区 UI 基础）
   ├─ @kstock/web        bundle：KStock 人格 / 账户门 / 公共页 / 技能目录
   ├─ @kstock/quant      宿主：/kstock-api 四库存储 + 客户端：量化工作台面板
   ├─ @kstock/client-brand  品牌：KStock 色板 / 背景 / 标记 / 中文本地化
   └─ 技能目录           vendor/skills（31 精选技能 + 自研 html-report）
```

- 四库数据兼容 1.x：`~/.kstock/product/kstock.db` 与 `~/.kstock/reports/` 原样沿用
- 报告归档入口：`POST /kstock-api/reports`（agent 显式入库，见 html-report 技能）

## 快速开始（开发）

前置：Node ≥ 22.5（含 node:sqlite）、pnpm、Python 3（仅脚本用）。

```bash
pnpm install                          # 根工作区（Electron 壳）
bash scripts/build-engine-bundle.sh   # 构建引擎分发束（首次约 3-10 分钟）
pnpm dev:desktop                      # 启动桌面端（壳自动拉起引擎并注入 token）
```

浏览器直连引擎（无 Electron）：

```bash
cd vendor/qilin
KSTOCK_APP_DATA_DIR=~/.kstock QILIN_HOME=~/.kstock/qilin-home \
KSTOCK_PRESETS_DIR=$PWD/../../kstock/presets \
node --import tsx/esm apps/cli/src/bin.ts --profile kstock --port 18001
```

## 常用命令

```bash
bash scripts/check-ci.sh              # CI 门禁（插件构建 + 类型检查 + 契约校验）
bash scripts/check-release.sh         # 发布链路（引擎束 + 桌面打包）
python3 scripts/sync_upstreams.py     # 上游同步（QiLin / KSkills）
```

## 文档

- [运行说明](docs/运行说明.md)
- [首次运行](docs/首次运行.md)
- [配置说明](docs/配置说明.md)
- [2.0 特性差异与迁移说明](docs/2.0-特性差异与迁移说明.md)
- [上游同步](docs/上游同步.md)
- [发布说明](docs/发布说明.md)
- 历史文档：[docs/archive](docs/archive)
