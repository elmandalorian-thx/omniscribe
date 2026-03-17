import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listSessions, getSession, getTranscriptSegments } from "../db/queries";

export function registerNoteTools(server: McpServer): void {
  server.tool(
    "list_notes",
    "List voice notes/dictations. Shorthand for searching notes only.",
    {
      limit: z.number().default(20).describe("Maximum notes to return"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Filter by tags"),
      date_from: z
        .string()
        .optional()
        .describe("Filter notes after this date"),
      date_to: z
        .string()
        .optional()
        .describe("Filter notes before this date"),
    },
    async ({ limit, tags, date_from, date_to }) => {
      const sessions = await listSessions({
        sessionType: "note",
        limit,
        tags,
        dateFrom: date_from,
        dateTo: date_to,
      });

      if (sessions.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No voice notes found." },
          ],
        };
      }

      const formatted = sessions
        .map((s) => {
          const date = new Date(s.started_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          const time = new Date(s.started_at).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });
          const duration = s.duration_secs
            ? `${Math.round(s.duration_secs / 60)}m`
            : "...";
          const tags = s.tags.length > 0 ? ` [${s.tags.join(", ")}]` : "";

          return `- **${s.title || "Voice Note"}** — ${date} ${time} (${duration}, ${s.word_count} words)${tags}\n  ID: ${s.id}`;
        })
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `${sessions.length} voice notes:\n\n${formatted}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_note",
    "Get a voice note with its full transcript text.",
    {
      session_id: z.string().describe("UUID of the note session"),
    },
    async ({ session_id }) => {
      const session = await getSession(session_id);
      if (!session) {
        return {
          content: [
            { type: "text" as const, text: `Note not found: ${session_id}` },
          ],
        };
      }

      if (session.session_type !== "note") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Session ${session_id} is a ${session.session_type}, not a note. Use get_session and get_transcript instead.`,
            },
          ],
        };
      }

      const segments = await getTranscriptSegments(session_id);
      const fullText = segments.map((s) => s.text).join(" ");

      const details = [
        `**${session.title || "Voice Note"}**`,
        `Date: ${new Date(session.started_at).toLocaleString()}`,
        session.duration_secs
          ? `Duration: ${Math.round(session.duration_secs / 60)} minutes`
          : null,
        `Words: ${session.word_count}`,
        session.tags.length > 0 ? `Tags: ${session.tags.join(", ")}` : null,
        `\n---\n`,
        fullText || "(No transcript available yet)",
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [{ type: "text" as const, text: details }],
      };
    }
  );
}
