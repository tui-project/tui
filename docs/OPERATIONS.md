# Operating tui

[Back to the README](../README.md)

## Upgrade with Docker Compose

Read the [release notes](https://github.com/tui-project/tui/releases) for breaking changes and migration steps before upgrading. Back up your current configuration first, using the procedure below.

For a Compose service using the published image:

```bash
docker compose pull tui
docker compose up -d tui
docker compose logs --tail=100 tui
```

For reproducible deployments, replace `latest` with a published version tag, for example `ghcr.io/tui-project/tui:0.2.1`. Docker version tags do not include the `v` prefix used by Git tags. Change the pinned version when you want to upgrade.

The checked-in Compose file uses `build: .`. When building from source, check out the desired release and run `docker compose up -d --build tui` instead of pulling an image.

For a container created with `docker run`, pull the desired image, stop and remove the old container, then repeat the README's run command with the same config and media mounts. Removing the container does not remove these host directories.

## Back up and restore

The default `config` directory contains the database (including credentials and upload history), generated torrents, logs, and temporary screenshots. Protect backups as you would your tracker credentials. If you override storage locations, include those locations in your backup too.

Before backing up, let active uploads finish, then stop tui so database files remain consistent. Run these commands from the directory containing your Compose file:

```bash
docker compose stop tui
tar -czf "tui-config-$(date +%Y%m%d-%H%M%S).tar.gz" config
docker compose start tui
```

Copy the archive to your backup storage and record the image version used. Source media is a separate mount and is not included in this archive.

To restore:

1. Stop tui and preserve the current config directory separately.
2. Extract the chosen archive into an empty restore directory. It contains a top-level `config` folder.
3. Point the Compose config mount at that restored folder, or place it at the original config location. Ensure the process can write to it.
4. Start tui using the version recorded with the backup and the original media mounts. Sign in and check Settings and History before starting uploads.

For a rollback after an upgrade, use the matching pre-upgrade backup and image version. An older version may not understand data written by a newer version.

## Troubleshooting

| Symptom                                             | What to check                                                                                                                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Media browser is empty or a directory is missing    | Add a media path in Settings. With the README's Docker mount, use `/media`. Confirm the host directory exists and is mounted into the container.                                                                                                             |
| Permission denied while browsing or processing      | The tui process needs permission to read media and traverse parent directories, and to write to `config`. Check host ownership and mount permissions.                                                                                                        |
| Metadata lookup fails                               | Verify your TMDB key and outbound connectivity. Review the parsed title and metadata before proceeding. TVDB lookup uses Sonarr Skyhook and does not take a separate API key.                                                                                |
| Screenshot generation fails                         | Enable ImgBB and set its key. Check ffmpeg/ffprobe paths and that the media file is readable. The supplied image includes both binaries.                                                                                                                     |
| Tracker checks or upload fail                       | Verify the enabled tracker's API key and passkey, inspect its reported error, and review its current official upload rules. tui's rule checks are not exhaustive.                                                                                            |
| Upload succeeds but injection fails                 | Check connectivity from tui to QUI, the QUI API key, and QUI's cross-seed configuration and conditions. tui currently targets instance ID `1`. Review QUI logs and confirm seeding separately; do not repeat the tracker upload solely to address injection. |
| Dashboard or live logs stop updating behind a proxy | Check that the proxy permits long-lived server-sent event connections and does not buffer stream responses.                                                                                                                                                  |

Use the **Logs** page, `docker compose logs --tail=100 tui`, or `config/logs/server.log` to narrow down a failure. Before sharing logs, redact API keys, passkeys, session IDs, private download/announce URLs, and personal paths. Never attach database files or a complete config directory to an issue.

See [reporting guidance](../README.md#reporting-bugs--feature-requests) for the information to include in a bug report.
