#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Render one structured analysis payload into a self-contained HTML dashboard."""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any

from report_contract import validate_report_payload


ASSET_DIR = Path(__file__).resolve().parents[1] / "assets"
_SAFE_BASENAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$")


def _safe_basename(value: str) -> str:
    if not _SAFE_BASENAME.fullmatch(value):
        raise ValueError("basename 只能包含字母、数字、点、下划线和连字符")
    return value


def render_dashboard_html(payload: dict[str, Any], runtime_js: str) -> str:
    """Return a complete HTML document with data and runtime embedded."""
    validate_report_payload(payload)
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    if "</script" in serialized.lower():
        raise ValueError("报告数据不能包含 script 结束标签")
    title = html.escape(str(payload["title"]), quote=True)
    generated_at = html.escape(str(payload["generated_at"]), quote=True)
    report_id = html.escape(str(payload["report_id"]), quote=True)
    summary = html.escape(str(payload["sections"][0].get("summary", "")), quote=True)
    css = """
:root { color-scheme: light; --ink:#18212a; --muted:#65727d; --line:#d7dee3; --panel:#fff; --accent:#117a8b; --soft:#f2f5f6; }
* { box-sizing:border-box; }
body { margin:0; background:#eef2f3; color:var(--ink); font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif; }
.dashboard-shell { max-width:1320px; margin:0 auto; padding:24px; }
.dashboard-header { background:var(--panel); border:1px solid var(--line); padding:24px; box-shadow:0 8px 24px rgba(24,33,42,.05); }
.dashboard-kicker { color:var(--accent); font-size:12px; letter-spacing:.08em; text-transform:uppercase; }
.dashboard-header h1 { margin:4px 0 8px; font-size:28px; line-height:1.2; }
.dashboard-meta { color:var(--muted); margin:0; }
.dashboard-summary { color:#334155; max-width:900px; }
.dashboard-nav { display:flex; gap:8px; flex-wrap:wrap; padding:16px 0; position:sticky; top:0; z-index:2; background:#eef2f3; }
.dashboard-nav-item { border:1px solid var(--line); border-radius:4px; background:#fff; color:#334155; padding:7px 11px; cursor:pointer; }
.dashboard-nav-item:hover { border-color:var(--accent); color:var(--accent); }
.dashboard-section { background:var(--panel); border:1px solid var(--line); padding:20px; margin:0 0 16px; scroll-margin-top:80px; }
.dashboard-section-header { display:flex; justify-content:space-between; gap:12px; align-items:center; border-bottom:1px solid var(--line); padding-bottom:10px; }
.dashboard-section-header h2 { margin:0; font-size:18px; }
.dashboard-status { color:var(--accent); font-size:12px; }
.status-partial .dashboard-status { color:#b45309; }
.status-unavailable .dashboard-status { color:#64748b; }
.dashboard-metrics { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:10px; margin:16px 0; }
.dashboard-metric { background:var(--soft); border-left:3px solid var(--accent); padding:12px; min-height:92px; }
.dashboard-metric-label,.dashboard-metric-meta { display:block; color:var(--muted); }
.dashboard-metric-value { display:block; font-size:22px; margin:4px 0; }
.dashboard-charts { display:grid; grid-template-columns:repeat(auto-fit,minmax(340px,1fr)); gap:14px; }
.dashboard-chart { border:1px solid var(--line); margin:0; padding:12px; min-height:190px; overflow:auto; }
.dashboard-chart-title { font-weight:650; margin-bottom:8px; }
.dashboard-chart svg { width:100%; height:auto; min-height:170px; display:block; }
.dashboard-chart-note { color:var(--muted); margin:4px 0 10px; }
.dashboard-data-table { border-collapse:collapse; width:100%; font-size:12px; }
.dashboard-data-table th,.dashboard-data-table td { border:1px solid var(--line); padding:5px 7px; text-align:left; }
.dashboard-data-table th { background:var(--soft); }
.dashboard-gaps { color:#92400e; background:#fff7ed; border:1px solid #fed7aa; padding:10px 10px 10px 28px; }
@media (max-width:700px) { .dashboard-shell { padding:12px; } .dashboard-header h1 { font-size:22px; } .dashboard-charts { grid-template-columns:1fr; } }
"""
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; frame-src 'none'">
<title>{title}</title>
<style>{css}</style>
</head>
<body>
<div class="dashboard-shell" id="dashboard-root">
  <header class="dashboard-header">
    <div class="dashboard-kicker">KStock HTML Dashboard</div>
    <h1>{title}</h1>
    <p class="dashboard-meta">报告 ID：{report_id} · 生成时间：{generated_at}</p>
    <p class="dashboard-summary">{summary}</p>
  </header>
</div>
<script>window.__KSTOCK_REPORT__={serialized};</script>
<script>{runtime_js}</script>
<script>window.KStockDashboard.mount(document.getElementById("dashboard-root"),window.__KSTOCK_REPORT__);</script>
</body>
</html>
"""


def render_report(input_path: Path, output_dir: Path, basename: str) -> Path:
    basename = _safe_basename(basename)
    payload = json.loads(input_path.read_text(encoding="utf-8"))
    runtime_js = (ASSET_DIR / "dashboard-runtime.js").read_text(encoding="utf-8")
    document = render_dashboard_html(payload, runtime_js)
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / f"{basename}.html"
    fd, temporary = tempfile.mkstemp(prefix=f".{basename}.", suffix=".tmp", dir=output_dir)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(document)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Render one offline HTML dashboard")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--basename", required=True)
    args = parser.parse_args()
    try:
        path = render_report(args.input, args.output_dir, args.basename)
    except Exception as exc:
        parser.error(str(exc))
    print(f"HTML: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
