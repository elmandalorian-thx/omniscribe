export interface TranscriptSegment {
  id: string;
  sessionId: string;
  segmentIndex: number;
  speakerId: string | null;
  speakerName: string | null;
  text: string;
  startTime: number; // seconds from session start
  endTime: number;
  confidence: number | null;
  isFinal: boolean;
  createdAt: string;
}

export interface TranscriptEmbedding {
  id: string;
  sessionId: string;
  chunkText: string;
  chunkStart: number; // first segment_index
  chunkEnd: number; // last segment_index
  embedding: number[];
  createdAt: string;
}

export interface SessionSummary {
  id: string;
  sessionId: string;
  summaryType: "brief" | "detailed" | "action_items" | "decisions";
  content: string;
  modelUsed: string | null;
  createdAt: string;
}
