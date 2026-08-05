# 用户消息编辑与重新发送设计

## 目标

在用户消息气泡下方常驻编辑和复制操作。用户修改历史消息并重新发送时，从该消息处创建真实会话分支，再通过后端原生编辑重跑能力回滚并替换该轮输入，确保界面历史和模型上下文一致。

## 交互设计

- 用户消息气泡下方常驻 `Pencil` 编辑按钮和 `Copy` 复制按钮。
- 图标按钮使用 Lucide 图标，并提供 `title`、`aria-label` 和可见焦点状态。
- 复制成功后，复制图标短暂切换为 `Check`，不显示额外弹窗。
- 点击编辑后，原消息位置就地切换为多行文本框。
- 编辑区提供“取消”和“重新发送”按钮；文本为空时禁用重新发送。
- 正在生成回复时禁用历史消息编辑，避免产生并发分支；没有已完成 assistant 文本回复的用户消息也不可编辑。
- 重新发送成功后切换到新分支，展示编辑点之前的历史、修改后的用户消息和新生成的回复。
- 原任务及其后续回复继续保留在历史任务列表中。

## 会话语义

采用后端真实分支接口 `POST /api/threads/{thread_id}/branches` 和原生编辑重跑准备接口 `POST /api/threads/{thread_id}/runs/edit-regenerate/prepare`。不在原 thread 上只做前端截断，也不通过创建空 thread 后重放文本历史模拟分支。

后端分支接口以已完成 assistant turn 的消息 ID 为锚点。前端从被编辑的用户消息向后定位紧邻的已完成 assistant turn，并提交：

- `message_id`：该 assistant turn 的主引擎消息 ID。
- `message_ids`：该 turn 合并的全部 assistant 引擎消息 ID。
- `title`：可选的新分支标题。

分支 checkpoint 包含目标用户消息和原 assistant 回复，因此分支成功后不能直接追加修改文本。前端必须在新 thread 上调用编辑重跑准备接口，提交原 human message ID 和修改后的文本。后端返回：

- 回滚到原 human message 之前的 `checkpoint`。
- 已清洗并替换文本的 `input`。
- 标记被替换 run 和消息版本的 `metadata`。
- 新 user message ID 与原轮消息 ID 集合。

前端将上述 `checkpoint`、`input` 和 `metadata` 原样用于新 thread 的流式 run，仅从 `input` 中移除旧附件引用。这样后端会从正确 checkpoint 重新执行，并在消息历史中隐藏被替换的原轮。

准备成功后，前端创建对应的新本地 session 并绑定分支返回的 `thread_id`。新 session 立即展示编辑点之前的历史和修改后的用户消息，再流式展示新回复；原 session 保持不变。

如果目标用户消息后不存在已完成 assistant 文本回复，前端不提供编辑提交，因为后端无法建立可靠的分支锚点和编辑回滚点。复制操作仍然可用。

## 数据模型

`ChatMessage` 的 assistant turn 增加引擎消息 ID 集合。历史消息转换时，同一 run 内合并多个 assistant 消息需要同时合并这些 ID；实时流式 turn 也应从引擎事件中采集相同信息。

编辑准备接口还要求原 human message ID。后续发送新消息时，前端先生成 user message ID，并把同一个 ID 同时写入本地 `ChatMessage` 和 run input；历史会话继续直接采用引擎返回的 human message ID。这样当前会话和重新加载的会话都能使用同一套编辑链路。

用户消息编辑本期只继承：

- 修改后的文本。
- 原消息记录的模型；若模型已不可用，则使用当前有效模型。

历史附件不自动重新上传，也不在本期扩展 `ChatMessage` 保存附件引用。

## 组件边界

- `UserBubble`：负责展示用户消息、复制反馈和就地编辑状态，通过回调提交编辑结果。
- `ChatFeed`：向用户气泡透传编辑、复制所需状态与回调，不负责分支业务。
- `turnsClient`：新增类型化的 thread branch、edit-regenerate prepare 请求，并允许流式 run 传入后端返回的 checkpoint 和 metadata。
- `sessionStore`、`engineHistory` 与流式 reducer：统一 user message ID，并保存 assistant turn 的全部引擎消息 ID。
- `Home`：负责定位分支锚点、依次执行 branch 和 edit-regenerate prepare、创建并切换分支 session，再使用准备结果启动流式生成。

## 状态与错误处理

- 分支创建和编辑重跑准备期间锁定该编辑提交，防止重复点击。
- 分支创建失败时保留原 session、编辑框和已修改文本，并显示明确错误。
- 分支创建成功但编辑重跑准备失败时，不切换 session；前端对尚未启动 run 的新分支执行 best-effort 删除，避免历史列表出现无效分支。
- 分支成功但新 run 失败时保留新分支及修改后的用户消息，按现有 assistant error turn 方式展示错误。
- 复制失败时不切换成功图标，并以无侵入方式显示失败反馈。
- 已进入 streaming 状态时禁用编辑入口；复制仍保持可用。

## 测试范围

- `UserBubble`：按钮常驻、复制成功反馈、复制失败、进入编辑、取消恢复、空文本禁用、提交回调和 streaming 禁用。
- `ChatFeed`：正确透传消息索引、编辑状态与回调。
- `sessionStore` 与 `engineHistory`：发送时 user message ID 一致；历史转换能采集 human ID，并合并单条或多条 assistant 消息 ID。
- `turnsClient`：branch 与 edit-regenerate prepare 的 URL、CSRF 请求头、请求体、响应映射和错误响应；流式 run 正确透传 checkpoint 与 metadata。
- `Home`：锚点定位、两阶段准备顺序、旧附件移除、历史截断、新 session 绑定与切换、原 session 保留、原模型沿用、无可用锚点禁用、失败恢复与孤立分支清理。
- 回归验证：完整前端测试、TypeScript/Vite 构建，并在桌面和窄屏视口检查按钮、编辑框和消息布局。

## 非目标

- 不修改或删除原 thread。
- 不在原 thread 中覆盖历史 checkpoint。
- 不支持历史附件自动重传。
- 不增加分支树、版本切换器或消息版本导航界面。
