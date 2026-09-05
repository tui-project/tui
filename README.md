# tui

A self-hosted web application for uploading media to private BitTorrent trackers. Select a file or folder, review auto-detected metadata, write a BBCode description, and submit — tui handles torrent creation, duplicate checking, rule validation, and uploading in the background.

> **Current state:** Early development (v0.2.1). The core upload flow is functional, with tracker-specific support for Aither (ATH) and Upload.cx (ULCX). Breaking changes between versions should be expected.

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
- [First Upload](#first-upload)
- [Configuration](#configuration)
- [Maintenance and Troubleshooting](#maintenance-and-troubleshooting)
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

[![tui upload review showing tracker checks](docs/screenshots/upload-review.png)](docs/screenshots/upload-review.png)

[View the full screenshot gallery](docs/SCREENSHOTS.md).

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

- Docker (recommended path) **or** Node.js 26 and pnpm 11.25.0 (the versions used by CI and the Docker build)

### Docker (recommended)

Replace `/path/to/media` with an existing media directory on your host, then run the latest image. The image includes ffmpeg, ffprobe, and mediainfo.

```bash
docker run -d \
  --name tui \
  -p 4000:4000 \
  -v "$(pwd)/config:/app/config" \
  -v /path/to/media:/media \
  --restart unless-stopped \
  ghcr.io/tui-project/tui:latest
```

Open `http://localhost:4000`, create your admin account, then follow [First upload](#first-upload).

### Docker Compose

Create a `docker-compose.yml`, replacing `/path/to/media` with an existing host directory:

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

The Compose file checked into this repository builds from source; the example above uses the published image. Then start it:

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

Continue with [First upload](#first-upload) after creating your account.

The production server listens on port `3000` by default. Set `HOST` and `PORT` environment variables to override it; the supplied Docker image uses port `4000`.

---

## First upload

1. Sign in after creating your admin account and open **Settings**.
2. Add a **Media path**. For the Docker examples above, enter `/media`, not the host path `/path/to/media`. tui browses files on its server; it does not transfer source media from your browser's computer.
3. Enter your **TMDB API Key**. Enable at least one tracker and enter its **API Key** and **Pass Key**.
4. Optionally enable **ImgBB** for generated screenshots, or **QUI** for torrent-client injection, and enter their credentials.
5. Save your settings, then open **Upload**. Select media, review metadata, select trackers, review pre-flight checks, and write the description before submitting.
6. Follow progress on the dashboard and review each tracker's result. Confirm that the torrent is present and seeding in your client after upload.

## Configuration

Application settings are managed through the **Settings** page in the UI. Nothing requires editing config files by hand.

| Setting                          | Description                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------ |
| **Media paths**                  | Directories the file browser exposes for source media selection                |
| **TMDB API key**                 | Required for automatic metadata lookup and language lists                      |
| **Trackers**                     | Enable supported trackers and enter their API keys and passkeys                |
| **Image host**                   | ImgBB API key for screenshot uploads                                           |
| **Torrent client**               | URL and API key for optional post-upload injection                             |
| **ffmpeg / ffprobe / mediainfo** | Binary names or custom paths (`ffmpeg`, `ffprobe`, and `mediainfo` use `PATH`) |
| **Screenshot counts**            | How many screenshots to capture for movies vs. episode packs                   |
| **Log level**                    | Runtime verbosity, reflected in both the log file and live viewer              |

### Integration credentials

| Integration             | Required for                                   | Credentials                                               |
| ----------------------- | ---------------------------------------------- | --------------------------------------------------------- |
| TMDB                    | Metadata lookup and language lists             | [TMDB API key](https://www.themoviedb.org/settings/api)   |
| Tracker                 | Uploading to each enabled tracker              | API key and passkey from your tracker account settings    |
| ImgBB                   | Optional screenshot generation and hosting     | [ImgBB API key](https://imgbb.com/api)                    |
| Qui                     | Optional torrent-client injection after upload | URL reachable from Tui and API key from your Qui instance |
| TVDB via Sonarr Skyhook | TV episode and special metadata lookup         | No separate TVDB API key needed                           |

### Qui injection limitations

Injection currently targets QUI instance ID `1`; the instance cannot be selected in Tui. Qui may reject torrent injection depending on its cross-seed configuration and whether the torrent meets its cross-seed conditions. A successful tracker upload does not guarantee successful injection into your torrent client. Check Qui's result and logs when injection fails, and confirm the torrent is seeding in the intended client.

From a Docker container, `localhost` refers to that container. Use a Qui address reachable from the Tui container.

---

## Maintenance and troubleshooting

See the [operations guide](docs/OPERATIONS.md) for upgrades, backups, restores, and common problems.

---

## Contributing

See the [contributing guide](docs/CONTRIBUTING.md) for development setup, test commands, coding conventions, and the pull request workflow. Code and dependency changes require `pnpm test`, `pnpm typecheck`, and `pnpm test:coverage` to pass.

---

## Reporting Bugs & Feature Requests

Use [GitHub Issues](https://github.com/tui-project/tui/issues) for both.

**Bug reports** — include:

- tui version (visible on the About page)
- Steps to reproduce
- What you expected vs. what happened
- Installation method (Docker image tag or local Node/pnpm versions), operating system, and affected tracker/integration
- Relevant log output from `config/logs/server.log`, with API keys, passkeys, session IDs, private download/announce URLs, and personal paths redacted

Do not attach your `config` directory or database files; settings contain credentials. See [SECURITY.md](SECURITY.md) for vulnerability reporting.

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
