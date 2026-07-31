# 发现记录

## 当前仓库

- `KStock` 当前几乎是空仓库。
- 现有跟踪文件只有 `README.md` 和 git 元数据。

## 本地源仓库

- 本地镜像仓库位于 `/Users/libing/kk_Projects/QiLin` 和 `/Users/libing/kk_Projects/KSkills`。
- 两个镜像都在 `main` 分支，并跟踪 `origin/main`。
- 这让 KStock 可以把它们当作源输入，而不是修改源仓库本身。

## QiLin

- 公共仓库：`kkutysllb/QiLin`。
- QiLin 是一个生产级 Python 智能体引擎。
- 它提供嵌入式 API、技能存储、技能安装、按用户隔离的技能空间、运行时技能 CRUD 等能力。
- QiLin 适合被当作产品壳外的本地引擎层。

## KSkills

- 公共仓库：`kkutysllb/KSkills`。
- KSkills 是一个技能包仓库，包含 coding、stock、media、research、common 五类。
- stock 目录里有大量适合量化研究、财报分析、估值、行业、公告、新闻、宏观的技能。
- coding 类技能更适合作为开发工具链，不适合直接进 V1 产品运行时。

## 产品含义

- KStock 的最佳形态是一个薄产品壳，而不是重新实现一套 agent runtime。
- V1 应该只加载精选的 stock + common 技能。
- 上游同步应通过本地镜像和锁定清单完成，避免污染上游。

## 用户数据空间研究

- KStock sidecar 当前通过 `QILIN_HOME` 指向仓库内 `.kstock/qilin`，这只适合开发环境，不适合作为正式桌面包的用户数据目录。
- QiLin 的 `Paths` 已经有成熟的用户隔离目录：`{QILIN_HOME}/users/{user_id}/threads/{thread_id}/user-data/{workspace,uploads,outputs}`。
- QiLin sandbox 会把线程目录映射为 `/mnt/user-data`，所以 KStock 的任务文件、上传文件和报告产物应尽量复用这套目录，不要另建一套孤立 workspace。
- QiLin 的 `database` 配置支持 `memory/sqlite/postgres`，SQLite 模式会把 checkpointer 和应用数据统一放在 `{sqlite_dir}/qilin.db`。
- 当前 KStock 的 `config/qilin.config.yaml` 没显式写 `database`，QiLin 配置文件加载会补 `sqlite + .qilin/data` 默认值，但这个相对路径对桌面正式包不够可控。
- QiLinClient 已支持在 runnable config / context 中携带 `user_id`，KStock sidecar 后续应显式注入稳定的本地用户 ID，避免落到 QiLin 默认用户 `default`。
- KStock sidecar 目前只支持 `health` 方法，下一阶段需要扩展用户空间、线程、运行、上传、输出索引等产品协议。
- Tauri Rust 层当前也只是占位 `sidecar_status`，还没有把系统应用数据目录传入 Python sidecar；正式方案应由桌面宿主确定跨平台 app data 根目录。
- QiLin 的 `ThreadMetaRepository`、`RunRepository`、`DbRunEventStore` 已能记录线程、运行和消息事件，KStock 不应重复实现这套基础运行数据库。
- QiLin repository 的 `AUTO` 用户解析要求 `CurrentUser` ContextVar 已设置；文件路径层在未设置时会落到 `default`。KStock sidecar 入口需要统一设置本地用户上下文，避免数据库与文件路径使用不同用户。
- QiLinClient 的 `stream()` 支持 `user_id` 作为可信 embedded 参数，但上传、artifact、memory、skills 等方法仍大量使用 `get_effective_user_id()`，因此仅在 chat 参数里传 `user_id` 不够。
- QiLin 上传管理已提供安全写入、去重文件名、虚拟路径 `/mnt/user-data/uploads/...` 和 artifact URL 生成逻辑，KStock 上传/报告文件应复用它。
