import Link from "next/link";
import { Session } from "@/lib/supabase";

export function SessionCard({ session }: { session: Session }) {
  const date = new Date(session.started_at);
  const timeStr = date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const duration = session.duration_secs
    ? `${Math.round(session.duration_secs / 60)}m`
    : "...";
  const title = session.title || (session.session_type === "note" ? "Voice Note" : "Meeting");

  return (
    <Link href={`/sessions/${session.id}`}>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors cursor-pointer">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <TypeBadge type={session.session_type} />
            <h3 className="font-medium text-white text-sm truncate max-w-md">{title}</h3>
          </div>
          <StatusBadge status={session.status} />
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{dateStr} {timeStr}</span>
          <span>{duration}</span>
          <span>{session.word_count.toLocaleString()} words</span>
          {session.platform && (
            <span className="text-gray-600">{session.platform.replace("_", " ")}</span>
          )}
        </div>
        {session.tags && session.tags.length > 0 && (
          <div className="flex gap-1.5 mt-2">
            {session.tags.map((tag, i) => (
              <span key={i} className="text-xs bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors = type === "meeting"
    ? "bg-blue-950 text-blue-400"
    : "bg-emerald-950 text-emerald-400";
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${colors}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") return null;
  const colors = status === "recording"
    ? "bg-red-950 text-red-400"
    : status === "transcribing"
    ? "bg-yellow-950 text-yellow-400"
    : "bg-gray-800 text-gray-400";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded ${colors}`}>
      {status}
    </span>
  );
}
