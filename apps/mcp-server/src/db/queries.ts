import { getSupabaseClient } from "./client";

export interface SessionRow {
  id: string;
  user_id: string;
  device_id: string;
  session_type: "meeting" | "note";
  title: string | null;
  status: string;
  platform: string | null;
  meeting_url: string | null;
  participants: string[];
  tags: string[];
  started_at: string;
  ended_at: string | null;
  duration_secs: number | null;
  model_used: string | null;
  language: string;
  word_count: number;
  created_at: string;
}

export interface SegmentRow {
  id: string;
  session_id: string;
  segment_index: number;
  speaker_id: string | null;
  speaker_name: string | null;
  text: string;
  start_time: number;
  end_time: number;
  confidence: number | null;
}

export async function listSessions(options: {
  sessionType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  platform?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}): Promise<SessionRow[]> {
  const client = getSupabaseClient();
  let query = client
    .from("sessions")
    .select("*")
    .order("started_at", { ascending: false });

  if (options.sessionType) {
    query = query.eq("session_type", options.sessionType);
  }
  if (options.status) {
    query = query.eq("status", options.status);
  }
  if (options.dateFrom) {
    query = query.gte("started_at", options.dateFrom);
  }
  if (options.dateTo) {
    query = query.lte("started_at", options.dateTo);
  }
  if (options.platform) {
    query = query.eq("platform", options.platform);
  }
  if (options.tags && options.tags.length > 0) {
    query = query.overlaps("tags", options.tags);
  }

  query = query.range(
    options.offset || 0,
    (options.offset || 0) + (options.limit || 20) - 1
  );

  const { data, error } = await query;
  if (error) throw new Error(`Query failed: ${error.message}`);
  return (data || []) as SessionRow[];
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Query failed: ${error.message}`);
  }
  return data as SessionRow;
}

export async function getTranscriptSegments(
  sessionId: string
): Promise<SegmentRow[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("transcript_segments")
    .select("*")
    .eq("session_id", sessionId)
    .order("segment_index", { ascending: true });

  if (error) throw new Error(`Query failed: ${error.message}`);
  return (data || []) as SegmentRow[];
}

export async function searchTranscriptsSemantic(
  embedding: number[],
  options: {
    matchCount?: number;
    filterType?: string;
  }
): Promise<
  Array<{
    session_id: string;
    session_type: string;
    title: string | null;
    chunk_text: string;
    similarity: number;
  }>
> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("search_transcripts", {
    query_embedding: embedding,
    match_count: options.matchCount || 10,
    filter_type: options.filterType || null,
  });

  if (error) throw new Error(`Search failed: ${error.message}`);
  return data || [];
}

export async function searchTranscriptsKeyword(
  query: string,
  options: {
    matchCount?: number;
    filterType?: string;
  }
): Promise<
  Array<{
    session_id: string;
    session_type: string;
    title: string | null;
    segment_text: string;
    rank: number;
  }>
> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("search_transcripts_keyword", {
    search_query: query,
    match_count: options.matchCount || 20,
    filter_type: options.filterType || null,
  });

  if (error) throw new Error(`Keyword search failed: ${error.message}`);
  return data || [];
}
