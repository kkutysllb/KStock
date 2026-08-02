"""KStock 金融搜索工具测试。

分为两部分：
  1. 单元测试：mock akshare 接口，验证数据格式与错误处理。
  2. 真实调用冒烟测试（test_*_real_*）：直连 akshare 验证真实可用性，
     在受限/离线环境下自动跳过（AKSHARE_REAL_TEST=1 时才跑）。

akshare 接口返回 pandas.DataFrame，这里构造等价 DataFrame 作为 mock 返回值。
"""
import os
from pathlib import Path
from unittest.mock import patch

import pandas as pd
import pytest
import yaml

from scripts.kstock_tools.akshare_data_tool import (
    finance_data_search_tool,
    _normalize_symbol,
    _to_sina_symbol,
    _parse_query as _parse_data_query,
)
from scripts.kstock_tools.akshare_news_tool import (
    finance_news_search_tool,
    _is_stock_code,
    _parse_query as _parse_news_query,
)
from scripts.kstock_tools.report_dashboard_tool import (
    render_html_report_from_file_tool,
    render_html_report_tool,
)


# ── 是否启用真实调用测试 ────────────────────────────────────────────
_REAL_ENABLED = os.environ.get("AKSHARE_REAL_TEST") == "1"
real_only = pytest.mark.skipif(not _REAL_ENABLED, reason="需 AKSHARE_REAL_TEST=1 才跑真实调用")


# ── 辅助 mock 数据 ──────────────────────────────────────────────────


def _mock_hist_df() -> pd.DataFrame:
    """构造与 ak.stock_zh_a_hist 等价的 DataFrame。"""
    return pd.DataFrame(
        {
            "日期": ["2025-01-16", "2025-01-17", "2025-01-20"],
            "股票代码": ["600000"] * 3,
            "开盘": [9.40, 9.42, 9.49],
            "收盘": [9.38, 9.44, 9.54],
            "最高": [9.45, 9.47, 9.62],
            "最低": [9.30, 9.25, 9.40],
            "成交量": [400000, 416632, 374426],
            "成交额": [3.7e8, 4.27e8, 3.89e8],
            "振幅": [1.60, 2.35, 2.33],
            "涨跌幅": [-0.21, 0.64, 1.06],
            "涨跌额": [-0.02, 0.06, 0.10],
            "换手率": [0.13, 0.14, 0.13],
        }
    )


def _mock_financials_df() -> pd.DataFrame:
    """构造与 ak.stock_financial_report_sina 等价的 DataFrame。"""
    return pd.DataFrame(
        {
            "报告日": ["2024-09-30", "2024-06-30", "2024-03-31", "2023-12-31"],
            "营业收入": [1.3e11, 8.5e10, 4.2e10, 1.7e11],
            "净利息收入": [2.5e10, 1.7e10, 8.5e9, 3.4e10],
            "净利润": [5.5e10, 3.6e10, 1.8e10, 7.2e10],
        }
    )


def _mock_dividends_df() -> pd.DataFrame:
    import datetime
    return pd.DataFrame(
        {
            "公告日期": [datetime.date(2024, 7, 1), datetime.date(2023, 7, 1)],
            "送股": [0, 0],
            "转增": [0, 0],
            "派息": [1.5, 1.2],
            "进度": ["实施", "实施"],
            "除权除息日": [datetime.date(2024, 7, 6), datetime.date(2023, 7, 5)],
            "股权登记日": [datetime.date(2024, 7, 5), datetime.date(2023, 7, 4)],
            "红股上市日": [pd.NaT, pd.NaT],
        }
    )


def _mock_news_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "关键词": ["600000"] * 3,
            "新闻标题": [
                "浦发银行三季报：净利润同比增长",
                "银行板块整体走强 浦发银行领涨",
                "浦发银行获大行买入评级",
            ],
            "新闻内容": [
                "浦发银行发布三季报，净利润同比增长 5%...",
                "今日银行板块表现强势，浦发银行涨逾 2%...",
                "多家券商给予浦发银行买入评级...",
            ],
            "发布时间": ["2025-01-20 17:30:00", "2025-01-19 16:00:00", "2025-01-18 09:15:00"],
            "文章来源": ["证券时报", "财联社", "中证报"],
            "新闻链接": [
                "https://example.com/news/1",
                "https://example.com/news/2",
                "https://example.com/news/3",
            ],
        }
    )


def _mock_cctv_df() -> pd.DataFrame:
    return pd.DataFrame(
        {
            "date": ["2025-01-20", "2025-01-20"],
            "title": [
                "美联储宣布维持利率不变",
                "国务院召开常务会议部署经济工作",
            ],
            "content": [
                "美联储周三宣布维持联邦基金利率目标区间不变...",
                "会议研究部署进一步推动经济回升向好的举措...",
            ],
        }
    )


# ── 配置一致性 ──────────────────────────────────────────────────────


def test_tool_names_match_config():
    """工具 name 属性与 yaml 配置一致。"""
    config_path = Path(__file__).resolve().parent.parent / "config" / "qilin.config.yaml"
    with config_path.open(encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh)
    names = {t["name"] for t in cfg.get("tools", [])}
    assert "finance_data_search" in names
    assert "finance_news_search" in names
    assert "render_html_report" in names
    assert "render_html_report_from_file" in names
    assert finance_data_search_tool.name == "finance_data_search"
    assert finance_news_search_tool.name == "finance_news_search"
    assert render_html_report_tool.name == "render_html_report"
    assert render_html_report_from_file_tool.name == "render_html_report_from_file"


def test_config_references_akshare_modules():
    """yaml 工具引用已切换为 akshare 模块（不是旧的 yfinance/duckduckgo）。"""
    config_path = Path(__file__).resolve().parent.parent / "config" / "qilin.config.yaml"
    with config_path.open(encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh)
    uses = {t["use"] for t in cfg.get("tools", [])}
    assert any("akshare_data_tool" in u for u in uses)
    assert any("akshare_news_tool" in u for u in uses)
    # 旧模块不应再出现
    assert not any("yfinance_tool" in u for u in uses)
    assert not any("duckduckgo_news_tool" in u for u in uses)


# ── 解析逻辑 ────────────────────────────────────────────────────────


def test_normalize_symbol_strips_suffix():
    """规范化股票代码：剥离 .SS/.SZ/.SH 等后缀。"""
    assert _normalize_symbol("600000.SS") == "600000"
    assert _normalize_symbol("000001.SZ") == "000001"
    assert _normalize_symbol("600000") == "600000"
    assert _normalize_symbol("  600000.sh  ") == "600000"


def test_to_sina_symbol():
    """纯数字代码转新浪格式：6 开头 → sh，其他 → sz。"""
    assert _to_sina_symbol("600000") == "sh600000"
    assert _to_sina_symbol("000001") == "sz000001"
    assert _to_sina_symbol("300750") == "sz300750"


def test_parse_data_query_json():
    """JSON 格式数据查询解析。"""
    symbol, dtype, days = _parse_data_query('{"symbol": "600000", "data_type": "history", "days": 30}')
    assert symbol == "600000"
    assert dtype == "history"
    assert days == 30


def test_parse_data_query_plain():
    """纯文本格式数据查询解析（含后缀规范化）。"""
    symbol, dtype, days = _parse_data_query("600000.SS history 60")
    assert symbol == "600000"
    assert dtype == "history"
    assert days == 60


def test_is_stock_code():
    """6 位数字判定为 A 股代码。"""
    assert _is_stock_code("600000")
    assert _is_stock_code("000001")
    assert not _is_stock_code("美联储加息")
    assert not _is_stock_code("AAPL")
    assert not _is_stock_code("60000")  # 5 位不算


def test_parse_news_query_json():
    """新闻 JSON 解析 max_results。"""
    kw, n = _parse_news_query('{"query": "600000", "max_results": 5}')
    assert kw == "600000"
    assert n == 5


# ── 数据工具 mock 测试 ──────────────────────────────────────────────


@patch("akshare.stock_zh_a_hist")
def test_data_quote_uses_last_day(mock_hist):
    """quote 取历史 K 线最后一天作为最新行情。"""
    mock_hist.return_value = _mock_hist_df()
    result = finance_data_search_tool._run("600000")
    mock_hist.assert_called_once()
    # 返回包含关键字段
    assert "600000" in result
    assert "最新行情" in result
    # 最后一天收盘 9.54，应出现在结果
    assert "9.54" in result
    assert "1.06" in result  # 涨跌幅


@patch("akshare.stock_zh_a_hist")
def test_data_history_format(mock_hist):
    """history 输出 markdown 表格。"""
    mock_hist.return_value = _mock_hist_df()
    result = finance_data_search_tool._run("600000 history 10")
    assert "历史行情" in result
    assert "开盘" in result
    assert "收盘" in result
    assert "涨跌幅" in result
    # 3 条数据全部出现
    assert "2025-01-16" in result
    assert "2025-01-20" in result


@patch("akshare.stock_financial_report_sina")
def test_data_financials_format(mock_fin):
    """financials 输出利润表 markdown 表格。"""
    mock_fin.return_value = _mock_financials_df()
    result = finance_data_search_tool._run("600000 financials")
    mock_fin.assert_called_once_with(stock="600000", symbol="利润表")
    assert "利润表" in result
    assert "营业收入" in result
    # 数值会被转换为"亿"单位（1.3e11 → 1300.00亿）
    assert "亿" in result


@patch("akshare.stock_history_dividend_detail")
def test_data_dividends_format(mock_div):
    """dividends 输出分红历史。"""
    mock_div.return_value = _mock_dividends_df()
    result = finance_data_search_tool._run("600000 dividends")
    mock_div.assert_called_once_with(symbol="600000", indicator="分红")
    assert "分红历史" in result
    assert "1.5" in result  # 最新一次派息


@patch("akshare.stock_zh_a_hist")
def test_data_quote_error_on_empty(mock_hist):
    """无数据时返回友好错误。"""
    mock_hist.return_value = pd.DataFrame()
    result = finance_data_search_tool._run("999999")
    assert "⚠️" in result
    assert "999999" in result


def test_data_empty_symbol_error():
    """空股票代码返回错误。"""
    result = finance_data_search_tool._run("   ")
    assert "⚠️" in result
    assert "不能为空" in result


def test_data_unknown_data_type_error():
    """未知 data_type 返回错误。"""
    result = finance_data_search_tool._run("600000 unknown_type")
    assert "⚠️" in result
    assert "unknown_type" in result


@patch("akshare.stock_zh_a_hist")
@patch("akshare.stock_zh_a_daily")
def test_data_quote_fallback_to_sina(mock_daily, mock_hist):
    """东方财富 stock_zh_a_hist 报错时，自动 fallback 到新浪 stock_zh_a_daily。"""
    # 源1 东方财富报错
    mock_hist.side_effect = Exception("proxy error")
    # 源2 新浪返回英文列名 DataFrame
    mock_daily.return_value = pd.DataFrame({
        "date": ["2025-01-20"],
        "open": [9.49],
        "high": [9.62],
        "low": [9.40],
        "close": [9.54],
        "volume": [374426],
        "amount": [3.89e8],
        "outstanding_share": [2.9e10],
        "turnover": [0.0013],
    })
    result = finance_data_search_tool._run("600000")
    # 调用了新浪 fallback
    mock_daily.assert_called_once()
    sina_args = mock_daily.call_args
    assert sina_args.kwargs["symbol"] == "sh600000"  # 6 开头 → sh 前缀
    # 结果成功格式化（中文列名被映射）
    assert "⚠️" not in result
    assert "600000" in result
    assert "最新行情" in result
    assert "9.54" in result  # 收盘价


@patch("akshare.stock_zh_a_hist")
@patch("akshare.stock_zh_a_daily")
def test_data_history_fallback_to_sina(mock_daily, mock_hist):
    """history 查询东方财富报错时也能 fallback 到新浪。"""
    mock_hist.side_effect = Exception("proxy error")
    mock_daily.return_value = pd.DataFrame({
        "date": ["2025-01-16", "2025-01-20"],
        "open": [9.40, 9.49],
        "high": [9.45, 9.62],
        "low": [9.30, 9.40],
        "close": [9.38, 9.54],
        "volume": [400000, 374426],
        "amount": [3.7e8, 3.89e8],
        "outstanding_share": [2.9e10, 2.9e10],
        "turnover": [0.0014, 0.0013],
    })
    result = finance_data_search_tool._run("000001 history 10")
    # 0 开头 → sz 前缀
    assert mock_daily.call_args.kwargs["symbol"] == "sz000001"
    assert "⚠️" not in result
    assert "历史行情" in result
    assert "9.54" in result


# ── 新闻工具 mock 测试 ──────────────────────────────────────────────


@patch("akshare.stock_news_em")
def test_news_by_stock_code(mock_news):
    """按股票代码查新闻（东方财富个股新闻）。"""
    mock_news.return_value = _mock_news_df()
    result = finance_news_search_tool._run("600000")
    mock_news.assert_called_once_with(symbol="600000")
    assert "600000" in result
    assert "浦发银行三季报" in result
    assert "证券时报" in result
    assert "https://example.com/news/1" in result


@patch("akshare.news_cctv")
def test_news_by_keyword_cctv(mock_cctv):
    """关键词在 CCTV 新闻中筛选。"""
    mock_cctv.return_value = _mock_cctv_df()
    result = finance_news_search_tool._run("美联储")
    assert "美联储" in result
    # 只有第一条标题含"美联储"，第二条不含
    assert "维持利率不变" in result
    assert "找到" in result


@patch("akshare.news_cctv")
def test_news_keyword_no_match(mock_cctv):
    """关键词无匹配时返回友好提示。"""
    mock_cctv.return_value = _mock_cctv_df()
    result = finance_news_search_tool._run("某极冷门关键词")
    assert "ℹ️" in result
    assert "某极冷门关键词" in result


@patch("akshare.stock_news_em")
def test_news_stock_empty(mock_news):
    """股票无新闻时返回友好提示。"""
    mock_news.return_value = pd.DataFrame()
    result = finance_news_search_tool._run("999999")
    assert "ℹ️" in result
    assert "999999" in result


def test_news_empty_query_error():
    """空关键词返回错误。"""
    result = finance_news_search_tool._run("   ")
    assert "⚠️" in result
    assert "不能为空" in result


# ════════════════════════════════════════════════════════════════════
# 真实调用冒烟测试（默认跳过，AKSHARE_REAL_TEST=1 时执行）
# ════════════════════════════════════════════════════════════════════


def _is_sandbox_network_error(result: str) -> bool:
    """检测是否为沙箱代理拦截（push2his/push2.eastmoney.com 等域名被拦）。"""
    network_errs = ("ProxyError", "Max retries exceeded", "RemoteDisconnected", "HTTPSConnectionPool")
    return "⚠️" in result and any(e in result for e in network_errs)


@real_only
def test_real_data_quote():
    """真实调用：查询 600000 浦发银行最新行情。

    沙箱环境 push2his.eastmoney.com 可能被代理拦截，此时 xfail。
    """
    result = finance_data_search_tool._run("600000")
    print("\n[real quote] →", result[:200])
    if _is_sandbox_network_error(result):
        pytest.xfail("沙箱代理拦截 push2his.eastmoney.com，请在用户环境验证")
    assert "600000" in result
    assert "⚠️" not in result


@real_only
def test_real_data_history():
    """真实调用：查询 600000 最近 10 天历史 K 线。

    沙箱环境 push2his.eastmoney.com 可能被代理拦截，此时 xfail。
    """
    result = finance_data_search_tool._run("600000 history 10")
    print("\n[real history] →", result[:200])
    if _is_sandbox_network_error(result):
        pytest.xfail("沙箱代理拦截 push2his.eastmoney.com，请在用户环境验证")
    assert "600000" in result
    assert "日期" in result


@real_only
def test_real_news_by_stock():
    """真实调用：查询 600000 相关新闻（东方财富，沙箱可用）。"""
    result = finance_news_search_tool._run("600000")
    print("\n[real news by stock] →", result[:200])
    if _is_sandbox_network_error(result):
        pytest.xfail("沙箱网络限制")
    assert "600000" in result
    assert "⚠️" not in result
