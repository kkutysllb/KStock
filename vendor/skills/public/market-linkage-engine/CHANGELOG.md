# Changelog

## [1.0.1] - 2026-08-04

### Fixed
- `data/fetcher.py` 的 kk_common 自动注入路径多算一级：
  `../../../../common/src` 指向不存在的 `skills/common/src`，导致自动注入从未
  生效（只能依赖 PYTHONPATH 或 site-packages 兜底）。修正为 `../../../common/src`
  （到 `public/` 后取同级 `common/src`），任何目录结构正确的部署都可自动导入。

## [1.0.0] - 2026-07-03

### Added
- Initial standardized package structure.
