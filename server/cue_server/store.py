from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
UPLOAD_DIR = ROOT / "uploads"
DB_PATH = DATA_DIR / "cue.db"
_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _lock:
        conn = _connect()
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS takes (
              id TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,
              file_name TEXT NOT NULL,
              scene_id TEXT NOT NULL,
              status TEXT NOT NULL,
              progress REAL NOT NULL DEFAULT 0,
              stage TEXT NOT NULL DEFAULT '',
              error TEXT,
              report_json TEXT
            )
            """
        )
        conn.commit()
        conn.close()


def create_take(file_name: str, scene_id: str) -> str:
    take_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    with _lock:
        conn = _connect()
        conn.execute(
            """
            INSERT INTO takes (id, created_at, file_name, scene_id, status, progress, stage)
            VALUES (?, ?, ?, ?, 'queued', 0, 'Queued')
            """,
            (take_id, now, file_name, scene_id),
        )
        conn.commit()
        conn.close()
    return take_id


def update_take(
    take_id: str,
    *,
    status: str | None = None,
    progress: float | None = None,
    stage: str | None = None,
    error: str | None = None,
    report: dict[str, Any] | None = None,
) -> None:
    fields: list[str] = []
    values: list[Any] = []
    if status is not None:
        fields.append("status = ?")
        values.append(status)
    if progress is not None:
        fields.append("progress = ?")
        values.append(progress)
    if stage is not None:
        fields.append("stage = ?")
        values.append(stage)
    if error is not None:
        fields.append("error = ?")
        values.append(error)
    if report is not None:
        fields.append("report_json = ?")
        values.append(json.dumps(report))
    if not fields:
        return
    values.append(take_id)
    with _lock:
        conn = _connect()
        conn.execute(f"UPDATE takes SET {', '.join(fields)} WHERE id = ?", values)
        conn.commit()
        conn.close()


def get_take(take_id: str) -> dict[str, Any] | None:
    with _lock:
        conn = _connect()
        row = conn.execute("SELECT * FROM takes WHERE id = ?", (take_id,)).fetchone()
        conn.close()
    return _row_to_take(row) if row else None


def list_takes(limit: int = 50) -> list[dict[str, Any]]:
    with _lock:
        conn = _connect()
        rows = conn.execute(
            "SELECT * FROM takes ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        conn.close()
    return [_row_to_take(row) for row in rows]


def _row_to_take(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "createdAt": row["created_at"],
        "fileName": row["file_name"],
        "sceneId": row["scene_id"],
        "status": row["status"],
        "progress": row["progress"],
        "stage": row["stage"],
        "error": row["error"],
        "report": json.loads(row["report_json"]) if row["report_json"] else None,
    }
