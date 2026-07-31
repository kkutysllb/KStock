"""akshare 金融数据查询工具。

通过 akshare 查询 A 股/港股/美股的金融数据。
数据源：东方财富、新浪财经、同花顺等（国内官方渠道，免费，无限流）。

支持的数据类型：
  - quote：最新行情（取历史 K 线最后一天作为实时近似）
  - history：历史 K 线（默认最近 60 个交易日）
  - financials：利润表
  - balance_sheet：资产负债表
  - cashflow：现金流量表
  - dividends：分红历史

输入格式：
  - JSON：{"symbol": "600000", "data_type": "history", "days": 30}
  - 纯文本："600000"（默认查 quote）
  - 纯文本："600000 history"（查历史 K 线）
  - 纯文本："600000 financials"（查利润表）

A股代码：6 位数字，沪市 6 开头，深市 0/3 开头（如 600000、000001、300750）。
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

import pandas as pd
from langchain.tools import BaseTool


class FinanceDataSearchTool(BaseTool):
    """查询股票/基金/指数的金融数据（来源：akshare）。"""

    name: str = "finance_data_search"
    description: str = (
        "搜索股票/基金/指数的金融数据。支持：\n"
        "- quote：最新行情（价格、涨跌幅、换手率等）\n"
        "- history：历史 K 线数据（OHLCV）\n"
        "- financials：利润表\n"
        "- balance_sheet：资产负债表\n"
        "- cashflow：现金流量表\n"
        "- dividends：分红配送历史\n\n"
        "输入格式：\n"
        '  - JSON：{"symbol": "600000", "data_type": "history"}\n'
        '  - 纯文本："600000" 或 "600000 history"\n\n'
        "A股代码为 6 位数字（沪市 6 开头、深市 0/3 开头）。\n"
        "数据源：akshare（东方财富/新浪财经，国内免费无限流）。"
    )

    def _run(self, query: str) -> str:
        """同步执行查询。"""
        symbol, data_type, days = _parse_query(query)
        if not symbol:
            return _error("股票代码不能为空。")

        try:
            import akshare as ak
        except ImportError:
            return _error("akshare 未安装。请运行 uv sync 安装依赖。")

        try:
            if data_type == "quote":
                return _format_quote(ak, symbol)
            elif data_type == "history":
                return _format_history(ak, symbol, days)
            elif data_type == "financials":
                df = ak.stock_financial_report_sina(stock=symbol, symbol="利润表")
                return _format_dataframe(df, symbol, "利润表")
            elif data_type == "balance_sheet":
                df = ak.stock_financial_report_sina(stock=symbol, symbol="资产负债表")
                return _format_dataframe(df, symbol, "资产负债表")
            elif data_type == "cashflow":
                df = ak.stock_financial_report_sina(stock=symbol, symbol="现金流量表")
                return _format_dataframe(df, symbol, "现金流量表")
            elif data_type == "dividends":
                df = ak.stock_history_dividend_detail(symbol=symbol, indicator="分红")
                return _format_dividends(df, symbol)
            else:
                return _error(
                    f"未知 data_type '{data_type}'。支持: quote / history / financials / "
                    "balance_sheet / cashflow / dividends"
                )
        except Exception as exc:
            return _error(f"查询 {symbol}({data_type}) 失败：{exc}")

    async def _arun(self, query: str) -> str:
        """异步执行（当前直接调用同步实现）。"""
        return self._run(query)


# ── 单例导出 ────────────────────────────────────────────────────────

finance_data_search_tool = FinanceDataSearchTool()


# ── 解析与格式化工具 ────────────────────────────────────────────────


def _parse_query(query: str) -> tuple[str, str, int]:
    """解析 query 为 (symbol, data_type, days)。

    支持格式：
      - JSON: {"symbol": "600000", "data_type": "history", "days": 30}
      - 纯文本: "600000" → ("600000", "quote", 60)
      - 纯文本: "600000 history" → ("600000", "history", 60)
      - 纯文本: "600000 history 30" → ("600000", "history", 30)
    """
    query = query.strip()
    if query.startswith("{"):
        try:
            data = json.loads(query)
            return (
                str(data.get("symbol", "")).strip(),
                str(data.get("data_type", "quote")).strip(),
                int(data.get("days", 60)),
            )
        except (json.JSONDecodeError, ValueError, TypeError):
            pass

    parts = query.split()
    if not parts:
        return ("", "quote", 60)

    symbol = _normalize_symbol(parts[0])
    data_type = parts[1] if len(parts) > 1 else "quote"
    days = 60
    if len(parts) > 2:
        try:
            days = int(parts[2])
        except ValueError:
            pass
    return (symbol, data_type, days)


def _normalize_symbol(raw: str) -> str:
    """规范化股票代码：剥离 .SS/.SZ/.SH 等后缀，只保留 6 位数字。

    yfinance 用 600000.SS 格式，akshare 用纯数字 600000。
    """
    raw = raw.strip().upper()
    # 剥离常见后缀
    for suffix in (".SS", ".SZ", ".SH", ".BJ"):
        if raw.endswith(suffix):
            raw = raw[: -len(suffix)]
            break
    return raw


def _to_sina_symbol(symbol: str) -> str:
    """akshare 纯数字代码转新浪格式：600000 → sh600000，000001 → sz000001。"""
    if symbol.startswith("6"):
        return f"sh{symbol}"
    return f"sz{symbol}"


def _get_hist(ak: Any, symbol: str, lookback_days: int) -> pd.DataFrame:
    """获取 A 股历史 K 线，多源 fallback。

    源1：东方财富 stock_zh_a_hist（列名中文，含涨跌幅/成交额/换手率等）。
    源2（fallback）：新浪 stock_zh_a_daily（列名英文，走 finance.sina.com.cn，
        更稳定但字段较少）。

    返回统一中文列名的 DataFrame（失败返回空 DataFrame）。
    """
    end = datetime.now().strftime("%Y%m%d")
    start = (datetime.now() - timedelta(days=lookback_days * 2)).strftime("%Y%m%d")

    # 源1：东方财富
    try:
        df = ak.stock_zh_a_hist(
            symbol=symbol, period="daily",
            start_date=start, end_date=end, adjust="qfq",
        )
        if df is not None and not df.empty:
            return df
    except Exception:
        pass

    # 源2：新浪（fallback）
    sina_symbol = _to_sina_symbol(symbol)
    df = ak.stock_zh_a_daily(
        symbol=sina_symbol, start_date=start, end_date=end, adjust="qfq",
    )
    if df is None or df.empty:
        return pd.DataFrame()
    # 映射英文列名为中文（与东方财富一致）
    return df.rename(columns={
        "date": "日期", "open": "开盘", "high": "最高", "low": "最低",
        "close": "收盘", "volume": "成交量", "amount": "成交额",
        "outstanding_share": "流通股本", "turnover": "换手率",
    })


def _format_quote(ak: Any, symbol: str) -> str:
    """格式化最新行情（从历史 K 线取最后一天）。"""
    hist = _get_hist(ak, symbol, lookback_days=30)
    if hist is None or hist.empty:
        return _error(f"未获取到 {symbol} 的行情数据（可能是无效代码或非 A 股）。")

    last = hist.iloc[-1]
    lines = [f"## {symbol} 最新行情\n"]
    col_map = {
        "日期": "日期",
        "开盘": "开盘",
        "收盘": "收盘",
        "最高": "最高",
        "最低": "最低",
        "成交量": "成交量",
        "成交额": "成交额",
        "振幅": "振幅(%)",
        "涨跌幅": "涨跌幅(%)",
        "涨跌额": "涨跌额",
        "换手率": "换手率(%)",
    }
    for src, label in col_map.items():
        if src in hist.columns:
            val = last[src]
            if src in ("成交量",) and val:
                lines.append(f"- **{label}**：{val:,.0f}")
            elif src in ("成交额",) and val:
                lines.append(f"- **{label}**：{val/1e8:,.2f} 亿")
            elif src in ("开盘", "收盘", "最高", "最低"):
                lines.append(f"- **{label}**：{val:.2f}")
            else:
                lines.append(f"- **{label}**：{val}")
    return "\n".join(lines)


def _format_history(ak: Any, symbol: str, days: int) -> str:
    """格式化历史 K 线数据。"""
    days = max(min(days, 365), 5)  # 限制 5-365 天
    hist = _get_hist(ak, symbol, lookback_days=days)
    if hist is None or hist.empty:
        return _error(f"未获取到 {symbol} 的历史数据。")

    recent = hist.tail(days)
    lines = [f"## {symbol} 历史行情（最近 {len(recent)} 条）\n"]
    lines.append("| 日期 | 开盘 | 最高 | 最低 | 收盘 | 涨跌幅(%) | 成交量 |")
    lines.append("|------|------|------|------|------|-----------|--------|")
    for _, row in recent.iterrows():
        vol = row.get("成交量", 0)
        lines.append(
            f"| {row['日期']} "
            f"| {row['开盘']:.2f} "
            f"| {row['最高']:.2f} "
            f"| {row['最低']:.2f} "
            f"| {row['收盘']:.2f} "
            f"| {row.get('涨跌幅', 0):.2f} "
            f"| {vol:,.0f} |"
        )
    return "\n".join(lines)


def _format_dataframe(df: Any, symbol: str, title: str) -> str:
    """格式化 DataFrame（财报类）为 markdown 表格。

    stock_financial_report_sina 返回的 DataFrame：
      - 行是报告期（倒序，最新在最前）
      - 列是财务指标（报告日、营业收入、净利润...）
    """
    if df is None or df.empty:
        return _error(f"未获取到 {symbol} 的{title}数据。")

    lines = [f"## {symbol} {title}（最近 4 期）\n"]
    # 最多展示前 4 期（最新 4 期报告）+ 前 12 个核心指标
    cols = list(df.columns[:12])
    recent = df.head(4)
    lines.append("| 指标 | " + " | ".join(str(c) for c in cols) + " |")
    lines.append("|------|" + "|".join(["------" for _ in cols]) + "|")
    for _, row in recent.iterrows():
        vals = []
        for col in cols:
            val = row[col]
            if val is None or val == 0 or (isinstance(val, float) and val != val):
                vals.append("—")
            elif isinstance(val, (int, float)):
                if abs(val) >= 1e8:
                    vals.append(f"{val/1e8:,.2f}亿")
                elif abs(val) >= 1e4:
                    vals.append(f"{val/1e4:,.2f}万")
                else:
                    vals.append(f"{val:,.2f}")
            else:
                vals.append(str(val))
        lines.append(f"| {''} | " + " | ".join(vals) + " |")
    return "\n".join(lines)


def _format_dividends(df: Any, symbol: str) -> str:
    """格式化分红历史。"""
    if df is None or df.empty:
        return _error(f"未获取到 {symbol} 的分红历史。")

    recent = df.tail(15)
    lines = [f"## {symbol} 分红历史（最近 {len(recent)} 次）\n"]
    lines.append("| 公告日期 | 送股 | 转增 | 派息(税前) | 进度 | 除权除息日 |")
    lines.append("|----------|------|------|-----------|------|-----------|")
    for _, row in recent.iterrows():
        lines.append(
            f"| {row.get('公告日期', '')} "
            f"| {row.get('送股', 0)} "
            f"| {row.get('转增', 0)} "
            f"| {row.get('派息', 0)} "
            f"| {row.get('进度', '')} "
            f"| {row.get('除权除息日', '')} |"
        )
    return "\n".join(lines)


def _error(msg: str) -> str:
    """格式化错误消息。"""
    return f"⚠️ {msg}"
