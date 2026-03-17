import { supabase } from "@/lib/supabase";
import { SearchBar } from "@/components/SearchBar";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = searchParams.q || "";
  let results: Array<{
    session_id: string;
    session_type: string;
    title: string | null;
    segment_text: string;
    rank: number;
  }> = [];

  if (query) {
    const { data } = await supabase.rpc("search_transcripts_keyword", {
      search_query: query,
      match_count: 20,
    });
    results = data || [];
  }

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-white mb-6">Search Transcripts</h1>

      <div className="mb-8">
        <SearchBar initialQuery={query} />
      </div>

      {query && (
        <p className="text-sm text-gray-500 mb-4">
          {results.length} results for &quot;{query}&quot;
        </p>
      )}

      {results.length > 0 ? (
        <div className="flex flex-col gap-3">
          {results.map((r, i) => (
            <Link key={i} href={`/sessions/${r.session_id}`}>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                    r.session_type === "meeting" ? "bg-blue-950 text-blue-400" : "bg-emerald-950 text-emerald-400"
                  }`}>
                    {r.session_type}
                  </span>
                  <span className="text-sm font-medium text-white truncate">
                    {r.title || "Untitled"}
                  </span>
                </div>
                <p className="text-sm text-gray-400 line-clamp-2">
                  {r.segment_text}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : query ? (
        <div className="text-center py-12 text-gray-500">
          No results found. Try different search terms.
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          Search across all your meeting transcripts and voice notes.
        </div>
      )}
    </div>
  );
}
