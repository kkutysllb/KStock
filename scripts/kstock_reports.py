"""User-scoped persistence for the independent HTML report library."""

from __future__ import annotations

import hashlib
import os
import re
import shutil
import sqlite3
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any


_SAFE_COMPONENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


class ReportLibraryStore:
    """Archive and index self-contained reports outside thread workspaces."""

    def __init__(self, data_root: Path, db_path: Path | None = None):
        self.data_root = Path(data_root).expanduser().resolve()
        self.reports_root = self.data_root / "reports"
        self.db_path = Path(db_path or (self.data_root / "runtime" / "qilin" / "data" / "qilin.db"))
        self.reports_root.mkdir(parents=True, exist_ok=True)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS report_library (
                    report_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    thread_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    symbol TEXT,
                    report_type TEXT NOT NULL,
                    generated_at TEXT NOT NULL,
                    period_start TEXT,
                    period_end TEXT,
                    risk_level TEXT,
                    coverage_status TEXT,
                    relative_path TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    sha256 TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (user_id, report_id)
                )
                """
            )
            connection.execute("CREATE INDEX IF NOT EXISTS idx_report_library_date ON report_library (user_id, generated_at)")

    @staticmethod
    def _component(value: Any, name: str) -> str:
        value = str(value or "")
        if not _SAFE_COMPONENT.fullmatch(value):
            raise ValueError(f"{name} contains unsafe path characters")
        return value

    @staticmethod
    def _generated_date(value: str) -> tuple[str, str, str]:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("generated_at must be an ISO-8601 timestamp") from exc
        return parsed.strftime("%Y"), parsed.strftime("%m"), parsed.strftime("%d")

    def _user_root(self, user_id: str) -> Path:
        return self.reports_root / self._component(user_id, "user_id")

    def _relative_path(self, user_id: str, generated_at: str, report_id: str) -> str:
        year, month, day = self._generated_date(generated_at)
        return str(Path("reports") / user_id / year / month / day / f"{report_id}.html")

    def archive(self, html_path: Path, report_id: str, thread_id: str, metadata: dict[str, Any]) -> dict[str, Any]:
        source = Path(html_path).resolve()
        if not source.is_file() or source.suffix.lower() != ".html":
            raise ValueError("archive source must be an existing .html file")
        report_id = self._component(report_id, "report_id")
        thread_id = self._component(thread_id, "thread_id")
        user_id = self._component(metadata.get("user_id"), "user_id")
        generated_at = str(metadata.get("generated_at") or "")
        year, month, day = self._generated_date(generated_at)
        relative_path = str(Path("reports") / user_id / year / month / day / f"{report_id}.html")
        target = self.data_root / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        old_row = self.get_report(report_id, user_id=user_id)
        old_path = self.data_root / old_row["relative_path"] if old_row else None
        now = datetime.now().astimezone().isoformat()
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        size = source.stat().st_size
        row = {
            "report_id": report_id,
            "user_id": user_id,
            "thread_id": thread_id,
            "title": str(metadata.get("title") or report_id),
            "symbol": metadata.get("symbol"),
            "report_type": str(metadata.get("report_type") or "analysis"),
            "generated_at": generated_at,
            "period_start": metadata.get("period_start"),
            "period_end": metadata.get("period_end"),
            "risk_level": metadata.get("risk_level"),
            "coverage_status": metadata.get("coverage_status"),
            "relative_path": relative_path,
            "size_bytes": size,
            "sha256": digest,
            "created_at": old_row.get("created_at", now) if old_row else now,
            "updated_at": now,
        }

        backup = None
        temporary = None
        try:
            if target.exists():
                fd, backup = tempfile.mkstemp(prefix=f".{report_id}.", suffix=".bak", dir=target.parent)
                os.close(fd)
                shutil.copy2(target, backup)
            fd, temporary = tempfile.mkstemp(prefix=f".{report_id}.", suffix=".tmp", dir=target.parent)
            os.close(fd)
            shutil.copy2(source, temporary)
            os.replace(temporary, target)
            temporary = None
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO report_library
                    (report_id,user_id,thread_id,title,symbol,report_type,generated_at,period_start,period_end,
                     risk_level,coverage_status,relative_path,size_bytes,sha256,created_at,updated_at)
                    VALUES (:report_id,:user_id,:thread_id,:title,:symbol,:report_type,:generated_at,:period_start,:period_end,
                            :risk_level,:coverage_status,:relative_path,:size_bytes,:sha256,:created_at,:updated_at)
                    ON CONFLICT(user_id, report_id) DO UPDATE SET
                      thread_id=excluded.thread_id,title=excluded.title,symbol=excluded.symbol,
                      report_type=excluded.report_type,generated_at=excluded.generated_at,
                      period_start=excluded.period_start,period_end=excluded.period_end,
                      risk_level=excluded.risk_level,coverage_status=excluded.coverage_status,
                      relative_path=excluded.relative_path,size_bytes=excluded.size_bytes,
                      sha256=excluded.sha256,updated_at=excluded.updated_at
                    """,
                    row,
                )
            if old_path and old_path != target and old_path.is_file():
                old_path.unlink()
            return row
        except Exception:
            if temporary:
                Path(temporary).unlink(missing_ok=True)
            if backup:
                os.replace(backup, target)
                backup = None
            elif old_row and old_path and old_path != target and target.exists():
                target.unlink()
            raise
        finally:
            if backup:
                Path(backup).unlink(missing_ok=True)

    def list_reports(self, *, user_id: str, date: str | None = None, symbol: str | None = None, query: str | None = None) -> list[dict[str, Any]]:
        self._component(user_id, "user_id")
        clauses = ["user_id = ?"]
        values: list[Any] = [user_id]
        if date:
            clauses.append("substr(generated_at, 1, 10) = ?")
            values.append(date)
        if symbol:
            clauses.append("symbol = ?")
            values.append(symbol)
        if query:
            clauses.append("(title LIKE ? OR report_type LIKE ? OR symbol LIKE ?)")
            pattern = f"%{query}%"
            values.extend([pattern, pattern, pattern])
        with self._connect() as connection:
            rows = connection.execute(f"SELECT * FROM report_library WHERE {' AND '.join(clauses)} ORDER BY generated_at DESC", values).fetchall()
        return [dict(row) for row in rows]

    def get_report(self, report_id: str, *, user_id: str) -> dict[str, Any] | None:
        report_id = self._component(report_id, "report_id")
        self._component(user_id, "user_id")
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM report_library WHERE user_id = ? AND report_id = ?", (user_id, report_id)).fetchone()
        return dict(row) if row else None

    def open_report_path(self, report_id: str, *, user_id: str) -> Path:
        row = self.get_report(report_id, user_id=user_id)
        if not row:
            raise FileNotFoundError(report_id)
        path = (self.data_root / row["relative_path"]).resolve()
        if self.reports_root not in path.parents or not path.is_file():
            raise FileNotFoundError(report_id)
        return path

    def delete(self, report_id: str, *, user_id: str) -> None:
        row = self.get_report(report_id, user_id=user_id)
        if not row:
            return
        path = (self.data_root / row["relative_path"]).resolve()
        if self.reports_root not in path.parents:
            raise ValueError("report path escapes reports root")
        with self._connect() as connection:
            connection.execute("DELETE FROM report_library WHERE user_id = ? AND report_id = ?", (user_id, report_id))
        path.unlink(missing_ok=True)

