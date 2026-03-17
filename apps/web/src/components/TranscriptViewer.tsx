"use client";

import { TranscriptSegment } from "@/lib/supabase";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptViewer({ segments }: { segments: TranscriptSegment[] }) {
  if (segments.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No transcript available yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {segments.map((seg) => (
        <div key={seg.id} className="flex gap-3 py-2 px-3 rounded-lg hover:bg-gray-900/50 group">
          <span className="text-xs text-gray-600 font-mono w-12 shrink-0 pt-0.5 text-right">
            {formatTime(seg.start_time)}
          </span>
          {seg.speaker_name || seg.speaker_id ? (
            <span className="text-xs font-medium text-indigo-400 w-24 shrink-0 pt-0.5 truncate">
              {seg.speaker_name || seg.speaker_id}
            </span>
          ) : null}
          <p className="text-sm text-gray-200 leading-relaxed flex-1">
            {seg.text}
          </p>
        </div>
      ))}
    </div>
  );
}
