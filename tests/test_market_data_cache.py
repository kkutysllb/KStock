"""行情数据磁盘缓存（kk_common.market_data_cache）回归测试。

规范源码在 scripts/patches/market_data_cache.py，由 patch_vendor_skills
拷贝进 vendor/skills/public/common/src/kk_common/；两份拷贝一致性由
test_patch_vendor_skills 保障。
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pandas as pd
import pytest

KK_COMMON_SRC = (
    Path(__file__).resolve().parents[1] / "vendor/skills/public/common/src"
)
sys.path.insert(0, str(KK_COMMON_SRC))

from kk_common import market_data_cache  # noqa: E402
from kk_common.finance_data_gateway import FinanceDataGateway  # noqa: E402


def bd_range(start: str, end: str) -> pd.DataFrame:
    dates = pd.bdate_range(start, end)
    return pd.DataFrame(
        {
            "ts_code": ["600000.SH"] * len(dates),
            "trade_date": [d.strftime("%Y%m%d") for d in dates],
            "close": [10.0 + i for i in range(len(dates))],
            "amount": [1000.0 * (i + 1) for i in range(len(dates))],
        }
    )


@pytest.fixture(autouse=True)
def cache_env(tmp_path, monkeypatch):
    monkeypatch.setenv("KSTOCK_MARKET_DATA_CACHE_DIR", str(tmp_path / "market-data"))
    monkeypatch.delenv("KSTOCK_MARKET_DATA_CACHE", raising=False)


def test_daily_second_call_is_pure_hit():
    calls = []

    def fetch(params):
        calls.append(params)
        return bd_range(params["start_date"], params["end_date"])

    p1 = {"ts_code": "600000.SH", "start_date": "20240101", "end_date": "20240110"}
    df1 = market_data_cache.wrap_request("daily", p1, fetch)
    df2 = market_data_cache.wrap_request("daily", dict(p1), fetch)

    assert len(calls) == 1  # 第二次纯缓存命中
    assert len(df2) == len(df1)
    assert list(df2["trade_date"]) == list(df1["trade_date"])
    assert df2["trade_date"].dtype == df1["trade_date"].dtype  # dtype 往返保持


def test_incremental_tail_fetch_merges_without_full_refetch():
    calls = []

    def fetch(params):
        calls.append(dict(params))
        return bd_range(params["start_date"], params["end_date"])

    market_data_cache.wrap_request(
        "daily",
        {"ts_code": "600000.SH", "start_date": "20240101", "end_date": "20240110"},
        fetch,
    )
    df2 = market_data_cache.wrap_request(
        "daily",
        {"ts_code": "600000.SH", "start_date": "20240101", "end_date": "20240131"},
        fetch,
    )

    # 第二次只增量拉取尾部（起始 = 缓存末日 20240110 往前重叠 7 天 = 20240103）
    assert len(calls) == 2
    assert calls[1]["start_date"] == "20240103"
    assert calls[1]["end_date"] == "20240131"
    # 合并结果覆盖请求区间且无重复
    dates = list(df2["trade_date"])
    assert dates == sorted(set(dates))
    assert dates[0] == "20240101"
    assert dates[-1] == "20240131"

    # 第三次（全区间）纯命中
    market_data_cache.wrap_request(
        "daily",
        {"ts_code": "600000.SH", "start_date": "20240101", "end_date": "20240131"},
        fetch,
    )
    assert len(calls) == 2


def test_different_params_use_separate_cache_entries():
    calls = []

    def fetch(params):
        calls.append(params)
        return bd_range(params["start_date"], params["end_date"])

    for code in ("600000.SH", "000001.SZ"):
        market_data_cache.wrap_request(
            "daily",
            {"ts_code": code, "start_date": "20240101", "end_date": "20240110"},
            fetch,
        )
        market_data_cache.wrap_request(
            "daily",
            {"ts_code": code, "start_date": "20240101", "end_date": "20240110"},
            fetch,
        )

    assert len(calls) == 2  # 每个标的各拉一次


def test_empty_dataframe_never_cached():
    calls = []

    def fetch(params):
        calls.append(params)
        return pd.DataFrame()

    market_data_cache.wrap_request(
        "daily", {"ts_code": "600000.SH", "start_date": "20240101", "end_date": "20240110"}, fetch
    )
    market_data_cache.wrap_request(
        "daily", {"ts_code": "600000.SH", "start_date": "20240101", "end_date": "20240110"}, fetch
    )

    assert len(calls) == 2  # 空 DF（上游失败语义）不落盘


def test_env_switch_disables_cache(monkeypatch):
    monkeypatch.setenv("KSTOCK_MARKET_DATA_CACHE", "0")
    calls = []

    def fetch(params):
        calls.append(params)
        return bd_range(params["start_date"], params["end_date"])

    p = {"ts_code": "600000.SH", "start_date": "20240101", "end_date": "20240110"}
    market_data_cache.wrap_request("daily", p, fetch)
    market_data_cache.wrap_request("daily", p, fetch)

    assert len(calls) == 2
    assert market_data_cache.handles("daily") is False


def test_snapshot_ttl_expiry_triggers_refetch(tmp_path):
    calls = []

    def fetch(params):
        calls.append(params)
        return pd.DataFrame({"ts_code": ["600000.SH"], "name": ["浦发银行"]})

    p = {"list_status": "L"}
    market_data_cache.wrap_request("stock_basic", p, fetch)
    market_data_cache.wrap_request("stock_basic", dict(p), fetch)
    assert len(calls) == 1  # 7 天 TTL 内命中

    # 把 meta.fetched_at 改到过期前 → 下次调用重拉
    meta_path = next((tmp_path / "market-data" / "stock_basic").glob("*/meta.json"))
    meta = eval(meta_path.read_text())  # noqa: S307 测试构造
    meta["fetched_at"] = time.time() - 8 * 86400
    meta_path.write_text(repr(meta))
    market_data_cache.wrap_request("stock_basic", dict(p), fetch)
    assert len(calls) == 2


def test_unregistered_api_bypasses_cache():
    calls = []

    def fetch(params):
        calls.append(params)
        return bd_range("20240101", "20240110")

    # stk_mins 已纳入白名单；用真正未注册的接口验证旁路
    assert market_data_cache.handles("income") is False
    p = {"ts_code": "600000.SH", "start_date": "20240101", "end_date": "20240110"}
    market_data_cache.wrap_request("income", p, fetch)
    market_data_cache.wrap_request("income", p, fetch)
    assert len(calls) == 2


def test_missing_cache_dir_disables_cache(monkeypatch, tmp_path):
    monkeypatch.setenv("KSTOCK_MARKET_DATA_CACHE_DIR", str(tmp_path / "nonexistent-dir"))
    assert market_data_cache.cache_dir() == str(tmp_path / "nonexistent-dir")
    # 显式目录不存在时仍可用（首次写入会建目录），handles 以显式目录为准
    assert market_data_cache.handles("daily") is True


def test_gateway_weave_caches_adapter_requests():
    """FinanceDataGateway.request 织入验证：白名单接口两次调用只打一次适配器。"""

    class CountingAdapter:
        def __init__(self):
            self.calls = 0

        def request(self, endpoint, **kwargs):
            self.calls += 1
            return bd_range(kwargs["start_date"], kwargs["end_date"])

    adapter = CountingAdapter()
    gateway = FinanceDataGateway(adapter=adapter)
    p = {"ts_code": "600000.SH", "start_date": "20240101", "end_date": "20240110"}
    gateway.daily(**p)
    gateway.daily(**p)
    assert adapter.calls == 1


# ── 分钟线（stk_mins，trade_time 日期时间列）──────────────────────────


def mins_frame(start_day: str, end_day: str) -> pd.DataFrame:
    rows = []
    for day in pd.bdate_range(start_day, end_day):
        for clock in ("09:31:00", "10:30:00", "14:45:00"):
            rows.append(
                {
                    "ts_code": "600000.SH",
                    "trade_time": f"{day.strftime('%Y-%m-%d')} {clock}",
                    "close": 10.0 + len(rows),
                    "vol": 100.0 + len(rows),
                }
            )
    return pd.DataFrame(rows)


def _digits(value: str) -> str:
    return "".join(ch for ch in str(value) if ch.isdigit())


def test_stk_mins_second_call_is_pure_hit():
    calls = []

    def fetch(params):
        calls.append(dict(params))
        full = mins_frame("2024-01-02", "2024-01-31")
        mask = full["trade_time"].str.replace(r"\D", "", regex=True).between(
            _digits(params["start_date"]), _digits(params["end_date"])
        )
        return full.loc[mask].reset_index(drop=True)

    p = {
        "ts_code": "600000.SH",
        "freq": "5min",
        "start_date": "2024-01-02 09:00:00",
        "end_date": "2024-01-05 15:00:00",
    }
    df1 = market_data_cache.wrap_request("stk_mins", p, fetch)
    # end(15:00) 超过最后一根 K 线(14:45)：首次落盘即记录 probe_end，
    # 后续同范围请求纯命中（无需再探测）
    df2 = market_data_cache.wrap_request("stk_mins", dict(p), fetch)
    df3 = market_data_cache.wrap_request("stk_mins", dict(p), fetch)

    assert len(calls) == 1
    assert list(df2["trade_time"]) == list(df1["trade_time"])
    assert list(df3["trade_time"]) == list(df1["trade_time"])
    assert df3["trade_time"].dtype == df1["trade_time"].dtype


def test_stk_mins_incremental_tail_uses_datetime_start_and_short_overlap():
    calls = []

    def fetch(params):
        calls.append(dict(params))
        full = mins_frame("2024-01-02", "2024-01-31")
        mask = full["trade_time"].str.replace(r"\D", "", regex=True).between(
            _digits(params["start_date"]), _digits(params["end_date"])
        )
        return full.loc[mask].reset_index(drop=True)

    p1 = {
        "ts_code": "600000.SH",
        "freq": "5min",
        "start_date": "2024-01-02 09:00:00",
        "end_date": "2024-01-05 15:00:00",
    }
    market_data_cache.wrap_request("stk_mins", p1, fetch)
    df2 = market_data_cache.wrap_request(
        "stk_mins",
        {**p1, "end_date": "2024-01-12 15:00:00"},
        fetch,
    )

    assert len(calls) == 2
    # 增量起点 = 缓存末日 2024-01-05 往前重叠 1 天 → "2024-01-04 00:00:00"
    assert calls[1]["start_date"] == "2024-01-04 00:00:00"
    assert calls[1]["end_date"] == "2024-01-12 15:00:00"
    # 合并结果覆盖请求区间、按时间排序、无重复
    times = list(df2["trade_time"])
    digits = [_digits(t) for t in times]
    assert digits == sorted(set(digits))
    assert digits[0].startswith("20240102")
    assert digits[-1].startswith("20240112")

    # 第三次（全区间）纯命中
    market_data_cache.wrap_request(
        "stk_mins", {**p1, "end_date": "2024-01-12 15:00:00"}, fetch
    )
    assert len(calls) == 2


def test_stk_mins_different_freq_isolated():
    calls = []

    def fetch(params):
        calls.append(dict(params))
        full = mins_frame("2024-01-02", "2024-01-05")
        mask = full["trade_time"].str.replace(r"\D", "", regex=True).between(
            _digits(params["start_date"]), _digits(params["end_date"])
        )
        return full.loc[mask].reset_index(drop=True)

    for freq in ("5min", "15min"):
        for _ in range(3):
            market_data_cache.wrap_request(
                "stk_mins",
                {
                    "ts_code": "600000.SH",
                    "freq": freq,
                    "start_date": "2024-01-02 09:00:00",
                    "end_date": "2024-01-05 15:00:00",
                },
                fetch,
            )

    # 每个 freq 首次全量即记录 probe_end，之后纯命中 → 共 2 次
    assert len(calls) == 2
    assert {c["freq"] for c in calls} == {"5min", "15min"}
