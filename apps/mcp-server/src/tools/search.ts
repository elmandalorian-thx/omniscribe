import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateEmbedding } from "../db/embeddings";
import {
  searchTranscriptsSemantic,
  searchTranscriptsKeyword,
} from "../db/queries";

export function registerSearchTools(server: McpServer): void {
  server.tool(
    "search_transcripts",
    "Semantic search across all meeting transcripts and voice notes. Returns relevant transcript chunks ranked by similarity. Falls back to keyword search if embeddings are unavailable.",
    {
      query: z.string().describe("Natural language search query"),
      session_type: z
        .enum(["meeting", "note"])
        .optional()
        .describe("Filter by session type. Omit to search both."),
      limit: z
        .number()
        .default(10)
        .describe("Maximum number of results to return"),
      date_from: z
        .string()
        .optional()
        .describe("Filter sessions after this date (ISO format)"),
      date_to: z
        .string()
        .optional()
        .describe("Filter sessions before this date (ISO format)"),
    },
    async ({ query, session_type, limit }) => {
      try {
        // Try semantic search first
        const embedding = await generateEmbedding(query);
        const results = await searchTranscriptsSemantic(embedding, {
          matchCount: limit,
          filterType: session_type,
        });

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No matching transcripts found.",
              },
            ],
          };
        }

        const formatted = results
          .map(
            (r, i) =>
              `**${i + 1}.** [${r.session_type}] ${r.title || "Untitled"} (similarity: ${r.similarity.toFixed(3)})\n> ${r.chunk_text.slice(0, 300)}${r.chunk_text.length > 300 ? "..." : ""}\n> Session ID: ${r.session_id}`
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${results.length} results for "${query}":\n\n${formatted}`,
            },
          ],
        };
      } catch {
        // Fall back to keyword search
        const results = await searchTranscriptsKeyword(query, {
          matchCount: limit,
          filterType: session_type,
        });

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No matching transcripts found.",
              },
            ],
          };
        }

        const formatted = results
          .map(
            (r, i) =>
              `**${i + 1}.** [${r.session_type}] ${r.title || "Untitled"}\n> ${r.segment_text.slice(0, 300)}${r.segment_text.length > 300 ? "..." : ""}\n> Session ID: ${r.session_id}`
          )
          .join("\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${results.length} keyword results for "${query}":\n\n${formatted}`,
            },
          ],
        };
      }
    }
  );
}
