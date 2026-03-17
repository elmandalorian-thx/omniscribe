import { supabase, Session } from "@/lib/supabase";
import { SessionCard } from "@/components/SessionCard";

export const dynamic = "force-dynamic";

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: { type?: string; platform?: string };
}) {
  let query = supabase
    .from("sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(50);

  if (searchParams.type) {
    query = query.eq("session_type", searchParams.type);
  }
  if (searchParams.platform) {
    query = query.eq("platform", searchParams.platform);
  }

  const { data: sessions } = await query;
  const allSessions = (sessions || []) as Session[];

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-6">All Sessions</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <FilterChip href="/sessions" label="All" active={!searchParams.type} />
        <FilterChip href="/sessions?type=meeting" label="Meetings" active={searchParams.type === "meeting"} />
        <FilterChip href="/sessions?type=note" label="Notes" active={searchParams.type === "note"} />
      </div>

      {allSessions.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p>No sessions found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {allSessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <a
      href={href}
      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
        active
          ? "bg-indigo-600 border-indigo-600 text-white"
          : "bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600"
      }`}
    >
      {label}
    </a>
  );
}
