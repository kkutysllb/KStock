"""策略工作区 agent 工具：策略创建 / 版本保存 / 回测记录。

配合 lead_soul「策略研究与回测场景」编排使用。核心纪律：
- 策略代码**必须**经 strategy_save_version 存入策略库，禁止只留在
  thread workspace（thread 结束即沉没）；
- 每次修改参数或代码 = 一个新版本（父版本 = 当前版本），版本不可变；
- 回测结束必须用 strategy_record_backtest 记录「策略版本 × 数据区间 ×
  交易规则」三元组与指标，否则跨版本对比无法对齐口径。

数据落 ~/.kstock/product/strategies（沙箱内 /mnt/strategies 只读）。
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
    from scripts.kstock_strategies import StrategyStore

    data_root = os.environ.get("KSTOCK_APP_DATA_DIR")
    if not data_root:
        raise RuntimeError("KSTOCK_APP_DATA_DIR 未设置（gateway 启动时注入）")
    return StrategyStore(Path(data_root))


def _user_id() -> str:
    from qilin.runtime.user_context import get_effective_user_id

    return str(get_effective_user_id())


class StrategyListTool(BaseTool):
    """列出策略库中的策略（含当前版本与最近一次回测指标）。"""

    name: str = "strategy_list"
    description: str = (
        "列出策略库中所有策略：strategy_id、名称、投资假设、状态、当前版本、"
        "最近一次回测的核心指标。用户提到「继续/改进/对比之前的策略」时先调用本工具定位策略。"
    )

    def _run(self, query: str = "") -> str:
        try:
            store = _get_store()
            return _ok({"strategies": store.list_strategies(_user_id())})
        except Exception as exc:  # noqa: BLE001 工具层统一兜底
            return _error(f"策略列表读取失败：{exc}")


class StrategyCreateTool(BaseTool):
    """创建新策略（返回 strategy_id，后续版本都挂在其下）。"""

    name: str = "strategy_create"
    description: str = (
        "创建新策略。输入 JSON：{\"name\": \"双均线动量\", "
        "\"hypothesis\": \"短期均线上穿长期均线代表动量转强…\"}。"
        "hypothesis 写投资逻辑/假设，后续每次迭代都要回过头对照它。"
    )

    def _run(self, query: str) -> str:
        try:
            params = _parse_json(query)
            name = str(params.get("name") or "").strip()
            if not name:
                return _error("name 不能为空")
            store = _get_store()
            return _ok(store.create_strategy(_user_id(), name, str(params.get("hypothesis") or "")))
        except ValueError as exc:
            return _error(str(exc))
        except Exception as exc:  # noqa: BLE001
            return _error(f"策略创建失败：{exc}")


class StrategyGetLatestTool(BaseTool):
    """读取策略当前版本的代码与参数（迭代的起点）。"""

    name: str = "strategy_get_latest"
    description: str = (
        "读取策略当前版本（版本号、完整策略代码、参数、变更历史摘要）。"
        "输入 JSON：{\"strategy_id\": \"stg_xxx\"}。"
        "迭代前必须先调用本工具拿到最新代码与 parent_version。"
    )

    def _run(self, query: str) -> str:
        try:
            params = _parse_json(query)
            strategy_id = str(params.get("strategy_id") or "").strip()
            if not strategy_id:
                return _error("strategy_id 不能为空")
            store = _get_store()
            strategy = store.get_strategy(_user_id(), strategy_id)
            if int(strategy["current_version"]) < 1:
                return _ok({**strategy, "code": None, "params": {}, "note": "尚无版本，请先保存 v1"})
            latest = store.get_version(_user_id(), strategy_id, int(strategy["current_version"]))
            return _ok({
                **{k: strategy[k] for k in ("strategy_id", "name", "hypothesis", "status", "current_version")},
                "code": latest["code"],
                "params": latest["params"],
                "change_note": latest["change_note"],
            })
        except KeyError as exc:
            return _error(str(exc).strip("'"))
        except ValueError as exc:
            return _error(str(exc))
        except Exception as exc:  # noqa: BLE001
            return _error(f"策略读取失败：{exc}")


class StrategySaveVersionTool(BaseTool):
    """保存策略新版本（代码 + 参数 + 变更说明，版本不可变）。"""

    name: str = "strategy_save_version"
    description: str = (
        "保存策略新版本。输入 JSON：{\"strategy_id\": \"stg_xxx\", "
        "\"code\": \"<完整策略代码>\", \"params\": {\"short\": 10, \"long\": 30}, "
        "\"change_note\": \"均线 5/20 → 10/30，降低交易频率\", "
        "\"parent_version\": 2}。parent_version 必须等于当前版本号"
        "（strategy_get_latest 返回的 current_version），冲突时会报错——"
        "此时重新读取最新版本后再提交。change_note 必须写清改了什么、为什么。"
    )

    def _run(self, query: str) -> str:
        try:
            params = _parse_json(query)
            strategy_id = str(params.get("strategy_id") or "").strip()
            code = params.get("code")
            if not strategy_id:
                return _error("strategy_id 不能为空")
            if not isinstance(code, str) or not code.strip():
                return _error("code 不能为空")
            parent_version = params.get("parent_version")
            store = _get_store()
            return _ok(store.save_version(
                _user_id(), strategy_id,
                code=code,
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


class StrategyRecordBacktestTool(BaseTool):
    """记录一次回测运行（版本 × 数据区间 × 规则 × 指标）。"""

    name: str = "strategy_record_backtest"
    description: str = (
        "回测结束后记录运行结果，供跨版本对比。输入 JSON："
        "{\"strategy_id\": \"stg_xxx\", \"version\": 3, "
        "\"data_start\": \"20220101\", \"data_end\": \"20241231\", "
        "\"rules\": {\"commission\": 0.00025, \"stamp_duty\": 0.0005, "
        "\"slippage\": 0.001, \"enforce_a_share_rules\": true}, "
        "\"metrics\": {\"total_return_pct\": 23.3, \"sharpe_ratio\": 0.79, "
        "\"max_drawdown_pct\": -33.05, \"win_rate_pct\": 45.6, \"trade_count\": 31}, "
        "\"equity\": [...], \"trades\": [...]}。"
        "rules 必须原样抄录本次回测使用的交易规则参数（含 a_share_rules 回显），"
        "metrics 抄录回测输出的 metrics；equity/trades 可选（大文件可省略）。"
    )

    def _run(self, query: str) -> str:
        try:
            params = _parse_json(query)
            strategy_id = str(params.get("strategy_id") or "").strip()
            version = params.get("version")
            if not strategy_id or version is None:
                return _error("strategy_id 与 version 不能为空")
            store = _get_store()
            return _ok(store.record_run(
                _user_id(), strategy_id,
                version=int(version),
                data_start=str(params.get("data_start") or ""),
                data_end=str(params.get("data_end") or ""),
                rules=params.get("rules") or {},
                metrics=params.get("metrics") or {},
                equity=params.get("equity"),
                trades=params.get("trades"),
                thread_id=params.get("thread_id"),
            ))
        except ValueError as exc:
            return _error(str(exc))
        except KeyError as exc:
            return _error(str(exc).strip("'"))
        except Exception as exc:  # noqa: BLE001
            return _error(f"回测记录失败：{exc}")


strategy_list_tool = StrategyListTool()
strategy_create_tool = StrategyCreateTool()
strategy_get_latest_tool = StrategyGetLatestTool()
strategy_save_version_tool = StrategySaveVersionTool()
strategy_record_backtest_tool = StrategyRecordBacktestTool()
