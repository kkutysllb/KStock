"""因子工作区 agent 工具：因子创建 / 版本保存 / 检验运行记录。

配合 lead_soul「因子研究场景」编排使用。核心纪律：
- 因子计算代码**必须**经 factor_save_version 存入因子库，禁止只留在
  thread workspace（thread 结束即沉没）；
- 每次修改定义或参数 = 一个新版本（父版本 = 当前版本），版本不可变；
- 检验（IC/IR + 分层回测）结束必须用 factor_record_run 记录「因子版本 ×
  股票池 × 数据区间 × 检验配置」与指标，否则跨版本对比无法对齐口径。

数据落 ~/.kstock/product/factors（沙箱内 /mnt/factors 只读）。
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
    from scripts.kstock_factors import FactorStore

    data_root = os.environ.get("KSTOCK_APP_DATA_DIR")
    if not data_root:
        raise RuntimeError("KSTOCK_APP_DATA_DIR 未设置（gateway 启动时注入）")
    return FactorStore(Path(data_root))


def _user_id() -> str:
    from qilin.runtime.user_context import get_effective_user_id

    return str(get_effective_user_id())


class FactorListTool(BaseTool):
    """列出因子库中的因子（含当前版本与最近一次检验指标）。"""

    name: str = "factor_list"
    description: str = (
        "列出因子库中所有因子：factor_id、名称、因子逻辑假设、类别（value/momentum/"
        "quality/low_vol/size/growth/custom）、状态、当前版本、最近一次检验的核心指标"
        "（IC 均值 / IR / IC>0 占比）。用户提到「继续/改进/对比之前的因子」或「已研究过"
        "哪些因子」时先调用本工具定位因子，避免重复研究。"
    )

    def _run(self, query: str = "") -> str:
        try:
            store = _get_store()
            return _ok({"factors": store.list_factors(_user_id())})
        except Exception as exc:  # noqa: BLE001 工具层统一兜底
            return _error(f"因子列表读取失败：{exc}")


class FactorCreateTool(BaseTool):
    """创建新因子（返回 factor_id，后续版本都挂在其下）。"""

    name: str = "factor_create"
    description: str = (
        "创建新因子。输入 JSON：{\"name\": \"20日反转\", "
        "\"hypothesis\": \"A股短期反转效应显著：过去20日跌幅大的股票未来20日倾向反弹…\", "
        "\"category\": \"momentum\"}。hypothesis 写因子逻辑/经济学假设（为什么它应该有效），"
        "后续每次迭代都要回过头对照它；category 可选 value/momentum/quality/low_vol/"
        "size/growth/custom（默认 custom）。"
    )

    def _run(self, query: str) -> str:
        try:
            params = _parse_json(query)
            name = str(params.get("name") or "").strip()
            if not name:
                return _error("name 不能为空")
            store = _get_store()
            return _ok(store.create_factor(
                _user_id(), name,
                str(params.get("hypothesis") or ""),
                str(params.get("category") or "custom"),
            ))
        except ValueError as exc:
            return _error(str(exc))
        except Exception as exc:  # noqa: BLE001
            return _error(f"因子创建失败：{exc}")


class FactorGetLatestTool(BaseTool):
    """读取因子当前版本的计算代码与参数（迭代或复用的起点）。"""

    name: str = "factor_get_latest"
    description: str = (
        "读取因子当前版本（版本号、完整因子计算代码、参数、变更历史摘要）。"
        "输入 JSON：{\"factor_id\": \"fac_xxx\"}。"
        "迭代前必须先调用本工具拿到最新代码与 parent_version；"
        "复用已验证因子做选股时也用它取因子定义。"
    )

    def _run(self, query: str) -> str:
        try:
            params = _parse_json(query)
            factor_id = str(params.get("factor_id") or "").strip()
            if not factor_id:
                return _error("factor_id 不能为空")
            store = _get_store()
            factor = store.get_factor(_user_id(), factor_id)
            if int(factor["current_version"]) < 1:
                return _ok({**factor, "code": None, "params": {}, "note": "尚无版本，请先保存 v1"})
            latest = store.get_version(_user_id(), factor_id, int(factor["current_version"]))
            return _ok({
                **{k: factor[k] for k in ("factor_id", "name", "hypothesis", "category", "status", "current_version")},
                "code": latest["code"],
                "params": latest["params"],
                "change_note": latest["change_note"],
            })
        except KeyError as exc:
            return _error(str(exc).strip("'"))
        except ValueError as exc:
            return _error(str(exc))
        except Exception as exc:  # noqa: BLE001
            return _error(f"因子读取失败：{exc}")


class FactorSaveVersionTool(BaseTool):
    """保存因子新版本（计算代码 + 参数 + 变更说明，版本不可变）。"""

    name: str = "factor_save_version"
    description: str = (
        "保存因子新版本。输入 JSON：{\"factor_id\": \"fac_xxx\", "
        "\"code\": \"<完整因子计算代码：输入行情/财务面板 DataFrame(index=日期,"
        "columns=代码) → 输出因子值面板>\", \"params\": {\"window\": 20}, "
        "\"change_note\": \"窗口 10 日 → 20 日，降低换手\", \"parent_version\": 2}。"
        "parent_version 必须等于当前版本号（factor_get_latest 返回的 current_version），"
        "冲突时重新 factor_get_latest 后再提交。change_note 必须写清改了什么、为什么。"
    )

    def _run(self, query: str) -> str:
        try:
            params = _parse_json(query)
            factor_id = str(params.get("factor_id") or "").strip()
            code = params.get("code")
            if not factor_id:
                return _error("factor_id 不能为空")
            if not isinstance(code, str) or not code.strip():
                return _error("code 不能为空")
            parent_version = params.get("parent_version")
            store = _get_store()
            return _ok(store.save_version(
                _user_id(), factor_id,
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


class FactorRecordRunTool(BaseTool):
    """记录一次因子检验运行（版本 × 股票池 × 区间 × 检验配置 × 指标）。"""

    name: str = "factor_record_run"
    description: str = (
        "因子检验（IC/IR + 分层回测）结束后记录运行结果，供跨版本/跨参数对比。输入 JSON："
        "{\"factor_id\": \"fac_xxx\", \"version\": 1, "
        "\"universe\": \"hs300+zz500 成分\", \"data_start\": \"20220101\", \"data_end\": \"20241231\", "
        "\"config\": {\"n_groups\": 5, \"period\": 20, \"neutralize\": \"申万一级\", \"winsorize\": \"2.5/97.5\"}, "
        "\"metrics\": {\"ic_mean\": 0.042, \"ir\": 0.61, \"ic_positive_pct\": 58.3, "
        "\"n_periods\": 240, \"long_short_spread_pct\": 12.7}, "
        "\"ic_series\": [{\"date\": \"2022-01-04\", \"ic\": 0.031}], "
        "\"layers\": {\"group_stats\": [{\"group\": \"group_1\", \"final_nav\": 1.05}]}}。"
        "metrics 抄录 cli.py analyze 输出的 ic_summary + backtest 关键字段；"
        "ic_series 抄录 ic_series.csv 的完整内容（超 2MB 可降采样）；"
        "layers 抄录分层回测的 group_stats（可选）；config 必须原样抄录本次检验配置，"
        "否则跨版本对比口径失效。"
    )

    def _run(self, query: str) -> str:
        try:
            params = _parse_json(query)
            factor_id = str(params.get("factor_id") or "").strip()
            version = params.get("version")
            if not factor_id or version is None:
                return _error("factor_id 与 version 不能为空")
            store = _get_store()
            return _ok(store.record_run(
                _user_id(), factor_id,
                version=int(version),
                universe=str(params.get("universe") or ""),
                data_start=str(params.get("data_start") or ""),
                data_end=str(params.get("data_end") or ""),
                config=params.get("config") or {},
                metrics=params.get("metrics") or {},
                ic_series=params.get("ic_series"),
                layers=params.get("layers"),
                thread_id=params.get("thread_id"),
            ))
        except ValueError as exc:
            return _error(str(exc))
        except KeyError as exc:
            return _error(str(exc).strip("'"))
        except Exception as exc:  # noqa: BLE001
            return _error(f"检验记录失败：{exc}")


factor_list_tool = FactorListTool()
factor_create_tool = FactorCreateTool()
factor_get_latest_tool = FactorGetLatestTool()
factor_save_version_tool = FactorSaveVersionTool()
factor_record_run_tool = FactorRecordRunTool()
