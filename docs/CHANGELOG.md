# Changelog

## 2026-03-17

- Initial monorepo scaffold (pnpm workspaces + Turborepo)
- Shared TypeScript types package (`packages/shared/`)
- Supabase migrations: sessions, segments, pgvector embeddings, RLS policies
- Python daemon with full audio capture + transcription pipeline (`apps/daemon/`)
  - WASAPI loopback capture (meetings) + microphone capture (notes)
  - Silero VAD for speech detection
  - faster-whisper transcription engine with CUDA/CPU support
  - Groq API fallback for non-GPU devices
  - SQLite local storage with sync queue
  - Supabase background sync engine
  - Session manager orchestrating capture → transcribe → store lifecycle
  - FastAPI local server for tray app communication
- CLAUDE.md project documentation
- Electron system tray app (`apps/tray/`)
  - System tray with context menu: Start Meeting, Quick Note, Stop, Open Dashboard
  - Global hotkey Ctrl+Shift+N for Quick Note toggle
  - Daemon process lifecycle management (spawn/kill Python daemon)
  - HTTP client communicating with daemon on localhost:52849
  - IPC bridge for renderer window
  - Popup window with session list, recording controls, dark UI
  - Notification support for recording start/stop/complete
- MCP server with 9 tools (`apps/mcp-server/`)
  - search_transcripts: semantic (pgvector) + keyword fallback
  - list_sessions, get_session: browse and inspect sessions
  - get_transcript: full transcript in text/srt/json formats
  - list_notes, get_note: voice note shortcuts
  - list_meetings: meeting-specific listing with platform filter
  - get_recent_context: last N hours of transcripts for contextual awareness
  - get_meeting_summary: returns transcript for AI summarization
  - Supabase client, OpenAI embeddings, Dockerfile for Railway
- Environment variable examples and Claude Desktop MCP config docs
