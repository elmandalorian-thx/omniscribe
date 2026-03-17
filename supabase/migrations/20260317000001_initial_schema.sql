-- OmniScribe: Core schema for sessions and transcript segments
-- Unified table for both meetings and voice notes

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  device_id     TEXT NOT NULL,
  session_type  TEXT NOT NULL CHECK (session_type IN ('meeting', 'note')),
  title         TEXT,
  status        TEXT NOT NULL DEFAULT 'recording'
                CHECK (status IN ('recording', 'transcribing', 'completed', 'failed', 'archived')),

  -- Meeting-specific (NULL for notes)
  platform      TEXT,
  meeting_url   TEXT,
  participants  JSONB DEFAULT '[]',

  -- Note-specific
  tags          TEXT[] DEFAULT '{}',

  -- Timing
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  duration_secs INTEGER,

  -- Audio metadata
  audio_path    TEXT,
  audio_format  TEXT DEFAULT 'wav',
  sample_rate   INTEGER DEFAULT 16000,

  -- Transcription metadata
  model_used    TEXT,
  language      TEXT DEFAULT 'en',
  word_count    INTEGER DEFAULT 0,

  -- Sync tracking
  synced_at     TIMESTAMPTZ,
  local_only    BOOLEAN DEFAULT false,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user_type ON sessions(user_id, session_type);
CREATE INDEX idx_sessions_user_date ON sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_status ON sessions(status);

-- Transcript segments (individual speaker turns or note chunks)
CREATE TABLE transcript_segments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL,

  speaker_id    TEXT,
  speaker_name  TEXT,

  text          TEXT NOT NULL,
  start_time    REAL NOT NULL,
  end_time      REAL NOT NULL,
  confidence    REAL,

  is_final      BOOLEAN DEFAULT true,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_segments_session ON transcript_segments(session_id, segment_index);
CREATE INDEX idx_segments_text_search ON transcript_segments
  USING gin(to_tsvector('english', text));

-- Session summaries (Phase 4, schema ready now)
CREATE TABLE session_summaries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  summary_type  TEXT NOT NULL CHECK (summary_type IN ('brief', 'detailed', 'action_items', 'decisions')),
  content       TEXT NOT NULL,
  model_used    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on sessions
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
