# OmniScribe

Self-hosted meeting intelligence + voice notes system with MCP cloud sync. Captures system audio from any app, transcribes locally via Whisper, syncs to Supabase, and exposes everything to AI agents via MCP.

## Deployment

| Environment | Platform | URL |
|-------------|----------|-----|
| MCP Server | Railway | TBD |
| Web Dashboard | Vercel | TBD |
| Supabase | Supabase Cloud | TBD |

Environment variables: see `apps/daemon/.env.example`, `apps/mcp-server/.env.example`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop daemon | Python 3.11 + pyaudiowpatch + faster-whisper |
| Desktop tray | Electron |
| Mobile app | React Native (Expo) — Phase 3 |
| Cloud DB | Supabase (PostgreSQL + pgvector) |
| MCP server | Node.js + @modelcontextprotocol/sdk |
| Web dashboard | Next.js 14 |
| Monorepo | pnpm workspaces + Turborepo |

## Architecture

### Data Flow
`Audio Source → Capture (WASAPI/Mic) → WAV Chunks → faster-whisper → SQLite → Supabase Sync → MCP Server → Claude`

### Session Types
- **meeting**: Captures system audio via WASAPI loopback (what you hear). Auto-detect or manual trigger.
- **note**: Captures microphone input. Always manual trigger (tray button or Ctrl+Shift+N).

Both share the same pipeline: capture → transcribe → SQLite → Supabase sync → MCP queryable.

### Daemon ↔ Tray Communication
Electron tray app controls the Python daemon via FastAPI on `localhost:52849`.

### Key Patterns
- **Offline-first**: SQLite is source of truth locally. Supabase is eventual-consistency sync target.
- **Session type polymorphism**: Single `sessions` table with `session_type` discriminator.
- **Chunked processing**: Audio captured in 30s WAV chunks, transcribed incrementally.

## Shared Components

| Component | Path | Purpose |
|-----------|------|---------|
| TypeScript types | `packages/shared/src/types/` | Session, Segment, MCP tool interfaces |
| Constants | `packages/shared/src/constants.ts` | Audio config, ports, thresholds |
| SQLite store | `apps/daemon/.../storage/sqlite_store.py` | Local persistence for all session data |
| Session manager | `apps/daemon/.../session/manager.py` | Orchestrates capture → transcribe → store lifecycle |
| Audio capture factory | `apps/daemon/.../audio/capture.py` | `get_capture_backend(type)` returns loopback or mic |

## New Module Checklist

1. Add directory under `apps/` (JS) or extend `apps/daemon/` (Python)
2. For JS packages: add to `pnpm-workspace.yaml`, import from `@omniscribe/shared`
3. For new DB tables: add migration in `supabase/migrations/`, update RLS policies
4. For new MCP tools: add tool in `apps/mcp-server/src/tools/`, register in index.ts
5. Update `docs/CHANGELOG.md` with changes

## File Structure

```
omniscribe/
├── packages/shared/           # TypeScript types + constants
├── apps/
│   ├── daemon/                # Python: audio capture + transcription + local API
│   ├── tray/                  # Electron: system tray UI
│   ├── mcp-server/            # Node.js: MCP server for AI agents
│   ├── web/                   # Next.js: web dashboard
│   └── mobile/                # React Native: mobile app (Phase 3)
├── supabase/migrations/       # PostgreSQL schema + pgvector + RLS
├── infra/                     # Railway + Vercel deployment configs
├── docs/                      # Changelog, architecture docs
└── PRD/                       # Product requirements document
```

## Development Guidelines

1. **Python daemon**: Use `ruff` for linting, type hints on all functions, `pytest` for tests
2. **JS/TS packages**: Strict TypeScript, import shared types from `@omniscribe/shared`
3. **DB changes**: Always add a numbered migration file, never modify existing migrations
4. **Audio files**: Never committed to git (in .gitignore). Only text transcripts sync to cloud.
5. **Secrets**: Use `OMNISCRIBE_` prefix for all env vars. Never commit `.env` files.
6. **Sessions**: Both meetings and notes use `session/manager.py` — don't create parallel paths
7. **Sync**: Unidirectional local→cloud only. No writes from cloud back to device.

## References

- [PRD](PRD/OmniScribe_PRD_v1.docx)
- [Changelog](docs/CHANGELOG.md)
- [Architecture Plan](.claude/plans/sleepy-purring-steele.md)
