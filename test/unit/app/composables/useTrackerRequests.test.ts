import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Metadata } from '../../../../app/components/upload/upload.types'
import type { TrackerRequest } from '../../../../app/composables/useTrackerRequests'

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

const buildRequest = (): TrackerRequest => ({
    id: 'req-1',
    filepath: '/media/movie.mkv',
    status: 'pending',
    trackers: [{ code: 'ULCX', title: 'Title', titleModified: false, anonymous: false }],
})

describe('useTrackerRequests composable', () => {
    beforeEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
    })

    describe('getRequests', () => {
        it('fetches requests with the given limit and returns them', async () => {
            const expected = [buildRequest()]
            const fetchMock = vi.fn().mockResolvedValue(expected)
            vi.stubGlobal('$fetch', fetchMock)

            const { useTrackerRequests } = await import('../../../../app/composables/useTrackerRequests')
            const { getRequests, loading, error } = useTrackerRequests()

            const result = await getRequests(6)

            expect(result).toEqual(expected)
            expect(fetchMock).toHaveBeenCalledWith('/api/tracker/requests', { query: { limit: 6 } })
            expect(loading.value).toBe(false)
            expect(error.value).toBe(false)
        })

        it('sets an error flag and returns null when the fetch fails', async () => {
            const fetchMock = vi.fn().mockRejectedValue(new Error('network error'))
            vi.stubGlobal('$fetch', fetchMock)

            const { useTrackerRequests } = await import('../../../../app/composables/useTrackerRequests')
            const { getRequests, loading, error } = useTrackerRequests()

            const result = await getRequests(6)

            expect(result).toBeNull()
            expect(loading.value).toBe(false)
            expect(error.value).toBe(true)
        })

        it('skips a fetch while another is already in progress', async () => {
            let resolveGet: ((value: TrackerRequest[]) => void) | undefined
            const fetchMock = vi.fn().mockImplementation(
                () =>
                    new Promise<TrackerRequest[]>((resolve) => {
                        resolveGet = () => resolve([buildRequest()])
                    })
            )
            vi.stubGlobal('$fetch', fetchMock)

            const { useTrackerRequests } = await import('../../../../app/composables/useTrackerRequests')
            const { getRequests, loading } = useTrackerRequests()

            const firstGet = getRequests(6)
            expect(loading.value).toBe(true)

            await expect(getRequests(6)).resolves.toBeNull()
            expect(fetchMock).toHaveBeenCalledTimes(1)

            resolveGet?.([buildRequest()])
            const result = await firstGet

            expect(result).toEqual([buildRequest()])
            expect(loading.value).toBe(false)
        })
    })

    describe('retryRequest', () => {
        it('calls the PATCH endpoint with action:retry', async () => {
            const fetchMock = vi.fn().mockResolvedValue(undefined)
            vi.stubGlobal('$fetch', fetchMock)

            const { useTrackerRequests } = await import('../../../../app/composables/useTrackerRequests')
            const { retryRequest, loading, error } = useTrackerRequests()

            await retryRequest('req-1')

            expect(fetchMock).toHaveBeenCalledWith('/api/tracker/requests/req-1', { method: 'PATCH', body: { action: 'retry' } })
            expect(loading.value).toBe(false)
            expect(error.value).toBe(false)
        })

        it('sets an error flag when the retry call fails', async () => {
            const fetchMock = vi.fn().mockRejectedValue(new Error('network error'))
            vi.stubGlobal('$fetch', fetchMock)

            const { useTrackerRequests } = await import('../../../../app/composables/useTrackerRequests')
            const { retryRequest, loading, error } = useTrackerRequests()

            await retryRequest('req-1')

            expect(loading.value).toBe(false)
            expect(error.value).toBe(true)
        })

        it('skips a retry while another operation is in progress', async () => {
            let resolveRetry: (() => void) | undefined
            const fetchMock = vi.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolveRetry = () => resolve(undefined)
                    })
            )
            vi.stubGlobal('$fetch', fetchMock)

            const { useTrackerRequests } = await import('../../../../app/composables/useTrackerRequests')
            const { retryRequest, loading } = useTrackerRequests()

            const first = retryRequest('req-1')
            expect(loading.value).toBe(true)

            await retryRequest('req-1')
            expect(fetchMock).toHaveBeenCalledTimes(1)

            resolveRetry?.()
            await first
            expect(loading.value).toBe(false)
        })
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
