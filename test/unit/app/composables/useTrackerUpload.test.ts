import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Metadata } from '../../../../app/components/upload/upload.types'

const buildMetadata = (): Metadata => ({
    fileName: 'Movie.2024.1080p.mkv',
    releaseGroup: 'GROUP',
    mediaType: 'movie',
    title: 'Movie',
    originalTitle: 'Movie',
    year: 2024,
    season: null,
    episode: null,
    language: ['English'],
    originalLanguage: 'English',
    sourceType: 'WEB-DL',
    source: 'Web',
    service: '',
    repack: false,
    proper: false,
    cut: '',
    hybrid: false,
    resolution: '1080p',
    hdr: [],
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    audioMetadata: '',
    tmdbId: 1,
    imdbId: '',
    tvdbId: null,
})

describe('useTrackerUpload composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
    })

    it('removes null and empty-string metadata fields before upload', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true })
        vi.stubGlobal('$fetch', fetchMock)

        const { useTrackerUpload } = await import('../../../../app/composables/useTrackerUpload')
        const { uploadTorrent, loading, error } = useTrackerUpload()

        await uploadTorrent('/media/movie.mkv', buildMetadata(), 'Release description', ['FNP'])

        expect(fetchMock).toHaveBeenCalledWith('/api/tracker/upload', {
            method: 'POST',
            body: {
                filepath: '/media/movie.mkv',
                metadata: {
                    fileName: 'Movie.2024.1080p.mkv',
                    releaseGroup: 'GROUP',
                    mediaType: 'movie',
                    title: 'Movie',
                    originalTitle: 'Movie',
                    year: 2024,
                    language: ['English'],
                    originalLanguage: 'English',
                    sourceType: 'WEB-DL',
                    source: 'Web',
                    repack: false,
                    proper: false,
                    hybrid: false,
                    resolution: '1080p',
                    hdr: [],
                    videoCodec: 'H.264',
                    audioCodec: 'DTS-HD MA',
                    audioChannels: '5.1',
                    tmdbId: 1,
                },
                description: 'Release description',
                trackerCodes: ['FNP'],
            },
        })
        expect(loading.value).toBe(false)
        expect(error.value).toBe(false)
    })
})
