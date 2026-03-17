"""Session lifecycle manager: orchestrates capture -> transcribe -> store."""

import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

from omniscribe_daemon.audio.capture import get_capture_backend, AudioCaptureBackend
from omniscribe_daemon.config import settings
from omniscribe_daemon.storage.sqlite_store import SQLiteStore

logger = logging.getLogger(__name__)


class SessionManager:
    """Manages the lifecycle of recording sessions (meetings and notes)."""

    def __init__(self, store: SQLiteStore):
        self.store = store
        self._current_session: dict | None = None
        self._capture: AudioCaptureBackend | None = None
        self._transcription_thread: threading.Thread | None = None

    @property
    def is_recording(self) -> bool:
        return self._capture is not None and self._capture.is_recording

    @property
    def current_session(self) -> dict | None:
        if self._current_session:
            return self.store.get_session(self._current_session["id"])
        return None

    def start_session(
        self,
        session_type: str = "meeting",
        title: str | None = None,
        platform: str | None = None,
    ) -> dict:
        """Start a new recording session.

        Args:
            session_type: 'meeting' (WASAPI loopback) or 'note' (microphone)
            title: Optional session title
            platform: Meeting platform (for meetings only)

        Returns:
            Session dict from SQLite.
        """
        if self.is_recording:
            raise RuntimeError("A session is already recording. Stop it first.")

        # Create session record
        session = self.store.create_session(
            device_id=settings.device_id or "unknown",
            session_type=session_type,
            title=title,
            platform=platform,
        )
        self._current_session = session

        # Set up audio output directory
        session_audio_dir = settings.audio_dir / session["id"]
        session_audio_dir.mkdir(parents=True, exist_ok=True)

        # Start capture (loopback for meetings, mic for notes)
        self._capture = get_capture_backend(session_type, session_audio_dir)
        self._capture.start()

        # Update session with audio path
        self.store.update_session(session["id"], audio_path=str(session_audio_dir))

        logger.info(
            "Session started: id=%s type=%s title=%s",
            session["id"],
            session_type,
            title,
        )
        return session

    def stop_session(self) -> dict | None:
        """Stop the current recording session and trigger transcription."""
        if not self.is_recording or not self._current_session:
            logger.warning("No active session to stop")
            return None

        session_id = self._current_session["id"]

        # Stop audio capture
        chunk_paths = self._capture.stop()
        self._capture = None

        # Update session timing
        now = datetime.now(timezone.utc).isoformat()
        session = self.store.get_session(session_id)
        if session:
            started = datetime.fromisoformat(session["started_at"])
            ended = datetime.fromisoformat(now)
            duration = int((ended - started).total_seconds())
            self.store.update_session(
                session_id,
                ended_at=now,
                duration_secs=duration,
                status="transcribing",
            )

        # Start transcription in background
        self._transcription_thread = threading.Thread(
            target=self._transcribe_session,
            args=(session_id, chunk_paths),
            daemon=True,
        )
        self._transcription_thread.start()

        logger.info("Session stopped: id=%s, %d chunks to transcribe", session_id, len(chunk_paths))
        result = self.store.get_session(session_id)
        self._current_session = None
        return result

    def _transcribe_session(self, session_id: str, chunk_paths: list[Path]) -> None:
        """Transcribe all audio chunks for a session (runs in background thread)."""
        try:
            from omniscribe_daemon.transcription.engine import transcribe_audio

            segment_index = 0
            total_words = 0
            time_offset = 0.0
            model_used = None

            for chunk_path in chunk_paths:
                try:
                    result = transcribe_audio(chunk_path)
                    model_used = result.model_used

                    for seg in result.segments:
                        self.store.add_segment(
                            session_id=session_id,
                            segment_index=segment_index,
                            text=seg["text"],
                            start_time=time_offset + seg["start"],
                            end_time=time_offset + seg["end"],
                            confidence=seg.get("confidence"),
                        )
                        total_words += len(seg["text"].split())
                        segment_index += 1

                    # Offset for next chunk
                    time_offset += settings.audio_chunk_duration_secs

                except Exception as e:
                    logger.error("Failed to transcribe chunk %s: %s", chunk_path, e)

            # Auto-title for notes: use first ~10 words
            session = self.store.get_session(session_id)
            if session and session["session_type"] == "note" and not session["title"]:
                segments = self.store.get_transcript(session_id)
                if segments:
                    words = segments[0]["text"].split()[:10]
                    auto_title = " ".join(words)
                    if len(segments[0]["text"].split()) > 10:
                        auto_title += "..."
                    self.store.update_session(session_id, title=auto_title)

            # Mark session complete
            self.store.update_session(
                session_id,
                status="completed",
                model_used=model_used,
                word_count=total_words,
            )
            logger.info(
                "Transcription complete: session=%s, %d segments, %d words",
                session_id,
                segment_index,
                total_words,
            )

        except Exception as e:
            logger.error("Transcription failed for session %s: %s", session_id, e)
            self.store.update_session(session_id, status="failed")
