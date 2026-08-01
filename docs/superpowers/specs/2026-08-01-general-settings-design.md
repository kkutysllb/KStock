# 常规设置功能打通设计规格

- 日期：2026-08-01
- 分支：`main`
- 状态：已批准，待实现

## 1. 背景与目标

桌面端「设置 → 常规」目前只渲染三个硬编码字段，按钮没有读写行为，也不会影响工作台。本轮将其改成真实的用户偏好设置页：偏好保存到 KStock 用户数据空间，通过 Gateway 读写，并在保存后立即应用到当前桌面会话。

本轮只提供当前 React 桌面端能够真实执行的选项。防止系统休眠、关闭窗口时最小化到托盘等依赖 Tauri 原生能力的行为暂不加入，避免出现只保存数值但功能不生效的假开关。

## 2. 方案选择

采用独立的 KStock 桌面偏好文件，不使用 `localStorage` 作为真源，也不把桌面交互偏好写入 QiLin `qilin.runtime.yaml`。

| 方案 | 结论 | 原因 |
|---|---|---|
| 用户数据空间中的独立偏好文件 | 采用 | 能按用户隔离、原子写入、随 KStock 数据空间迁移，且不污染引擎配置 |
| 仅使用 `localStorage` | 不采用 | 无法跨 WebView 数据清理迁移，Gateway 和其他桌面实例不可见 |
| 写入 QiLin runtime YAML | 不采用 | 界面偏好不是引擎运行配置，混写会扩大热重载配置的职责 |

## 3. 数据模型

偏好文件保存到：

```text
<KSTOCK_APP_DATA_DIR>/product/preferences/<user-key>.json
```

`user-key` 由当前用户标识计算稳定 SHA-256 摘要，避免把邮箱或其他用户标识直接放入路径，也杜绝路径穿越。文件内保留原始 `user_id` 便于诊断。

```json
{
  "version": 1,
  "user_id": "current-user-id",
  "preferences": {
    "density": "comfortable",
    "reduce_motion": false,
    "sidebar_collapsed": false,
    "history_collapsed": false,
    "auto_scroll": true,
    "show_stage": true,
    "show_reasoning": true,
    "show_tool_calls": true,
    "restore_last_session": true,
    "create_session_when_empty": false,
    "send_shortcut": "mod_enter",
    "keep_draft_after_send": false,
    "keep_attachments_after_send": false
  }
}
```

新增字段时由后端默认值补齐；未知字段拒绝写入，避免拼写错误悄悄落盘。文件使用临时文件加 `os.replace` 原子替换，并用模块级锁串行化写操作。

## 4. Gateway API

新增 `scripts/kstock_general_settings.py`，在 `scripts/run_gateway.py` 注册路由。

| 方法 | 地址 | 行为 |
|---|---|---|
| `GET` | `/api/v1/kstock/general-settings` | 根据当前登录用户读取偏好；文件不存在时返回完整默认值 |
| `PUT` | `/api/v1/kstock/general-settings` | 校验并原子写入完整偏好对象，返回规范化后的值 |

路由使用 QiLin 当前用户上下文取得 `user_id`，不允许客户端传入用户或文件路径。JSON 损坏时返回明确的服务端错误，不覆盖原文件；字段校验失败返回 422 字段错误。

## 5. 前端数据流

新增 `generalSettingsClient.ts` 统一处理 cookie、CSRF、中文错误和类型。`Home` 在用户登录状态就绪后读取偏好，并维护唯一的 `GeneralPreferences` 状态：

```text
登录用户变化
  → GET general-settings
  → Home preferences 状态
  → WorkspaceShell / ChatFeed / AssistantTurn 应用偏好

设置页保存
  → PUT general-settings
  → GeneralSettings 回调 Home
  → 当前工作台立即更新
```

Gateway 暂时不可达时使用默认值保持应用可用；设置页单独显示加载或保存错误，不把失败状态伪装成已保存。

## 6. 表单与实际行为

常规页采用当前设置系统的低对比深色卡片、12 至 14px 字体、两列响应式字段和统一开关，不使用大标题或装饰性卡片嵌套。

### 6.1 界面与侧栏

- 界面密度：`舒适 / 紧凑`，通过根节点 class 调整工作台和设置页的间距。
- 减少动态效果：关闭非必要动画与过渡，保留功能状态变化。
- 默认折叠侧边栏：偏好加载后设置工作台侧栏状态。
- 默认折叠历史任务：控制每次挂载工作台时历史任务分组初始状态。

### 6.2 研究过程展示

- 自动跟随最新消息：开启时沿用当前贴底滚动；关闭时消息变化不主动滚动。
- 显示任务阶段：控制 assistant turn 的阶段徽章。
- 显示思考过程：控制 reasoning block。
- 显示工具调用：控制主代理和子代理的工具调用卡片；不会删除原始消息数据。

### 6.3 会话与输入

- 恢复上次打开的任务：按用户在 `localStorage` 只保存最后活动 thread id 作为运行状态，用户偏好文件只控制是否启用；历史列表加载时优先恢复仍存在的任务，否则回退到第一条。
- 无历史任务时自动新建：历史加载完成且为空时创建一个本地新研究会话。
- 发送快捷键：支持 `Cmd/Ctrl + Enter` 或 `Enter`；两种模式下 `Shift + Enter` 都换行。
- 发送后保留草稿：控制成功启动发送流程时是否清空输入文本。
- 发送后保留附件：控制已上传附件是否继续保留在下一条消息中。

## 7. 组件边界

- `GeneralSettings.tsx`：负责加载、编辑、保存、重置和表单状态，不直接操作工作台 DOM。
- `generalSettingsClient.ts`：只负责 HTTP、类型和错误归一化。
- `Home.tsx`：持有已应用偏好，并将其传给工作台和常规设置页。
- `ChatFeed.tsx`：只根据 `autoScroll` 决定是否跟随到底。
- `AssistantTurn.tsx` / `SubagentGroup.tsx`：只根据展示开关决定渲染，不改动消息模型。
- `kstock_general_settings.py`：只负责用户解析、模型校验和 JSON 持久化。

## 8. 错误与边界处理

- 未登录时不请求用户偏好；登出后恢复内存默认值并清理当前用户的临时 UI 状态。
- 用户切换时重新加载，不复用上一用户的偏好。
- 偏好加载晚于历史任务列表时，在两者都就绪后执行一次会话恢复，避免先错误选中第一条再覆盖。
- 保存期间禁用重复提交；离开页面前未保存的草稿不应用。
- `reduce_motion` 使用应用根 class，且与系统 `prefers-reduced-motion` 规则兼容。

## 9. 文档与验证约束

实现完成后更新 `docs/开发进度.md`，记录常规设置 API、用户级持久化和前端联动项。

按用户要求，本轮只修改代码，不运行 build、test 或浏览器验证。交付时明确标注未执行验证。

## 10. 范围外

- 防止系统休眠；
- 托盘、关闭窗口和开机启动行为；
- 系统原生通知和声音；
- 尚无多语言资源支撑的 UI 语言切换；
- 与 QiLin runtime 配置重复的模型、沙箱、预算和报告生成选项。
