import { describe, expect, it } from 'vitest'

describe('generic torrent cache repository', () => {
    it('returns null when a filepath has no cached torrent', async () => {
        const { findGenericTorrentCacheByFilepath } = await import('../../../../server/repositories/generic-torrent-cache-repository')

        await expect(findGenericTorrentCacheByFilepath('/missing/path')).resolves.toBeNull()
    })

    it('saves and retrieves cached generic torrents by filepath', async () => {
        const { findGenericTorrentCacheByFilepath, saveGenericTorrentCache } = await import('../../../../server/repositories/generic-torrent-cache-repository')

        await saveGenericTorrentCache({
            filepath: '/media/Movie.2024.1080p.mkv',
            genericTorrentPath: '/repo/config/torrents/movie.torrent',
        })

        await expect(findGenericTorrentCacheByFilepath('/media/Movie.2024.1080p.mkv')).resolves.toMatchObject({
            filepath: '/media/Movie.2024.1080p.mkv',
            genericTorrentPath: '/repo/config/torrents/movie.torrent',
        })
    })

    it('updates an existing cached torrent for the same filepath', async () => {
        const { findGenericTorrentCacheByFilepath, saveGenericTorrentCache } = await import('../../../../server/repositories/generic-torrent-cache-repository')

        await saveGenericTorrentCache({
            filepath: '/media/Movie.2024.1080p.mkv',
            genericTorrentPath: '/repo/config/torrents/old.torrent',
        })
        await saveGenericTorrentCache({
            filepath: '/media/Movie.2024.1080p.mkv',
            genericTorrentPath: '/repo/config/torrents/new.torrent',
        })

        await expect(findGenericTorrentCacheByFilepath('/media/Movie.2024.1080p.mkv')).resolves.toMatchObject({
            filepath: '/media/Movie.2024.1080p.mkv',
            genericTorrentPath: '/repo/config/torrents/new.torrent',
        })
    })
})
