"""选股工作区 agent 工具：方案创建 / 要求版本保存 / 选股运行与报告入库。

配合 lead_soul「选股策略扫描场景」编排使用。核心纪律：
- 用户的选股要求**必须**经 selection_create / selection_save_version 固化
  到选股库，禁止只留在对话里（下次「再跑一次」无从复现口径）；
- 每次调整选股要求 = 一个新版本（父版本 = 当前版本），版本不可变；
- 选股扫描结束必须用 selection_record_run 把**报告全文 + 命中清单**入库，
  锁定「要求版本 × 基准日 × 股票池 × 执行口径」，否则跨期跟踪没有意义。

数据落 ~/.kstock/product/selections（沙箱内 /mnt/selections 只读）。
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from langchain.tools import BaseTool


def _error(message: str) -> str:
    return json.dumps({"error": message}, ensure_ascii=False)


def _ok(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _parse_json(query: str) -> dict[str, Any]:
    try:
        parsed = json.loads(query)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    raise ValueError("入参必须是 JSON 对象")


def _get_store():
    from scripts.kstock_selections import SelectionStore

    data_root = os.environ.get("KSTOCK_APP_DATA_DIR")
    if not data_root:
        raise RuntimeError("KSTOCK_APP_DATA_DIR 未设置（gateway 启动时注入）")
    return SelectionStore(Path(data_root))


def _user_id() -> str:
    from qilin.runtime.user_context import get_effective_user_id

    return str(get_effective_user_id())


class SelectionListTool(BaseTool):
    """列出选股库中的方案（含当前版本要求与最近一次运行摘要）。"""

    name: str = "selection_list"
    description: str = (
        "列出选股库中所有选股方案：selection_id、名称、选股要求口径、状态、"
        "当前版本、最近一次运行的基准日与命中数。用户提到「再跑一次/更新/"
        "对比之前的选股」「上次那个高股息筛选」等引用既有方案时先调用本工具定位，"
        "避免重复建方案。"
    )

    def _run(self, query: str = "") -> str:
        try:
            store = _get_store()
            return _ok({"selections": store.list_selections(_user_id())})
        except Exception as exc:  # noqa: BLE001 工具层统一兜底
            return _error(f"选股库列表读取失败：{exc}")


class SelectionCreateTool(BaseTool):
    """创建新选股方案（返回 selection_id，要求落 v1）。"""

    name: str = "selection_create"
    description: str = (
        "创建新选股方案。输入 JSON：{\"name\": \"高股息组合\", "
        "\"criteria\": \"高股息 + 大市值(>200亿) + 沪深300 池，TopN 10\", "
        "\"params\": {\"strategies\": [\"高股息\"], \"market_cap\": \"large\", "
        "\"pool\": \"hs300\", \"top_n\": 10}}。criteria 用一句话写清用户的选股要求口径"
        "（策略 / 市值 / 股票池 / 数量 / 排序），params 存结构化口径（与澄清表单字段对应），"
        "两者都会随版本固化，后续按它复现执行。"
    )

    def _run(self, query: str) -> str:
        try:
            params = _parse_json(query)
            name = str(params.get("name") or "").strip()
            if not name:
                return _error("name 不能为空")
            store = _get_store()
            return _ok(store.create_selection(
                _user_id(), name,
                str(params.get("criteria") or ""),
                params.get("params") or {},
            ))
        except ValueError as exc:
            return _error(str(exc))
        except Exception as exc:  # noqa: BLE001
            return _error(f"选股方案创建失败：{exc}")


class SelectionGetLatestTool(BaseTool):
    """读取选股方案当前版本的要求口径（复现执行的起点）。"""

    name: str = "selection_get_latest"
    description: str = (
        "读取选股方案当前版本（版本号、结构化选股要求 criteria、参数、变更历史摘要）。"
        "输入 JSON：{\"selection_id\": \"sel_xxx\"}。"
        "复跑/调整方案前必须先调用本工具拿到最新口径与 parent_version。"
    )

    def _run(self, query: str) -> str:
        try:
            params = _parse_json(query)
            selection_id = str(params.get("selection_id") or "").strip()
            if not selection_id:
                return _error("selection_id 不能为空")
            store = _get_store()
            selection = store.get_selection(_user_id(), selection_id)
            if int(selection["current_version"]) < 1:
                return _ok({
                    **{k: selection[k] for k in ("selection_id", "name", "criteria", "status", "current_version")},
                    "structured": {},
                    "note": "尚无版本，请先保存 v1 选股要求",
                })
            latest = store.get_version(_user_id(), selection_id, int(selection["current_version"]))
            return _ok({
                **{k: selection[k] for k in ("selection_id", "name", "criteria", "status", "current_version")},
                "structured": latest["criteria"],
                "params": latest["params"],
                "change_note": latest["change_note"],
            })
        except KeyError as exc:
            return _error(str(exc).strip("'"))
        except ValueError as exc:
            return _error(str(exc))
        except Exception as exc:  # noqa: BLE001
            return _error(f"选股方案读取失败：{exc}")


class SelectionSaveVersionTool(BaseTool):
    """保存选股要求新版本（口径变更时用，版本不可变）。"""

    name: str = "selection_save_version"
    description: str = (
        "用户调整选股要求（换策略 / 改市值 / 换股票池 / 调 TopN 等）时保存新版本。"
        "输入 JSON：{\"selection_id\": \"sel_xxx\", "
        "\"criteria_json\": {\"strategies\": [\"高股息\",\"价值投资\"], \"market_cap\": \"large\", "
        "\"pool\": \"hs300\", \"top_n\": 10, \"summary\": \"高股息+价值 双策略 大市值 沪深300 TopN 10\"}, "
        "\"change_note\": \"加入价值投资策略，与高股息共振\", \"parent_version\": 2}。"
        "criteria_json.summary 必填（一句话口径摘要，列表展示用）；"
        "parent_version 必须等于当前版本号（selection_get_latest 返回的 current_version），"
        "冲突时重新读取后再提交。change_note 必须写清改了什么、为什么。"
    )

    def _run(self, query: str) -> str:
        try:
            params = _parse_json(query)
            selection_id = str(params.get("selection_id") or "").strip()
            criteria_json = params.get("criteria_json")
            if not selection_id:
                return _error("selection_id 不能为空")
            if not isinstance(criteria_json, dict) or not criteria_json:
                return _error("criteria_json 不能为空（含 summary 口径摘要）")
            parent_version = params.get("parent_version")
            store = _get_store()
            return _ok(store.save_version(
                _user_id(), selection_id,
                criteria_json=criteria_json,
                params=params.get("params") or {},
                change_note=str(params.get("change_note") or ""),
                parent_version=int(parent_version) if parent_version is not None else None,
            ))
        except ValueError as exc:
            return _error(str(exc))
        except KeyError as exc:
            return _error(str(exc).strip("'"))
        except Exception as exc:  # noqa: BLE001
            return _error(f"版本保存失败：{exc}")


class SelectionRecordRunTool(BaseTool):
    """选股扫描完成后归档：报告全文 + 命中清单 + 口径指标。"""

    name: str = "selection_record_run"
    description: str = (
        "选股扫描完成后入库归档，供「选股库」跨期跟踪与对比。输入 JSON："
        "{\"selection_id\": \"sel_xxx\", \"version\": 1, "
        "\"trade_date\": \"20240930\", \"universe\": \"沪深300\", "
        "\"rules\": {\"scripts\": [\"run_high_dividend.py\"], \"market_cap\": \"large\", \"top_n\": 10}, "
        "\"metrics\": {\"hit_count\": 23, \"strategy_count\": 2, \"consensus_count\": 5, \"top_n\": 10}, "
        "\"report\": \"<完整选股报告 markdown：命中清单表/共振股/TopN 组合建议/风险提示>\", "
        "\"picks\": [{\"code\": \"600036.SH\", \"name\": \"招商银行\", \"score\": 82.5, "
        "\"strategies\": [\"高股息\",\"价值投资\"], \"rank\": 1}]}。"
        "report 必须是给用户的完整选股报告全文（与对话中呈现一致）；"
        "picks 为命中清单（code/name/score/strategies/rank）；rules 原样抄录本次执行的"
        "脚本与参数口径，metrics 记 hit_count/strategy_count/consensus_count/top_n——"
        "否则跨期对比口径失效。"
    )

    def _run(self, query: str) -> str:
        try:
            params = _parse_json(query)
            selection_id = str(params.get("selection_id") or "").strip()
            version = params.get("version")
            if not selection_id or version is None:
                return _error("selection_id 与 version 不能为空")
            store = _get_store()
            return _ok(store.record_run(
                _user_id(), selection_id,
                version=int(version),
                trade_date=str(params.get("trade_date") or ""),
                universe=str(params.get("universe") or ""),
                rules=params.get("rules") or {},
                metrics=params.get("metrics") or {},
                report=params.get("report"),
                picks=params.get("picks"),
                thread_id=params.get("thread_id"),
            ))
        except ValueError as exc:
            return _error(str(exc))
        except KeyError as exc:
            return _error(str(exc).strip("'"))
        except Exception as exc:  # noqa: BLE001
            return _error(f"选股运行入库失败：{exc}")


selection_list_tool = SelectionListTool()
selection_create_tool = SelectionCreateTool()
selection_get_latest_tool = SelectionGetLatestTool()
selection_save_version_tool = SelectionSaveVersionTool()
selection_record_run_tool = SelectionRecordRunTool()
