"""KStock gateway 启动入口的配置生成持久化测试。

验证 `_generate_runtime_config` 的核心持久化语义：runtime.yaml 已存在时
绝不覆盖，确保用户通过设置页写入的 models / memory / database 等配置
跨 gateway 重启保留。

同时验证用户数据根目录（~/.kstock）与历史 v1 数据目录（Application
Support）的自动迁移语义。
"""
from __future__ import annotations

import asyncio
from pathlib import Path

import yaml

from scripts.run_gateway import _generate_runtime_config


# ── aiosqlite busy_timeout 修复 ────────────────────────────────────────


def test_create_app_initializes_data_space_before_server_logs():
    """打包态日志目录不能先创建 ~/.kstock，否则会阻断历史数据迁移。"""
    source = Path("scripts/run_gateway.py").read_text(encoding="utf-8")

    assert source.index("paths = _ensure_data_space()") < source.index("from scripts.kstock_dev_logs import")


def test_patch_aiosqlite_sets_busy_timeout(tmp_path):
    """连接建立后必须应用 30s busy_timeout 与 WAL。"""
    import aiosqlite

    from scripts.run_gateway import _patch_aiosqlite_busy_timeout

    _patch_aiosqlite_busy_timeout()

    async def _check():
        db_path = tmp_path / "patch_check.db"
        conn = aiosqlite.connect(str(db_path))
        async with conn:
            cursor = await conn.execute("PRAGMA busy_timeout")
            row = await cursor.fetchone()
            await cursor.close()
            cursor = await conn.execute("PRAGMA journal_mode")
            mode = await cursor.fetchone()
            await cursor.close()
            return row, mode

    (busy, mode) = asyncio.run(_check())
    assert busy == (30000,), f"busy_timeout 应为 30000，实际 {busy}"
    assert mode == ("wal",), f"journal_mode 应为 wal，实际 {mode}"


def test_patch_keeps_connect_sync_signature(tmp_path):
    """aiosqlite.connect 必须保持同步工厂语义，兼容 SQLAlchemy 方言。

    SQLAlchemy 的 sqlite+aiosqlite 方言同步调用 ``aiosqlite.connect`` 并直接
    访问返回值（``connection._thread.daemon = True``）；若把 connect 包装成
    协程，方言会拿到 coroutine 而崩溃。这里模拟方言的同步调用方式。
    """
    import aiosqlite

    from scripts.run_gateway import _patch_aiosqlite_busy_timeout

    _patch_aiosqlite_busy_timeout()
    conn = aiosqlite.connect(str(tmp_path / "dialect_check.db"))
    assert isinstance(conn, aiosqlite.Connection)
    assert hasattr(conn, "_thread"), "方言需要访问 connection._thread"


def test_patch_aiosqlite_is_idempotent():
    """重复调用不产生多层包装（保留原始 _connect 引用）。"""
    import aiosqlite

    from scripts.run_gateway import _patch_aiosqlite_busy_timeout

    _patch_aiosqlite_busy_timeout()
    first = aiosqlite.Connection._connect
    _patch_aiosqlite_busy_timeout()
    assert aiosqlite.Connection._connect is first


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


def test_user_writes_config_then_restart_backend_preserves_it(tmp_path, monkeypatch):
    """模拟「用户改配置 → 点重启后端」的完整时序，验证配置不丢。

    场景对应：用户在设置页改了 memory 段，然后点「重启后端」让变更生效。
    重启后端 = supervisor 重启子进程 = 子进程重新执行 create_app() →
    _generate_runtime_config()。本测试用连续两次调用模拟这个时序。
    """
    from scripts.kstock_models import _atomic_write_yaml
    from scripts.run_gateway import REPO_ROOT

    # _atomic_write_yaml 的备份目录依赖 KSTOCK_APP_DATA_DIR（生产由
    # create_app 注入；惰性化后 import 不再设置，测试需显式提供）
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(tmp_path))

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


# ── 增量合并：subagents.agents 段 ┄───────────────────────────────────


# 模板中 general-purpose 的技能白名单（与 config/qilin.config.yaml 一致）
_TEMPLATE_GP_SKILLS = [
    "a-stock-screener",
    "announcement-search",
    "backtrader_strategies",
    "business-query",
    "cb-analysis",
    "chart-visualization",
    "common",
    "dcf",
    "earnings-forecast",
    "earnings-revision",
    "etf-analysis",
    "event-query",
    "factor-research",
    "financial-statement",
    "futures-analysis",
    "hithink-futures",
    "industry-analysis",
    "macro-query",
    "market-linkage-engine",
    "news-search",
    "option-futures-linkage",
    "options-payoff",
    "options-volatility",
    "report-search",
    "sandbox-path-guide",
    "selection-strategies",
    "stock-analysis",
    "strategy-research",
    "tushare-data",
    "valuation-model",
    "zhishu-query",
]


def test_merges_subagent_agents_skills_whitelist(tmp_path):
    """老用户 runtime.yaml 的 subagents.agents 为空/缺省时，应合并模板白名单。

    场景：模板给内置 general-purpose 挂了沙箱路径规范技能白名单
    （subagents.agents.general-purpose.skills）。老用户 runtime.yaml 的
    agents 段为空（{}）或缺省，重启 gateway 后必须增量合并，否则子代理
    看不到规范技能，仍会执行 ls / 或 ls /mnt 探查被沙箱拒绝。
    """
    from scripts.run_gateway import REPO_ROOT

    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    runtime_cfg.parent.mkdir(parents=True, exist_ok=True)
    qilin_data_dir = tmp_path / "data"

    # 模拟老版本 yaml：agents 段为空 dict + 用户改过的全局参数
    legacy_cfg = {
        "models": [{"name": "my-model"}],
        "subagents": {
            "timeout_seconds": 3600,  # 用户改过，必须保留
            "agents": {},
        },
    }
    runtime_cfg.write_text(yaml.safe_dump(legacy_cfg, allow_unicode=True), encoding="utf-8")

    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)

    merged = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))
    agents = merged["subagents"]["agents"]

    # 1. 模板的 general-purpose.skills 白名单已合并
    assert "general-purpose" in agents, "模板 agents.general-purpose 必须合并进来"
    assert agents["general-purpose"]["skills"] == _TEMPLATE_GP_SKILLS
    assert "sandbox-path-guide" in agents["general-purpose"]["skills"]
    # 2. 用户改过的全局参数保留
    assert merged["subagents"]["timeout_seconds"] == 3600


def test_merges_subagent_agents_preserves_user_keys(tmp_path):
    """用户自定义的 agents key 保留，模板 key 覆盖同名。"""
    from scripts.run_gateway import REPO_ROOT

    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    runtime_cfg.parent.mkdir(parents=True, exist_ok=True)
    qilin_data_dir = tmp_path / "data"

    # 用户给 general-purpose 配过 model（与模板不同）+ 自定义 bash 代理 key
    user_cfg = {
        "models": [{"name": "my-model"}],
        "subagents": {
            "agents": {
                "general-purpose": {"model": "my-model"},
                "bash": {"max_turns": 30},  # 用户自定义 key
            },
        },
    }
    runtime_cfg.write_text(yaml.safe_dump(user_cfg, allow_unicode=True), encoding="utf-8")

    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)

    merged = yaml.safe_load(runtime_cfg.read_text(encoding="utf-8"))
    agents = merged["subagents"]["agents"]

    # 模板 key 覆盖同名（skills 白名单生效）
    assert agents["general-purpose"]["skills"] == _TEMPLATE_GP_SKILLS
    # 用户自定义 key 保留
    assert agents["bash"]["max_turns"] == 30


# ── 沙箱数据凭据注入 ─────────────────────────────────────────────────


def test_inject_data_secrets_injects_whitelist_keys(monkeypatch):
    """secrets.env 白名单密钥（TUSHARE_TOKEN / IWENCAI_API_KEY）注入
    config.context.secrets —— 沙箱 bash 子进程经 SkillActivationMiddleware
    授权的唯一通道（env_policy 会 scrub *TOKEN*/*KEY* 变量）。"""
    from scripts.run_gateway import _inject_data_secrets

    monkeypatch.setenv("TUSHARE_TOKEN", "tok-abc")
    monkeypatch.setenv("IWENCAI_API_KEY", "key-xyz")

    config: dict = {}
    _inject_data_secrets(config)

    assert config["context"]["secrets"] == {
        "TUSHARE_TOKEN": "tok-abc",
        "IWENCAI_API_KEY": "key-xyz",
    }


def test_inject_data_secrets_preserves_existing_config_and_client_wins(monkeypatch):
    """已有 config（configurable / context 其他键）不被破坏；客户端显式提供的
    同名 secrets 优先于服务端兜底值。"""
    from scripts.run_gateway import _inject_data_secrets

    monkeypatch.setenv("TUSHARE_TOKEN", "env-token")
    monkeypatch.setenv("IWENCAI_API_KEY", "env-key")

    config = {
        "recursion_limit": 1000,
        "configurable": {"thread_id": "t1"},
        "context": {"secrets": {"TUSHARE_TOKEN": "client-token"}},
    }
    _inject_data_secrets(config)

    assert config["recursion_limit"] == 1000
    assert config["configurable"] == {"thread_id": "t1"}
    assert config["context"]["secrets"] == {
        "TUSHARE_TOKEN": "client-token",  # 客户端显式值优先
        "IWENCAI_API_KEY": "env-key",  # 服务端兜底补缺
    }


def test_inject_data_secrets_noop_when_env_missing(monkeypatch):
    """环境无白名单密钥时不注入（也不创建 context 键）。"""
    from scripts.run_gateway import _inject_data_secrets

    monkeypatch.delenv("TUSHARE_TOKEN", raising=False)
    monkeypatch.delenv("IWENCAI_API_KEY", raising=False)

    config: dict = {}
    _inject_data_secrets(config)
    assert config == {}


def test_install_secrets_injection_patches_build_run_config(monkeypatch):
    """_install_secrets_injection 后，services.build_run_config 返回的
    RunnableConfig 携带 context.secrets（引擎注入通道的入口）。"""
    import app.gateway.services as gateway_services
    from scripts.run_gateway import _install_secrets_injection

    monkeypatch.setenv("TUSHARE_TOKEN", "tok-abc")

    _install_secrets_injection()
    config = gateway_services.build_run_config(
        "thread-1", {"recursion_limit": 500}, None
    )

    assert config["context"]["secrets"]["TUSHARE_TOKEN"] == "tok-abc"
    # 原有透传不受影响
    assert config["recursion_limit"] == 500
    assert config["configurable"]["thread_id"] == "thread-1"


# ── Tauri 桌面端 origin（CORS / CSRF）────────────────────────────


def test_patch_cors_allow_tauri_origin_keeps_tauri_scheme(monkeypatch):
    """引擎归一化只接受 http/https scheme，会丢弃 macOS/Linux 打包态 webview 的
    ``tauri://localhost`` origin（CORS preflight 400 / CSRF 403 → 前端报
    「无法连接本地引擎」）。包装层补丁必须让 tauri:// origin 进入白名单。"""
    monkeypatch.setenv(
        "GATEWAY_CORS_ORIGINS",
        "http://localhost:1420,tauri://localhost,https://tauri.localhost",
    )

    from scripts.run_gateway import _patch_cors_allow_tauri_origin

    # 补丁前：tauri://localhost 被引擎过滤
    from app.gateway import csrf_middleware

    assert "tauri://localhost" not in csrf_middleware._configured_cors_origins()

    # 补丁后：tauri://localhost 保留，其余 http/https origin 行为不变
    _patch_cors_allow_tauri_origin()
    origins = csrf_middleware._configured_cors_origins()
    assert "tauri://localhost" in origins
    assert "http://localhost:1420" in origins
    assert "https://tauri.localhost" in origins


def test_patch_csrf_exempts_whitelisted_tauri_origin(monkeypatch):
    """打包态 tauri://localhost 文档下 document.cookie 为空，前端构造不了
    X-CSRF-Token header；白名单内 tauri:// origin 的写请求应免 double-submit
    直接放行（origin 白名单校验即 CSRF 防护）。"""
    monkeypatch.setenv("GATEWAY_CORS_ORIGINS", "tauri://localhost,http://localhost:1420")

    from scripts.run_gateway import (
        _patch_cors_allow_tauri_origin,
        _patch_csrf_double_submit_for_tauri_origin,
    )

    _patch_cors_allow_tauri_origin()
    _patch_csrf_double_submit_for_tauri_origin()

    from fastapi import Request
    from starlette.responses import JSONResponse

    from app.gateway.csrf_middleware import CSRFMiddleware

    middleware = CSRFMiddleware(lambda scope, receive, send: None)

    async def _call_next(request):
        return JSONResponse(status_code=200, content={"ok": True})

    async def _dispatch(scope: dict):
        return await CSRFMiddleware.dispatch(middleware, Request(scope), _call_next)

    import asyncio

    # 白名单 tauri://localhost + 无 X-CSRF-Token header → 放行（不再 403）
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/threads",
        "headers": [(b"origin", b"tauri://localhost"), (b"host", b"localhost:18001")],
    }
    resp = asyncio.run(_dispatch(scope))
    assert resp.status_code == 200, "白名单 tauri:// origin 应免 double-submit 放行"

    # 非白名单 tauri 前缀 origin → 403 拒绝（安全边界不放松）
    scope["headers"][0] = (b"origin", b"tauri://evil.example")
    resp = asyncio.run(_dispatch(scope))
    assert resp.status_code == 403

    # 非 tauri origin（如 dev 1420）无 header → 仍走原 double-submit → 403
    scope["headers"][0] = (b"origin", b"http://localhost:1420")
    resp = asyncio.run(_dispatch(scope))
    assert resp.status_code == 403


def test_patch_cors_allows_tauri_origin_in_auth_origin_check(monkeypatch):
    """CSRF 的 ``is_allowed_auth_origin`` 对 ``tauri://localhost`` Origin 的
    登录请求必须放行（否则登录 POST 返回 403 Cross-site auth request denied）。"""
    monkeypatch.setenv(
        "GATEWAY_CORS_ORIGINS",
        "http://localhost:1420,tauri://localhost",
    )

    from scripts.run_gateway import _patch_cors_allow_tauri_origin
    from app.gateway.csrf_middleware import is_allowed_auth_origin

    _patch_cors_allow_tauri_origin()

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/login/local",
        "headers": [
            (b"origin", b"tauri://localhost"),
            (b"host", b"localhost:18001"),
            (b"content-type", b"application/json"),
        ],
    }
    from fastapi import Request

    assert is_allowed_auth_origin(Request(scope))

    # 非白名单恶意 Origin 仍被拒绝（回归：不得放宽安全边界）
    scope["headers"][0] = (b"origin", b"https://evil.example")
    assert not is_allowed_auth_origin(Request(scope))


# ── Lead Agent 运行守则（SOUL.md）初始化 ─────────────────────────────


def test_ensure_default_soul_creates_from_template(tmp_path):
    """首次启动把 config/lead_soul.md 模板写入 QILIN_HOME/SOUL.md。"""
    from scripts.run_gateway import REPO_ROOT, _ensure_default_soul

    qilin_home = tmp_path / "runtime" / "qilin"
    _ensure_default_soul(qilin_home)

    soul_path = qilin_home / "SOUL.md"
    assert soul_path.exists()
    assert soul_path.read_text(encoding="utf-8") == (
        REPO_ROOT / "config" / "lead_soul.md"
    ).read_text(encoding="utf-8")


def test_ensure_default_soul_preserves_user_content(tmp_path):
    """已存在的 SOUL.md 视为用户内容，绝不覆盖。"""
    from scripts.run_gateway import _ensure_default_soul

    qilin_home = tmp_path / "runtime" / "qilin"
    qilin_home.mkdir(parents=True, exist_ok=True)
    soul_path = qilin_home / "SOUL.md"
    soul_path.write_text("# 用户自定义守则\n", encoding="utf-8")

    _ensure_default_soul(qilin_home)

    assert soul_path.read_text(encoding="utf-8") == "# 用户自定义守则\n"


# ── 用户数据根目录：~/.kstock 默认与历史 v1 目录迁移 ────────────────


def _legacy_root_for(home: Path, monkeypatch) -> Path:
    """按平台构造历史 v1 数据根（与 run_gateway._legacy_app_data_roots 一致）。

    macOS: ~/Library/Application Support/KStock
    Windows: %APPDATA%\\KStock
    Linux: $XDG_DATA_HOME/KStock（默认 ~/.local/share/KStock）
    """
    import sys

    if sys.platform == "darwin":
        return home / "Library" / "Application Support" / "KStock"
    if sys.platform == "win32":
        appdata = home / "AppData" / "Roaming"
        monkeypatch.setenv("APPDATA", str(appdata))
        return appdata / "KStock"
    xdg = home / ".local" / "share"
    monkeypatch.setenv("XDG_DATA_HOME", str(xdg))
    return xdg / "KStock"


def test_resolve_app_data_root_defaults_to_kstock_home(monkeypatch):
    """无 KSTOCK_APP_DATA_DIR 时默认 ~/.kstock（不再用 Application Support）。"""
    monkeypatch.delenv("KSTOCK_APP_DATA_DIR", raising=False)

    from scripts.run_gateway import _resolve_app_data_root

    assert _resolve_app_data_root() == Path.home() / ".kstock"


def test_resolve_app_data_root_respects_env(monkeypatch, tmp_path):
    """KSTOCK_APP_DATA_DIR 显式指定时优先（Tauri 宿主 / 调试）。"""
    target = tmp_path / "custom-root"
    monkeypatch.setenv("KSTOCK_APP_DATA_DIR", str(target))

    from scripts.run_gateway import _resolve_app_data_root

    assert _resolve_app_data_root() == target.expanduser()


def test_migrate_legacy_data_root_moves_content(monkeypatch, tmp_path):
    """旧 Application Support 目录存在且新根不存在 → 整体迁移 + sqlite_dir 重写。"""
    import yaml

    from scripts.run_gateway import _migrate_legacy_data_root

    home = tmp_path / "home"
    monkeypatch.setenv("HOME", str(home))
    legacy = _legacy_root_for(home, monkeypatch)
    (legacy / "config").mkdir(parents=True)
    (legacy / "runtime" / "qilin" / "data").mkdir(parents=True)
    # 模拟旧 runtime.yaml：sqlite_dir 指向旧根（含空格路径）
    (legacy / "config" / "qilin.runtime.yaml").write_text(
        yaml.safe_dump(
            {
                "models": [{"name": "keep-me"}],
                "database": {
                    "backend": "sqlite",
                    "sqlite_dir": str(legacy / "runtime" / "qilin" / "data"),
                },
            },
            allow_unicode=True,
        ),
        encoding="utf-8",
    )
    (legacy / "runtime" / "qilin" / "data" / "qilin.db").write_bytes(b"db-content")

    target = home / ".kstock"
    result = _migrate_legacy_data_root(target)

    assert result == target
    assert not legacy.exists(), "旧目录应被整体移走"
    assert (target / "runtime" / "qilin" / "data" / "qilin.db").exists()
    # sqlite_dir 重写为新根，其余内容保留
    cfg = yaml.safe_load(
        (target / "config" / "qilin.runtime.yaml").read_text(encoding="utf-8")
    )
    assert cfg["database"]["sqlite_dir"] == str(target / "runtime" / "qilin" / "data")
    assert cfg["models"][0]["name"] == "keep-me"


def test_migrate_legacy_skips_when_target_exists(monkeypatch, tmp_path):
    """目标 ~/.kstock 已存在 → 不迁移旧目录（避免覆盖新数据）。"""
    from scripts.run_gateway import _migrate_legacy_data_root

    home = tmp_path / "home"
    monkeypatch.setenv("HOME", str(home))
    legacy = _legacy_root_for(home, monkeypatch)
    (legacy / "config").mkdir(parents=True)
    (legacy / "runtime").mkdir(parents=True)

    target = home / ".kstock"
    target.mkdir(parents=True)
    (target / "marker.txt").write_text("new-data", encoding="utf-8")

    result = _migrate_legacy_data_root(target)

    assert result == target
    assert legacy.exists(), "目标已存在时不得迁移旧目录"
    assert (target / "marker.txt").read_text(encoding="utf-8") == "new-data"


def test_migrate_legacy_skips_empty_legacy_dir(monkeypatch, tmp_path):
    """旧目录无 config/runtime（调试残留）→ 不迁移。"""
    from scripts.run_gateway import _migrate_legacy_data_root

    home = tmp_path / "home"
    monkeypatch.setenv("HOME", str(home))
    legacy = _legacy_root_for(home, monkeypatch)
    legacy.mkdir(parents=True)

    target = home / ".kstock"
    result = _migrate_legacy_data_root(target)

    assert result == target
    assert not target.exists(), "无有效内容时不应创建新根"
    assert legacy.exists()


def test_rewrite_runtime_sqlite_dir_only_touches_legacy_path(monkeypatch, tmp_path):
    """sqlite_dir 未指向旧根时（如用户自定义目录）不重写。"""
    import yaml

    from scripts.run_gateway import _rewrite_runtime_sqlite_dir

    data_root = tmp_path / ".kstock"
    config_dir = data_root / "config"
    config_dir.mkdir(parents=True)
    custom_dir = tmp_path / "custom-db"
    (config_dir / "qilin.runtime.yaml").write_text(
        yaml.safe_dump(
            {"database": {"backend": "sqlite", "sqlite_dir": str(custom_dir)}},
            allow_unicode=True,
        ),
        encoding="utf-8",
    )

    _rewrite_runtime_sqlite_dir(data_root, tmp_path / "Library" / "Application Support" / "KStock")

    cfg = yaml.safe_load((config_dir / "qilin.runtime.yaml").read_text(encoding="utf-8"))
    assert cfg["database"]["sqlite_dir"] == str(custom_dir)
