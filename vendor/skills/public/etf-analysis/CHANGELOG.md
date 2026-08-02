# Changelog

## [1.2.0] - 2026-08-02

### Added
- 期权ETF / 普通ETF 双标的池：期权 ETF 硬编码 7 大默认池；普通 ETF 不设默认池，由用户通过 `--symbols` 输入代码。
- 周度引擎输出自动标注标的类型（期权ETF/普通ETF），概览/对比表新增类型列，普通 ETF 提示无期权联动维度。
- SKILL.md 新增「标的池区分（期权ETF vs 普通ETF）」章节。

## [1.1.0] - 2026-08-02

### Added
- 新增期权ETF周度综合引擎 analyze_weekly_etf.py（ISO 自然周聚合）。

## [1.0.0] - 2026-07-03

### Added
- Initial standardized package structure.
