"""akshare 财经新闻搜索工具。

通过 akshare 搜索财经新闻。
数据源：东方财富、CCTV 新闻联播等（国内官方渠道，免费，无限流）。

支持两种查询模式：
  1. 按股票代码：返回该股票相关新闻（来源：东方财富个股新闻）
  2. 按关键词：在最近 7 天 CCTV 新闻联播财经条目中筛选

输入格式：
  - JSON：{"query": "600000", "max_results": 10}
  - 纯文本（6 位数字）："600000" → 按股票代码查
  - 纯文本（关键词）："美联储加息" → 在 CCTV 新闻中筛选
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any

from langchain.tools import BaseTool


class FinanceNewsSearchTool(BaseTool):
    """搜索财经新闻和资讯（来源：akshare）。"""

    name: str = "finance_news_search"
    description: str = (
        "搜索财经新闻和资讯。按关键词或股票代码搜索最新的财经新闻、\n"
        "政策动态、行业革新、企业业务进展等。\n\n"
        "输入格式：\n"
        '  - JSON：{"query": "600000", "max_results": 10}\n'
        "  - 纯文本 6 位数字（股票代码）：查该股相关新闻（东方财富）\n"
        "  - 纯文本关键词（如 \"美联储加息\"）：在 CCTV 新闻联播中筛选\n\n"
        "返回：新闻条目列表（标题、摘要、来源、时间、链接）。\n"
        "数据源：akshare（东方财富/CCTV，国内免费无限流）。"
    )

    def _run(self, query: str) -> str:
        """同步执行搜索。"""
        keywords, max_results = _parse_query(query)
        if not keywords:
            return _error("搜索关键词不能为空。")

        try:
            import akshare as ak
        except ImportError:
            return _error("akshare 未安装。请运行 uv sync 安装依赖。")

        try:
            if _is_stock_code(keywords):
                return _search_by_stock(ak, keywords, max_results)
            else:
                return _search_by_keyword(ak, keywords, max_results)
        except Exception as exc:
            return _error(f"搜索失败：{exc}")

    async def _arun(self, query: str) -> str:
        """异步执行（当前直接调用同步实现）。"""
        return self._run(query)


# ── 单例导出 ────────────────────────────────────────────────────────

finance_news_search_tool = FinanceNewsSearchTool()


# ── 工具函数 ────────────────────────────────────────────────────────


def _parse_query(query: str) -> tuple[str, int]:
    """解析 query 为 (keywords, max_results)。"""
    query = query.strip()
    if query.startswith("{"):
        try:
            data = json.loads(query)
            return (
                str(data.get("query", "")).strip(),
                int(data.get("max_results", 10)),
            )
        except (json.JSONDecodeError, ValueError, TypeError):
            pass
    return (query, 10)


def _is_stock_code(s: str) -> bool:
    """判断是否为 A 股股票代码（6 位纯数字）。"""
    return s.isdigit() and len(s) == 6


def _search_by_stock(ak: Any, code: str, max_results: int) -> str:
    """按股票代码搜索新闻（东方财富个股新闻）。"""
    df = ak.stock_news_em(symbol=code)
    if df is None or df.empty:
        return _info(f"未找到与股票 {code} 相关的新闻。")

    n = min(len(df), max_results)
    lines = [f"## 股票 {code} 相关新闻（共 {n} 条）\n"]
    for i in range(n):
        row = df.iloc[i]
        title = row.get("新闻标题", "（无标题）")
        content = str(row.get("新闻内容", "") or "")[:300]
        source = row.get("文章来源", "")
        time = row.get("发布时间", "")
        link = row.get("新闻链接", "")
        lines.append(f"### {i + 1}. {title}")
        if time:
            lines.append(f"**时间**：{time}")
        if source:
            lines.append(f"**来源**：{source}")
        if content:
            lines.append(f"**摘要**：{content}")
        if link:
            lines.append(f"**链接**：{link}")
        lines.append("")
    return "\n".join(lines)


def _search_by_keyword(ak: Any, keyword: str, max_results: int) -> str:
    """按关键词在最近 7 天 CCTV 新闻联播中筛选。"""
    # 拉取最近 7 天的 CCTV 新闻
    end = datetime.now()
    collected: list[dict[str, Any]] = []
    for offset in range(7):
        date = end - timedelta(days=offset)
        try:
            df = ak.news_cctv(date=date.strftime("%Y%m%d"))
        except Exception:
            continue
        if df is None or df.empty:
            continue
        for _, row in df.iterrows():
            title = str(row.get("title", ""))
            content = str(row.get("content", ""))
            # 关键词匹配（标题或正文）
            if keyword.lower() in title.lower() or keyword.lower() in content.lower():
                collected.append({
                    "date": str(row.get("date", date.strftime("%Y%m%d"))),
                    "title": title,
                    "content": content,
                })
                if len(collected) >= max_results:
                    break
        if len(collected) >= max_results:
            break

    if not collected:
        return _info(f"最近 7 天 CCTV 新闻联播未找到含「{keyword}」的条目。")

    lines = [f"## 搜索「{keyword}」— 找到 {len(collected)} 条结果\n"]
    for i, item in enumerate(collected, 1):
        lines.append(f"### {i}. {item['title']}")
        lines.append(f"**日期**：{item['date']}")
        if item["content"]:
            lines.append(f"**摘要**：{item['content'][:300]}")
        lines.append("")
    return "\n".join(lines)


def _error(msg: str) -> str:
    return f"⚠️ {msg}"


def _info(msg: str) -> str:
    return f"ℹ️ {msg}"
