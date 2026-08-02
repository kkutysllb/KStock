# Changelog

## [3.6.0] - 2026-08-02

### Removed
- 移除机器学习趋势预测引擎（analyze_trend_prediction.py / run_trend_model_train.py）及其全部文档引用（SKILL.md/README），十四维分析体系同步重编号。
- 移除依赖声明中的 tushare / scikit-learn / lightgbm（数据经 common 网关获取，禁止直接 import tushare）。

### Fixed
- 修复 analyze_financial_report.py / analyze_technical.py 导入 `analysis.*` 包失败（ModuleNotFoundError，analysis/ 目录不存在），改为同目录库模块导入。

### Changed
- SKILL.md / README 目录结构与实际对齐（selection-strategies 指向独立技能、chan_theory_v2 位于根目录、移除虚构的 ml-prediction/adapters/package.sh）。
- 依赖声明统一以 SKILL.md frontmatter requires.packages 为准（内置 Python 客户端已预装依赖，不提供 requirements.txt）。

## [3.5.0] - 2026-07-03

### Added
- Initial standardized package structure.
