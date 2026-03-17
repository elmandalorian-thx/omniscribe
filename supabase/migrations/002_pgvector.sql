-- OmniScribe: pgvector extension for semantic search

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE transcript_embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  chunk_text    TEXT NOT NULL,
  chunk_start   INTEGER NOT NULL,
  chunk_end     INTEGER NOT NULL,
  embedding     vector(1536) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_embeddings_session ON transcript_embeddings(session_id);
CREATE INDEX idx_embeddings_vector ON transcript_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Semantic search function
CREATE OR REPLACE FUNCTION search_transcripts(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  filter_type TEXT DEFAULT NULL,
  filter_user UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  session_id UUID,
  session_type TEXT,
  title TEXT,
  chunk_text TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.session_type,
    s.title,
    te.chunk_text,
    1 - (te.embedding <=> query_embedding) AS similarity
  FROM transcript_embeddings te
  JOIN sessions s ON s.id = te.session_id
  WHERE s.user_id = filter_user
    AND (filter_type IS NULL OR s.session_type = filter_type)
  ORDER BY te.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Full-text search function (keyword fallback)
CREATE OR REPLACE FUNCTION search_transcripts_keyword(
  search_query TEXT,
  match_count INT DEFAULT 20,
  filter_type TEXT DEFAULT NULL,
  filter_user UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  session_id UUID,
  session_type TEXT,
  title TEXT,
  segment_text TEXT,
  rank REAL
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.session_type,
    s.title,
    ts.text AS segment_text,
    ts_rank(to_tsvector('english', ts.text), plainto_tsquery('english', search_query)) AS rank
  FROM transcript_segments ts
  JOIN sessions s ON s.id = ts.session_id
  WHERE s.user_id = filter_user
    AND (filter_type IS NULL OR s.session_type = filter_type)
    AND to_tsvector('english', ts.text) @@ plainto_tsquery('english', search_query)
  ORDER BY rank DESC
  LIMIT match_count;
END;
$$;
