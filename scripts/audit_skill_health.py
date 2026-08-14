#!/usr/bin/env python3
"""KStock 技能健康审计：静态扫描 + Tushare fields 提取 + 官方接口校验。

阶段 1（默认）：语法、已知 bug 模式、缺失导入、已知错误字段名
阶段 2（--verify-fields）：AST 提取 fields 组合后，用真实 token 调官方接口，
    比对「请求字段 vs 返回列」差集——Tushare 对无效字段静默忽略导致缺列，
    缺列即拼写错误（返回空/报错则多为参数或权限问题）。

用法：
    uv run python scripts/audit_skill_health.py          # 阶段 1 静态
    source ~/.kworks/.env && uv run python \
        scripts/audit_skill_health.py --verify-fields    # 阶段 2 字段校验

输出：/tmp/audit_phase1.json、/tmp/audit_fields.json
"""
from __future__ import annotations

import argparse
import ast
import json
import os
import py_compile
import re
import sys
import time
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
VENDOR = REPO_ROOT / "vendor" / "skills" / "public"

# ── 已知 bug 模式 ──────────────────────────────────────────────────────────
BUG_PATTERNS = {
    "ts_fallback": r"except ImportError:\s*\n\s*ts = None",
    "ts_use": r"if ts and token:",
    "fillna_method": r"fillna\(method=",
    "pywencai_hint": r"pip install pywencai",
    "space_field": r"c_pay goods_for_sv",
}

KNOWN_BAD_FIELDS = [
    "inventory", "fix_asset_total", "total_current_assets", "total_current_liab",
    "bonds_payable", "undistr_profit", "oper_profit", "minority_plr",
    "n_cashflow_fnc_act", "c_pay goods_for_sv", "c_pay_goods_for_sv",
    "dtowequity", "eqy_to_debt", "excite_income", "excite_tax",
    "stot_invest_act", "stot_fin_act", "float_mv",
]

# ── 字符串还原（多行拼接）──────────────────────────────────────────────────
def _str_value(node: ast.AST) -> str | None:
    """还原 Constant 或相邻字符串拼接（BinOp % 排除）。"""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left = _str_value(node.left)
        right = _str_value(node.right)
        if left is not None and right is not None:
            return left + right
    return None


def _pro_calls(tree: ast.AST):
    """收集 (接口名, kwargs dict) —— callee 形如 <x>.pro.<api> 或 pro_api().<api>。"""
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        api = None
        # a.pro.income(...) / client.pro.daily(...)
        if (
            isinstance(func, ast.Attribute)
            and isinstance(func.value, ast.Attribute)
            and func.value.attr == "pro"
        ):
            api = func.attr
        # ts.pro_api().income(...)
        elif isinstance(func, ast.Attribute) and isinstance(func.value, ast.Call):
            inner = func.value.func
            if isinstance(inner, ast.Attribute) and inner.attr == "pro_api":
                api = func.attr
        if not api:
            continue
        kwargs = {}
        for kw in node.keywords:
            val = _str_value(kw.value)
            if val is not None:
                kwargs[kw.arg] = val
        yield api, kwargs


def verify_fields(combos: list[dict]) -> None:
    """阶段 2：真实 token 调官方接口，比对请求字段与返回列差集。

    无字段的组合（fields=None）只验证接口可调 + 默认返回非空。
    """
    import pandas as pd
    import tushare as ts

    token = os.getenv("TUSHARE_TOKEN")
    if not token:
        sys.exit("缺少 TUSHARE_TOKEN 环境变量（可 source ~/.kworks/.env）")
    ts.set_token(token)
    pro = ts.pro_api()

    # 最近交易日（trade_cal 校验），供日线类接口使用
    cal = pro.trade_cal(exchange="SSE", start_date="20260701", end_date="20260814", is_open="1")
    trade_date = str(cal["cal_date"].max()) if cal is not None and not cal.empty else "20260813"
    time.sleep(0.4)
    print(f"  基准交易日: {trade_date}")

    # 期货主力合约（fut_mapping 提取）
    fut_ts = None
    try:
        mp = pro.fut_mapping(ts_code="IF")
        time.sleep(0.4)
        if mp is not None and not mp.empty:
            fut_ts = str(mp.iloc[-1]["mapping_ts_code"])
            print(f"  IF 主力合约: {fut_ts}")
    except Exception as e:
        print(f"  fut_mapping 预取失败: {e}")

    def _call(api: str, **kwargs):
        time.sleep(0.4)
        try:
            return getattr(pro, api)(**kwargs), None
        except Exception as e:  # noqa: BLE001
            return None, str(e)

    TS_CODE = "000001.SZ"
    START, END = "20260101", trade_date
    # stk_mins 要求 'YYYY-MM-DD HH:MM:SS'，YYYYMMDD 格式会静默返回空
    _dash = f"{trade_date[:4]}-{trade_date[4:6]}-{trade_date[6:]}"
    default_params = {
        "stock_basic": dict(ts_code=TS_CODE),
        "income": dict(ts_code=TS_CODE, start_date=START, end_date=END),
        "balancesheet": dict(ts_code=TS_CODE, start_date=START, end_date=END),
        "cashflow": dict(ts_code=TS_CODE, start_date=START, end_date=END),
        "fina_indicator": dict(ts_code=TS_CODE, start_date=START, end_date=END),
        "daily_basic": dict(ts_code=TS_CODE, start_date=START, end_date=END),
        "dividend": dict(ts_code=TS_CODE),
        "moneyflow": dict(ts_code=TS_CODE, start_date=START, end_date=END),
        "stk_holdernumber": dict(ts_code=TS_CODE, start_date=START, end_date=END),
        "top10_holders": dict(ts_code=TS_CODE, period="20260331"),
        "top10_floatholders": dict(ts_code=TS_CODE, period="20260331"),
        "stk_holdertrade": dict(ts_code=TS_CODE, start_date=START, end_date=END),
        "stk_mins": dict(ts_code=TS_CODE, freq="1min",
                         start_date=f"{_dash} 09:30:00", end_date=f"{_dash} 15:00:00"),
        "index_weight": dict(index_code="000300.SH", trade_date=trade_date),
        "index_daily": dict(ts_code="000001.SH", start_date=START, end_date=END),
        "opt_basic": dict(exchange="SSE"),
        "opt_daily": dict(exchange="SSE", start_date=trade_date, end_date=trade_date),
        "fund_daily": dict(ts_code="510050.SH", start_date=START, end_date=END),
        "fut_mapping": dict(symbol="IF"),
        "fut_daily": dict(ts_code=fut_ts or "IF2609.CFX", start_date=START, end_date=END),
        "fut_holding": dict(symbol="IF2609", trade_date=trade_date),
    }

    results = []
    tested = set()

    def _check(api: str, fields: str | None, caller: str) -> dict:
        key = (api, fields)
        if key in tested:
            return {}
        tested.add(key)
        params = dict(default_params.get(api, {}))
        df, err = _call(api, fields=fields, **params) if fields else _call(api, **params)
        if err:
            res = {"api": api, "fields": fields, "caller": caller, "status": "ERROR", "detail": err[:200]}
        elif df is None or df.empty:
            res = {"api": api, "fields": fields, "caller": caller, "status": "EMPTY",
                   "detail": "返回空数据（参数/日期无数据，非字段问题）"}
        else:
            cols = list(df.columns)
            if fields:
                missing = [f for f in fields.split(",") if f and f not in cols]
                status = "OK" if not missing else "BAD_FIELD"
                res = {"api": api, "fields": fields, "caller": caller, "status": status,
                       "missing": missing, "rows": len(df)}
            else:
                res = {"api": api, "fields": None, "caller": caller, "status": "OK",
                       "cols": cols[:12], "rows": len(df)}
        results.append(res)
        return res

    print("\n## 阶段 2：真实接口字段校验")
    for combo in combos:
        api, fields = combo["api"], combo["fields"]
        # caller 信息：从 phase1 调用清单找示例文件
        caller = next((c["file"] for c in _PHASE1_CALLS if c["api"] == api and c["fields"] == fields), "")
        _check(api, fields, caller)
    # 无 fields 的接口默认返回校验
    for api in sorted({c["api"] for c in _PHASE1_CALLS if not c.get("fields")}):
        _check(api, None, "(default fields)")

    ok = [r for r in results if r["status"] == "OK"]
    bad = [r for r in results if r["status"] == "BAD_FIELD"]
    err = [r for r in results if r["status"] in ("ERROR", "EMPTY")]
    for r in bad:
        print(f"  [BAD_FIELD] {r['api']} missing={r['missing']} @ {r['caller']}")
    for r in err:
        print(f"  [{r['status']}] {r['api']}: {r['detail'][:120]}")
    print(f"\n  共校验 {len(results)} 个调用：OK={len(ok)} BAD_FIELD={len(bad)} ERROR/EMPTY={len(err)}")
    with open("/tmp/audit_fields.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)


_PHASE1_CALLS: list[dict] = []


def main() -> None:
    parser = argparse.ArgumentParser(description="KStock 技能健康审计")
    parser.add_argument("--verify-fields", action="store_true", help="阶段 2：真实接口字段校验")
    args = parser.parse_args()

    if args.verify_fields:
        phase1 = json.loads(Path("/tmp/audit_phase1.json").read_text(encoding="utf-8"))
        global _PHASE1_CALLS
        _PHASE1_CALLS = phase1["field_calls"]
        combos = json.loads(Path("/tmp/audit_combos.json").read_text(encoding="utf-8"))
        verify_fields(combos)
        return

    scripts = sorted(VENDOR.glob("*/scripts/**/*.py"))
    static_issues: list[dict] = []
    field_calls: list[dict] = []

    for path in scripts:
        rel = path.relative_to(VENDOR).as_posix()
        text = path.read_text(encoding="utf-8", errors="replace")

        # 1. 语法
        try:
            py_compile.compile(str(path), doraise=True)
        except py_compile.PyCompileError as e:
            static_issues.append({"file": rel, "type": "syntax", "detail": str(e).splitlines()[-1]})
            continue  # 语法错误则跳过 AST
        try:
            tree = ast.parse(text)
        except SyntaxError:
            continue

        # 2. 已知 bug 模式
        for name, pat in BUG_PATTERNS.items():
            if pat and re.search(pat, text):
                static_issues.append({"file": rel, "type": f"pattern:{name}", "detail": pat})

        # 3. np 使用但未导入
        if re.search(r"\bnp\.", text) and not re.search(r"import numpy", text):
            static_issues.append({"file": rel, "type": "pattern:np_missing", "detail": "使用 np.* 但无 numpy 导入"})

        # 4. Tushare 调用提取（known_bad 在字段串内检查，避免全文误报）
        for api, kwargs in _pro_calls(tree):
            fields = kwargs.get("fields")
            if fields is None:
                field_calls.append({"file": rel, "api": api, "fields": None})
                continue
            missing = [f for f in fields.split(",") if f and f in KNOWN_BAD_FIELDS]
            field_calls.append({
                "file": rel, "api": api, "fields": fields,
                "known_bad": missing,
                "params": {k: v for k, v in kwargs.items() if k != "fields"},
            })

    print("=" * 70)
    print(f"扫描 {len(scripts)} 个脚本")
    print(f"静态问题 {len(static_issues)} 条；Tushare fields 调用 {len(field_calls)} 个")
    print("=" * 70)

    print("\n## 一、静态问题")
    if not static_issues:
        print("  （无）")
    for iss in static_issues:
        print(f"  [{iss['type']}] {iss['file']}")
        print(f"      {iss['detail'][:160]}")

    print("\n## 二、Tushare 调用（含已知错误字段标记）")
    bad_calls = [c for c in field_calls if c.get("known_bad")]
    print(f"  含已知错误字段的调用：{len(bad_calls)} 个")
    for c in bad_calls:
        print(f"  [!!] {c['file']} -> {c['api']}(fields=...)")
        print(f"       错误字段: {c['known_bad']}")

    out = {
        "static_issues": static_issues,
        "field_calls": field_calls,
        "apis": sorted({c["api"] for c in field_calls}),
    }
    with open("/tmp/audit_phase1.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    combos = {(c["api"], c["fields"]) for c in field_calls if c["fields"]}
    print(f"\n  API 接口分布: {len(out['apis'])} 个")
    for api, n in Counter(c["api"] for c in field_calls).most_common():
        print(f"    {api}: {n}")
    print(f"\n  唯一 (api, fields) 组合: {len(combos)} 个")
    with open("/tmp/audit_combos.json", "w", encoding="utf-8") as f:
        json.dump([{"api": a, "fields": fl} for a, fl in sorted(combos)], f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
