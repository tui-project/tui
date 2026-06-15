import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    repack: 0,
    proper: 0,
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

describe('useTrackerRequests composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
    })

    describe('uploadTorrent', () => {
        it('removes null and empty-string metadata fields before upload', async () => {
            const fetchMock = vi.fn().mockResolvedValue(undefined)
            vi.stubGlobal('$fetch', fetchMock)

            const { useTrackerRequests } = await import('../../../../app/composables/useTrackerRequests')
            const { uploadTorrent, loading, error } = useTrackerRequests()

            const trackers = [{ code: 'ULCX', title: 'Title', titleModified: false, anonymous: false }]
            await expect(uploadTorrent('/media/movie.mkv', buildMetadata(), 'Release description', trackers)).resolves.toBeUndefined()

            expect(fetchMock).toHaveBeenCalledWith('/api/tracker/requests', {
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
                        repack: 0,
                        proper: 0,
                        hybrid: false,
                        resolution: '1080p',
                        hdr: [],
                        videoCodec: 'H.264',
                        audioCodec: 'DTS-HD MA',
                        audioChannels: '5.1',
                        tmdbId: 1,
                    },
                    description: 'Release description',
                    trackers,
                },
            })
            expect(loading.value).toBe(false)
            expect(error.value).toBe(false)
        })

        it('sets an error flag when the upload request fails', async () => {
            const fetchMock = vi.fn().mockRejectedValue(new Error('upload failed'))
            vi.stubGlobal('$fetch', fetchMock)

            const { useTrackerRequests } = await import('../../../../app/composables/useTrackerRequests')
            const { uploadTorrent, loading, error } = useTrackerRequests()

            await expect(
                uploadTorrent('/media/movie.mkv', buildMetadata(), undefined, [{ code: 'ULCX', title: 'Title', titleModified: false, anonymous: false }])
            ).resolves.toBeUndefined()

            expect(fetchMock).toHaveBeenCalledTimes(1)
            expect(loading.value).toBe(false)
            expect(error.value).toBe(true)
        })

        it('ignores duplicate submissions while an upload is already in progress', async () => {
            let resolveUpload: (() => void) | undefined
            const fetchMock = vi.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolveUpload = () => resolve(undefined)
                    })
            )
            vi.stubGlobal('$fetch', fetchMock)

            const { useTrackerRequests } = await import('../../../../app/composables/useTrackerRequests')
            const { uploadTorrent, loading, error } = useTrackerRequests()

            const firstUpload = uploadTorrent('/media/movie.mkv', buildMetadata(), undefined, [{ code: 'ULCX', title: 'Title', titleModified: false, anonymous: false }])
            expect(loading.value).toBe(true)

            await expect(
                uploadTorrent('/media/movie.mkv', buildMetadata(), undefined, [{ code: 'ULCX', title: 'Title', titleModified: false, anonymous: false }])
            ).resolves.toBeUndefined()
            expect(fetchMock).toHaveBeenCalledTimes(1)

            resolveUpload?.()
            await firstUpload

            expect(loading.value).toBe(false)
            expect(error.value).toBe(false)
        })
    })
})
