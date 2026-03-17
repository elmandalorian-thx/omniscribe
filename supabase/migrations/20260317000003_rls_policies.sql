-- OmniScribe: Row-Level Security policies

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;

-- Sessions: users see only their own
CREATE POLICY "Users manage own sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id);

-- Segments: users see segments belonging to their sessions
CREATE POLICY "Users manage own segments" ON transcript_segments
  FOR ALL USING (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  );

-- Embeddings: users see embeddings belonging to their sessions
CREATE POLICY "Users manage own embeddings" ON transcript_embeddings
  FOR ALL USING (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  );

-- Summaries: users see summaries belonging to their sessions
CREATE POLICY "Users manage own summaries" ON session_summaries
  FOR ALL USING (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  );
