# Claude Desktop MCP Configuration

Add this to your Claude Desktop config file to connect OmniScribe:

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

## Local Development (stdio)

```json
{
  "mcpServers": {
    "omniscribe": {
      "command": "node",
      "args": ["C:/path/to/omniscribe/apps/mcp-server/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_KEY": "your-service-role-key",
        "OPENAI_API_KEY": "sk-your-key"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `search_transcripts` | Semantic + keyword search across meetings and notes |
| `list_sessions` | Browse all sessions with filters |
| `get_session` | Get session metadata |
| `get_transcript` | Full transcript (text/srt/json) |
| `list_notes` | List voice notes only |
| `list_meetings` | List meetings only |
| `get_note` | Get a note with full transcript |
| `get_recent_context` | Last N hours of transcripts |
| `get_meeting_summary` | Session summary (returns transcript for you to summarize) |
