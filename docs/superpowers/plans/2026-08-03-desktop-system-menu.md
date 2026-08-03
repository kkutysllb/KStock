# Desktop System Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善 KStock 桌面端系统菜单、托盘菜单和对应前端功能入口。

**Architecture:** Tauri/Rust 侧负责创建原生菜单、处理窗口/目录/重载等原生动作；需要前端状态参与的动作通过 `kstock://menu` 事件发送给 React。React 侧集中监听菜单事件并复用已有的新建任务、设置页、报告页和更新检查逻辑。

**Tech Stack:** Tauri 2、Rust、React、Vitest、`@tauri-apps/api/event`、`@tauri-apps/plugin-updater`。

---

### Task 1: 前端菜单事件监听

**Files:**
- Modify: `apps/desktop/src/pages/Home.tsx`
- Modify: `apps/desktop/src/components/UpdateButton.tsx`
- Test: `apps/desktop/tests/App.spec.tsx`

- [x] **Step 1: Write failing tests**

Add a Vitest mock for `@tauri-apps/api/event.listen`, capture the registered callback, then assert:

```ts
expect(screen.getAllByRole("button", { name: "新研究会话" })).toHaveLength(1);
await emitMenuCommand("new-task");
expect(screen.getAllByRole("button", { name: "新研究会话" })).toHaveLength(2);
await emitMenuCommand("open-settings");
expect(screen.getByRole("heading", { name: "常规" })).toBeVisible();
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --dir apps/desktop test -- App.spec.tsx`

Expected: FAIL because no listener is registered for `kstock://menu`.

- [x] **Step 3: Implement minimal listener**

In `Home.tsx`, import `listen` and register one `useEffect` that handles:

```ts
type DesktopMenuCommand =
  | "new-task"
  | "open-settings"
  | "open-reports"
  | "check-update";
```

For `new-task`, call `handleNewSession()`. For `open-settings`, set settings section to `general` and switch to settings. For `open-reports`, switch to reports. For `check-update`, dispatch `window.dispatchEvent(new CustomEvent("kstock:check-update"))`.

- [x] **Step 4: Wire update button**

In `UpdateButton.tsx`, listen to the browser event `kstock:check-update` and call the existing `check()` returned by `useAppUpdate()`.

- [x] **Step 5: Run frontend tests**

Run: `pnpm --dir apps/desktop test -- App.spec.tsx`

Expected: PASS.

### Task 2: Native menu and tray expansion

**Files:**
- Modify: `apps/desktop/src-tauri/src/main.rs`

- [x] **Step 1: Add native menu items**

Extend `build_app_menu` with:

```text
KStock: 检查更新, 偏好设置
文件: 新建任务, 打开交付文件目录, 打开应用数据目录, 关闭窗口
视图: 重新加载, 强制重新加载, 开发者工具（debug only）, 放大, 缩小, 实际大小
帮助: 打开应用数据目录, 打开日志目录
```

- [x] **Step 2: Add native helpers**

Add helper functions for:

```rust
emit_menu_command(app, "new-task")
open_main_window(app)
hide_main_window(app)
open_path(path)
open_app_data_dir(app)
open_logs_dir(app)
reload_main_window(app, hard)
set_main_zoom(app, factor)
```

- [x] **Step 3: Handle menu events**

Map each custom menu id to either a native helper or `emit_menu_command`.

- [x] **Step 4: Run Rust check**

Run: `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`

Expected: PASS.

### Task 3: Final verification

**Files:**
- No additional files.

- [x] **Step 1: Run full desktop tests**

Run: `pnpm --dir apps/desktop test`

Expected: PASS.

- [x] **Step 2: Run desktop build**

Run: `pnpm --dir apps/desktop build`

Expected: PASS.

- [x] **Step 3: Run diff check**

Run: `git diff --check`

Expected: no output.
