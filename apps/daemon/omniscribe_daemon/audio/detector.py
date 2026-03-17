"""Meeting auto-detection: monitors running processes for known meeting apps."""

import logging
import subprocess

logger = logging.getLogger(__name__)

# Process names that indicate a meeting is active
MEETING_PROCESSES = {
    "zoom.exe": "zoom",
    "ms-teams.exe": "teams",
    "teams.exe": "teams",
    "slack.exe": "slack",
    "discord.exe": "discord",
}

# Chrome tab patterns that indicate a meeting (checked via window title)
MEETING_URL_PATTERNS = [
    "meet.google.com",
    "zoom.us/j/",
    "teams.microsoft.com",
]


def get_running_meeting_apps() -> list[str]:
    """Check which meeting applications are currently running."""
    try:
        result = subprocess.run(
            ["tasklist", "/FO", "CSV", "/NH"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        running = set()
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.strip('"').split('","')
            if parts:
                process_name = parts[0].lower()
                if process_name in MEETING_PROCESSES:
                    running.add(MEETING_PROCESSES[process_name])
        return list(running)
    except Exception as e:
        logger.warning("Failed to check running processes: %s", e)
        return []


def detect_active_meeting() -> str | None:
    """Detect if a meeting app is currently active. Returns platform name or None."""
    apps = get_running_meeting_apps()
    if apps:
        return apps[0]
    return None
