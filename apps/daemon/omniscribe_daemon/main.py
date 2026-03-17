"""OmniScribe daemon entry point."""

import argparse
import asyncio
import logging
import platform
import uuid

import uvicorn

from omniscribe_daemon.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("omniscribe")


def ensure_device_id() -> str:
    """Generate or load a persistent device ID."""
    id_file = settings.data_dir / "device_id"
    if id_file.exists():
        return id_file.read_text().strip()
    device_id = f"{platform.node()}-{uuid.uuid4().hex[:8]}"
    settings.ensure_dirs()
    id_file.write_text(device_id)
    return device_id


def main() -> None:
    parser = argparse.ArgumentParser(description="OmniScribe daemon")
    parser.add_argument("--host", default=settings.api_host)
    parser.add_argument("--port", type=int, default=settings.api_port)
    args = parser.parse_args()

    settings.ensure_dirs()

    if not settings.device_id:
        settings.device_id = ensure_device_id()

    logger.info("OmniScribe daemon starting on %s:%d", args.host, args.port)
    logger.info("Device ID: %s", settings.device_id)
    logger.info("Data directory: %s", settings.data_dir)

    # Initialize SQLite
    from omniscribe_daemon.storage.sqlite_store import SQLiteStore

    store = SQLiteStore(settings.db_path)
    store.initialize()
    logger.info("SQLite database initialized at %s", settings.db_path)

    # Start Supabase sync if configured
    sync = None
    if settings.supabase_url and settings.supabase_service_key:
        from omniscribe_daemon.storage.supabase_sync import SupabaseSync

        sync = SupabaseSync(store)
        sync.start()
        logger.info("Supabase sync enabled → %s", settings.supabase_url)
    else:
        logger.info("Supabase sync disabled (no credentials configured)")

    # Start meeting auto-detection monitor if enabled
    monitor = None
    if settings.auto_detect_enabled:
        from omniscribe_daemon.audio.monitor import MeetingMonitor
        from omniscribe_daemon.session.manager import SessionManager

        manager = SessionManager(store)
        monitor = MeetingMonitor(manager, interval=settings.auto_detect_interval_secs)
        monitor.start()
        logger.info("Auto-detection enabled (interval=%ds)", settings.auto_detect_interval_secs)
    else:
        logger.info("Auto-detection disabled (set OMNISCRIBE_AUTO_DETECT_ENABLED=true to enable)")

    # Start API server (FastAPI + uvicorn)
    from omniscribe_daemon.api.server import create_app

    app = create_app(store, monitor=monitor)
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
