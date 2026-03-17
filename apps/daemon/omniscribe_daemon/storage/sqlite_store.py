"""Local SQLite storage for sessions and transcript segments."""

import json
import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)


class SQLiteStore:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._conn: sqlite3.Connection | None = None

    @property
    def conn(self) -> sqlite3.Connection:
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
        return self._conn

    def initialize(self) -> None:
        """Create tables if they don't exist."""
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                device_id TEXT NOT NULL,
                session_type TEXT NOT NULL CHECK (session_type IN ('meeting', 'note')),
                title TEXT,
                status TEXT NOT NULL DEFAULT 'recording',
                platform TEXT,
                meeting_url TEXT,
                participants TEXT DEFAULT '[]',
                tags TEXT DEFAULT '[]',
                started_at TEXT NOT NULL,
                ended_at TEXT,
                duration_secs INTEGER,
                audio_path TEXT,
                model_used TEXT,
                language TEXT DEFAULT 'en',
                word_count INTEGER DEFAULT 0,
                synced_at TEXT,
                local_only INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS transcript_segments (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
                segment_index INTEGER NOT NULL,
                speaker_id TEXT,
                speaker_name TEXT,
                text TEXT NOT NULL,
                start_time REAL NOT NULL,
                end_time REAL NOT NULL,
                confidence REAL,
                is_final INTEGER DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_segments_session
                ON transcript_segments(session_id, segment_index);

            CREATE TABLE IF NOT EXISTS sync_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                action TEXT NOT NULL DEFAULT 'upsert',
                created_at TEXT NOT NULL,
                synced_at TEXT
            );
        """)
        logger.info("SQLite tables initialized")

    def create_session(
        self,
        device_id: str,
        session_type: str,
        title: str | None = None,
        platform: str | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        session_id = str(uuid.uuid4())
        self.conn.execute(
            """INSERT INTO sessions
               (id, device_id, session_type, title, status, platform,
                started_at, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'recording', ?, ?, ?, ?)""",
            (session_id, device_id, session_type, title, platform, now, now, now),
        )
        self._enqueue_sync("sessions", session_id)
        self.conn.commit()
        return self.get_session(session_id)

    def get_session(self, session_id: str) -> dict | None:
        row = self.conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
        return dict(row) if row else None

    def list_sessions(
        self,
        session_type: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[dict]:
        query = "SELECT * FROM sessions"
        params: list = []
        if session_type:
            query += " WHERE session_type = ?"
            params.append(session_type)
        query += " ORDER BY started_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = self.conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def update_session(self, session_id: str, **kwargs) -> dict | None:
        if not kwargs:
            return self.get_session(session_id)
        now = datetime.now(timezone.utc).isoformat()
        kwargs["updated_at"] = now
        set_clause = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [session_id]
        self.conn.execute(
            f"UPDATE sessions SET {set_clause} WHERE id = ?", values
        )
        self._enqueue_sync("sessions", session_id)
        self.conn.commit()
        return self.get_session(session_id)

    def add_segment(
        self,
        session_id: str,
        segment_index: int,
        text: str,
        start_time: float,
        end_time: float,
        speaker_id: str | None = None,
        speaker_name: str | None = None,
        confidence: float | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        segment_id = str(uuid.uuid4())
        self.conn.execute(
            """INSERT INTO transcript_segments
               (id, session_id, segment_index, speaker_id, speaker_name,
                text, start_time, end_time, confidence, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (segment_id, session_id, segment_index, speaker_id, speaker_name,
             text, start_time, end_time, confidence, now),
        )
        self._enqueue_sync("transcript_segments", segment_id)
        self.conn.commit()
        return {
            "id": segment_id,
            "session_id": session_id,
            "segment_index": segment_index,
            "text": text,
            "start_time": start_time,
            "end_time": end_time,
        }

    def get_transcript(self, session_id: str) -> list[dict]:
        rows = self.conn.execute(
            """SELECT * FROM transcript_segments
               WHERE session_id = ? ORDER BY segment_index""",
            (session_id,),
        ).fetchall()
        return [dict(r) for r in rows]

    def get_unsynced_records(self, limit: int = 50) -> list[dict]:
        rows = self.conn.execute(
            """SELECT * FROM sync_queue WHERE synced_at IS NULL
               ORDER BY created_at LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]

    def mark_synced(self, queue_id: int) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self.conn.execute(
            "UPDATE sync_queue SET synced_at = ? WHERE id = ?", (now, queue_id)
        )
        self.conn.commit()

    def _enqueue_sync(self, table_name: str, record_id: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self.conn.execute(
            """INSERT INTO sync_queue (table_name, record_id, created_at)
               VALUES (?, ?, ?)""",
            (table_name, record_id, now),
        )
