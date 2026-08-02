#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ETF 周度综合分析工具（模板格式）——期权 ETF 与普通 ETF 双标的池

数据来源：Tushare Pro API（fund_daily / fund_share / fund_nav）
分析维度：周行情 / 周均成交额 / 份额变化 / 规模估算 / 横向对比 / 综合研判

标的池区分（技能层统一口径）：
  · 期权 ETF（默认池，与 market-linkage-engine 的 OPTION_ETFS 一致，硬编码）：
      510050.SH 上证50ETF / 510300.SH 沪深300ETF / 510500.SH 中证500ETF /
      512100.SH 中证1000ETF / 159915.SZ 创业板ETF / 588000.SH 科创50ETF /
      159901.SZ 深100ETF —— 具备场内期权，分析可联动期权维度；
  · 普通 ETF（不设默认池，由用户通过 --symbols 传入任意 ETF 代码，如
      512880.SH 证券ETF / 518880.SH 黄金ETF）：无对应场内期权，仅 ETF 自身
      维度（价格/量能/份额），无期权联动维度；脚本按是否在期权池内自动
      标注「期权ETF / 普通ETF」类型。

周粒度口径：按 ISO 自然周聚合（周标签形如 2026-W31），默认取最近一周；
  周涨跌幅 = 周内末收盘 / 周内首收盘 - 1；周均成交额 = 周内每日成交额均值；
  周份额变化 = 周末份额 - 周初份额（亿份）；规模 = 最新净值 × 最新份额（亿元）。

用法:
  python3 analyze_weekly_etf.py                      # 最近一周 · 期权 ETF（默认池）
  python3 analyze_weekly_etf.py --symbols 512880.SH,518880.SH   # 普通 ETF 用户输入
  python3 analyze_weekly_etf.py --symbols 510300.SH,512880.SH   # 可混搭，自动标注类型
  python3 analyze_weekly_etf.py --weeks 2            # 回溯两周
  python3 analyze_weekly_etf.py --json               # JSON 输出
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import Dict, Any, List

_script_dir = os.path.dirname(os.path.abspath(__file__))
_scripts_root = os.path.dirname(_script_dir)
for _p in (_scripts_root, os.path.dirname(_scripts_root)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

TOKEN = os.environ.get("TUSHARE_TOKEN", "")
if not TOKEN:
    print(json.dumps({"error": "TUSHARE_TOKEN 环境变量未设置"}))
    sys.exit(1)

try:
    from kk_common import get_finance_data_gateway
    pro = get_finance_data_gateway()
except Exception as e:
    print(json.dumps({"error": f"kk_common 网关不可用: {e}"}))
    sys.exit(1)


# ======================================================================
#  7 大期权 ETF 标的（与 market-linkage-engine OPTION_ETFS 口径一致）
# ======================================================================
OPTION_ETFS = {
    "510050.SH": "上证50ETF",
    "510300.SH": "沪深300ETF",
    "510500.SH": "中证500ETF",
    "512100.SH": "中证1000ETF",
    "159915.SZ": "创业板ETF",
    "588000.SH": "科创50ETF",
    "159901.SZ": "深100ETF",
}

OPTION_ETFS_INDEX = {
    "510050.SH": "000016.SH",
    "510300.SH": "000300.SH",
    "510500.SH": "000905.SH",
    "512100.SH": "000852.SH",
    "159915.SZ": "399006.SZ",
    "588000.SH": "000688.SH",
    "159901.SZ": "399330.SZ",
}

INDEX_NAMES = {
    "000016.SH": "上证50", "000300.SH": "沪深300", "000905.SH": "中证500",
    "000852.SH": "中证1000", "399006.SZ": "创业板指", "000688.SH": "科创50",
    "399330.SZ": "深证100",
}


def is_option_etf(code: str) -> bool:
    """是否属于 7 大期权 ETF 标的。"""
    return code in OPTION_ETFS


def etf_kind_label(code: str) -> str:
    """标的类型标注：期权ETF / 普通ETF（普通 ETF 不设默认池，由用户输入）。"""
    return "期权ETF" if is_option_etf(code) else "普通ETF"


def etf_display_name(code: str) -> str:
    """标的展示名：期权池内取内置名称；普通 ETF 无内置名称，回退为代码本身。"""
    return OPTION_ETFS.get(code, code)


# ======================================================================
#  格式化工具
# ======================================================================

def _pct(val, sign=True) -> str:
    if val is None:
        return '-'
    prefix = ('+' if val > 0 else '') if sign else ''
    return f"{prefix}{val:.2f}%"


def _num(val, nd=2) -> str:
    if val is None:
        return '-'
    return f"{val:,.{nd}f}"


def _fmt_date(d) -> str:
    if d and len(str(d)) == 8:
        s = str(d)
        return f"{s[:4]}-{s[4:6]}-{s[6:]}"
    return str(d or '-')


def _chg(v):
    if v is None:
        return '—'
    icon = '▲' if v > 0 else '▼' if v < 0 else '─'
    return f"{icon} {v:+.2f}%"


def _bar(val: float, max_val: float, width: int = 20,
         fill: str = '█', empty: str = '░') -> str:
    if max_val == 0:
        return empty * width
    filled = int(min(abs(val) / max_val, 1.0) * width)
    return fill * filled + empty * (width - filled)


def _score_bar(score, width=20):
    n = max(0, min(width, int(score / 100 * width)))
    return '█' * n + '░' * (width - n)


def _default_serializer(obj):
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    if hasattr(obj, 'item'):
        return obj.item()
    return str(obj)


# ======================================================================
#  数据获取
# ======================================================================

def get_latest_trade_date():
    # 优先用 ETF 行情数据推断最新交易日（trade_cal 可能因权限返回空）
    try:
        df = pro.fund_daily(ts_code="510300.SH")
        if df is not None and not df.empty:
            return str(df["trade_date"].max())
    except Exception:
        pass
    trade_date = datetime.now().strftime("%Y%m%d")
    for _ in range(15):
        try:
            cal = pro.trade_cal(exchange="SSE", trade_date=trade_date, is_open="1")
            if not cal.empty:
                return trade_date
        except Exception:
            pass
        trade_date = (datetime.strptime(trade_date, "%Y%m%d") - timedelta(days=1)).strftime("%Y%m%d")
    return trade_date


def _week_label(d: str) -> str:
    """ISO 自然周标签，如 2026-W31。"""
    dd = datetime.strptime(str(d), "%Y%m%d")
    iso = dd.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


def fetch_weekly_data(weeks: int = 1,
                     symbols: List[str] = None) -> Dict[str, Any]:
    """采集 ETF 周度数据（期权 ETF 默认池 + 用户自定义普通 ETF）。

    参数:
        weeks: 回溯周数
        symbols: 用户输入的 ETF 代码列表（普通 ETF 不设默认池，由用户提供）；
                 为空时使用 7 大期权 ETF 默认池

    返回:
        {'pool': {...}, 'week_labels': [最近周...], 'etfs': {code: {...}}, 'trade_date': ...}
    """
    if symbols:
        etfs = {c: etf_display_name(c) for c in symbols}
        pool_name = f"自定义标的（{len(etfs)} 只）"
    else:
        etfs = dict(OPTION_ETFS)
        pool_name = "7 大期权 ETF"

    end = get_latest_trade_date()
    # 回溯窗口放大，保证覆盖完整自然周
    start = (datetime.strptime(end, "%Y%m%d") - timedelta(days=weeks * 10 + 7)).strftime("%Y%m%d")
    result: Dict[str, Any] = {
        "trade_date": end,
        "fetch_start": start,
        "pool": {"kind": "option" if not symbols else "custom", "name": pool_name, "symbols": list(etfs)},
        "week_labels": [],
        "etfs": {},
    }

    for code, name in etfs.items():
        info = _analyze_etf_weekly(code, name, start, end)
        result["etfs"][code] = info

    # 收集所有周标签并按序排（近 weeks 周）
    labels = set()
    for info in result["etfs"].values():
        for w in info.get("weeks", []):
            if isinstance(w, dict) and w.get("week"):
                labels.add(w["week"])
    result["week_labels"] = sorted(labels)[-max(weeks, 1):]
    return result


def _analyze_etf_weekly(code: str, name: str, start: str, end: str) -> Dict[str, Any]:
    """单只 ETF 周度聚合：行情 / 成交额 / 份额 / 规模。"""
    out: Dict[str, Any] = {
        "ts_code": code, "name": name, "kind": etf_kind_label(code),
        "index_name": INDEX_NAMES.get(OPTION_ETFS_INDEX.get(code, ""), ""),
        "weeks": [], "weekly": {}, "error": None,
    }
    try:
        daily = pro.fund_daily(ts_code=code, start_date=start, end_date=end)
        share = pro.fund_share(ts_code=code, start_date=start, end_date=end)
    except Exception as e:
        out["error"] = str(e)
        return out
    if daily is None or daily.empty:
        out["error"] = f"无行情数据: {code}"
        return out

    df = daily.sort_values("trade_date").copy()
    df["trade_date"] = df["trade_date"].astype(str)
    df["week"] = df["trade_date"].map(_week_label)
    df["amount_yi"] = df["amount"] / 1e5          # 千元 → 亿元
    df["vol_yi"] = df["vol"] / 1e8                # 手 → 亿手（展示用，容错）

    share_df = None
    if share is not None and not share.empty:
        share_df = share.sort_values("trade_date").copy()
        share_df["trade_date"] = share_df["trade_date"].astype(str)
        share_df["fd_share_yi"] = share_df["fd_share"] / 1e4   # 万份 → 亿份

    weeks = []
    for week, g in df.groupby("week"):
        week_days = g.sort_values("trade_date")
        first, last = week_days.iloc[0], week_days.iloc[-1]
        week_chg = None
        if float(first["close"]) and float(first["close"]) > 0:
            week_chg = round((float(last["close"]) / float(first["close"]) - 1) * 100, 2)
        # 份额变化：周内首末交易日份额差（亿份）
        share_chg = None
        share_first = share_last = None
        if share_df is not None and not share_df.empty:
            s_in_week = share_df[share_df["trade_date"].isin(set(week_days["trade_date"]))]
            if not s_in_week.empty:
                s_first = s_in_week.iloc[0]["fd_share_yi"]
                s_last = s_in_week.iloc[-1]["fd_share_yi"]
                share_first, share_last = s_first, s_last
                share_chg = round(s_last - s_first, 4)
        weeks.append({
            "week": week,
            "start": str(first["trade_date"]),
            "end": str(last["trade_date"]),
            "days": len(week_days),
            "open": float(first["open"]) if "open" in first else float(first["close"]),
            "close": float(last["close"]),
            "week_chg": week_chg,
            "avg_amount_yi": round(float(week_days["amount_yi"].mean()), 4),
            "sum_amount_yi": round(float(week_days["amount_yi"].sum()), 4),
            "max_amount_yi": round(float(week_days["amount_yi"].max()), 4),
            "avg_pct_chg": round(float(week_days["pct_chg"].mean()), 3),
            "share_first_yi": share_first,
            "share_last_yi": share_last,
            "share_chg_yi": share_chg,
            "detail": [
                {"date": _fmt_date(r["trade_date"]), "close": float(r["close"]),
                 "pct_chg": float(r["pct_chg"]), "amount_yi": round(float(r["amount_yi"]), 4)}
                for _, r in week_days.iterrows()
            ],
        })
    out["weeks"] = weeks
    out["weekly"] = {w["week"]: w for w in weeks}
    return out


# ======================================================================
#  综合研判：评分 / 信号 / 背离
# ======================================================================

def _score_week(week: Dict[str, Any]) -> Dict[str, Any]:
    """单周聚合信号：价格 / 量能 / 份额三维度 → 评分（0-100）与方向。"""
    chg = week.get("week_chg")
    score = 50
    signals = []
    direction = "中性"

    if chg is not None:
        if chg >= 1.0:
            score += 15
            signals.append(f"周涨 {_pct(chg)}，多头占优")
        elif chg <= -1.0:
            score -= 15
            signals.append(f"周跌 {_pct(chg)}，空头占优")
        else:
            signals.append(f"周内震荡（{_pct(chg)}）")

    avg_amt = week.get("avg_amount_yi")
    if avg_amt is not None:
        if avg_amt >= 20:
            signals.append(f"周均成交额 {avg_amt:.1f} 亿，交投活跃")
        elif avg_amt < 5:
            signals.append(f"周均成交额 {avg_amt:.1f} 亿，交投清淡")

    sh_chg = week.get("share_chg_yi")
    if sh_chg is not None:
        if sh_chg > 0.5:
            score += 12
            signals.append(f"份额净增 {sh_chg:+.2f} 亿份，资金净流入")
        elif sh_chg < -0.5:
            score -= 12
            signals.append(f"份额净减 {sh_chg:+.2f} 亿份，资金净流出")
        else:
            signals.append(f"份额变化 {sh_chg:+.2f} 亿份，基本持平")
        # 价格 × 份额背离
        if chg is not None:
            if chg >= 1.0 and sh_chg < -0.5:
                score -= 8
                signals.append("⚠️ 价涨但份额净减 = 资金不追高（背离）")
            elif chg <= -1.0 and sh_chg > 0.5:
                score += 8
                signals.append("✅ 价跌但份额净增 = 逢低布局（背离）")

    score = max(0, min(100, score))
    if score >= 58:
        direction = "偏多"
    elif score <= 42:
        direction = "偏空"
    return {"score": score, "direction": direction, "signals": signals}


# ======================================================================
#  报告输出（Markdown 模板格式）
# ======================================================================

def print_market_overview(result: Dict[str, Any], week: str):
    etfs = result["etfs"]
    pool = result.get("pool", {}).get("name", "")
    rows = []
    for code, info in etfs.items():
        w = info.get("weekly", {}).get(week)
        if not w:
            rows.append({"类型": info.get("kind", ""), "标的": info["name"], "对应指数": info.get("index_name", ""),
                         "周涨跌幅": "-", "周均成交额": "-", "份额变化": "-", "信号": "⚠️ 无数据"})
            continue
        sc = _score_week(w)
        rows.append({
            "类型": info.get("kind", ""),
            "标的": info["name"],
            "对应指数": info.get("index_name", ""),
            "周涨跌幅": _pct(w.get("week_chg")),
            "周均成交额(亿)": _num(w.get("avg_amount_yi")),
            "份额变化(亿份)": _num(w.get("share_chg_yi")),
            "信号": f"{sc['direction']}（{sc['score']}分）",
        })
    print("\n## 一、周度市场概览\n")
    print(f"**标的池：{pool}**　**分析周：{week}**（{result.get('trade_date', '')} 数据快照）\n")
    print("| 类型 | 标的 | 对应指数 | 周涨跌幅 | 周均成交额(亿) | 份额变化(亿份) | 信号 |")
    print("|------|------|----------|----------|----------------|----------------|------|")
    for r in rows:
        print(f"| {r['类型']} | **{r['标的']}** | {r['对应指数']} | {r['周涨跌幅']} | "
              f"{r['周均成交额(亿)']} | {r['份额变化(亿份)']} | {r['信号']} |")


def print_symbol_analysis(info: Dict[str, Any], week: str):
    print(f"\n### {info['name']}（{info['ts_code']}）— {info.get('kind', '')} · 对应指数：{info.get('index_name', '-')}（{week}）\n")
    if info.get("error"):
        print(f"**数据异常：** {info['error']}")
        return
    w = info.get("weekly", {}).get(week)
    if not w:
        print("**本周无数据**")
        return

    print("#### 1. 周度行情\n")
    print("| 指标 | 数值 | 说明 |")
    print("|------|------|------|")
    print(f"| 周开盘 | {_num(w.get('open'))} | 周内首个交易日开盘 |")
    print(f"| 周末收盘 | {_num(w.get('close'))} | 周内最后交易日收盘 |")
    print(f"| 周涨跌幅 | **{_pct(w.get('week_chg'))}** | 周首→周末累计 |")
    print(f"| 周均成交额 | {_num(w.get('avg_amount_yi'))} 亿 | 周内每日均值（Tushare 口径） |")
    print(f"| 周成交总额 | {_num(w.get('sum_amount_yi'))} 亿 | 周内累计 |")

    print("\n#### 2. 份额与规模\n")
    print("| 指标 | 数值 | 说明 |")
    print("|------|------|------|")
    print(f"| 周初份额 | {_num(w.get('share_first_yi'))} 亿份 | 周内首个交易日 |")
    print(f"| 周末份额 | {_num(w.get('share_last_yi'))} 亿份 | 周内最后交易日 |")
    print(f"| 周份额变化 | **{_num(w.get('share_chg_yi'))} 亿份** | 净申赎（正=流入/负=流出） |")

    print("\n#### 3. 周度信号\n")
    sc = _score_week(w)
    print(f"**评分：{sc['score']}/100 → 方向：{sc['direction']}**\n")
    for s in sc["signals"]:
        print(f"- {s}")

    print("\n**周内每日明细：**\n")
    print("| 日期 | 收盘 | 涨跌幅 | 成交额(亿) |")
    print("|------|------|--------|-----------|")
    for r in w.get("detail", []):
        print(f"| {r['date']} | {_num(r['close'])} | {_pct(r['pct_chg'])} | {_num(r['amount_yi'])} |")


def print_cross_etf_comparison(result: Dict[str, Any], week: str):
    print("\n## 三、分标的周度对比\n")
    print("| 类型 | 标的 | 周涨跌幅 | 周均成交额(亿) | 份额变化(亿份) | 评分 | 方向 |")
    print("|------|------|----------|----------------|----------------|------|------|")
    for code, info in result["etfs"].items():
        w = info.get("weekly", {}).get(week)
        if not w:
            continue
        sc = _score_week(w)
        icon = '▼' if sc["score"] <= 42 else '▲' if sc["score"] >= 58 else '─'
        print(f"| {info.get('kind', '')} | **{info['name']}** {code} | {_pct(w.get('week_chg'))} | "
              f"{_num(w.get('avg_amount_yi'))} | {_num(w.get('share_chg_yi'))} | "
              f"{icon} {sc['score']}/100 {_bar(sc['score'], 100, 8)} | {sc['direction']} |")


def print_composite_analysis(result: Dict[str, Any], week: str):
    print("\n## 四、综合研判\n")
    scores = []
    for code, info in result["etfs"].items():
        w = info.get("weekly", {}).get(week)
        if w:
            scores.append(_score_week(w))
    if not scores:
        print("本周无可用数据。")
        return
    avg = sum(s["score"] for s in scores) / len(scores)
    bull = sum(1 for s in scores if s["direction"] == "偏多")
    bear = sum(1 for s in scores if s["direction"] == "偏空")
    neutral = len(scores) - bull - bear
    env = "偏多" if avg >= 58 else "偏空" if avg <= 42 else "中性震荡"
    print(f"**综合评分：{avg:.1f}/100**")
    print(f"{_score_bar(avg)}")
    print(f"**市场环境：{env}**（{bull} 偏多 / {neutral} 中性 / {bear} 偏空）\n")

    print("### 积极信号\n")
    pos = []
    for code, info in result["etfs"].items():
        w = info.get("weekly", {}).get(week)
        if not w:
            continue
        sc = _score_week(w)
        if sc["direction"] == "偏多":
            pos.append(f"| {info['name']} | 方向 | {sc['direction']}（{sc['score']}分） |")
        for s in sc["signals"]:
            if "净增" in s or "逢低布局" in s:
                pos.append(f"| {info['name']} | 资金/背离 | {s} |")
                break
    if pos:
        print("| 标的 | 信号类型 | 说明 |")
        print("|------|----------|------|")
        for p in pos:
            print(p)
    else:
        print("| — | — | 本周暂无明确积极信号 |")

    print("\n### 风险信号\n")
    risk = []
    for code, info in result["etfs"].items():
        w = info.get("weekly", {}).get(week)
        if not w:
            continue
        sc = _score_week(w)
        if sc["direction"] == "偏空":
            risk.append(f"| {info['name']} | 方向 | {sc['direction']}（{sc['score']}分） |")
        for s in sc["signals"]:
            if "净流出" in s or "不追高" in s:
                risk.append(f"| {info['name']} | 资金/背离 | {s} |")
                break
    if risk:
        print("| 标的 | 信号类型 | 说明 |")
        print("|------|----------|------|")
        for r in risk:
            print(r)
    else:
        print("| — | — | 本周暂无明确风险信号 |")


def print_xiaos_summary(result: Dict[str, Any], week: str):
    print("\n## 五、小s的总结\n")
    print(f"### 关键结论（{week}）：\n")
    items = []
    for code, info in result["etfs"].items():
        w = info.get("weekly", {}).get(week)
        if not w:
            continue
        chg = w.get("week_chg")
        icon = '📉' if chg is not None and chg < 0 else '📈' if chg is not None and chg > 0 else '➡️'
        items.append(f"- **{info['name']}（{code}）：** {icon} 周{_chg(chg)}，"
                     f"份额{_num(w.get('share_chg_yi'))} 亿份，"
                     f"周均成交 {_num(w.get('avg_amount_yi'))} 亿")
    for it in items:
        print(it)
    if not items:
        print("- 本周无可用数据")


# ======================================================================
#  主入口
# ======================================================================

def main():
    parser = argparse.ArgumentParser(
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description="""
ETF 周度综合分析工具 · Tushare Pro（期权 ETF / 普通 ETF 双标的池）

标的池:
  · 期权 ETF（默认池，硬编码 7 大）：510050/510300/510500/512100/159915/588000/159901
  · 普通 ETF（不设默认池）：用户通过 --symbols 传入任意 ETF 代码，
      脚本按是否在期权池内自动标注「期权ETF / 普通ETF」类型

用法:
  python3 analyze_weekly_etf.py
  python3 analyze_weekly_etf.py --symbols 512880.SH,518880.SH
  python3 analyze_weekly_etf.py --weeks 2
  python3 analyze_weekly_etf.py --json
        """,
    )
    parser.add_argument('--weeks', '-w', type=int, default=1,
                        help='回溯周数（默认 1 = 最近一周）')
    parser.add_argument('--symbols', '-s', type=str, default=None,
                        help='ETF 代码列表（逗号分隔，如 512880.SH,518880.SH）；不传时使用 7 大期权 ETF 默认池')
    parser.add_argument('--json', action='store_true',
                        help='以 JSON 格式输出原始结果')

    args = parser.parse_args()

    symbols = [s.strip().upper() for s in args.symbols.split(',') if s.strip()] if args.symbols else None
    if symbols:
        print(f"正在采集自定义 ETF 周度数据（{len(symbols)} 只，回溯 {args.weeks} 周窗口）...")
    else:
        print(f"正在采集 7 大期权 ETF 周度数据（回溯 {args.weeks} 周窗口）...")
    result = fetch_weekly_data(weeks=args.weeks, symbols=symbols)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2, default=_default_serializer))
        return

    week = result["week_labels"][-1] if result["week_labels"] else None
    if week is None:
        print("未聚合到任何自然周数据。")
        return

    print_market_overview(result, week)

    print("\n## 二、逐标的周度分析\n")
    for code, info in result["etfs"].items():
        print_symbol_analysis(info, week)

    print_cross_etf_comparison(result, week)
    print_composite_analysis(result, week)
    print_xiaos_summary(result, week)

    if result.get("pool", {}).get("kind") == "custom":
        normal_count = sum(1 for c in symbols if not is_option_etf(c))
        if normal_count:
            print(f"\n> 💡 本池含 {normal_count} 只普通 ETF（无对应场内期权），无期权联动维度；如需期权维度请分析 7 大期权 ETF（不带 --symbols 运行）。")

    print("\n---")
    print("⚠️ 以上分析基于 Tushare Pro 数据与逻辑推演，不构成投资建议。")


if __name__ == '__main__':
    main()
