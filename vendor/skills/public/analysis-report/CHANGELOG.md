# Changelog

## [2.3.0] - 2026-07-25

### Added
- 英文触发式 `description`，覆盖分析、复盘、研究、回测和看板类任务。
- 强制输出 Markdown 报告 + 暗色/亮色双主题 HTML 看板三份交付物。
- 内置 `scripts/render_report.py` 作为统一渲染入口，并在写文件前严格校验图表契约。
- 新增 `tests/test_render_report.py`，覆盖契约校验与双主题输出。

### Removed
- 移除对 `md-to-html` 类技能的依赖；本技能不再调用任何 Markdown 转 HTML 工具。
- 移除报告中给出买入/卖出/持有等交易建议的旧约定，改为研究结论、情景条件与需跟踪指标。

## [2.2.0] - 2026-07-25

### Changed
- 要求同时输出 Markdown 结构化报告与暗色/亮色两份 HTML 看板。
- 新增对图表工具与参数的严格校验，依据 chart-visualization 字段契约。
- 暗色与亮色看板分别使用独立的图表 URL 与主题参数。

## [2.1.0] - 2026-07-25

### Changed
- 新增可执行渲染器 `scripts/render_report.py` 作为唯一的 HTML 渲染入口。
- 移除对传统 Markdown 转 HTML 转换流程的依赖。

## [1.0.0] - 2026-07-03

### Added
- Initial standardized package structure.
