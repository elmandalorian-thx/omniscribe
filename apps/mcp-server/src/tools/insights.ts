import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listSessions, getTranscriptSegments, getSession } from "../db/queries";

export function registerInsightTools(server: McpServer): void {
  server.tool(
    "get_recent_context",
    "Get transcripts from the most recent sessions to provide context about what was discussed today or recently. Useful for getting up to speed before a meeting or drafting follow-ups.",
    {
      hours_back: z
        .number()
        .default(24)
        .describe("How many hours back to look"),
      session_type: z
        .enum(["meeting", "note"])
        .optional()
        .describe("Filter by session type"),
      max_sessions: z
        .number()
        .default(5)
        .describe("Maximum number of sessions to include"),
    },
    async ({ hours_back, session_type, max_sessions }) => {
      const since = new Date(
        Date.now() - hours_back * 60 * 60 * 1000
      ).toISOString();

      const sessions = await listSessions({
        sessionType: session_type,
        dateFrom: since,
        limit: max_sessions,
        status: "completed",
      });

      if (sessions.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No completed sessions found in the last ${hours_back} hours.`,
            },
          ],
        };
      }

      const summaries: string[] = [];

      for (const session of sessions) {
        const segments = await getTranscriptSegments(session.id);
        const fullText = segments.map((s) => s.text).join(" ");

        // Truncate long transcripts to first 500 words
        const words = fullText.split(" ");
        const preview =
          words.length > 500
            ? words.slice(0, 500).join(" ") + "... [truncated]"
            : fullText;

        const date = new Date(session.started_at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        const duration = session.duration_secs
          ? `${Math.round(session.duration_secs / 60)}m`
          : "unknown";

        summaries.push(
          `### ${session.title || "Untitled"} [${session.session_type}]\n` +
            `*${date} — ${duration} — ${session.word_count} words*\n` +
            `ID: ${session.id}\n\n` +
            preview
        );
      }

      return {
        content: [
          {
            type: "text" as const,
            text:
              `Recent context (last ${hours_back}h, ${sessions.length} sessions):\n\n` +
              summaries.join("\n\n---\n\n"),
          },
        ],
      };
    }
  );

  server.tool(
    "get_meeting_summary",
    "Get or generate a summary of a meeting session. Returns existing summary if available, or the raw transcript for you to summarize.",
    {
      session_id: z.string().describe("UUID of the session"),
      summary_type: z
        .enum(["brief", "detailed", "action_items", "decisions"])
        .default("brief")
        .describe("Type of summary to retrieve"),
    },
    async ({ session_id, summary_type }) => {
      const session = await getSession(session_id);
      if (!session) {
        return {
          content: [
            { type: "text" as const, text: `Session not found: ${session_id}` },
          ],
        };
      }

      // Check for existing summary (Phase 4 — for now return transcript)
      const segments = await getTranscriptSegments(session_id);
      if (segments.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No transcript available for session ${session_id} (status: ${session.status})`,
            },
          ],
        };
      }

      const fullText = segments
        .map((s) => {
          const speaker = s.speaker_name || s.speaker_id || "";
          return speaker ? `${speaker}: ${s.text}` : s.text;
        })
        .join("\n");

      const header = [
        `**${session.title || "Untitled"}** (${session.session_type})`,
        `Date: ${new Date(session.started_at).toLocaleString()}`,
        session.duration_secs
          ? `Duration: ${Math.round(session.duration_secs / 60)} minutes`
          : null,
        `Words: ${session.word_count}`,
        session.platform ? `Platform: ${session.platform}` : null,
        `\nRequested summary type: ${summary_type}`,
        `Note: Auto-generated summaries are a Phase 4 feature. Here is the full transcript for you to summarize:\n`,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [
          { type: "text" as const, text: header + "\n---\n\n" + fullText },
        ],
      };
    }
  );
}
