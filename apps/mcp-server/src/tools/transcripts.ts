import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSession, getTranscriptSegments } from "../db/queries";

export function registerTranscriptTools(server: McpServer): void {
  server.tool(
    "get_transcript",
    "Get the full transcript text of a session, optionally with speaker labels and timestamps.",
    {
      session_id: z.string().describe("UUID of the session"),
      include_timestamps: z
        .boolean()
        .default(false)
        .describe("Include timestamps for each segment"),
      include_speakers: z
        .boolean()
        .default(true)
        .describe("Include speaker labels"),
      format: z
        .enum(["text", "srt", "json"])
        .default("text")
        .describe("Output format"),
    },
    async ({ session_id, include_timestamps, include_speakers, format }) => {
      const session = await getSession(session_id);
      if (!session) {
        return {
          content: [
            { type: "text" as const, text: `Session not found: ${session_id}` },
          ],
        };
      }

      const segments = await getTranscriptSegments(session_id);
      if (segments.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No transcript segments found for session: ${session_id} (status: ${session.status})`,
            },
          ],
        };
      }

      if (format === "json") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  session_id,
                  title: session.title,
                  session_type: session.session_type,
                  segments: segments.map((s) => ({
                    index: s.segment_index,
                    speaker: s.speaker_name || s.speaker_id,
                    text: s.text,
                    start: s.start_time,
                    end: s.end_time,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (format === "srt") {
        const srt = segments
          .map((s, i) => {
            const start = formatSrtTime(s.start_time);
            const end = formatSrtTime(s.end_time);
            const speaker = include_speakers && s.speaker_name
              ? `${s.speaker_name}: `
              : "";
            return `${i + 1}\n${start} --> ${end}\n${speaker}${s.text}`;
          })
          .join("\n\n");

        return {
          content: [{ type: "text" as const, text: srt }],
        };
      }

      // Default: plain text
      const header = `# ${session.title || "Untitled"} (${session.session_type})\n\n`;

      const lines = segments.map((s) => {
        const parts: string[] = [];
        if (include_timestamps) {
          parts.push(`[${formatTime(s.start_time)}]`);
        }
        if (include_speakers && s.speaker_name) {
          parts.push(`${s.speaker_name}:`);
        } else if (include_speakers && s.speaker_id) {
          parts.push(`${s.speaker_id}:`);
        }
        parts.push(s.text);
        return parts.join(" ");
      });

      return {
        content: [
          { type: "text" as const, text: header + lines.join("\n") },
        ],
      };
    }
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
}
