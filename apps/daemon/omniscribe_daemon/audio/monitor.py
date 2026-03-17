"""Meeting auto-detection monitor — background thread that auto-starts/stops recording."""

import logging
import threading
import time

from omniscribe_daemon.audio.detector import detect_active_meeting
from omniscribe_daemon.config import settings
from omniscribe_daemon.session.manager import SessionManager

logger = logging.getLogger(__name__)


class MeetingMonitor:
    """Background thread that monitors for meeting apps and auto-starts recording."""

    def __init__(self, session_manager: SessionManager, interval: int = 5):
        self.session_manager = session_manager
        self.interval = interval
        self._running = False
        self._thread: threading.Thread | None = None
        self._auto_started_session_id: str | None = None
        self._consecutive_detections = 0
        self._consecutive_absences = 0
        self._cooldown_until = 0.0  # timestamp — don't auto-start before this
        self._enabled = True

    @property
    def is_enabled(self) -> bool:
        return self._enabled

    def toggle(self) -> bool:
        """Toggle auto-detection on/off. Returns new state."""
        self._enabled = not self._enabled
        logger.info("Auto-detection %s", "enabled" if self._enabled else "disabled")
        return self._enabled

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()
        logger.info(
            "Meeting monitor started (interval=%ds, apps=%s)",
            self.interval,
            settings.auto_detect_apps,
        )

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=10)
        logger.info("Meeting monitor stopped")

    def set_cooldown(self, seconds: float = 30.0) -> None:
        """Prevent auto-start for N seconds (e.g., after manual stop)."""
        self._cooldown_until = time.time() + seconds

    def _monitor_loop(self) -> None:
        while self._running:
            try:
                if self._enabled:
                    self._check()
            except Exception as e:
                logger.error("Monitor error: %s", e)

            time.sleep(self.interval)

    def _check(self) -> None:
        platform = detect_active_meeting()

        if platform:
            self._consecutive_absences = 0
            self._consecutive_detections += 1

            # Debounce: require 2 consecutive detections before auto-starting
            if (
                self._consecutive_detections >= 2
                and not self.session_manager.is_recording
                and time.time() > self._cooldown_until
            ):
                self._auto_start(platform)
        else:
            self._consecutive_detections = 0
            self._consecutive_absences += 1

            # Auto-stop: require 3 consecutive absences (15s at 5s interval)
            if (
                self._consecutive_absences >= 3
                and self.session_manager.is_recording
                and self._auto_started_session_id is not None
            ):
                self._auto_stop()

    def _auto_start(self, platform: str) -> None:
        try:
            session = self.session_manager.start_session(
                session_type="meeting",
                platform=platform,
                title=f"Auto: {platform.replace('_', ' ').title()}",
            )
            self._auto_started_session_id = session["id"]
            logger.info(
                "Auto-detected %s — recording started (session=%s)",
                platform,
                session["id"],
            )
        except RuntimeError:
            # Already recording (manual session)
            pass
        except Exception as e:
            logger.error("Auto-start failed: %s", e)

    def _auto_stop(self) -> None:
        try:
            session_id = self._auto_started_session_id
            self.session_manager.stop_session()
            self._auto_started_session_id = None
            self._consecutive_absences = 0
            logger.info("Meeting ended — auto-stopped recording (session=%s)", session_id)
        except Exception as e:
            logger.error("Auto-stop failed: %s", e)
