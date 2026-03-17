import type { SessionType, MeetingPlatform, SessionStatus } from "./session";

export interface SearchTranscriptsInput {
  query: string;
  sessionType?: SessionType;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface SearchTranscriptsResult {
  sessionId: string;
  sessionType: SessionType;
  title: string | null;
  chunkText: string;
  similarity: number;
}

export interface ListSessionsInput {
  sessionType?: SessionType;
  limit?: number;
  offset?: number;
  status?: SessionStatus;
  dateFrom?: string;
  dateTo?: string;
}

export interface GetSessionInput {
  sessionId: string;
}

export interface GetTranscriptInput {
  sessionId: string;
  includeTimestamps?: boolean;
  includeSpeakers?: boolean;
  format?: "text" | "srt" | "json";
}

export interface ListNotesInput {
  limit?: number;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface ListMeetingsInput {
  limit?: number;
  platform?: MeetingPlatform;
  dateFrom?: string;
  dateTo?: string;
}

export interface GetRecentContextInput {
  hoursBack?: number;
  sessionType?: SessionType;
  maxSessions?: number;
}
