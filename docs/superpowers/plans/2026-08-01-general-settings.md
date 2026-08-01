# 常规设置功能打通 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将设置页「常规」改成按用户持久化且能即时影响桌面工作台的真实偏好表单。

**Architecture:** Gateway 新增用户级 JSON 偏好 API，前端通过独立 client 加载完整模型。`Home` 持有已应用偏好并把它们传入工作台、消息流和设置组件；偏好只控制已有 UI 能力，不写入 QiLin runtime 配置。

**Tech Stack:** FastAPI/Pydantic、Python 原子 JSON 写入、React/TypeScript、现有 CSS 设置卡片体系。

---

### Task 1: 用户级常规设置持久化 API

**Files:**
- Create: `scripts/kstock_general_settings.py`
- Modify: `scripts/run_gateway.py`

- [x] **Step 1: 定义严格的 Pydantic 模型和默认值**

在新路由中定义 `GeneralPreferences`，字段与规格一致：`density`、`reduce_motion`、`sidebar_collapsed`、`history_collapsed`、`auto_scroll`、`show_stage`、`show_reasoning`、`show_tool_calls`、`restore_last_session`、`create_session_when_empty`、`send_shortcut`、`keep_draft_after_send`、`keep_attachments_after_send`。使用 `ConfigDict(extra="forbid")`，枚举字段只接受规格中的值。

- [x] **Step 2: 实现安全路径和原子读写**

使用 `get_effective_user_id()` 获取用户，计算 `sha256(user_id)` 的前 32 位作为文件名，路径为 `<data_root>/product/preferences/<hash>.json`。读取缺失文件时返回 `DEFAULT_PREFERENCES`；写入使用 `tempfile.mkstemp` 和 `os.replace`，并用模块级 `threading.Lock` 串行化。

- [x] **Step 3: 增加 GET/PUT 路由并在 gateway 挂载**

路由前缀为 `/api/v1/kstock`，端点为 `/general-settings`。GET 返回 `{preferences: ...}`；PUT 接收 `GeneralPreferences`，写入 `{version: 1, user_id, preferences}` 后返回同样的规范化对象。`run_gateway.create_app()` import 并 `include_router`。

### Task 2: 前端 API client 和常规设置表单

**Files:**
- Create: `apps/desktop/src/lib/generalSettingsClient.ts`
- Create: `apps/desktop/src/components/GeneralSettings.tsx`
- Modify: `apps/desktop/src/styles.css`

- [x] **Step 1: 镜像现有 API client 的 CSRF/cookie 模式**

导出 `GeneralPreferences` 类型、`DEFAULT_GENERAL_PREFERENCES`、`getGeneralPreferences()` 和 `updateGeneralPreferences()`；错误统一为带中文 message 的 `GeneralSettingsApiError`。

- [x] **Step 2: 实现受控表单**

表单按「界面与侧栏」「研究过程」「会话与输入」三张同级 settings card 展示。下拉使用 `select`，布尔项使用现有 toggle 样式；维护 dirty、重置、保存中、保存成功和错误状态。保存成功通过 `onSaved(preferences)` 回传 Home。

- [x] **Step 3: 增加常规表单的专属 CSS**

沿用 `runtime-config-*` 的间距、边框、12-14px 字体和响应式两列网格；增加 `.general-settings`、`.general-settings-section`、`.general-settings-toggle`、`.density-compact` 和 `.reduce-motion` 所需样式，避免嵌套卡片和大字号。

### Task 3: Home 状态与工作台联动

**Files:**
- Modify: `apps/desktop/src/pages/Home.tsx`
- Modify: `apps/desktop/src/components/ChatFeed.tsx`
- Modify: `apps/desktop/src/components/AssistantTurn.tsx`
- Modify: `apps/desktop/src/components/SubagentGroup.tsx`

- [x] **Step 1: 加载和应用用户偏好**

在 `Home` 中增加 `generalPreferences` 状态；用户就绪后调用 GET，失败回退默认值。把 `density` 和 `reduce_motion` 映射为 workspace/settings 根 class；把侧栏与历史折叠初始值传入 `WorkspaceShell`。

- [x] **Step 2: 接入会话恢复与空会话创建**

历史线程加载后，若开启 `restore_last_session`，从 `localStorage` 的 `kstock.lastSession.<userId>` 恢复仍存在的 thread；选择会话时更新该 key。若开启 `create_session_when_empty` 且后端无线程，则创建本地新研究会话。

- [x] **Step 3: 接入消息展示开关和自动滚动**

`ChatFeed` 接收 `autoScroll`，仅在开启且用户贴底时跟随；`AssistantTurn` 接收 `showStage`、`showReasoning`、`showToolCalls` 并条件渲染对应区块；`SubagentGroup` 通过同一工具调用开关隐藏工具卡片但保留步骤正文。

- [x] **Step 4: 接入输入行为偏好**

textarea 增加 `onKeyDown`：`enter` 模式下 Enter 发送、Shift+Enter 换行；`mod_enter` 模式下 Cmd/Ctrl+Enter 发送、普通 Enter 换行。发送流程按照 `keep_draft_after_send` 和 `keep_attachments_after_send` 决定是否清理输入状态。

### Task 4: 设置入口和开发进度

**Files:**
- Modify: `apps/desktop/src/pages/Home.tsx`
- Modify: `docs/开发进度.md`

- [x] **Step 1: 将 general section 接入真实组件**

在 `SettingsPage` 的 section 分支中优先渲染 `<GeneralSettings initialValue={generalPreferences} onSaved={onGeneralPreferencesChanged} />`，并把 Home 的状态和回调传入。

- [x] **Step 2: 更新开发进度记录**

在 `docs/开发进度.md` 追加阶段十三，列出后端 API、用户数据空间文件、表单字段和工作台联动状态。

- [x] **Step 3: 检查变更范围并提交**

只暂存本阶段代码、规格/计划和开发进度，不纳入 `.superpowers/`、`findings.md`、`progress.md`、`task_plan.md`。按用户要求不运行 build/test/browser 验证，提交信息使用 `feat(settings): implement general preferences`。

---

## 自检记录

- 规格中的 13 个偏好字段全部在 Task 1/2 定义并在 Task 3 应用。
- 用户级隔离、原子写入、错误回退、立即应用和开发进度更新均有对应步骤。
- 范围外的原生防休眠、托盘、通知和多语言切换没有进入实施任务。
