from __future__ import annotations

import sqlite3
import time
import uuid
from pathlib import Path
from typing import Any


class ProductStore:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path

    def _connect(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def ensure_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS projects (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  created_at REAL NOT NULL,
                  updated_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS project_threads (
                  project_id TEXT NOT NULL,
                  thread_id TEXT NOT NULL,
                  title TEXT,
                  created_at REAL NOT NULL,
                  updated_at REAL NOT NULL,
                  PRIMARY KEY (project_id, thread_id)
                );
                CREATE TABLE IF NOT EXISTS report_assets (
                  id TEXT PRIMARY KEY,
                  thread_id TEXT NOT NULL,
                  project_id TEXT,
                  title TEXT,
                  filename TEXT NOT NULL,
                  virtual_path TEXT NOT NULL,
                  host_path TEXT NOT NULL,
                  mime_type TEXT,
                  created_at REAL NOT NULL,
                  last_opened_at REAL
                );
                CREATE TABLE IF NOT EXISTS task_tags (
                  thread_id TEXT NOT NULL,
                  tag TEXT NOT NULL,
                  created_at REAL NOT NULL,
                  PRIMARY KEY (thread_id, tag)
                );
                CREATE TABLE IF NOT EXISTS recent_items (
                  item_type TEXT NOT NULL,
                  item_id TEXT NOT NULL,
                  opened_at REAL NOT NULL,
                  PRIMARY KEY (item_type, item_id)
                );
                CREATE TABLE IF NOT EXISTS ui_state (
                  key TEXT PRIMARY KEY,
                  value_json TEXT NOT NULL,
                  updated_at REAL NOT NULL
                );
                """
            )

    @staticmethod
    def _row(row: sqlite3.Row) -> dict[str, Any]:
        return dict(row)

    def create_project(self, name: str) -> dict[str, Any]:
        now = time.time()
        project_id = f"project_{uuid.uuid4().hex[:12]}"
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (project_id, name, now, now),
            )
        return {"id": project_id, "name": name, "created_at": now, "updated_at": now}

    def list_projects(self) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute("SELECT * FROM projects ORDER BY updated_at DESC").fetchall()
        return [self._row(row) for row in rows]

    def link_thread(self, project_id: str, thread_id: str, *, title: str | None = None) -> None:
        now = time.time()
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO project_threads (project_id, thread_id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(project_id, thread_id) DO UPDATE SET
                  title=excluded.title,
                  updated_at=excluded.updated_at
                """,
                (project_id, thread_id, title, now, now),
            )

    def list_project_threads(self, project_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM project_threads WHERE project_id = ? ORDER BY updated_at DESC",
                (project_id,),
            ).fetchall()
        return [self._row(row) for row in rows]

    def upsert_report_asset(
        self,
        *,
        thread_id: str,
        filename: str,
        virtual_path: str,
        host_path: str,
        mime_type: str | None,
        title: str | None = None,
        project_id: str | None = None,
    ) -> dict[str, Any]:
        now = time.time()
        report_id = f"report_{uuid.uuid4().hex[:12]}"
        with self._connect() as conn:
            existing = conn.execute(
                "SELECT id, created_at, last_opened_at FROM report_assets WHERE thread_id = ? AND virtual_path = ?",
                (thread_id, virtual_path),
            ).fetchone()
            if existing:
                report_id = existing["id"]
                created_at = existing["created_at"]
                last_opened_at = existing["last_opened_at"]
            else:
                created_at = now
                last_opened_at = None
            conn.execute(
                """
                INSERT INTO report_assets (
                  id, thread_id, project_id, title, filename, virtual_path, host_path, mime_type, created_at, last_opened_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  project_id=excluded.project_id,
                  title=excluded.title,
                  filename=excluded.filename,
                  host_path=excluded.host_path,
                  mime_type=excluded.mime_type
                """,
                (report_id, thread_id, project_id, title, filename, virtual_path, host_path, mime_type, created_at, last_opened_at),
            )
        return {
            "id": report_id,
            "thread_id": thread_id,
            "project_id": project_id,
            "title": title,
            "filename": filename,
            "virtual_path": virtual_path,
            "host_path": host_path,
            "mime_type": mime_type,
            "created_at": created_at,
            "last_opened_at": last_opened_at,
        }

    def list_report_assets(self, thread_id: str) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT * FROM report_assets WHERE thread_id = ? ORDER BY created_at DESC",
                (thread_id,),
            ).fetchall()
        return [self._row(row) for row in rows]
