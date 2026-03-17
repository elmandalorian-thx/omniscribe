import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listSessions, getSession } from "../db/queries";

export function registerSessionTools(server: McpServer): void {
  server.tool(
    "list_sessions",
    "List recent recording sessions (meetings and/or notes) with metadata. Returns sessions ordered by most recent first.",
    {
      session_type: z
        .enum(["meeting", "note"])
        .optional()
        .describe("Filter by session type"),
      limit: z.number().default(20).describe("Maximum sessions to return"),
      offset: z.number().default(0).describe("Pagination offset"),
      status: z
        .enum(["recording", "transcribing", "completed", "failed"])
        .optional()
        .describe("Filter by session status"),
      date_from: z
        .string()
        .optional()
        .describe("Filter sessions after this date"),
      date_to: z
        .string()
        .optional()
        .describe("Filter sessions before this date"),
    },
    async ({ session_type, limit, offset, status, date_from, date_to }) => {
      const sessions = await listSessions({
        sessionType: session_type,
        limit,
        offset,
        status,
        dateFrom: date_from,
        dateTo: date_to,
      });

      if (sessions.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No sessions found matching the criteria." },
          ],
        };
      }

      const formatted = sessions
        .map((s) => {
          const duration = s.duration_secs
            ? `${Math.round(s.duration_secs / 60)}m`
            : "in progress";
          const date = new Date(s.started_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const time = new Date(s.started_at).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return `- **${s.title || "Untitled"}** [${s.session_type}] — ${date} ${time} (${duration}, ${s.word_count} words, ${s.status})\n  ID: ${s.id}${s.platform ? ` | Platform: ${s.platform}` : ""}`;
        })
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `${sessions.length} sessions:\n\n${formatted}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get_session",
    "Get full details of a specific session including metadata and statistics.",
    {
      session_id: z.string().describe("UUID of the session"),
    },
    async ({ session_id }) => {
      const session = await getSession(session_id);

      if (!session) {
        return {
          content: [
            { type: "text" as const, text: `Session not found: ${session_id}` },
          ],
        };
      }

      const duration = session.duration_secs
        ? `${Math.round(session.duration_secs / 60)} minutes`
        : "in progress";

      const details = [
        `**${session.title || "Untitled"}**`,
        `Type: ${session.session_type}`,
        `Status: ${session.status}`,
        `Started: ${session.started_at}`,
        session.ended_at ? `Ended: ${session.ended_at}` : null,
        `Duration: ${duration}`,
        `Words: ${session.word_count}`,
        `Language: ${session.language}`,
        session.platform ? `Platform: ${session.platform}` : null,
        session.model_used ? `Model: ${session.model_used}` : null,
        session.tags.length > 0 ? `Tags: ${session.tags.join(", ")}` : null,
        `Device: ${session.device_id}`,
        `ID: ${session.id}`,
      ]
        .filter(Boolean)
        .join("\n");

      return {
        content: [{ type: "text" as const, text: details }],
      };
    }
  );
}
