# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Detailed conventions for server routes, repositories, logging, and tests live in [AGENTS.md](./AGENTS.md). Read it before making changes.

## What This App Does

**tui** is a self-hosted Nuxt 4 application for uploading media to private BitTorrent trackers. The user selects a media file/folder, reviews auto-detected metadata, writes a BBCode description, and submits an upload request. The server creates a generic `.torrent` file and queues uploads to one or more configured trackers.

## Commands

```bash
pnpm dev                             # start dev server at http://localhost:3000
pnpm typecheck                       # TypeScript check (required before finishing any change)
pnpm lint                            # ESLint
pnpm lint:fix                        # ESLint with auto-fix
pnpm test                            # all test projects
pnpm test:unit                       # unit tests only (fastest feedback loop)
pnpm vitest run --project unit path/to/file.test.ts   # single unit test file
pnpm vitest run --project nuxt path/to/file.test.ts   # single nuxt component test
pnpm build                           # typecheck + production build
```

Run the focused test first after a small change, then the full unit project, then `pnpm typecheck` before wrapping up.

For every change — new code or modified existing code — run `pnpm test:coverage` and verify before reporting the task as complete:

1. All tests pass
2. All touched files have 100% coverage — every branch, including error paths and null guards

## Architecture

### Stack

- **Nuxt 4** with `app/` directory layout (not `src/`)
- **Nitro** for server-side API routes under `server/api/`
- **NeDB** (`@seald-io/nedb`) for embedded, file-based persistence — no external database
- **Nuxt UI v4** (Tailwind CSS v4) for UI components
- **Zod** for request validation in every API route
- **Vitest** with three projects: `unit` (Node, no Nuxt), `nuxt` (happy-dom, Nuxt runtime), `e2e` (sequential, real server)

### Request lifecycle

```
Browser → Nitro middleware → server/api route → repository → NeDB datastore
```

Two global Nitro middlewares run on every non-bypassed request (see [server/middleware/](./server/middleware/)):

1. `setup-required` — redirects to `/setup` if no users exist yet
2. `session-required` — validates the `session_id` cookie; redirects to `/login` if missing or expired

All datastores are opened and awaited in `server/plugins/db-init.ts` at server startup. Repository methods can assume datastores are ready and must not call `autoloadPromise` themselves.

### Database

Defined in [server/utils/db.ts](./server/utils/db.ts). Each collection maps 1-to-1 to a `.db` file under `config/database/` (or `$DATABASE_DIR` in tests):

| Collection export                | File                         | Model                  |
| -------------------------------- | ---------------------------- | ---------------------- |
| `userCollection`                 | `users.db`                   | `User`                 |
| `sessionCollection`              | `sessions.db`                | `Session`              |
| `settingsCollection`             | `settings.db`                | `Settings`             |
| `directoryCacheCollection`       | `directory-cache.db`         | `DirectoryCache`       |
| `genericTorrentCacheCollection`  | `generic-torrent-cache.db`   | `GenericTorrentCache`  |
| `trackerUploadRequestCollection` | `tracker-upload-requests.db` | `TrackerUploadRequest` |

Application code must go through repositories, not import collections directly.

### Upload flow (key feature)

1. **`POST /api/tracker/requests`** — validates the body with Zod, creates a `TrackerUploadRequest` record with status `pending`, fires `processTrackerUploadRequest` asynchronously (not awaited), and returns `201` immediately.
2. `processTrackerUploadRequest` (inside [server/api/tracker/requests.post.ts](./server/api/tracker/requests.post.ts)) transitions the request through statuses: `pending → torrent_creation → uploading → success | partial_success | fail`.
3. **`server/services/torrent.ts`** creates a generic `.torrent` (no announce URL) using `create-torrent`, saves it under `config/torrents/`, and reports progress back via the `onProgress` callback which writes to the DB. Piece length is calculated automatically from total source size.
4. A `GenericTorrentCache` entry is saved so re-uploads of the same filepath reuse the existing `.torrent` file.
5. **`GET /api/tracker/requests`** — returns requests sorted newest-first; accepts an optional `limit` query param.
6. The dashboard (`app/pages/index.vue`) polls this endpoint every 2 seconds to show live status cards.

### Settings

A single document with `id: 'app-settings'` is stored in `settings.db`. It holds `mediaPaths`, `tmdbApiKey`, `trackers[]`, `imageHostProviders[]`, and ffmpeg/screenshot config. Trackers have `selected`, `code`, `name`, `url`, `apiKey`, and `passKey` fields.

### Metadata model

`server/model/metadata.ts` exports typed enums/constants (`MEDIA_TYPES`, `SOURCES`, `SOURCE_TYPES`, `SERVICES`, `RESOLUTIONS`, `HDR_TYPES`, `VIDEO_CODECS`, `AUDIO_CODECS`, `AUDIO_CHANNELS`, `AUDIO_METADATA_TYPES`) used for both server-side Zod validation and frontend dropdowns. When adding a new enum value, update both the model constants and any relevant Zod schemas in route files.

### Frontend composables pattern

Composables under `app/composables/` expose `loading` and `error` as `readonly` refs alongside async action functions. They never throw — callers check `error.value` after awaiting. Example: `useTrackerRequests`, `useSettings`.

### Test isolation

Unit tests that exercise database modules must:

1. Call `vi.resetModules()` before importing
2. Set `process.env.DATABASE_DIR` to a temp directory
3. Clean up the temp dir in `afterEach`

Test file placement mirrors source:

- `server/api/...` → `test/e2e/server/api/...`
- `server/repositories/...` → `test/unit/server/repositories/...`
- `app/composables/...` → `test/unit/app/composables/...`
- `app/components/...` or `app/pages/...` → `test/nuxt/...`

### Runtime file locations

All runtime data lives under `config/` (gitignored in production):

- `config/database/` — NeDB `.db` files
- `config/torrents/` — generated `.torrent` files (UUID filenames)
- `config/logs/server.log` — rotating JSON log (max 5 MB × 5 files)
- `config/tmp/screenshots/` — screenshot temp files
