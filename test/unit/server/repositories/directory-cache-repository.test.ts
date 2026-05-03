import { describe, expect, it } from 'vitest'

describe('directory cache repository', () => {
    it('returns null when directory cache is missing', async () => {
        const { getDirectoryCache } = await import('../../../../server/repositories/directory-cache-repository')

        await expect(getDirectoryCache('/missing/path')).resolves.toBeNull()
    })

    it('saves and retrieves directory cache by path', async () => {
        const { getDirectoryCache, saveDirectoryCache } = await import('../../../../server/repositories/directory-cache-repository')

        await saveDirectoryCache({
            path: '/media',
            signature: '123:10',
            items: [
                { path: '/media/shows', folder: true },
                { path: '/media/movie.mkv', folder: false },
            ],
        })

        await expect(getDirectoryCache('/media')).resolves.toMatchObject({
            path: '/media',
            signature: '123:10',
            items: [
                { path: '/media/shows', folder: true },
                { path: '/media/movie.mkv', folder: false },
            ],
        })
    })

    it('upserts by path when saving existing directory cache', async () => {
        const { getDirectoryCache, saveDirectoryCache } = await import('../../../../server/repositories/directory-cache-repository')

        await saveDirectoryCache({
            path: '/media',
            signature: '123:10',
            items: [{ path: '/media/old', folder: false }],
        })

        await saveDirectoryCache({
            path: '/media',
            signature: '456:20',
            items: [{ path: '/media/new', folder: false }],
        })

        await expect(getDirectoryCache('/media')).resolves.toMatchObject({
            path: '/media',
            signature: '456:20',
            items: [{ path: '/media/new', folder: false }],
        })
    })
})
