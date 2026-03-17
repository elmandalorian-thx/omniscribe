import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchTools } from "./tools/search";
import { registerSessionTools } from "./tools/sessions";
import { registerTranscriptTools } from "./tools/transcripts";
import { registerNoteTools } from "./tools/notes";
import { registerMeetingTools } from "./tools/meetings";
import { registerInsightTools } from "./tools/insights";

const server = new McpServer({
  name: "omniscribe",
  version: "0.1.0",
});

// Register all tools
registerSearchTools(server);
registerSessionTools(server);
registerTranscriptTools(server);
registerNoteTools(server);
registerMeetingTools(server);
registerInsightTools(server);

// Start server with stdio transport
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OmniScribe MCP server started");
}

main().catch((err) => {
  console.error("Failed to start MCP server:", err);
  process.exit(1);
});
