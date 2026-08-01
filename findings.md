# KStock 项目分析发现

## 需求
- 全面分析当前项目功能。
- 认真读完核心引擎源码，深入理解已完成能力和真实实现状态。
- 本轮先建立共同认知，不进行业务改造。

## 研究发现
- 仓库是 pnpm + Python/uv + Tauri 的混合 monorepo：桌面 UI 在 `apps/desktop`，Rust Tauri 壳在 `apps/desktop/src-tauri`，Python gateway/配置/测试在根目录 `scripts`、`tests`，上游运行时在 `vendor/qilin`。
- `vendor/skills/public` 是随仓库 vendored 的金融能力包，包含股票分析、公告/新闻/研报、财务报表、行业和宏观查询等技能；其中 `kk-stock-analysis/chan_theory_v2` 含独立的缠论引擎，但当前项目的“核心引擎”仍需结合 Qilin 调度链确认。
- 最近提交主要围绕桌面端设置、技能/工具、运行时配置、历史任务和附件体验；这表明当前产品已从基础聊天壳扩展到可配置的金融研究工作台。
- 根目录已存在 `.venv`、`apps/desktop/node_modules`、`apps/desktop/dist` 和测试产物；后续可做本地静态检查和测试，但需区分构建产物与源码。
- 初步入口线索：`scripts/run_gateway.py`、`scripts/kstock_gateway_control.py`、`apps/desktop/src-tauri/src/gateway.rs`、`apps/desktop/src/App.tsx`，以及 `vendor/qilin` 的 Python 应用代码。
- QiLin 官方架构文档把请求生命周期定义为：用户输入 → Input Polish → Lead Agent Loop →（可选 SubAgent）→ Tool Call → Sandbox → 安全结束原因检查 → Guardrails → Stream Bridge → Checkpoint → Run Events；这是一条需要在源码中逐段验证的主链。
- 引擎的关键横切能力是中间件式的：循环检测、读前写、工具进度、token 预算、记忆注入、技能激活、上传处理、护栏和工具错误处理等会围绕 Agent 图组合，而不是散落在 UI。
- 文档与当前仓库存在一个需要核对的漂移：README 仍引用 `sidecar` 目录和 `sidecar/tests`，但实际源码与测试位于根目录 `scripts`、`tests`，Python 包通过根 `pyproject.toml` editable 安装 `vendor/qilin`。
- Qilin 配置面非常宽（模型、工具、技能、MCP、沙箱、数据库、记忆、子代理、调度、guardrails、上传等）；KStock 的 `config/qilin.config.yaml` 和运行时配置脚本决定实际启用子集，不能把 `config.example.yaml` 的所有能力当成已上线功能。
- 桌面聊天链已端到端接入真实 Gateway：首次发送创建 thread；请求 context 注入 `model_name`、thinking 和可选 reasoning effort；SSE reducer 处理正文、reasoning、工具结果、usage、values 快照、error/gap 以及子代理 custom events；停止操作同时 abort 流与调用 run cancel API。
- 历史任务不再是本地假数据：登录后搜索后端 threads，切换时懒加载 run-event 消息并转换为前端 turn；删除 thread 同步清理后端用户数据空间。前端本地 session 仍是展示态，后端 thread/checkpoint/run events 是持久真源。
- Lead Agent 模型解析优先级为“请求指定 → 自定义 agent 配置 → 全局首模型”，不支持 thinking 时自动降级；运行根节点统一挂 tracing callback，避免模型层重复 span。
- Agent 工具在装配时依次经过：配置加载/分组 → 技能搜索附加 → memory tools 附加 → authorization 过滤 → deferred tool search 拆分；这意味着某个工具写在源码中并不代表模型可见。
- 技能采用渐进式激活：基础 prompt 只给启用技能的元数据；显式 `/skill-name` 或实际读取技能文件后，`SkillToolPolicyMiddleware` 才限制到技能声明的 allowed-tools；压缩前由 DurableContext 记录已加载技能与已完成委派，避免摘要后丢失。
- Agent 工厂对 checkpoint channel mode 采取 fail-closed：持久化场景不允许未经 mode marker/兼容门的 delta schema，进程首次冻结 full/delta 模式后客户端不能热切换，以防状态静默损坏。
- QiLin 记忆是可插拔 `MemoryManager` 合约：核心要求 `add` / `get_context`，可选 search、事实 CRUD、导入导出、shutdown flush；按 `(agent_name, user_id)` 分桶。工具模式要求后端实现 search，middleware 模式由 `MemoryMiddleware` 被动写入。KStock 模板当前 `memory.enabled=false`，因此功能代码存在但默认未启用。
- 上传系统把文件放到用户/thread 虚拟路径，middleware 将上传元数据注入状态并由 sandbox 工具解析；设置层支持 max files、单文件/总大小和 `auto_convert_documents`，文档格式默认转换 Markdown，前端发送消息时把上传引用放进 `additional_kwargs.files`。
- Gateway 认证是本地用户数据库 + bcrypt 密码 + JWT HttpOnly cookie；CSRF double-submit、same-site cookie、密码强度/常见密码拒绝、每 IP 失败 5 次锁定 5 分钟。首个管理员只能走 `/initialize`，普通 `/register` 固定 user 角色。
- QiLin 的持久运行面以 `RunManager`、checkpoint/store、RunJournal/RunEventStore、Memory/Redis StreamBridge 组成；默认无 stream_bridge 配置时使用进程内 memory bridge，跨 worker 需 Redis + Postgres 配置。SQLite 多 worker 被显式拒绝。
- 缠论 `ChanEngine` 标准入口：最少 10 条 K 线；形态阶段调用 `KlineProcessor`→`BiBuilder`（至少 2 分型）→`SegBuilder`（至少 3 笔）→`ZhongShuBuilder`（至少 3 段），标准级再做 MACD 背驰与买卖点，完整级增加趋势/风险/置信度/建议与增强信号。
- 缠论实现的完成度需要谨慎表述：`analyze(..., ADVANCED)` 的多级别递归在代码中明确 `pass`；真正多级别需调用 `analyze_multi_level`，它对每级做 COMPLETE、再做跨级买卖点/一致性。`chan_enhanced.generate_signal_library` 有大量 `pass` 占位；gap 方向/成笔等部分注释标注为简化，因此不能把“完整缠论”当成已验证生产策略。
- KStock 的 5 个预置子代理角色（market-data-analyst、stock-researcher、chan-theory-analyst、backtest-executor、report-writer）已写入模板；但角色能否真正工作依赖 runtime.yaml 增量同步、工具注册（当前 9 个）和技能目录必须是 QiLin 认可的 `public/*`。

## 技术决策
| 决策 | 理由 |
|------|------|
| 结论必须关联源码、测试或运行结果 | 区分实际完成能力与命名、注释或界面暗示 |

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|

## 资源
- 项目根目录：`/Users/libing/kk_Projects/KStock`

## 视觉/浏览器发现
- 尚未进行界面验证。

## 产品端实际启用边界
- 设置页不是静态 mock：模型、运行时配置、数据库、沙箱、护栏、工具搜索、子代理、上传、技能和 MCP 均通过 KStock 自有 API 读写；写入前由对应配置模型校验，密钥类值转存到 `secrets.env`，部分字段明确需要重启后端。
- 报告的真实交付形态是 Markdown：Agent 写入 thread 的 `outputs` 目录并通过 `present_files` 交付；PDF/DOCX 在 UI 中明确是灰显规划项。右侧预览依赖前端会话的 `reportMarkdown`，当前代码没有从历史产物自动恢复该字段。
- 账户页展示本地账户、角色和模型密钥环境变量名，不回显密钥；OIDC/SSO 未实现。模型配置和默认模型端到端可用，发送时将选中模型和思考参数放进 run context。
- 记忆页有读取、重载、导入/导出和事实增删能力，但模板 `memory.enabled=false`；安装后的默认运行不会注入或持久化记忆，需用户主动开启并配置后端。
- 子代理设置页允许调整全局参数并查看五个预置角色，但没有 `custom_agents` CRUD；启动时模板角色覆盖同名用户定义，其他用户自定义角色保留。
- 技能页实际发现 `vendor/skills/public` 的 12 个技能并可持久化启停；技能默认启用，显式关闭才写扩展配置。
- 模板打开本地沙箱 host bash，缠论和回测脚本因此可由代理执行；模板没有 scheduler/channels 配置，KStock UI/API 也没有对应入口。QiLin 的这些底层模块不能算当前产品已启用功能。

## 缠论 smoke test
- 使用 120 条确定性合成日线调用 `ChanEngine.analyze`：BASIC 返回形态结果；STANDARD 增加动力学阶段；COMPLETE 返回趋势、强度、风险、置信度、建议和增强信号；ADVANCED 返回动力学结果但 `multi_level_results` 仍为空，符合源码中的空实现分支。
- `analyze_multi_level` 对 daily/weekly 两级均执行 COMPLETE，并返回各级结果、一致性 consensus 和综合摘要。合成数据使用自然日而非交易日，因此出现时间间隔警告，但结果正常生成。
- 准确表述应是“单级别主链可运行 + 独立多级别入口可运行 + 部分增强信号仍为占位”，不是所有高级递归和信号库均已完成。

## 运行时边界与残余风险
- 首次启动把 SQLite、运行事件和技能根目录写入用户数据空间；后续启动保留用户设置，仅增量同步模板工具和预置角色。模板升级会覆盖同名产品角色。
- 后端 thread、checkpoint、run events 和输出交付记录是真源，前端 session 主要是视图缓存。内存 StreamBridge 适合单进程；多 worker 需要 Redis + Postgres，SQLite 多 worker 被拒绝。
- 当前 `langgraph` 比 QiLin delta-history patch 的验证版本高一个小版本；测试通过，但仍是兼容性观察项。
- 根 README、故障排查和 CI 脚本仍有旧 `sidecar`/`sidecar/tests` 引用，与实际根 `tests`、`scripts` 和 `vendor/qilin` 运行方式漂移。

---
*源码阅读过程中持续更新。*
