from __future__ import annotations

import json
from pathlib import Path

import yaml

from kstock_sidecar.data_space import DataSpaceInfo, KStockDataSpace


def test_data_space_creates_expected_directories(tmp_path: Path) -> None:
    data_space = KStockDataSpace(app_data_dir=tmp_path)

    info = data_space.ensure()

    assert isinstance(info, DataSpaceInfo)
    assert info.app_data_dir == tmp_path.resolve()
    assert info.qilin_home == tmp_path.resolve() / "runtime/qilin"
    assert info.qilin_data_dir == tmp_path.resolve() / "runtime/qilin/data"
    assert info.product_db_path == tmp_path.resolve() / "product/kstock.db"
    assert info.runtime_config_path == tmp_path.resolve() / "config/qilin.runtime.yaml"
    assert info.skill_root.is_absolute()
    assert info.is_development_fallback is False

    assert (tmp_path / "config").is_dir()
    assert (tmp_path / "runtime/qilin/data").is_dir()
    assert (tmp_path / "runtime/qilin/users" / info.active_user_id).is_dir()
    assert (tmp_path / "product").is_dir()
    assert (tmp_path / "product/exports").is_dir()
    assert (tmp_path / "product/report-index").is_dir()
    assert (tmp_path / "cache").is_dir()
    assert (tmp_path / "cache/market-data").is_dir()
    assert (tmp_path / "cache/skill-scan").is_dir()
    assert (tmp_path / "cache/thumbnails").is_dir()
    assert (tmp_path / "logs").is_dir()
    assert (tmp_path / "backups").is_dir()


def test_data_space_writes_stable_local_user(tmp_path: Path) -> None:
    data_space = KStockDataSpace(app_data_dir=tmp_path)

    first = data_space.ensure()
    second = data_space.ensure()

    settings_path = tmp_path / "config/kstock.settings.json"
    settings = json.loads(settings_path.read_text(encoding="utf-8"))

    assert first.active_user_id == second.active_user_id
    assert first.active_user_id.startswith("local-")
    assert settings_path.is_file()
    assert settings["activeUserId"] == first.active_user_id


def test_data_space_writes_qilin_runtime_config(tmp_path: Path) -> None:
    skill_root = tmp_path / "skills"
    data_space = KStockDataSpace(app_data_dir=tmp_path, skill_root=skill_root)

    info = data_space.ensure()

    config = yaml.safe_load(info.runtime_config_path.read_text(encoding="utf-8"))

    assert config["database"]["backend"] == "sqlite"
    assert Path(config["database"]["sqlite_dir"]).is_absolute()
    assert Path(config["database"]["sqlite_dir"]) == info.qilin_data_dir
    assert config["run_events"]["backend"] == "db"
    assert Path(config["skills"]["root"]) == info.skill_root
    assert config["sandbox"]["use"] == "qilin.sandbox.local:LocalSandboxProvider"
    assert config["sandbox"]["allow_host_bash"] is False
    assert config["memory"]["enabled"] is False


def test_data_space_as_dict_uses_protocol_field_names(tmp_path: Path) -> None:
    data_space = KStockDataSpace(app_data_dir=tmp_path)
    info = data_space.ensure()

    payload = data_space.as_dict(info)

    assert payload == {
        "appDataDir": str(info.app_data_dir),
        "activeUserId": info.active_user_id,
        "qilinHome": str(info.qilin_home),
        "qilinDataDir": str(info.qilin_data_dir),
        "runtimeConfigPath": str(info.runtime_config_path),
        "productDbPath": str(info.product_db_path),
        "skillRoot": str(info.skill_root),
        "developmentFallback": False,
    }


def test_migration_copies_dev_qilin_only_when_target_empty(tmp_path: Path):
    repo_root = tmp_path / "repo"
    dev_qilin = repo_root / ".kstock/qilin"
    dev_qilin.mkdir(parents=True)
    (dev_qilin / "memory.json").write_text("{}", encoding="utf-8")
    app_data = tmp_path / "app-data"

    data_space = KStockDataSpace(app_data_dir=app_data, repo_root=repo_root)
    data_space.migrate_development_qilin_if_empty()

    assert (app_data / "runtime/qilin/memory.json").is_file()
    assert (app_data / "config/migration-state.json").is_file()


def test_migration_does_not_overwrite_existing_runtime(tmp_path: Path):
    repo_root = tmp_path / "repo"
    dev_qilin = repo_root / ".kstock/qilin"
    dev_qilin.mkdir(parents=True)
    (dev_qilin / "memory.json").write_text('{"old": true}', encoding="utf-8")
    app_data = tmp_path / "app-data"
    existing = app_data / "runtime/qilin"
    existing.mkdir(parents=True)
    (existing / "memory.json").write_text('{"new": true}', encoding="utf-8")

    data_space = KStockDataSpace(app_data_dir=app_data, repo_root=repo_root)
    data_space.migrate_development_qilin_if_empty()

    assert (existing / "memory.json").read_text(encoding="utf-8") == '{"new": true}'
