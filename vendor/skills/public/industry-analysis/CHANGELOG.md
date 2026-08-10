# Changelog

## [2.0.1] - 2026-08-10

### Fixed
- `scripts/analyze_industry.py` 数据层 pywencai 与 Node 22 不兼容：
  pywencai 内部调用 node 脚本，Node 22 的 `punycode` 弃用警告打印到 stdout
  污染 JSON 输出，导致解析失败返回 None（`'NoneType' object has no attribute 'get'`）。
  修复：`WencaiDataLayer.query()` 优先走本项目自带网关 CLI
  （`industry-query-cli.py`，IWENCAI_API_KEY，跨 Node 版本稳定），pywencai 降级为兜底。
- `get_industry_overview` 网关返回的「所属同花顺行业」列为 list（pywencai 为字符串），
  `value_counts()` 报 `unhashable type: 'list'`。修复：explode 扁平化后统计。
- `analyze_industry()` 入口可用性检查改为「网关 CLI 或 pywencai 任一可用」。

## [2.0.0] - 2026-07-03

### Added
- Initial standardized package structure.
