import { supabase, Session } from "@/lib/supabase";
import Link from "next/link";
import { SessionCard } from "@/components/SessionCard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);

  const allSessions = (sessions || []) as Session[];
  const completedSessions = allSessions.filter((s) => s.status === "completed");
  const totalWords = completedSessions.reduce((sum, s) => sum + s.word_count, 0);
  const totalMinutes = completedSessions.reduce(
    (sum, s) => sum + (s.duration_secs || 0) / 60,
    0
  );

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Total Sessions" value={String(completedSessions.length)} />
        <StatCard label="Hours Transcribed" value={`${(totalMinutes / 60).toFixed(1)}h`} />
        <StatCard label="Total Words" value={totalWords.toLocaleString()} />
      </div>

      {/* Recent sessions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Recent Sessions</h2>
        <Link href="/sessions" className="text-sm text-indigo-400 hover:text-indigo-300">
          View all
        </Link>
      </div>

      {allSessions.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No sessions yet</p>
          <p className="text-sm">Start recording from the system tray or press Ctrl+Shift+N for a quick note.</p>
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}
