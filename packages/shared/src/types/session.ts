export type SessionType = "meeting" | "note";

export type SessionStatus =
  | "recording"
  | "transcribing"
  | "completed"
  | "failed"
  | "archived";

export type MeetingPlatform =
  | "google_meet"
  | "zoom"
  | "teams"
  | "slack"
  | "discord"
  | "phone"
  | "unknown";

export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  sessionType: SessionType;
  title: string | null;
  status: SessionStatus;

  // Meeting-specific (null for notes)
  platform: MeetingPlatform | null;
  meetingUrl: string | null;
  participants: string[];

  // Note-specific
  tags: string[];

  // Timing
  startedAt: string; // ISO timestamp
  endedAt: string | null;
  durationSecs: number | null;

  // Transcription metadata
  modelUsed: string | null;
  language: string;
  wordCount: number;

  // Sync
  syncedAt: string | null;
  localOnly: boolean;

  createdAt: string;
  updatedAt: string;
}
