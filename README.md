# KStock

KStock 是一个跨平台桌面端股票量化智能体，核心引擎使用 QiLin，技能体系只保留适合研究 / 分析 / 报告的精选技能。

## 现状

- 桌面端：Electron + React
- 后端：内置 QiLin gateway（Python / FastAPI，由 Electron 主进程托管）
- 技能：本地精选副本 + 同步脚本
- CI：跨平台检查与发布脚本已建立

## 快速开始

```bash
pnpm install                          # 前端依赖
uv venv && uv sync                    # Python 运行时（editable 安装 vendor/qilin）
bash scripts/build-gateway-bundle.sh  # 构建开发用 gateway（首次或修改 Python 后）
pnpm dev:desktop                      # 启动 Electron 桌面端（主进程自动托管 gateway）
```

## 常用命令

```bash
uv run pytest tests -q
pnpm -C apps/desktop test
pnpm -C apps/desktop exec playwright test
bash scripts/check-ci.sh
bash scripts/check-release.sh
./build-release.sh v0.1.0   # 一键发布（校验 → 构建 → 打 tag → 推送触发 CI）
```

## 文档

- [运行说明](docs/运行说明.md)
- [首次运行](docs/首次运行.md)
- [配置说明](docs/配置说明.md)
- [故障排查](docs/故障排查.md)
- [上游同步](docs/上游同步.md)
- [发布说明](docs/发布说明.md)
