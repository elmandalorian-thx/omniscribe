"""Background sync engine: pushes local SQLite data to Supabase."""

import logging
import threading
import time

from omniscribe_daemon.config import settings
from omniscribe_daemon.storage.sqlite_store import SQLiteStore

logger = logging.getLogger(__name__)


class SupabaseSync:
    """Background thread that syncs local SQLite records to Supabase."""

    def __init__(self, store: SQLiteStore):
        self.store = store
        self._running = False
        self._thread: threading.Thread | None = None
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not settings.supabase_url or not settings.supabase_service_key:
                logger.warning("Supabase not configured — sync disabled")
                return None
            from supabase import create_client

            self._client = create_client(settings.supabase_url, settings.supabase_service_key)
        return self._client

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._sync_loop, daemon=True)
        self._thread.start()
        logger.info("Supabase sync started")

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=10)
        logger.info("Supabase sync stopped")

    def _sync_loop(self) -> None:
        retry_delay = 1.0

        while self._running:
            try:
                synced = self._sync_batch()
                if synced > 0:
                    logger.info("Synced %d records to Supabase", synced)
                    retry_delay = 1.0  # Reset on success
                time.sleep(5.0)  # Poll every 5 seconds
            except Exception as e:
                logger.error("Sync error: %s", e)
                time.sleep(min(retry_delay, 60.0))
                retry_delay *= 2  # Exponential backoff

    def _sync_batch(self) -> int:
        client = self._get_client()
        if client is None:
            return 0

        records = self.store.get_unsynced_records(limit=50)
        synced = 0

        for record in records:
            try:
                if record["table_name"] == "sessions":
                    self._sync_session(client, record["record_id"])
                elif record["table_name"] == "transcript_segments":
                    self._sync_segment(client, record["record_id"])

                self.store.mark_synced(record["id"])
                synced += 1
            except Exception as e:
                logger.error(
                    "Failed to sync %s/%s: %s",
                    record["table_name"],
                    record["record_id"],
                    e,
                )

        return synced

    def _sync_session(self, client, session_id: str) -> None:
        session = self.store.get_session(session_id)
        if not session:
            return

        # Map SQLite row to Supabase schema
        data = {
            "id": session["id"],
            "user_id": session["user_id"],
            "device_id": session["device_id"],
            "session_type": session["session_type"],
            "title": session["title"],
            "status": session["status"],
            "platform": session["platform"],
            "meeting_url": session["meeting_url"],
            "started_at": session["started_at"],
            "ended_at": session["ended_at"],
            "duration_secs": session["duration_secs"],
            "model_used": session["model_used"],
            "language": session["language"],
            "word_count": session["word_count"],
        }
        # Remove None values
        data = {k: v for k, v in data.items() if v is not None}

        client.table("sessions").upsert(data).execute()

    def _sync_segment(self, client, segment_id: str) -> None:
        row = self.store.conn.execute(
            "SELECT * FROM transcript_segments WHERE id = ?", (segment_id,)
        ).fetchone()
        if not row:
            return

        data = dict(row)
        data = {k: v for k, v in data.items() if v is not None}
        client.table("transcript_segments").upsert(data).execute()
