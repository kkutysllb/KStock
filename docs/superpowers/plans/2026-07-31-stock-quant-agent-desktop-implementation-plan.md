# 股票量化智能体桌面端实施计划

> **给执行者：** 建议优先使用 `superpowers:subagent-driven-development` 按任务执行；也可以使用 `superpowers:executing-plans` 按批次执行。所有步骤都使用复选框跟踪。

**目标：** 用 Tauri + React + Python sidecar 搭建跨平台的 Stock Quant Agent 桌面端，让用户可以通过对话完成研究、分析和报告生成，并能稳定同步 QiLin / KSkills 的上游更新。

**架构：** 桌面壳只负责界面、窗口和本地交互；Python sidecar 负责 QiLin 调度、技能加载、报告生成和状态管理；`vendor/skills` 负责保存精选技能副本；`scripts/` 负责上游同步与校验；GitHub Actions 负责跨平台构建、测试和发布。Sidecar 与桌面壳使用本地标准输入 / 标准输出的 JSON 行协议，避免端口管理和跨平台网络差异。

**技术栈：** Tauri、React、TypeScript、Vite、Rust、Python 3.12、QiLin、本地 JSON 行协议、pytest、Vitest、Playwright、GitHub Actions、pnpm、cargo。

---

## 文件边界

- `apps/desktop/`：桌面界面与 Tauri 主工程。
- `sidecar/`：Python sidecar 与 QiLin 适配层。
- `vendor/skills/`：精选技能的产品内副本与清单。
- `scripts/`：上游同步、技能校验、发布检查脚本。
- `.github/workflows/`：持续集成与发布流水线。
- `docs/`：中文运行说明、同步说明、发布检查清单。

### 任务 1：建立仓库骨架与基础工具链

**文件：**
- 创建：`package.json`
- 创建：`pnpm-workspace.yaml`
- 创建：`apps/desktop/package.json`
- 创建：`apps/desktop/index.html`
- 创建：`apps/desktop/vite.config.ts`
- 创建：`apps/desktop/src/main.tsx`
- 创建：`apps/desktop/src/App.tsx`
- 创建：`apps/desktop/src/styles.css`
- 创建：`apps/desktop/src-tauri/Cargo.toml`
- 创建：`sidecar/pyproject.toml`
- 创建：`sidecar/src/kstock_sidecar/__init__.py`
- 创建：`sidecar/src/kstock_sidecar/__main__.py`
- 创建：`sidecar/tests/test_imports.py`
- 修改：`README.md`
- 修改：`.gitignore`

- [ ] **步骤 1：先写失败测试**

```python
from kstock_sidecar import __version__


def test_package_importable():
    assert __version__ == "0.1.0"
```

- [ ] **步骤 2：运行测试，确认它失败**

运行：`python -m pytest sidecar/tests/test_imports.py -q`

预期：失败，报 `ModuleNotFoundError: No module named 'kstock_sidecar'`

- [ ] **步骤 3：写最小实现**

```python
# sidecar/src/kstock_sidecar/__init__.py
__version__ = "0.1.0"
```

- [ ] **步骤 4：再跑测试，确认通过**

运行：`python -m pytest sidecar/tests/test_imports.py -q`

预期：通过，输出 `1 passed`

- [ ] **步骤 5：提交**

```bash
git add package.json pnpm-workspace.yaml apps/desktop sidecar README.md .gitignore
git commit -m "chore: 初始化桌面端仓库骨架"
```

### 任务 2：实现 QiLin sidecar 协议与桥接层

**文件：**
- 创建：`sidecar/src/kstock_sidecar/protocol.py`
- 创建：`sidecar/src/kstock_sidecar/config.py`
- 创建：`sidecar/src/kstock_sidecar/qilin_adapter.py`
- 创建：`sidecar/src/kstock_sidecar/server.py`
- 创建：`sidecar/tests/test_protocol.py`
- 创建：`sidecar/tests/test_qilin_adapter.py`
- 创建：`sidecar/tests/test_server_smoke.py`
- 创建：`apps/desktop/src-tauri/src/sidecar.rs`
- 创建：`apps/desktop/src/lib/sidecarClient.ts`
- 创建：`apps/desktop/src/lib/sidecarTypes.ts`

- [ ] **步骤 1：先写失败测试**

```python
from kstock_sidecar.protocol import Request


def test_request_roundtrip():
    req = Request.model_validate_json('{"id":"1","method":"health","params":{}}')
    assert req.method == "health"
```

- [ ] **步骤 2：运行测试，确认它失败**

运行：`python -m pytest sidecar/tests/test_protocol.py -q`

预期：失败，提示 `Request` 或 `model_validate_json` 尚未实现。

- [ ] **步骤 3：写最小实现**

```python
# sidecar/src/kstock_sidecar/protocol.py
from pydantic import BaseModel


class Request(BaseModel):
    id: str
    method: str
    params: dict = {}


class Response(BaseModel):
    id: str
    ok: bool = True
    result: dict | str | None = None
    error: str | None = None
```

- [ ] **步骤 4：再跑测试，确认通过**

运行：`python -m pytest sidecar/tests/test_protocol.py sidecar/tests/test_qilin_adapter.py -q`

预期：通过，至少 `2 passed`

- [ ] **步骤 5：提交**

```bash
git add sidecar apps/desktop/src-tauri/src/sidecar.rs
git commit -m "feat: 建立 QiLin sidecar 协议"
```

### 任务 3：落地精选技能包与上游同步机制

**文件：**
- 创建：`vendor/skills/approved-skills.json`
- 创建：`vendor/skills/README.md`
- 创建：`vendor/skills/stock/analysis-report/`
- 创建：`vendor/skills/stock/chart-visualization/`
- 创建：`vendor/skills/stock/kk-common/`
- 创建：`vendor/skills/stock/kk-stock-analysis/`
- 创建：`vendor/skills/stock/kk-financial-statement/`
- 创建：`vendor/skills/stock/kk-valuation-model/`
- 创建：`vendor/skills/stock/kk-industry-analysis/`
- 创建：`vendor/skills/stock/kk-news-search/`
- 创建：`vendor/skills/stock/kk-report-search/`
- 创建：`vendor/skills/stock/kk-announcement-search/`
- 创建：`vendor/skills/stock/kk-business-query/`
- 创建：`vendor/skills/stock/kk-macro-query/`
- 创建：`scripts/sync_upstreams.py`
- 创建：`scripts/verify_skill_pack.py`
- 创建：`sidecar/src/kstock_sidecar/skills.py`
- 创建：`sidecar/tests/test_skill_filter.py`
- 创建：`sidecar/tests/test_upstream_lock.py`
- 创建：`upstream.lock.json`

- [ ] **步骤 1：先写失败测试**

```python
from kstock_sidecar.skills import filter_approved_skills


def test_only_approved_skills_survive():
    skills = [
        {"name": "analysis-report"},
        {"name": "kk-strategy-research"},
    ]
    kept = filter_approved_skills(skills)
    assert [item["name"] for item in kept] == ["analysis-report"]
```

- [ ] **步骤 2：运行测试，确认它失败**

运行：`python -m pytest sidecar/tests/test_skill_filter.py -q`

预期：失败，提示 `filter_approved_skills` 尚未实现。

- [ ] **步骤 3：写最小实现**

```python
# sidecar/src/kstock_sidecar/skills.py
APPROVED_SKILLS = {
    "analysis-report",
    "chart-visualization",
    "kk-common",
    "kk-stock-analysis",
    "kk-financial-statement",
    "kk-valuation-model",
    "kk-industry-analysis",
    "kk-news-search",
    "kk-report-search",
    "kk-announcement-search",
    "kk-business-query",
    "kk-macro-query",
}


def filter_approved_skills(skills: list[dict]) -> list[dict]:
    return [skill for skill in skills if skill.get("name") in APPROVED_SKILLS]
```

- [ ] **步骤 4：再跑测试，确认通过**

运行：`python -m pytest sidecar/tests/test_skill_filter.py sidecar/tests/test_upstream_lock.py -q`

预期：通过，至少 `2 passed`

- [ ] **步骤 5：提交**

```bash
git add vendor/skills scripts sidecar/upstream.lock.json
git commit -m "feat: 添加精选技能包与上游同步"
```

### 任务 4：实现桌面工作台与对话工作流

**文件：**
- 创建：`apps/desktop/src/components/ChatPanel.tsx`
- 创建：`apps/desktop/src/components/ReportPanel.tsx`
- 创建：`apps/desktop/src/components/SkillDrawer.tsx`
- 创建：`apps/desktop/src/components/WorkspaceSidebar.tsx`
- 创建：`apps/desktop/src/components/StatusBar.tsx`
- 创建：`apps/desktop/src/lib/markdown.ts`
- 创建：`apps/desktop/src/lib/sessionStore.ts`
- 创建：`apps/desktop/src/pages/Home.tsx`
- 创建：`apps/desktop/tests/App.spec.tsx`
- 创建：`apps/desktop/playwright/home.spec.ts`
- 修改：`apps/desktop/src/App.tsx`
- 修改：`apps/desktop/src/styles.css`

- [ ] **步骤 1：先写失败测试**

```tsx
import { render, screen } from "@testing-library/react";
import { App } from "../src/App";


test("首屏展示聊天工作台", () => {
  render(<App />);
  expect(screen.getByRole("textbox", { name: "消息输入" })).toBeVisible();
  expect(screen.getByText("会话")).toBeVisible();
  expect(screen.getByText("报告")).toBeVisible();
});
```

- [ ] **步骤 2：运行测试，确认它失败**

运行：`pnpm -C apps/desktop test`

预期：失败，提示页面组件或无障碍标签尚未实现。

- [ ] **步骤 3：写最小实现**

```tsx
export function App() {
  return (
    <main>
      <aside>会话</aside>
      <section>
        <label htmlFor="message-input">消息输入</label>
        <textarea id="message-input" />
      </section>
      <aside>报告</aside>
    </main>
  );
}
```

- [ ] **步骤 4：再跑测试，确认通过**

运行：`pnpm -C apps/desktop test && pnpm -C apps/desktop exec playwright test`

预期：测试通过，首屏不出现营销页内容。

- [ ] **步骤 5：提交**

```bash
git add apps/desktop
git commit -m "feat: 搭建桌面工作台"
```

### 任务 5：打通持续集成与发布流水线

**文件：**
- 创建：`.github/workflows/ci.yml`
- 创建：`.github/workflows/release.yml`
- 创建：`scripts/check-ci.sh`
- 创建：`scripts/check-release.sh`
- 创建：`scripts/build-sidecar.sh`
- 创建：`scripts/build-desktop.sh`
- 创建：`docs/发布说明.md`
- 创建：`docs/运行说明.md`
- 创建：`docs/上游同步.md`

- [ ] **步骤 1：先写失败检查脚本**

```bash
#!/usr/bin/env bash
set -euo pipefail

python -m pytest sidecar/tests -q
pnpm -C apps/desktop test
pnpm -C apps/desktop exec playwright test
```

- [ ] **步骤 2：运行脚本，确认它失败**

运行：`bash scripts/check-ci.sh`

预期：失败，因为前面的应用、sidecar 或工作流文件还未全部完成。

- [ ] **步骤 3：写最小实现**

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pnpm install
      - run: python -m pytest sidecar/tests -q
      - run: pnpm -C apps/desktop test
```

- [ ] **步骤 4：再跑检查，确认通过**

运行：`bash scripts/check-ci.sh`

预期：本地检查通过，GitHub Actions 可按三平台矩阵执行。

- [ ] **步骤 5：提交**

```bash
git add .github/workflows scripts docs
git commit -m "ci: 建立跨平台构建与发布流水线"
```

### 任务 6：补齐中文运行文档与首次使用说明

**文件：**
- 修改：`README.md`
- 创建：`docs/首次运行.md`
- 创建：`docs/配置说明.md`
- 创建：`docs/故障排查.md`

- [ ] **步骤 1：先写最小文档骨架**

```markdown
# 首次运行

1. 安装依赖。
2. 启动桌面端。
3. 检查侧边栏技能状态。
4. 发送第一条分析请求。
```

- [ ] **步骤 2：检查文档链接与标题**

运行：`rg -n "TODO|TBD|TODO|English" README.md docs`

预期：没有遗留占位符，也没有英文正文。

- [ ] **步骤 3：提交**

```bash
git add README.md docs
git commit -m "docs: 补齐中文运行文档"
```

## 覆盖检查

- 设计稿中的跨平台桌面壳，由任务 1、4、5 覆盖。
- QiLin 作为本地核心引擎，由任务 2 覆盖。
- 精选技能与上游同步，由任务 3 覆盖。
- 研究 / 分析 / 报告优先的首屏体验，由任务 4 和 6 覆盖。
- 上游锁定与不污染上游，由任务 3 和 5 覆盖。
- CI / 发布打包检查，由任务 5 覆盖。

## 自检结果

1. **占位符检查：** 本计划中没有 `TBD`、`TODO`、`稍后补充` 之类占位语。
2. **一致性检查：** `sidecar/src/kstock_sidecar/protocol.py`、`qilin_adapter.py`、`server.py` 的协议名在所有任务里保持一致，都是 JSON 行协议。
3. **范围检查：** 任务数量足以覆盖当前设计稿，没有把策略、期货、期权提前塞进 V1。
4. **可执行性检查：** 每个任务都能独立提交，不需要等整条链路一次性完成。

