"""KStock gateway 启动入口的配置生成持久化测试。

验证 `_generate_runtime_config` 的核心持久化语义：runtime.yaml 已存在时
绝不覆盖，确保用户通过设置页写入的 models / memory / database 等配置
跨 gateway 重启保留。
"""
from __future__ import annotations

import yaml

from scripts.run_gateway import _generate_runtime_config


# ── 首次生成 ─────────────────────────────────────────────────────────


def test_generate_creates_file_when_absent(tmp_path):
    """runtime.yaml 不存在时生成，且 database.sqlite_dir 为绝对路径。"""
    from scripts.run_gateway import REPO_ROOT

    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    qilin_data_dir = tmp_path / "runtime" / "qilin" / "data"

    assert not runtime_cfg.exists()
    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)

    assert runtime_cfg.exists()
    cfg = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))
    # 路径修正在首次生成时生效
    assert cfg["database"]["backend"] == "sqlite"
    assert cfg["database"]["sqlite_dir"] == str(qilin_data_dir)
    assert cfg["run_events"]["backend"] == "db"


# ── 持久化核心：已存在不覆盖 ───────────────────────────────────────


def test_generate_preserves_existing_user_config(tmp_path):
    """runtime.yaml 已存在（含用户自定义 models）时绝不覆盖。

    这是修复「每次重启都要重新配置模型」的核心回归测试：模拟用户已通过
    设置页写入模型，gateway 重启后调用 _generate_runtime_config，用户配置
    必须原样保留。
    """
    from scripts.run_gateway import REPO_ROOT

    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    runtime_cfg.parent.mkdir(parents=True, exist_ok=True)
    qilin_data_dir = tmp_path / "runtime" / "qilin" / "data"

    # 模拟用户已通过 API 写入的配置（含自定义 models / memory 段）
    user_cfg = {
        "models": [
            {
                "name": "my-deepseek",
                "use": "qilin.models.patched_deepseek:PatchedChatDeepSeek",
                "model": "deepseek-chat",
                "api_key_env": "$KSTOCK_MODEL_MY_DEEPSEEK_KEY",
            }
        ],
        "memory": {"enabled": True, "mode": "tool"},
        "database": {"backend": "sqlite", "sqlite_dir": str(qilin_data_dir)},
    }
    runtime_cfg.write_text(yaml.safe_dump(user_cfg, allow_unicode=True), encoding="utf-8")

    # gateway 重启 → create_app → _ensure_data_space → _generate_runtime_config
    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)

    # 用户配置原样保留，未被模板覆盖
    preserved = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))
    assert preserved["models"] == user_cfg["models"]
    assert preserved["models"][0]["name"] == "my-deepseek"
    assert preserved["memory"]["mode"] == "tool"


def test_generate_idempotent_when_tools_already_synced(tmp_path):
    """已存在且 tools 段已与模板一致时，多次调用幂等，文件 mtime 不变。

    新逻辑下已存在 yaml 会增量合并模板 tools 段；只有当 tools 段已同步时
    才真正不写入。本测试先调用一次让 tools 同步，再验证后续调用幂等。
    """
    from scripts.run_gateway import REPO_ROOT

    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    runtime_cfg.parent.mkdir(parents=True, exist_ok=True)
    runtime_cfg.write_text("memory:\n  enabled: true\n", encoding="utf-8")
    qilin_data_dir = tmp_path / "data"

    # 第一次：合并 tools 段（旧 yaml 缺这段）
    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)

    # 后续调用：tools 已同步，不应再写入
    mtime_before = runtime_cfg.stat().st_mtime_ns
    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)
    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)
    mtime_after = runtime_cfg.stat().st_mtime_ns

    assert mtime_before == mtime_after


# ── 增量合并：老用户 yaml 缺 tools 段时同步过来 ──────────────────────


def test_merges_tools_section_for_legacy_users(tmp_path):
    """老版本首次启动生成的 yaml 缺 tools 段，重启后应增量合并。

    场景：用户在 KStock 早期版本首次启动（那时模板还没 tools 段），后续
    版本给模板加了金融搜索工具。用户重启 gateway 后，_generate_runtime_config
    应把模板 tools 段合并进现有 yaml，而不是什么都不做——否则
    config.tools 为空，agent 看不到任何工具（issue: agent 回复「不支持
    实时网页搜索」）。

    合并时必须保留用户的持久化配置（models / memory / database 等）。
    """
    from scripts.run_gateway import REPO_ROOT

    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    runtime_cfg.parent.mkdir(parents=True, exist_ok=True)
    qilin_data_dir = tmp_path / "runtime" / "qilin" / "data"

    # 模拟老版本生成的 yaml：有用户配置，但没有 tools 段
    legacy_cfg = {
        "models": [{"name": "my-minimax", "use": "qilin.models.patched_minimax", "model": "MiniMax-M3"}],
        "memory": {"enabled": True, "mode": "middleware"},
        "database": {"backend": "sqlite", "sqlite_dir": str(qilin_data_dir)},
        # 注意：没有 tools 段
    }
    runtime_cfg.write_text(yaml.safe_dump(legacy_cfg, allow_unicode=True), encoding="utf-8")

    # 用户重启 gateway → _generate_runtime_config 增量合并 tools 段
    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)

    merged = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))

    # 1. tools 段已合并（来自模板）
    assert "tools" in merged, "老 yaml 缺 tools 段时必须增量合并"
    tool_names = {t["name"] for t in merged["tools"]}
    assert "finance_data_search" in tool_names
    assert "finance_news_search" in tool_names

    # 2. 用户配置原样保留（未被模板覆盖）
    assert merged["models"][0]["name"] == "my-minimax"
    assert merged["memory"]["mode"] == "middleware"
    assert merged["database"]["sqlite_dir"] == str(qilin_data_dir)


def test_updates_tools_section_when_template_changes(tmp_path):
    """模板 tools 段升级后，老用户 yaml 的旧 tools 段应被覆盖同步。

    场景：产品迭代把金融数据源从 yfinance 换成 akshare，模板 tools 段的
    use 路径变了。老用户 yaml 里还是旧的 yfinance 引用，重启后应被模板
    新版本覆盖——tools 段是产品级配置（不是用户级），覆盖安全。
    """
    from scripts.run_gateway import REPO_ROOT

    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    runtime_cfg.parent.mkdir(parents=True, exist_ok=True)
    qilin_data_dir = tmp_path / "data"

    # 模拟老版本 yaml：有「旧」tools 段（引用已废弃的 yfinance 模块）
    legacy_with_old_tools = {
        "models": [{"name": "my-model"}],
        "tools": [
            {"name": "finance_data_search", "group": "search", "use": "scripts.kstock_tools.yfinance_tool:finance_data_search_tool"},
        ],
    }
    runtime_cfg.write_text(yaml.safe_dump(legacy_with_old_tools, allow_unicode=True), encoding="utf-8")

    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)

    merged = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))
    uses = {t["use"] for t in merged["tools"]}
    # 旧引用被替换为新 akshare 模块
    assert any("akshare_data_tool" in u for u in uses), "模板 tools 段升级后应覆盖老用户的旧引用"
    assert not any("yfinance_tool" in u for u in uses), "旧的 yfinance 引用应被替换"
    # 用户配置保留
    assert merged["models"][0]["name"] == "my-model"


# ── 端到端时序：改配置 → 重启后端 ─────────────────────────────────


def test_user_writes_config_then_restart_backend_preserves_it(tmp_path):
    """模拟「用户改配置 → 点重启后端」的完整时序，验证配置不丢。

    场景对应：用户在设置页改了 memory 段，然后点「重启后端」让变更生效。
    重启后端 = supervisor 重启子进程 = 子进程重新执行 create_app() →
    _generate_runtime_config()。本测试用连续两次调用模拟这个时序。
    """
    from scripts.kstock_models import _atomic_write_yaml
    from scripts.run_gateway import REPO_ROOT

    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    runtime_cfg.parent.mkdir(parents=True, exist_ok=True)
    qilin_data_dir = tmp_path / "runtime" / "qilin" / "data"

    # 1. 首次启动 gateway：从模板生成 runtime.yaml
    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)
    assert runtime_cfg.exists()

    # 2. 用户在设置页改 memory 段 → PUT /api/v1/kstock/runtime-config/memory
    #    （复用 kstock_models 的原子写入，与生产代码路径一致）
    cfg = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))
    cfg["memory"] = {"enabled": True, "mode": "tool", "injection_enabled": True}
    cfg["models"] = [{"name": "production-model", "use": "openai", "model": "gpt-4"}]
    _atomic_write_yaml(runtime_cfg, cfg)

    # 3. 用户点「重启后端」→ supervisor 重启子进程 → 子进程走 create_app()
    #    → _ensure_data_space() → _generate_runtime_config()
    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)

    # 4. 用户刚写入的配置原样保留
    final = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))
    assert final["memory"]["mode"] == "tool"
    assert final["models"][0]["name"] == "production-model"
    # tools 段也应存在（增量合并）
    assert "tools" in final
    assert "finance_data_search" in {t["name"] for t in final["tools"]}


# ── 增量合并：subagents.custom_agents 段 ┄─────────────────────────────


# 模板中预置的 5 个子代理角色名（与 config/qilin.config.yaml 一致）
_PRESET_AGENT_NAMES = {
    "market-data-analyst",
    "stock-researcher",
    "chan-theory-analyst",
    "backtest-executor",
    "report-writer",
}


def test_merges_custom_agents_for_legacy_users(tmp_path):
    """老版本首次启动生成的 yaml 缺 subagents.custom_agents，重启后应增量合并。

    场景：用户在早期版本首次启动（那时模板还没预置子代理角色），后续版本
    给模板加了 5 个预置角色。用户重启 gateway 后，_generate_runtime_config
    应把模板 custom_agents 段合并进现有 yaml——否则 Lead Agent 分派子代理时
    看不到任何预置角色。
    """
    from scripts.run_gateway import REPO_ROOT

    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    runtime_cfg.parent.mkdir(parents=True, exist_ok=True)
    qilin_data_dir = tmp_path / "runtime" / "qilin" / "data"

    # 模拟老版本生成的 yaml：有用户配置，但没有 subagents 段
    legacy_cfg = {
        "models": [{"name": "my-model", "use": "openai", "model": "gpt-4"}],
        "database": {"backend": "sqlite", "sqlite_dir": str(qilin_data_dir)},
        # 注意：没有 subagents 段
    }
    runtime_cfg.write_text(yaml.safe_dump(legacy_cfg, allow_unicode=True), encoding="utf-8")

    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)

    merged = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))

    # 1. subagents.custom_agents 已合并（5 个预置角色全部到位）
    assert "subagents" in merged, "老 yaml 缺 subagents 段时必须增量合并"
    custom_agents = merged["subagents"].get("custom_agents", {})
    merged_names = set(custom_agents.keys())
    assert _PRESET_AGENT_NAMES.issubset(merged_names), (
        f"5 个预置角色必须全部合并进来，实际只有: {merged_names}"
    )
    # 每个预置角色都有 system_prompt
    for name in _PRESET_AGENT_NAMES:
        assert "system_prompt" in custom_agents[name], f"{name} 缺 system_prompt"

    # 2. 用户配置原样保留（未被模板覆盖）
    assert merged["models"][0]["name"] == "my-model"


def test_preserves_user_custom_agents_not_in_template(tmp_path):
    """用户自定义的独立角色（不在模板里）必须保留。"""
    from scripts.run_gateway import REPO_ROOT

    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    runtime_cfg.parent.mkdir(parents=True, exist_ok=True)
    qilin_data_dir = tmp_path / "data"

    # 模拟用户已有一个自定义角色 + 修改过的全局参数
    user_cfg = {
        "models": [{"name": "my-model"}],
        "subagents": {
            "timeout_seconds": 3600,  # 用户改了全局超时
            "max_turns": 50,
            "custom_agents": {
                # 用户自己新增的角色（不在模板里）
                "my-custom-analyst": {
                    "description": "我自己加的分析师",
                    "system_prompt": "你是自定义子代理",
                    "tools": ["finance_data_search"],
                },
            },
        },
    }
    runtime_cfg.write_text(yaml.safe_dump(user_cfg, allow_unicode=True), encoding="utf-8")

    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)

    merged = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))
    custom_agents = merged["subagents"]["custom_agents"]

    # 用户自定义角色保留
    assert "my-custom-analyst" in custom_agents, "用户自定义角色不应被模板合并删除"
    assert custom_agents["my-custom-analyst"]["system_prompt"] == "你是自定义子代理"
    # 5 个预置角色也合并进来
    assert _PRESET_AGENT_NAMES.issubset(set(custom_agents.keys()))
    # 用户改过的全局参数保留（不被模板覆盖）
    assert merged["subagents"]["timeout_seconds"] == 3600
    assert merged["subagents"]["max_turns"] == 50


def test_template_roles_override_user_modifications(tmp_path):
    """模板预置角色定义权威：用户改过的同名预置角色会被模板版本覆盖。

    场景：用户改了 market-data-analyst 的 system_prompt（想微调），但产品
    迭代后模板里该角色的定义也变了（比如加了新约束）。重启后用户改动被
    覆盖——这是有意为之，保证产品级角色定义权威，避免用户的旧版微调与
    新版模板定义冲突。
    """
    from scripts.run_gateway import REPO_ROOT

    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    runtime_cfg.parent.mkdir(parents=True, exist_ok=True)
    qilin_data_dir = tmp_path / "data"

    # 模拟用户改过的预置角色（与模板定义不同）
    user_cfg = {
        "models": [{"name": "my-model"}],
        "subagents": {
            "custom_agents": {
                "market-data-analyst": {
                    "description": "我改过的描述",
                    "system_prompt": "这不是模板版本，是用户微调版",
                    "tools": ["bash"],  # 用户加了 bash
                },
            },
        },
    }
    runtime_cfg.write_text(yaml.safe_dump(user_cfg, allow_unicode=True), encoding="utf-8")

    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)

    merged = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))
    market_agent = merged["subagents"]["custom_agents"]["market-data-analyst"]

    # 用户改动被模板版本覆盖
    assert market_agent["system_prompt"] != "这不是模板版本，是用户微调版"
    assert "bash" not in (market_agent.get("tools") or []), "用户的工具改动应被模板覆盖"
    # 其他预置角色也到位
    assert _PRESET_AGENT_NAMES.issubset(set(merged["subagents"]["custom_agents"].keys()))
