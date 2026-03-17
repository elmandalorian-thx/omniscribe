"""FastAPI server for tray app communication (localhost only)."""

import logging

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from omniscribe_daemon.session.manager import SessionManager
from omniscribe_daemon.storage.sqlite_store import SQLiteStore

logger = logging.getLogger(__name__)


class StartSessionRequest(BaseModel):
    session_type: str = "meeting"  # "meeting" or "note"
    title: str | None = None
    platform: str | None = None


class SessionResponse(BaseModel):
    id: str
    session_type: str
    title: str | None
    status: str
    started_at: str
    ended_at: str | None = None
    duration_secs: int | None = None
    word_count: int = 0


def create_app(store: SQLiteStore, monitor=None) -> FastAPI:
    app = FastAPI(title="OmniScribe Daemon", version="0.1.0")
    manager = SessionManager(store)

    @app.get("/health")
    def health():
        return {
            "status": "ok",
            "recording": manager.is_recording,
            "auto_detect": monitor.is_enabled if monitor else False,
        }

    @app.post("/sessions/start")
    def start_session(req: StartSessionRequest):
        if req.session_type not in ("meeting", "note"):
            raise HTTPException(400, "session_type must be 'meeting' or 'note'")
        try:
            session = manager.start_session(
                session_type=req.session_type,
                title=req.title,
                platform=req.platform,
            )
            return session
        except RuntimeError as e:
            raise HTTPException(409, str(e))

    @app.post("/sessions/stop")
    def stop_session():
        session = manager.stop_session()
        if session is None:
            raise HTTPException(404, "No active session")
        # Set cooldown on auto-detect so it doesn't immediately re-trigger
        if monitor:
            monitor.set_cooldown(30.0)
        return session

    @app.get("/sessions/current")
    def current_session():
        session = manager.current_session
        if session is None:
            return {"recording": False}
        return {"recording": True, "session": session}

    @app.get("/sessions")
    def list_sessions(
        session_type: str | None = None,
        limit: int = 20,
        offset: int = 0,
    ):
        sessions = store.list_sessions(session_type=session_type, limit=limit, offset=offset)
        return {"sessions": sessions, "count": len(sessions)}

    @app.get("/sessions/{session_id}")
    def get_session(session_id: str):
        session = store.get_session(session_id)
        if not session:
            raise HTTPException(404, "Session not found")
        return session

    @app.get("/sessions/{session_id}/transcript")
    def get_transcript(session_id: str):
        session = store.get_session(session_id)
        if not session:
            raise HTTPException(404, "Session not found")
        segments = store.get_transcript(session_id)
        return {"session_id": session_id, "segments": segments}

    # Auto-detection endpoints
    @app.get("/auto-detect/status")
    def auto_detect_status():
        if not monitor:
            return {"available": False, "enabled": False}
        return {"available": True, "enabled": monitor.is_enabled}

    @app.post("/auto-detect/toggle")
    def auto_detect_toggle():
        if not monitor:
            raise HTTPException(404, "Auto-detection not configured")
        new_state = monitor.toggle()
        return {"enabled": new_state}

    return app
