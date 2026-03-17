"""Meeting auto-detection: monitors running processes and Chrome window titles."""

import ctypes
import ctypes.wintypes
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

# Window title patterns that indicate an active meeting in a browser
MEETING_WINDOW_PATTERNS = {
    "meet.google.com": "google_meet",
    "Meet -": "google_meet",
    "Google Meet": "google_meet",
    "Zoom Meeting": "zoom",
    "zoom.us/j/": "zoom",
    "Microsoft Teams": "teams",
}


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


def get_window_titles() -> list[str]:
    """Enumerate all visible window titles using Win32 API."""
    titles = []

    try:
        EnumWindows = ctypes.windll.user32.EnumWindows
        EnumWindowsProc = ctypes.WINFUNCTYPE(
            ctypes.wintypes.BOOL, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM
        )
        GetWindowTextW = ctypes.windll.user32.GetWindowTextW
        GetWindowTextLengthW = ctypes.windll.user32.GetWindowTextLengthW
        IsWindowVisible = ctypes.windll.user32.IsWindowVisible

        def callback(hwnd, lParam):
            if IsWindowVisible(hwnd):
                length = GetWindowTextLengthW(hwnd)
                if length > 0:
                    buf = ctypes.create_unicode_buffer(length + 1)
                    GetWindowTextW(hwnd, buf, length + 1)
                    titles.append(buf.value)
            return True

        EnumWindows(EnumWindowsProc(callback), 0)
    except Exception as e:
        logger.warning("Failed to enumerate windows: %s", e)

    return titles


def detect_meeting_from_windows() -> str | None:
    """Scan window titles for active meeting indicators (Google Meet in Chrome, etc.)."""
    titles = get_window_titles()

    for title in titles:
        for pattern, platform in MEETING_WINDOW_PATTERNS.items():
            if pattern.lower() in title.lower():
                logger.debug("Meeting detected in window: '%s' → %s", title[:80], platform)
                return platform

    return None


def detect_active_meeting() -> str | None:
    """Detect if a meeting is currently active.

    Checks both running processes (Zoom, Teams, etc.) and browser window titles
    (Google Meet). Returns platform name or None.
    """
    # Check browser windows first (Google Meet, web-based Zoom/Teams)
    window_match = detect_meeting_from_windows()
    if window_match:
        return window_match

    # Check running processes
    apps = get_running_meeting_apps()
    if apps:
        return apps[0]

    return None
