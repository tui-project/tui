import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

describe('useMetadata composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
        vi.stubGlobal('ref', ref)
    })

    it('fetches metadata and updates loading state on success', async () => {
        const metadata = {
            fileName: 'movie.mkv',
            releaseGroup: 'RG',
            mediaType: 'movie',
            title: 'My Movie',
            originalTitle: 'My Movie',
            year: 2020,
            season: null,
            episode: null,
            language: ['en'],
            originalLanguage: 'en',
            sourceType: 'bluray',
            source: 'BD',
            service: 'local',
            repack: 0,
            proper: 0,
            cut: '',
            hybrid: false,
            resolution: '1080p',
            hdr: [],
            videoCodec: 'h264',
            audioCodec: 'aac',
            audioChannels: '2.0',
            audioMetadata: '',
            tmdbId: null,
            imdbId: '',
            tvdbId: null,
        }

        const fetchMock = vi.fn().mockResolvedValue(metadata)
        vi.stubGlobal('$fetch', fetchMock)

        const { useMetadata } = await import('../../../../app/composables/useMetadata')
        const { getMetadata, loading, error } = useMetadata()

        const result = await getMetadata('/some/path')

        expect(fetchMock).toHaveBeenCalledWith('/api/metadata', {
            method: 'GET',
            query: { path: '/some/path' },
        })
        expect(result).toEqual(metadata)
        expect(error.value).toBe(false)
        expect(loading.value).toBe(false)
    })

    it('sets error flag when fetch throws', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('boom'))
        vi.stubGlobal('$fetch', fetchMock)

        const { useMetadata } = await import('../../../../app/composables/useMetadata')
        const { getMetadata, loading, error } = useMetadata()

        const result = await getMetadata('/path')

        expect(result).toBeUndefined()
        expect(error.value).toBe(true)
        expect(loading.value).toBe(false)
    })

    it('prevents duplicate fetch while loading', async () => {
        let resolveFetch: ((val: unknown) => void) | undefined
        const fetchMock = vi.fn().mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveFetch = resolve
                })
        )
        vi.stubGlobal('$fetch', fetchMock)

        const { useMetadata } = await import('../../../../app/composables/useMetadata')
        const { getMetadata, loading } = useMetadata()

        const first = getMetadata('/dup')
        const second = await getMetadata('/dup')

        expect(loading.value).toBe(true)
        expect(second).toBeUndefined()
        expect(fetchMock).toHaveBeenCalledTimes(1)

        resolveFetch?.({ fileName: 'x' })
        await first

        expect(loading.value).toBe(false)
    })
})
