# Changelog

## [1.1.0] - 2026-08-02

### Added
- 新增可转债周度全景综合引擎 analyze_weekly_cb.py（Tushare Pro，ISO 自然周聚合）：
  市场温度（中证转债指数 000832.CSI 周涨跌/周均成交/近 N 周对比）、市场规模与结构
  （存续只数/总余额/新上市/退市/条款事件）、估值全景（均价/平均溢价率/双低/价格分档）、
  资金与情绪（周成交总额/周均日成交）、双低策略池 TOP10、综合研判（0-100 分评分与
  积极/风险信号）；支持 --weeks 回溯与 --json 输出。
- SKILL.md v1.1.0：新增 cb-weekly capability 与「引擎4: 周度综合引擎」执行方式、
  周度口径说明；requires / required-secrets 新增 TUSHARE_TOKEN。

## [1.0.0] - 2026-07-03

### Added
- Initial standardized package structure.
