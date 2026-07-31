# Changelog

## [1.1.0] - 2026-07-25

### Added
- 新增 `finance_data_gateway` 模块：`FinanceDataGateway` / `TushareDataAdapter` /
  `get_finance_data_gateway()` / `reset_finance_data_gateway()`，显式封装全部 49 个
  常用 Tushare 接口（股票/财务/股东/指数/资金流/基金/期货/期权/宏观）。
- `__init__` 导出 gateway 四个符号。
- SKILL.md 声明数据访问边界：分析技能禁止直接 `import tushare`，必须通过本网关访问。

### Changed
- 描述、版本号、capabilities、tags 同步反映 finance-data-gateway 能力。

## [1.0.0] - 2026-07-03

### Added
- Initial standardized package structure.
