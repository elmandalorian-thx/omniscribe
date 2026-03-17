import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types matching our Supabase schema
export interface Session {
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
  updated_at: string;
}

export interface TranscriptSegment {
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

export interface SessionTag {
  id: string;
  session_id: string;
  tag_type: "company" | "person" | "topic";
  tag_value: string;
  confidence: number | null;
  source: "ai" | "manual";
}
