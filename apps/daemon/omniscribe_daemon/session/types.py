"""Session type definitions."""

from enum import StrEnum


class SessionType(StrEnum):
    MEETING = "meeting"
    NOTE = "note"


class SessionStatus(StrEnum):
    RECORDING = "recording"
    TRANSCRIBING = "transcribing"
    COMPLETED = "completed"
    FAILED = "failed"
    ARCHIVED = "archived"


class MeetingPlatform(StrEnum):
    GOOGLE_MEET = "google_meet"
    ZOOM = "zoom"
    TEAMS = "teams"
    SLACK = "slack"
    DISCORD = "discord"
    PHONE = "phone"
    UNKNOWN = "unknown"
