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


def test_generate_idempotent_when_exists(tmp_path):
    """已存在时多次调用幂等，文件 mtime 不变（确实没写入）。"""
    from scripts.run_gateway import REPO_ROOT

    runtime_cfg = tmp_path / "config" / "qilin.runtime.yaml"
    runtime_cfg.parent.mkdir(parents=True, exist_ok=True)
    runtime_cfg.write_text("memory:\n  enabled: true\n", encoding="utf-8")
    qilin_data_dir = tmp_path / "data"

    mtime_before = runtime_cfg.stat().st_mtime_ns
    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)
    _generate_runtime_config(runtime_cfg, qilin_data_dir, REPO_ROOT)
    mtime_after = runtime_cfg.stat().st_mtime_ns

    assert mtime_before == mtime_after


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
