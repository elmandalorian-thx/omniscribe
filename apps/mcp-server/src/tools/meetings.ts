import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listSessions } from "../db/queries";

export function registerMeetingTools(server: McpServer): void {
  server.tool(
    "list_meetings",
    "List meeting recordings. Shorthand for searching meetings only.",
    {
      limit: z.number().default(20).describe("Maximum meetings to return"),
      platform: z
        .enum(["google_meet", "zoom", "teams", "slack", "discord", "phone", "unknown"])
        .optional()
        .describe("Filter by meeting platform"),
      date_from: z
        .string()
        .optional()
        .describe("Filter meetings after this date"),
      date_to: z
        .string()
        .optional()
        .describe("Filter meetings before this date"),
    },
    async ({ limit, platform, date_from, date_to }) => {
      const sessions = await listSessions({
        sessionType: "meeting",
        limit,
        platform,
        dateFrom: date_from,
        dateTo: date_to,
      });

      if (sessions.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No meetings found." },
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
            : "in progress";
          const platformStr = s.platform ? ` (${s.platform})` : "";

          return `- **${s.title || "Meeting"}**${platformStr} — ${date} ${time} (${duration}, ${s.word_count} words, ${s.status})\n  ID: ${s.id}`;
        })
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `${sessions.length} meetings:\n\n${formatted}`,
          },
        ],
      };
    }
  );
}
