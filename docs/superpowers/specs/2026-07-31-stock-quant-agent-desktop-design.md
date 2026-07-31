# 股票量化智能体桌面端设计稿

日期：2026-07-31

## 1. 目标

KStock 重做为一个跨平台桌面端 Stock Quant Agent，体验上接近 Codex：以对话为中心，围绕“提问 -> 调用技能 -> 产出分析 / 报告 -> 继续追问”的工作流完成股票量化任务。

核心约束：

- 桌面端覆盖 macOS / Windows / Linux
- 核心引擎使用本地 QiLin
- 技能体系来自本地 KSkills，但只选适合产品定位的子集
- 本地产品持续跟踪 QiLin / KSkills 的上游更新，但不得反向污染上游仓库
- V1 聚焦研究 / 分析 / 报告，不先做完整交易、策略编排或全量量化平台

## 2. 产品边界

### 2.1 V1 要做

- 对话式股票研究入口
- 单标的和多标的分析
- 财报、估值、行业、公告、新闻、宏观的结构化分析
- 自动生成 Markdown 报告和可视化图表
- 本地历史会话、报告和工作区文件管理

### 2.2 V1 不做

- 真实交易执行
- 全量技能市场
- 全量 coding / dev 技能进入产品运行时
- 复杂策略库默认暴露
- 云端强依赖

## 3. 推荐架构

采用 `Tauri + Web 前端 + Python QiLin sidecar` 的三层结构。

### 3.1 组件分工

- **渲染层**：React + TypeScript 界面，负责聊天、报告视图、技能面板、历史、设置
- **Tauri 主进程**：负责窗口、文件访问、原生菜单、系统托盘、更新、sidecar 进程管理
- **QiLin Sidecar**：本地 Python 服务进程，负责对话编排、工具调用、技能加载、子代理、状态管理

### 3.2 为什么这样拆

- Tauri 保持桌面壳轻量、跨平台、启动快
- QiLin 保持现有引擎能力，不重写 agent runtime
- sidecar 让 Python 引擎和桌面壳解耦，CI 和发布也更清晰
- 上游仓库继续独立演进，KStock 只消费镜像和锁定版本
- 发布态 sidecar 是平台专用可执行产物，不依赖用户本机 Python

### 3.3 运行流

```text
用户输入
  -> React 聊天面板
  -> Tauri 命令层
  -> QiLin sidecar
  -> QiLin 引擎 / 技能加载器 / 工具
  -> 报告产物 + 图表
  -> 界面渲染
```

## 4. 技能策略

KSkills 不整包进入产品运行时，只做精选导入。

### 4.1 默认启用的核心技能包

- `analysis-report`
- `chart-visualization`
- `kk-common`
- `kk-stock-analysis`
- `kk-financial-statement`
- `kk-valuation-model`
- `kk-industry-analysis`
- `kk-news-search`
- `kk-report-search`
- `kk-announcement-search`
- `kk-business-query`
- `kk-macro-query`

### 4.2 先不默认启用

- `kk-factor-research`
- `kk-strategy-research`
- `kk-selection-strategies`
- `backtrader-strategies`
- `kk-options-payoff`
- `kk-options-volatility`
- `kk-market-linkage-engine`
- `kk-hithink-futures`
- 其他偏 coding / media / research 的技能

### 4.3 技能加载规则

- 产品只读取“已批准技能清单”
- 技能入口以 `SKILL.md` 为准
- 运行时只看产品自己的技能清单，不直接扫描整个 KSkills 仓库
- 新技能必须先进入“候选池”，通过前置评审后才进入默认包

## 5. 上游版本跟踪

KStock 维护自己的版本锁定，不改上游仓库。

### 5.1 约定的本地来源

- `/Users/libing/kk_Projects/QiLin`
- `/Users/libing/kk_Projects/KSkills`

### 5.2 版本记录

产品仓库保存一份 `upstream.lock.json` 或等价清单，至少记录：

- 仓库地址
- 目标分支
- 当前 commit hash
- 本次导入的文件列表
- 技能包版本号

### 5.3 同步方式

1. 先更新本地镜像仓库
2. 读取新的 commit hash
3. 比对锁定文件
4. 只同步被批准的 QiLin 接口变化和精选技能
5. 运行校验与冒烟测试
6. 通过后再提交到 KStock

### 5.4 隔离原则

- 不用 submodule 作为运行时依赖
- 不向 QiLin / KSkills 回写任何产品文件
- 所有产品定制只存在于 KStock

## 6. 数据与状态

### 6.1 本地状态

- 会话历史
- 线程状态
- 报告缓存
- 图表导出
- 用户偏好
- 技能启用状态

### 6.2 存储建议

- 配置：本地 JSON / YAML
- 会话和任务元数据：SQLite
- 报告与图表：本地工作区目录
- 临时文件：受控的应用数据目录

## 7. 发布与 CI

### 7.1 构建顺序

1. 构建前端
2. 构建 QiLin sidecar（平台专用可执行产物）
3. 执行 `tauri build`
4. 跑跨平台冒烟测试
5. 产出安装包与发布产物

### 7.2 CI 原则

- macOS / Windows / Linux 分别使用原生 runner
- sidecar 在对应平台先独立构建，再交给 Tauri 打包
- release 与 PR 构建分开
- 签名与 notarization 只在 release 阶段强制

### 7.3 风险控制

Tauri 本身不是最大风险点。真正的风险主要来自：

- sidecar 是否被正确打包
- macOS 签名 / notarization
- Windows 签名证书
- Linux 系统依赖

缓解方式：

- 把 Python sidecar 做成独立构建产物
- 在 CI 中先验证 sidecar 可启动，再执行 Tauri 打包
- release 才启用正式签名

## 8. 界面方向

- 首屏就是聊天工作台，不做营销页
- 左侧：会话、工作区、技能、历史
- 中间：对话
- 右侧：报告、图表、引用数据、技能激活状态
- 输出优先支持 Markdown 和可视化看板
- 界面风格偏专业、克制、密度高，适合长期研究工作

## 9. 验收标准

- 三个平台都能启动
- 能连上本地 QiLin sidecar
- 默认技能包可正常加载
- 研究 / 分析 / 报告任务可闭环
- 上游仓库更新后，KStock 可在不污染上游的情况下同步
- CI 能通过 PR 构建和 release 构建

## 10. 后续演进

V1 稳定后，再逐步加入：

- 策略研究
- 因子研究
- 选股策略
- 期权 / 期货
- 市场联动
- 更完整的技能市场
