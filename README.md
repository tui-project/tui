# tui

A self-hosted web application for uploading media to private BitTorrent trackers. Select a file or folder, review auto-detected metadata, write a BBCode description, and submit — tui handles torrent creation, duplicate checking, rule validation, and uploading in the background.

> **Current state:** Early development (v0.2.1). The core upload flow is functional, with tracker-specific support for Aither(ATH) and Upload.cx(ULCX). Breaking changes between versions should be expected.

---

## Table of Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Supported Trackers](#supported-trackers)
- [Tracker-specific Checks](#tracker-specific-checks)
- [Supported Integrations](#supported-integrations)
- [Getting Started](#getting-started)
    - [Docker (recommended)](#docker-recommended)
    - [Docker Compose](#docker-compose)
    - [Local Setup](#local-setup)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [Reporting Bugs & Feature Requests](#reporting-bugs--feature-requests)
- [Attributions](#attributions)
- [License](#license)

---

## Features

- **5-step guided upload flow** — Select media → Review/edit metadata → Pick trackers → Run pre-flight checks → Write the description and submit
- **Automatic metadata detection** — Parses the filename and combines MediaInfo, ffprobe, TMDB, and TVDB data to pre-fill resolution, codec, audio, HDR flags, and more
- **BBCode description editor** — Write and preview descriptions, use formatting shortcuts, and append a version footer automatically
- **Screenshot capture** — On request, captures a configurable number of screenshots with ffmpeg, uploads them to ImgBB, and inserts their links into the description
- **Parallel tracker uploads** — Submits to multiple selected trackers concurrently
- **Pre-flight checks** — Duplicate detection and tracker rule validation before submission
- **Tracker-aware title generation** — Formats the torrent title according to each tracker's naming convention
- **Torrent caching** — Re-uploads of the same filepath reuse the already-created `.torrent` file
- **Live upload dashboard** — Uses a server-sent event stream to show torrent creation progress and per-tracker results, with retry support for failed or partially successful uploads
- **Upload history** — Shows paginated upload attempts and lets you expand related attempts for the same source
- **Live log viewer** — Streams recent structured logs and supports filtering by text, level, and scope
- **Torrent client injection** — Pushes the download URL to a connected torrent client after a successful upload
- **Session-based auth** — Simple login with a single admin account; application routes require authentication after setup

---

## Screenshots

### Setup

<a href="docs/screenshots/setup.png"><img src="docs/screenshots/setup.png" width="49%" /></a>

### Dashboard

<a href="docs/screenshots/dashboard.png"><img src="docs/screenshots/dashboard.png" width="49%" /></a>

### Upload Flow

<a href="docs/screenshots/upload-select-media.png"><img src="docs/screenshots/upload-select-media.png" width="49%" /></a> <a href="docs/screenshots/upload-edit-metadata.png"><img src="docs/screenshots/upload-edit-metadata.png" width="49%" /></a>
<a href="docs/screenshots/upload-edit-description.png"><img src="docs/screenshots/upload-edit-description.png" width="49%" /></a> <a href="docs/screenshots/upload-description-preview.png"><img src="docs/screenshots/upload-description-preview.png" width="49%" /></a>
<a href="docs/screenshots/upload-select-trackers.png"><img src="docs/screenshots/upload-select-trackers.png" width="49%" /></a> <a href="docs/screenshots/upload-review.png"><img src="docs/screenshots/upload-review.png" width="49%" /></a>

### History

<a href="docs/screenshots/history.png"><img src="docs/screenshots/history.png" width="49%" /></a>

### Settings

<a href="docs/screenshots/settings.png"><img src="docs/screenshots/settings.png" width="49%" /></a>

---

## Supported Trackers

All current trackers run on the [UNIT3D](https://github.com/HDInnovations/UNIT3D-Community-Edition) platform. Each tracker has its own title format, rule validation, and duplicate detection logic built in.

| Tracker   | Code   | Platform |
| --------- | ------ | -------- |
| Aither    | `ATH`  | UNIT3D   |
| Upload.cx | `ULCX` | UNIT3D   |

## Tracker-specific Checks

During the Review step, tui runs pre-flight checks for each selected tracker before the upload is submitted:

- Tracker-specific rules validate the release metadata and report blocking issues.
- Duplicate detection looks for existing releases in the same quality or release slot.
- Duplicate results distinguish blocking conflicts from releases that the new upload may be able to trump.
- Title generation previews the tracker-specific torrent name that will be submitted.

These checks cover the rules currently implemented by tui, but they are not exhaustive and tracker rules may change independently. Uploaders remain responsible for reviewing and following the current official rules:

- [Aither upload rules](https://aither.cc/pages/1)
- [Upload.cx upload rules](https://upload.cx/pages/12)

## Supported Integrations

| Category            | Integration      | Notes                                |
| ------------------- | ---------------- | ------------------------------------ |
| **Metadata**        | TMDB             | Movie/show info, language lookup     |
| **Metadata**        | TVDB             | TV special and episode metadata      |
| **Image hosting**   | ImgBB            | Screenshot upload                    |
| **Torrent clients** | QUI              | Cross-seed injection via the QUI API |
| **Media analysis**  | ffmpeg / ffprobe | Screenshot capture, stream probing   |
| **Media analysis**  | mediainfo        | Detailed codec/format info           |

---

## Getting Started

### Prerequisites

- Docker (recommended path) **or** Node.js 22+ and pnpm 11

### Docker (recommended)

Pull and run the latest image:

```bash
docker run -d \
  --name tui \
  -p 4000:4000 \
  -v $(pwd)/config:/app/config \
  -v /path/to/media:/media \
  --restart unless-stopped \
  ghcr.io/tui-project/tui:latest
```

Open `http://localhost:4000` and complete the first-run setup wizard to create your admin account.

### Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
    tui:
        image: ghcr.io/tui-project/tui:latest
        # or build from source:
        # build: .
        ports:
            - '4000:4000'
        volumes:
            - ./config:/app/config
            - /path/to/media:/media
        restart: unless-stopped
```

Then start it:

```bash
docker compose up -d
```

The `./config` directory on your host will hold the database, generated torrents, logs, and screenshots. Back it up regularly.

#### Volume layout

| Host path            | Container path          | Contents                                            |
| -------------------- | ----------------------- | --------------------------------------------------- |
| `./config/database/` | `/app/config/database/` | NeDB database files                                 |
| `./config/torrents/` | `/app/config/torrents/` | Generated `.torrent` files                          |
| `./config/logs/`     | `/app/config/logs/`     | Rotating server log (JSON)                          |
| `./config/tmp/`      | `/app/config/tmp/`      | Temporary screenshot files                          |
| `/path/to/media`     | `/media`                | Source media files (add to Media Paths in Settings) |

### Local Setup

#### 1. Clone and install

```bash
git clone https://github.com/tui-project/tui.git
cd tui
pnpm install
```

#### 2. Install system dependencies

tui requires **ffmpeg**, **ffprobe**, and **mediainfo** to be available on the host. You can either:

- Install them system-wide (`brew install ffmpeg mediainfo` on macOS, `apt install ffmpeg mediainfo` on Debian/Ubuntu)
- Or point to custom binary paths in the Settings page after first launch

#### 3. Start the dev server

```bash
pnpm dev
```

Open `http://localhost:3000`. The first request redirects to `/setup` to create your admin account.

#### 4. Build for production

```bash
pnpm build
node .output/server/index.mjs
```

The production server listens on port `3000` by default. Set `HOST` and `PORT` environment variables to override it; the supplied Docker image uses port `4000`.

---

## Configuration

All settings are managed through the **Settings** page in the UI. Nothing requires editing config files by hand.

| Setting                          | Description                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------ |
| **Media paths**                  | Directories the file browser exposes for source media selection                |
| **TMDB API key**                 | Required for automatic metadata lookup and language lists                      |
| **Trackers**                     | URL, API key, and passkey for each supported tracker                           |
| **Image host**                   | ImgBB API key for screenshot uploads                                           |
| **Torrent client**               | URL and API key for optional post-upload injection                             |
| **ffmpeg / ffprobe / mediainfo** | Binary names or custom paths (`ffmpeg`, `ffprobe`, and `mediainfo` use `PATH`) |
| **Screenshot counts**            | How many screenshots to capture for movies vs. episode packs                   |
| **Log level**                    | Runtime verbosity, reflected in both the log file and live viewer              |

### Required API keys

Before you can upload, you'll need to obtain and enter the following in Settings:

- **TMDB API key** — get one at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api). Required for metadata lookups and language lists.
- **Tracker API key + pass key** — find these in your account settings on each tracker you want to upload to.
- **ImgBB API key** — get one at [imgbb.com/api](https://imgbb.com/api). Required for screenshot uploads.
- **QUI API key** — found in your QUI instance settings. Only needed if you want torrents automatically injected into your torrent client after upload.

---

## Contributing

Contributions are welcome. Please read this section before opening a pull request.

### Development workflow

```bash
pnpm install        # install dependencies
pnpm dev            # start dev server at http://localhost:3000
pnpm typecheck      # TypeScript check (required before finishing any change)
pnpm lint           # ESLint
pnpm lint:fix       # ESLint with auto-fix
pnpm test           # unit + Nuxt component + browser/API e2e tests
pnpm test:unit      # unit tests only (fastest feedback loop)
pnpm test:nuxt      # Nuxt component/page tests
pnpm test:e2e       # browser and API e2e tests
pnpm test:coverage  # unit and Nuxt coverage report
```

### Guidelines

- Follow the [Conventional Commits](https://www.conventionalcommits.org/) format: `type: short summary` (under 72 chars) followed by 1–2 sentences of context.
- All touched code paths must have 100% test coverage (branches, error paths, null guards included). Run `pnpm test:coverage` and verify before opening a PR.
- See [the contributing guide](./docs/CONTRIBUTING.md) for conventions on routes, repositories, logging, tests, and code style.

### Opening a pull request

1. Fork the repository and create a focused branch for your change.
2. Make your changes with tests.
3. Run `pnpm typecheck && pnpm test:coverage` — both must pass cleanly.
4. Open a PR with a clear description of what changed and why. CI runs automatically and must pass before merging.

---

## Reporting Bugs & Feature Requests

Use [GitHub Issues](https://github.com/tui-project/tui/issues) for both.

**Bug reports** — include:

- tui version (visible on the About page)
- Steps to reproduce
- What you expected vs. what happened
- Relevant log output from `config/logs/server.log`

**Feature requests** — describe the use case, not just the desired UI change. Explain what problem you're trying to solve.

---

## Attributions

tui is built on top of these open-source projects:

<table>
  <tr>
    <td align="center" width="120">
      <a href="https://nuxt.com"><img src="https://github.com/nuxt.png?size=60" width="60" alt="Nuxt" /><br /><sub><b>Nuxt</b></sub></a><br /><sub>MIT</sub>
    </td>
    <td align="center" width="120">
      <a href="https://ui.nuxt.com"><img src="https://github.com/nuxt.png?size=60" width="60" alt="Nuxt UI" /><br /><sub><b>Nuxt UI</b></sub></a><br /><sub>MIT</sub>
    </td>
    <td align="center" width="120">
      <a href="https://vuejs.org"><img src="https://github.com/vuejs.png?size=60" width="60" alt="Vue" /><br /><sub><b>Vue</b></sub></a><br /><sub>MIT</sub>
    </td>
    <td align="center" width="120">
      <a href="https://tailwindcss.com"><img src="https://github.com/tailwindlabs.png?size=60" width="60" alt="Tailwind CSS" /><br /><sub><b>Tailwind CSS</b></sub></a><br /><sub>MIT</sub>
    </td>
    <td align="center" width="120">
      <a href="https://zod.dev"><img src="https://zod.dev/_next/image?url=%2Flogo%2Flogo-glow.png&w=256&q=100" width="60" alt="Zod" /><br /><sub><b>Zod</b></sub></a><br /><sub>MIT</sub>
    </td>
    <td align="center" width="120">
      <a href="https://github.com/seald/nedb"><img src="https://github.com/seald.png?size=60" width="60" alt="NeDB" /><br /><sub><b>NeDB</b></sub></a><br /><sub>MIT</sub>
    </td>
    <td align="center" width="120">
      <a href="https://github.com/webtorrent/create-torrent"><img src="https://github.com/webtorrent.png?size=60" width="60" alt="create-torrent" /><br /><sub><b>create-torrent</b></sub></a><br /><sub>MIT</sub>
    </td>
    <td align="center" width="120">
      <a href="https://github.com/webtorrent/parse-torrent"><img src="https://github.com/webtorrent.png?size=60" width="60" alt="parse-torrent" /><br /><sub><b>parse-torrent</b></sub></a><br /><sub>MIT</sub>
    </td>
    <td align="center" width="120">
      <a href="https://github.com/JiLiZART/BBob"><img src="https://github.com/JiLiZART.png?size=60" width="60" alt="BBob" /><br /><sub><b>BBob</b></sub></a><br /><sub>MIT</sub>
    </td>
    <td align="center" width="120">
      <a href="https://github.com/unjs/consola"><img src="https://github.com/unjs.png?size=60" width="60" alt="consola" /><br /><sub><b>consola</b></sub></a><br /><sub>MIT</sub>
    </td>
  </tr>
</table>

<table>
  <tr>
    <td align="center" width="120">
      <a href="https://www.themoviedb.org"><img src="https://cdn.simpleicons.org/themoviedatabase" width="60" alt="TMDB" /><br /><sub><b>TMDB</b></sub></a>
    </td>
    <td align="center" width="120">
      <a href="https://thetvdb.com"><img src="https://thetvdb.com/images/logo.svg" width="60" alt="TheTVDB" /><br /><sub><b>TheTVDB</b></sub></a>
    </td>
    <td align="center" width="120">
      <a href="https://ffmpeg.org"><img src="https://github.com/FFmpeg.png?size=60" width="60" alt="FFmpeg" /><br /><sub><b>FFmpeg</b></sub></a>
    </td>
    <td align="center" width="120">
      <a href="https://mediaarea.net/en/MediaInfo"><img src="https://mediaarea.net/images/7eea6c8-339d5d7.png" width="60" alt="MediaInfo" /><br /><sub><b>MediaInfo</b></sub></a>
    </td>
  </tr>
</table>

---

## License

tui is released under the [GNU General Public License v3.0](./LICENSE).
