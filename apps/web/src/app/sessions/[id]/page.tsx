import { supabase, Session, TranscriptSegment } from "@/lib/supabase";
import { TranscriptViewer } from "@/components/TranscriptViewer";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SessionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!session) notFound();

  const { data: segments } = await supabase
    .from("transcript_segments")
    .select("*")
    .eq("session_id", params.id)
    .order("segment_index", { ascending: true });

  const s = session as Session;
  const segs = (segments || []) as TranscriptSegment[];

  const date = new Date(s.started_at);
  const dateStr = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const duration = s.duration_secs ? `${Math.round(s.duration_secs / 60)} min` : "In progress";
  const title = s.title || (s.session_type === "note" ? "Voice Note" : "Meeting");

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <Link href="/sessions" className="text-sm text-gray-500 hover:text-gray-300 mb-4 inline-block">
        &larr; Back to sessions
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
              s.session_type === "meeting" ? "bg-blue-950 text-blue-400" : "bg-emerald-950 text-emerald-400"
            }`}>
              {s.session_type}
            </span>
            {s.platform && (
              <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                {s.platform.replace("_", " ")}
              </span>
            )}
          </div>
          <h1 className="text-xl font-bold text-white">{title}</h1>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetaItem label="Date" value={dateStr} />
        <MetaItem label="Time" value={timeStr} />
        <MetaItem label="Duration" value={duration} />
        <MetaItem label="Words" value={s.word_count.toLocaleString()} />
      </div>

      {/* Tags */}
      {s.tags && s.tags.length > 0 && (
        <div className="flex gap-2 mb-6">
          {s.tags.map((tag, i) => (
            <span key={i} className="text-xs bg-indigo-950 text-indigo-300 px-3 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Transcript */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Transcript</h2>
        <span className="text-xs text-gray-600">{segs.length} segments</span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <TranscriptViewer segments={segs} />
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className="text-sm text-white">{value}</div>
    </div>
  );
}
