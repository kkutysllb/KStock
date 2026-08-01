# HTML 数据看板与报告库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 KStock 的研究交付改造成单文件离线 HTML 数据看板，并提供独立、按日期分组且与线程删除解耦的报告库。

**Architecture:** 分析报告技能先产出结构化报告 JSON，`render_html_report` 运行时工具调用本地校验器和内嵌图表运行时生成一个 HTML 文件，同时把它写入线程 outputs 并归档到用户数据空间的 `reports/<user_id>/YYYY/MM/DD/`。报告库通过 KStock 自有 Gateway 路由读取当前用户的索引和受控 HTML，桌面端新增独立侧边栏入口；线程删除逻辑不接触报告库。

**Tech Stack:** Python 3.12/pytest、SQLite、FastAPI、QiLin runtime tool injection、Node.js 18、TypeScript/React/Vitest、内嵌 SVG/Canvas 图表运行时。

---

## 文件边界

### 新建

- `vendor/skills/public/analysis-report/scripts/report_contract.py`：报告 JSON schema、分区/视觉覆盖校验和安全资源校验。
- `vendor/skills/public/analysis-report/assets/dashboard-runtime.js`：无网络依赖的图表与看板交互运行时。
- `vendor/skills/public/chart-visualization/tests/generate.test.mjs`：离线 descriptor 生成测试。
- `scripts/kstock_reports.py`：报告索引、文件归档、读取和删除服务。
- `scripts/kstock_tools/report_dashboard_tool.py`：注入当前 QiLin runtime 的 `render_html_report` 工具。
- `tests/test_kstock_reports.py`：报告库文件与 SQLite 索引生命周期测试。
- `tests/test_report_dashboard_tool.py`：运行时工具输出与归档测试。
- `apps/desktop/src/lib/reportsClient.ts`：报告库 API 类型与请求封装。
- `apps/desktop/src/components/ReportLibrary.tsx`：日期分组、筛选、打开和删除报告库 UI。
- `apps/desktop/src/components/HtmlReportViewer.tsx`：受限 iframe 看板预览。
- `apps/desktop/src/tests/reportsClient.spec.ts`：报告 API 客户端测试。
- `apps/desktop/src/tests/ReportLibrary.spec.tsx`：报告库交互测试。

### 修改

- `vendor/skills/public/analysis-report/scripts/render_report.py`：改为只输出一个 HTML，调用契约校验和内嵌 runtime。
- `vendor/skills/public/analysis-report/SKILL.md`、`CHANGELOG.md`：移除 Markdown/PDF/DOCX 和远程图表 URL 交付要求，加入分区/覆盖/离线契约。
- `vendor/skills/public/analysis-report/tests/test_render_report.py`：改写为单 HTML、覆盖校验和外部资源拒绝测试。
- `vendor/skills/public/chart-visualization/scripts/generate.js`、`SKILL.md`：保留 26 类字段与选型规则，改成离线 descriptor 输出，不执行远程请求。
- `config/qilin.config.yaml`：注册 `render_html_report`，更新 `report-writer` 输出格式和工具限制。
- `scripts/run_gateway.py`：创建报告目录，挂载报告库路由，向运行时提供报告目录环境信息。
- `apps/desktop/src/pages/Home.tsx`：增加报告库导航状态，移除 `reportMarkdown` 报告侧栏路径，运行结束后刷新报告库。
- `apps/desktop/src/components/ReportSettings.tsx`：只展示 HTML 看板和离线策略，删除 Markdown/PDF/DOCX 选项。
- `apps/desktop/src/components/ReportPanel.tsx`：改为渲染当前会话关联的 HTML 看板入口或空状态。
- `apps/desktop/src/lib/sessionStore.ts`、`gatewayTypes.ts`：增加 report id/summary 字段，移除报告文件的 Markdown 假数据。
- `apps/desktop/src/styles.css`：增加报告库日期分组、列表、筛选和 iframe 预览样式，保留聊天 Markdown 样式。
- `tests/test_run_gateway.py`、`tests/test_kstock_tools.py`：补充报告工具配置和报告目录初始化断言。

## Task 1: 建立报告契约和单文件 HTML 渲染器

**Files:**
- Create: `vendor/skills/public/analysis-report/scripts/report_contract.py`
- Create: `vendor/skills/public/analysis-report/assets/dashboard-runtime.js`
- Modify: `vendor/skills/public/analysis-report/scripts/render_report.py`
- Modify: `vendor/skills/public/analysis-report/tests/test_render_report.py`

- [ ] **Step 1: Write failing contract tests**

在 `test_render_report.py` 增加以下测试：

```python
def test_render_report_writes_only_one_html(tmp_path):
    result = run_renderer(tmp_path, valid_payload())
    assert result.returncode == 0
    assert (tmp_path / "report.html").exists()
    assert not list(tmp_path.glob("*.md"))
    assert not list(tmp_path.glob("*.pdf"))
    assert not list(tmp_path.glob("*.docx"))

def test_render_report_rejects_metric_without_visual_mapping(tmp_path):
    payload = valid_payload()
    payload["sections"][0]["metrics"][0].pop("visual")
    result = run_renderer(tmp_path, payload)
    assert result.returncode != 0
    assert "visual" in result.stderr

def test_render_report_rejects_external_resource(tmp_path):
    payload = valid_payload()
    payload["sections"][0]["summary"] = '<script src="https://example.com/a.js"></script>'
    result = run_renderer(tmp_path, payload)
    assert result.returncode != 0
    assert "external" in result.stderr.lower()

def test_render_report_keeps_unavailable_section_visible(tmp_path):
    payload = valid_payload()
    payload["sections"].append({
        "id": "backtest", "title": "回测", "status": "unavailable",
        "summary": "没有策略与区间数据", "metrics": [], "charts": [],
        "evidence": [], "gaps": ["缺少回测区间"]
    })
    result = run_renderer(tmp_path, payload)
    assert result.returncode == 0
    html = (tmp_path / "report.html").read_text(encoding="utf-8")
    assert "没有策略与区间数据" in html
    assert "缺少回测区间" in html
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `python -m pytest vendor/skills/public/analysis-report/tests/test_render_report.py -q`

Expected: the new tests fail because the current renderer still writes Markdown and dark/light HTML, does not validate visual coverage, and has no single-file runtime.

- [ ] **Step 3: Implement the contract validator**

在 `report_contract.py` 实现以下纯函数：

```python
def validate_report_payload(payload: dict) -> None
def validate_section(section: dict, path: str) -> None
def validate_visual_coverage(section: dict, path: str) -> None
def validate_chart_descriptor(chart: dict, path: str) -> None
def reject_external_resources(value: object, path: str = "payload") -> None
```

校验 `report_id/title/generated_at/sections`、分区状态、metric 的 `id/value/source/as_of/visual`、chart 的官方字段、metric mapping 和 `references`。允许来源 URL 作为文本字段，但拒绝 HTML/script/style 中的外部资源引用。

- [ ] **Step 4: Implement a single HTML renderer**

把 `render_report.py` 改为导出可测试的：

```python
def render_dashboard_html(payload: dict, runtime_js: str) -> str
def render_report(input_path: Path, output_dir: Path, basename: str) -> Path
```

`render_report()` 先调用 `validate_report_payload()`，再读取 `assets/dashboard-runtime.js`，把经过 JSON 转义的 payload 和 runtime 内嵌到 HTML。使用临时文件和 `os.replace()` 写入 `<basename>.html`，失败时不留下任何部分文件。

- [ ] **Step 5: Add the local dashboard runtime**

`dashboard-runtime.js` 提供 `window.KStockDashboard.mount(root, payload)`，使用内嵌 SVG/Canvas 和 DOM 交互渲染：line/area、bar/column、dual-axis、pie、radar、scatter、histogram、funnel、treemap、sankey、boxplot/violin、network/flow、liquid 和 spreadsheet。地图类在没有离线地理数据时渲染“数据表 + 缺失原因”卡片。运行时不得调用 `fetch`, `XMLHttpRequest`, `WebSocket` 或动态外部资源。

- [ ] **Step 6: Run focused tests and then the full skill tests**

Run:

```bash
python -m pytest vendor/skills/public/analysis-report/tests/test_render_report.py -q
python -m pytest vendor/skills/public/analysis-report/tests -q
```

Expected: all renderer tests pass and output contains exactly one `.html` file.

- [ ] **Step 7: Commit the renderer slice**

```bash
git add vendor/skills/public/analysis-report/scripts/report_contract.py \
  vendor/skills/public/analysis-report/assets/dashboard-runtime.js \
  vendor/skills/public/analysis-report/scripts/render_report.py \
  vendor/skills/public/analysis-report/tests/test_render_report.py
git commit -m "feat(report): render one offline html dashboard"
```

## Task 2: 将图表技能改为离线 descriptor

**Files:**
- Modify: `vendor/skills/public/chart-visualization/scripts/generate.js`
- Modify: `vendor/skills/public/chart-visualization/SKILL.md`
- Create: `vendor/skills/public/chart-visualization/tests/generate.test.mjs`

- [ ] **Step 1: Write failing Node tests**

使用 Node 内置 `node:test` 覆盖：line chart 输出 `mode: "offline"` descriptor；设置 `globalThis.fetch` 抛错时仍可生成；无离线地理数据的地图返回 `status: "fallback"` 和原因；未知字段被拒绝。

- [ ] **Step 2: Run Node tests and verify RED**

Run: `node --test vendor/skills/public/chart-visualization/tests/generate.test.mjs`

Expected: import fails because `normalizeDescriptor` does not exist and the current script tries to call the remote visualization service.

- [ ] **Step 3: Extract pure normalization from `generate.js`**

导出 `normalizeDescriptor(spec)` 和现有 `CHART_TYPE_MAP`。保留参考文档规定的字段校验、line/area long-format、column category/value、pie category 和 radar group 规范化；删除 `httpPost`, `generateChartUrl`, `generateMap` 的调用路径。脚本 CLI 输出 JSON descriptor，而不是 URL。

- [ ] **Step 4: Update the skill contract**

将 `SKILL.md` 的结果协议改为 `mode: offline`, `tool`, `args`, `status`, `reason`，明确报告渲染器负责内嵌运行时；保留 26 类图表选型和参考文件字段规则。更新 `CHANGELOG.md` 增加离线 descriptor 版本。

- [ ] **Step 5: Run tests and commit**

Run: `node --test vendor/skills/public/chart-visualization/tests/generate.test.mjs`

Expected: all tests pass and no network request is issued.

```bash
git add vendor/skills/public/chart-visualization/scripts/generate.js \
  vendor/skills/public/chart-visualization/SKILL.md \
  vendor/skills/public/chart-visualization/CHANGELOG.md \
  vendor/skills/public/chart-visualization/tests/generate.test.mjs
git commit -m "feat(chart-skill): generate offline chart descriptors"
```

## Task 3: 提供运行时报告生成工具并更新报告技能

> 执行本任务前必须先完成 Task 4；完整执行顺序为 1 → 2 → 4 → 3 → 5 → 6 → 7。

**Files:**
- Create: `scripts/kstock_tools/report_dashboard_tool.py`
- Modify: `vendor/skills/public/analysis-report/SKILL.md`
- Modify: `vendor/skills/public/analysis-report/CHANGELOG.md`
- Modify: `config/qilin.config.yaml`
- Create: `tests/test_report_dashboard_tool.py`
- Modify: `tests/test_kstock_tools.py`

- [ ] **Step 1: Write failing tool tests**

在 `tests/test_report_dashboard_tool.py` 中构造 runtime fixture，覆盖：合法 JSON 写入 thread outputs 和报告库；非 `.html` 文件名被拒绝；同一 `report_id` 重新生成只保留一个归档文件；渲染失败不留下半成品。

- [ ] **Step 2: Run tool tests and verify RED**

Run: `python -m pytest tests/test_report_dashboard_tool.py -q`

Expected: collection fails because the report tool and archive service do not exist.

- [ ] **Step 3: Implement the runtime-injected tool**

定义 `@tool("render_html_report")` 的签名：

```python
def render_html_report_tool(
    runtime: Runtime,
    report_json: str,
    filename: str = "report.html",
) -> dict[str, Any]
```

工具从 runtime 解析当前 thread outputs 路径，限制文件名只允许安全的 `.html` 名称，解析 JSON，调用 `render_report()` 写临时 HTML，再原子写入线程 outputs；随后调用 `ReportLibraryStore.archive()` 写报告库。返回 `report_id`, `thread_id`, `thread_virtual_path`, `library_relative_path`, `size_bytes`。错误返回结构化 `error`，不留下半成品。

- [ ] **Step 4: Update the analysis-report skill and report-writer prompt**

把 `analysis-report/SKILL.md` 改成单 HTML 输入/输出契约，要求先构造分区 JSON，再调用 `render_html_report`，最后调用 `present_files` 呈现线程 HTML。删除三文件、远程图表 URL、Markdown 报告和深浅主题要求，保留研究结论、风险和来源约束。

在 `config/qilin.config.yaml` 中注册 `render_html_report` 工具；`report-writer` 输出改为“单个离线 HTML 数据看板”；从 `disallowed_tools` 移除 `present_files`，保持 `task`、`bash`、`ask_clarification` 禁止。

- [ ] **Step 5: Run focused tests and commit**

Run: `python -m pytest tests/test_report_dashboard_tool.py tests/test_kstock_tools.py -q`

Expected: all focused tests pass, including config tool-name consistency.

```bash
git add scripts/kstock_tools/report_dashboard_tool.py \
  vendor/skills/public/analysis-report/SKILL.md \
  vendor/skills/public/analysis-report/CHANGELOG.md \
  config/qilin.config.yaml \
  tests/test_report_dashboard_tool.py tests/test_kstock_tools.py
git commit -m "feat(report): add html dashboard runtime tool"
```

## Task 4: 实现报告库索引、归档和删除服务

**Files:**
- Create: `scripts/kstock_reports.py`
- Create: `tests/test_kstock_reports.py`
- Modify: `scripts/run_gateway.py`

- [ ] **Step 1: Write failing lifecycle tests**

覆盖以下函数行为：首次归档创建 `reports/YYYY/MM/DD/<report_id>.html` 和 `report_library` 行；同一报告跨日期更新只保留最新版；列表按日期/标的/关键词过滤；删除同时删除文件和索引；线程目录清理不影响报告根目录；归档失败保留旧报告。

- [ ] **Step 2: Run lifecycle tests and verify RED**

Run: `python -m pytest tests/test_kstock_reports.py -q`

Expected: collection fails because the module does not exist.

- [ ] **Step 3: Implement `ReportLibraryStore`**

实现以下接口：

```python
class ReportLibraryStore:
    def __init__(self, data_root: Path, db_path: Path | None = None): ...
    def archive(self, html_path: Path, report_id: str, thread_id: str,
                metadata: dict[str, Any]) -> dict[str, Any]: ...
    def list_reports(self, *, date: str | None = None,
                     symbol: str | None = None,
                     query: str | None = None) -> list[dict[str, Any]]: ...
    def get_report(self, report_id: str) -> dict[str, Any] | None: ...
    def open_report_path(self, report_id: str) -> Path: ...
    def delete(self, report_id: str) -> None: ...
```

使用 `<data_root>/reports/<user_id>/` 存放 HTML，使用用户数据空间持久 SQLite（默认 `<data_root>/runtime/qilin/data/qilin.db`）创建 `report_library` 表。表必须包含 `user_id`，唯一键和所有 CRUD 查询均以 `(user_id, report_id)` 为作用域。归档流程先写临时文件、校验路径和摘要，再用事务 upsert 索引；旧路径只在新文件和新索引成功后删除。所有路径必须限制在当前用户的报告根目录内。

- [ ] **Step 4: Initialize report storage in `run_gateway.py`**

`_ensure_data_space()` 新增 `reports_dir`，创建目录并返回路径；`create_app()` 将 `ReportLibraryStore` 放入 `app.state.kstock_report_store`，供运行时工具和自有路由复用。新增 `test_run_gateway.py` 断言目录创建和返回键存在。

- [ ] **Step 5: Run tests and commit**

Run: `python -m pytest tests/test_kstock_reports.py tests/test_run_gateway.py -q`

Expected: all tests pass.

```bash
git add scripts/kstock_reports.py tests/test_kstock_reports.py \
  scripts/run_gateway.py tests/test_run_gateway.py
git commit -m "feat(report): persist independent report library"
```

## Task 5: 增加 Gateway 报告库接口并隔离线程删除

**Files:**
- Create: `scripts/kstock_reports_router.py`
- Create: `tests/test_kstock_reports_router.py`
- Modify: `scripts/run_gateway.py`

- [ ] **Step 1: Write failing API tests**

使用 FastAPI `TestClient` 覆盖 `GET /api/v1/kstock/reports` 日期分组与筛选、`GET /api/v1/kstock/reports/{report_id}` HTML 返回、`DELETE /api/v1/kstock/reports/{report_id}` 只删除目标文件、来源线程删除后的“任务不可用”状态。

- [ ] **Step 2: Run API tests and verify RED**

Run: `python -m pytest tests/test_kstock_reports_router.py -q`

Expected: route is not registered and tests fail.

- [ ] **Step 3: Implement authenticated report routes**

路由通过当前用户身份解析 `user_id`，所有 store 调用必须显式传入该用户，只返回该账户的索引。HTML 响应使用 `FileResponse`，设置 `Content-Type: text/html; charset=utf-8` 和禁止缓存；`DELETE` 复用 `ReportLibraryStore.delete(user_id, report_id)`，不存在返回 404。路由禁止传入任意文件路径，只接受 `report_id`。

- [ ] **Step 4: Mount routes and verify thread deletion boundary**

在 `run_gateway.create_app()` 挂载 router。线程删除测试只验证线程资源被清理且报告库文件/索引仍存在；不修改 vendor 删除逻辑。

- [ ] **Step 5: Run tests and commit**

Run: `python -m pytest tests/test_kstock_reports_router.py tests/test_kstock_reports.py -q`

```bash
git add scripts/kstock_reports_router.py tests/test_kstock_reports_router.py scripts/run_gateway.py
git commit -m "feat(gateway): expose independent report library api"
```

## Task 6: 桌面端报告库与 HTML 预览

**Files:**
- Create: `apps/desktop/src/lib/reportsClient.ts`
- Create: `apps/desktop/src/components/ReportLibrary.tsx`
- Create: `apps/desktop/src/components/HtmlReportViewer.tsx`
- Create: `apps/desktop/src/tests/reportsClient.spec.ts`
- Create: `apps/desktop/src/tests/ReportLibrary.spec.tsx`
- Modify: `apps/desktop/src/pages/Home.tsx`
- Modify: `apps/desktop/src/components/ReportSettings.tsx`
- Modify: `apps/desktop/src/components/ReportPanel.tsx`
- Modify: `apps/desktop/src/lib/sessionStore.ts`
- Modify: `apps/desktop/src/lib/gatewayTypes.ts`
- Modify: `apps/desktop/src/styles.css`

- [ ] **Step 1: Write failing client and component tests**

覆盖：报告列表按日期分组；删除必须确认；iframe 使用 `sandbox="allow-scripts"` 且不含 `allow-same-origin`；设置页显示 HTML 看板而不显示旧格式；聊天 assistant 正文仍可 Markdown 渲染。

- [ ] **Step 2: Run focused Vitest tests and verify RED**

Run: `pnpm -C apps/desktop vitest run src/tests/reportsClient.spec.ts src/tests/ReportLibrary.spec.tsx`

Expected: modules and components are missing, so tests fail.

- [ ] **Step 3: Implement API client and viewer**

`reportsClient.ts` 定义 `ReportSummary`, `ReportListResponse`, `listReports`, `getReportUrl`, `deleteReport`。`HtmlReportViewer` 只接收受控 report id，并渲染：

```tsx
<iframe title="HTML 数据看板" sandbox="allow-scripts" src={url} />
```

不授予 `allow-same-origin`、`allow-forms` 或 `allow-top-navigation`。

- [ ] **Step 4: Add report library navigation and interactions**

在 `Home.tsx` 的侧边栏把“报告库”按钮接到独立视图。首次打开调用 `listReports()`，按 `generated_at` 的本地日期分组，支持标的/标题关键词筛选、打开和删除。删除复用现有 `ConfirmDialog`，成功后刷新列表；线程已删除时显示不可返回任务状态。

- [ ] **Step 5: Remove legacy report UI without removing chat Markdown**

`ReportSettings` 只保留 HTML 看板、离线资源、报告库目录和两个技能状态；移除 Markdown/PDF/DOCX 卡片及 thread outputs 报告说明。`ReportPanel` 改为当前报告摘要/打开看板按钮，`sessionStore` 不再创建 `reportMarkdown` 文件假数据，但 `AssistantTurn` 和 `ReasoningBlock` 继续使用 `lib/markdown.tsx`。

- [ ] **Step 6: Run focused tests and commit**

Run: `pnpm -C apps/desktop vitest run src/tests/reportsClient.spec.ts src/tests/ReportLibrary.spec.tsx`

Expected: all focused tests pass with no legacy format labels in the report settings component.

```bash
git add apps/desktop/src/lib/reportsClient.ts apps/desktop/src/components/ReportLibrary.tsx \
  apps/desktop/src/components/HtmlReportViewer.tsx apps/desktop/src/tests/reportsClient.spec.ts \
  apps/desktop/src/tests/ReportLibrary.spec.tsx apps/desktop/src/pages/Home.tsx \
  apps/desktop/src/components/ReportSettings.tsx apps/desktop/src/components/ReportPanel.tsx \
  apps/desktop/src/lib/sessionStore.ts apps/desktop/src/lib/gatewayTypes.ts apps/desktop/src/styles.css
git commit -m "feat(desktop): add independent html report library"
```

## Task 7: 更新模板文案、运行链和完整回归

**Files:**
- Modify: `config/qilin.config.yaml`
- Modify: `apps/desktop/src/pages/Home.tsx`
- Modify: `apps/desktop/src/lib/qilinSettings.ts`
- Modify: `docs/开发进度.md`
- Modify: `README.md`

- [ ] **Step 1: Search for legacy report output references**

Run:

```bash
rg -n "Markdown|PDF|DOCX|reportMarkdown|dark.html|light.html|md报告|报告草稿" \
  config apps/desktop/src vendor/skills/public/analysis-report README.md docs/开发进度.md
```

Expected: remaining Markdown references are only chat rendering, uploaded-document conversion, or historical documentation explicitly marked legacy; report output settings and report-writer prompt contain HTML-only wording.

- [ ] **Step 2: Update runtime prompt and settings metadata**

让 `report-writer` 的标准输出只包含 HTML dashboard JSON → `render_html_report` → `present_files`。让 `qilinSettings.ts` 的报告设置摘要显示 HTML/离线/报告库，不显示旧格式。

- [ ] **Step 3: Run the full verification suite**

Run:

```bash
python -m pytest -q
node --test vendor/skills/public/chart-visualization/tests/generate.test.mjs
pnpm -C apps/desktop test
pnpm -C apps/desktop build
git diff --check
```

Expected: Python tests pass with existing explicit skips, chart Node tests pass, all desktop tests pass, production build succeeds, and `git diff --check` is clean.

- [ ] **Step 4: Verify the offline artifact manually**

Generate a fixture report with `render_report.py`, inspect with:

```bash
rg -n "https?://|fetch\\(|XMLHttpRequest|WebSocket|\\.md|\\.pdf|\\.docx" <temporary-output>/report.html
```

Expected: no runtime network calls or legacy report file references; source URLs may only appear in escaped visible reference text.

- [ ] **Step 5: Commit documentation and final integration**

```bash
git add config/qilin.config.yaml apps/desktop/src/pages/Home.tsx \
  apps/desktop/src/lib/qilinSettings.ts docs/开发进度.md README.md
git commit -m "docs: describe html dashboard report delivery"
```

## Self-review checklist

- **Spec coverage:** Tasks 1-2 cover the single-file contract and offline chart skill; Task 4 covers user-scoped independent storage and date grouping; Task 3 covers analysis-report and runtime generation after Task 4; Task 5 covers API and thread deletion isolation; Task 6 covers desktop report library and sandboxed preview; Task 7 covers legacy format removal, documentation and full verification.
- **No placeholders:** Every task has concrete paths, test names or exact commands; no step depends on an unspecified follow-up.
- **Type consistency:** `report_id`, `thread_id`, `generated_at`, `sections`, `metrics`, `charts`, `coverage`, `references` are shared between the contract validator, runtime tool, archive metadata and desktop summary types.
- **Risk boundary:** Chart maps without offline geometry render an explicit fallback card; they are not silently dropped. Chat Markdown remains separate from report artifacts.
