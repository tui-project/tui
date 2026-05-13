import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}
const readBody = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const setResponseStatus = vi.fn()
const saveTrackerUploadRequest = vi.fn()
const findGenericTorrentCacheByFilepath = vi.fn()
const saveGenericTorrentCache = vi.fn()
const updateTrackerUploadRequestStatus = vi.fn()
const updateTrackerUploadRequestTorrentCreationProgress = vi.fn()
const createGenericTorrent = vi.fn()
const createTrackerTorrent = vi.fn()
const getSettings = vi.fn()
const createTrackerService = vi.fn()
const resolveMediaFilePath = vi.fn()
const analyzeMediaFileAsText = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('setResponseStatus', setResponseStatus)
    getSettings.mockResolvedValue({ trackers: [] })
    createTrackerService.mockResolvedValue({ upload: vi.fn().mockResolvedValue(undefined) })
    resolveMediaFilePath.mockResolvedValue('/media/Movie.2024.1080p.mkv')
    analyzeMediaFileAsText.mockResolvedValue('mediainfo output')
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        createError,
        readBody,
        setResponseStatus,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))
    vi.doMock('../../../../server/repositories/generic-torrent-cache-repository', () => ({
        findGenericTorrentCacheByFilepath,
        saveGenericTorrentCache,
    }))
    vi.doMock('../../../../server/repositories/tracker-request-repository', () => ({
        saveTrackerUploadRequest,
        updateTrackerUploadRequestStatus,
        updateTrackerUploadRequestTorrentCreationProgress,
    }))
    vi.doMock('../../../../server/repositories/settings-repository', () => ({
        getSettings,
    }))
    vi.doMock('../../../../server/services/torrent', () => ({
        createGenericTorrent,
        createTrackerTorrent,
    }))
    vi.doMock('../../../../server/services/tracker/tracker-factory', () => ({
        createTrackerService,
    }))
    vi.doMock('../../../../server/utils/file-system', () => ({
        resolveMediaFilePath,
    }))
    vi.doMock('../../../../server/services/mediainfo', () => ({
        analyzeMediaFileAsText,
    }))

    const { default: handler } = await import('../../../../server/api/tracker/requests.post')
    return handler
}

function buildRequest(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        filepath: '/media/Movie.2024.1080p.mkv',
        metadata: {
            releaseGroup: 'GROUP',
            mediaType: 'movie',
            title: 'Movie',
            originalTitle: 'Movie',
            year: 2024,
            season: undefined,
            episode: undefined,
            language: ['English'],
            originalLanguage: 'English',
            sourceType: 'ENCODE',
            source: 'BluRay',
            service: undefined,
            repack: 0,
            proper: 0,
            rerip: false,
            threeD: false,
            cut: undefined,
            ratio: undefined,
            hybrid: false,
            hi10p: false,
            resolution: '1080p',
            hdr: [],
            videoCodec: 'H.264',
            audioCodec: 'DTS-HD MA',
            audioChannels: '5.1',
            audioMetadata: undefined,
            tmdbId: 1,
            imdbId: 'tt1234567',
            tvdbId: undefined,
        },
        description: 'Release description',
        trackers: [{ code: 'ULCX', title: 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP', titleModified: false, anonymous: false }],
        ...overrides,
    }
}

async function flushPromises() {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve()
    }
}

describe('POST /api/tracker/requests route handler', () => {
    it('rejects invalid request payload', async () => {
        readBody.mockResolvedValue(buildRequest({ filepath: '   ', trackers: [] }))
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
        expect(logger.warn).toHaveBeenCalled()
    })

    it('accepts valid upload requests', async () => {
        readBody.mockResolvedValue(buildRequest())
        findGenericTorrentCacheByFilepath.mockResolvedValue(null)
        saveTrackerUploadRequest.mockResolvedValue({
            id: 'upload-1',
            ...buildRequest(),
            status: 'pending',
        })
        createGenericTorrent.mockImplementation(async ({ onProgress }: { onProgress: (progressPercent: number) => Promise<void> }) => {
            await onProgress(25)
            await onProgress(100)

            return {
                genericTorrentPath: '/repo/config/torrents/generic-1.torrent',
            }
        })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            id: 'upload-1',
            status: 'pending',
        })

        await flushPromises()

        expect(setResponseStatus).toHaveBeenCalledWith({}, 201)
        expect(saveTrackerUploadRequest).toHaveBeenCalledWith({
            id: expect.any(String),
            description: 'Release description',
            filepath: '/media/Movie.2024.1080p.mkv',
            metadata: buildRequest().metadata,
            trackers: [{ code: 'ULCX', title: 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP', titleModified: false, anonymous: false }],
            status: 'pending',
            torrentCreationProgress: 0,
        })
        expect(updateTrackerUploadRequestStatus).toHaveBeenNthCalledWith(1, 'upload-1', 'torrent_creation')
        expect(updateTrackerUploadRequestTorrentCreationProgress).toHaveBeenNthCalledWith(1, 'upload-1', 25)
        expect(updateTrackerUploadRequestTorrentCreationProgress).toHaveBeenNthCalledWith(2, 'upload-1', 100)
        expect(saveGenericTorrentCache).toHaveBeenCalledWith({
            filepath: '/media/Movie.2024.1080p.mkv',
            genericTorrentPath: '/repo/config/torrents/generic-1.torrent',
        })
        expect(updateTrackerUploadRequestStatus).toHaveBeenNthCalledWith(2, 'upload-1', 'uploading')
        expect(logger.info).toHaveBeenCalledWith('Tracker upload request uploading to trackers.', {
            id: 'upload-1',
            filepath: '/media/Movie.2024.1080p.mkv',
            trackerCodes: ['ULCX'],
            status: 'uploading',
            genericTorrentPath: '/repo/config/torrents/generic-1.torrent',
            trackerTorrentPaths: {},
        })
    })

    it('reuses a cached generic torrent for matching filepath', async () => {
        readBody.mockResolvedValue(buildRequest())
        findGenericTorrentCacheByFilepath.mockResolvedValue({
            filepath: '/media/Movie.2024.1080p.mkv',
            genericTorrentPath: '/repo/config/torrents/cached.torrent',
        })
        saveTrackerUploadRequest.mockResolvedValue({
            id: 'upload-1',
            ...buildRequest(),
            status: 'pending',
        })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            id: 'upload-1',
            status: 'pending',
        })

        await flushPromises()

        expect(createGenericTorrent).not.toHaveBeenCalled()
        expect(saveGenericTorrentCache).not.toHaveBeenCalled()
        expect(updateTrackerUploadRequestTorrentCreationProgress).not.toHaveBeenCalled()
        expect(logger.debug).toHaveBeenCalledWith('Reusing cached generic torrent for tracker upload request.', {
            id: 'upload-1',
            filepath: '/media/Movie.2024.1080p.mkv',
            trackerCodes: ['ULCX'],
            genericTorrentPath: '/repo/config/torrents/cached.torrent',
        })
        expect(updateTrackerUploadRequestStatus).toHaveBeenNthCalledWith(1, 'upload-1', 'torrent_creation')
        expect(updateTrackerUploadRequestStatus).toHaveBeenNthCalledWith(2, 'upload-1', 'uploading')
    })

    it('rejects tv metadata without season and tvdbId', async () => {
        readBody.mockResolvedValue(
            buildRequest({
                metadata: {
                    ...buildRequest().metadata,
                    mediaType: 'tv',
                    season: undefined,
                    tvdbId: undefined,
                },
            })
        )
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
        expect(logger.warn).toHaveBeenCalled()
    })

    it('rejects web metadata without a service', async () => {
        readBody.mockResolvedValue(
            buildRequest({
                metadata: {
                    ...buildRequest().metadata,
                    source: 'Web',
                    service: undefined,
                },
            })
        )
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
        expect(logger.warn).toHaveBeenCalled()
    })

    it('creates tracker-specific torrents when a configured tracker has a passKey', async () => {
        readBody.mockResolvedValue(buildRequest())
        findGenericTorrentCacheByFilepath.mockResolvedValue(null)
        saveTrackerUploadRequest.mockResolvedValue({
            id: 'upload-1',
            ...buildRequest(),
            status: 'pending',
        })
        createGenericTorrent.mockResolvedValue({
            genericTorrentPath: '/repo/config/torrents/generic-1.torrent',
        })
        getSettings.mockResolvedValue({
            trackers: [{ code: 'ULCX', url: 'https://ulcx.example.com', passKey: 'secret123' }],
        })
        createTrackerTorrent.mockResolvedValue({
            trackerTorrentPath: '/config/tmp/torrents/ULCX/Movie.2024.1080p.torrent',
        })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({ id: 'upload-1', status: 'pending' })
        await flushPromises()

        expect(createTrackerTorrent).toHaveBeenCalledWith({
            genericTorrentPath: '/repo/config/torrents/generic-1.torrent',
            trackerCode: 'ULCX',
            announceUrl: 'https://ulcx.example.com/announce/secret123',
            sourcePath: '/media/Movie.2024.1080p.mkv',
        })
        expect(updateTrackerUploadRequestStatus).toHaveBeenLastCalledWith('upload-1', 'success')
        expect(logger.info).toHaveBeenLastCalledWith('Tracker upload request completed successfully.', {
            id: 'upload-1',
            trackerCodes: ['ULCX'],
        })
    })

    it('passes tracker override title and anonymous flag to service.upload', async () => {
        const uploadMock = vi.fn().mockResolvedValue(undefined)
        createTrackerService.mockResolvedValue({ upload: uploadMock })
        readBody.mockResolvedValue(buildRequest({ trackers: [{ code: 'ULCX', title: 'Custom Title', titleModified: true, anonymous: true }] }))
        findGenericTorrentCacheByFilepath.mockResolvedValue(null)
        saveTrackerUploadRequest.mockResolvedValue({
            id: 'upload-1',
            ...buildRequest(),
            status: 'pending',
        })
        createGenericTorrent.mockResolvedValue({ genericTorrentPath: '/repo/config/torrents/generic-1.torrent' })
        getSettings.mockResolvedValue({
            trackers: [{ code: 'ULCX', url: 'https://ulcx.example.com', passKey: 'secret123' }],
        })
        createTrackerTorrent.mockResolvedValue({ trackerTorrentPath: '/config/tmp/torrents/ULCX/Movie.torrent' })
        const handler = await loadHandler()

        await handler({} as never)
        await flushPromises()

        expect(uploadMock).toHaveBeenCalledWith('/config/tmp/torrents/ULCX/Movie.torrent', expect.any(Object), expect.any(String), expect.any(String), {
            title: 'Custom Title',
            anonymous: true,
        })
    })

    it('passes tracker title and anonymous flag from tracker item to service.upload', async () => {
        const uploadMock = vi.fn().mockResolvedValue(undefined)
        createTrackerService.mockResolvedValue({ upload: uploadMock })
        readBody.mockResolvedValue(buildRequest())
        findGenericTorrentCacheByFilepath.mockResolvedValue(null)
        saveTrackerUploadRequest.mockResolvedValue({
            id: 'upload-1',
            ...buildRequest(),
            status: 'pending',
        })
        createGenericTorrent.mockResolvedValue({ genericTorrentPath: '/repo/config/torrents/generic-1.torrent' })
        getSettings.mockResolvedValue({
            trackers: [{ code: 'ULCX', url: 'https://ulcx.example.com', passKey: 'secret123' }],
        })
        createTrackerTorrent.mockResolvedValue({ trackerTorrentPath: '/config/tmp/torrents/ULCX/Movie.torrent' })
        const handler = await loadHandler()

        await handler({} as never)
        await flushPromises()

        expect(uploadMock).toHaveBeenCalledWith('/config/tmp/torrents/ULCX/Movie.torrent', expect.any(Object), expect.any(String), expect.any(String), {
            title: 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP',
            anonymous: false,
        })
    })

    it('rejects request with empty trackers array', async () => {
        readBody.mockResolvedValue(buildRequest({ trackers: [] }))
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
        expect(logger.warn).toHaveBeenCalled()
    })

    it('marks the request as partial_success when some trackers fail', async () => {
        const uploadMock = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('upload failed'))
        createTrackerService.mockResolvedValue({ upload: uploadMock })
        readBody.mockResolvedValue(
            buildRequest({
                trackers: [
                    { code: 'ULCX', title: 'Title', titleModified: false, anonymous: false },
                    { code: 'ATH', title: 'Title', titleModified: false, anonymous: false },
                ],
            })
        )
        findGenericTorrentCacheByFilepath.mockResolvedValue(null)
        saveTrackerUploadRequest.mockResolvedValue({
            id: 'upload-1',
            ...buildRequest(),
            status: 'pending',
        })
        createGenericTorrent.mockResolvedValue({ genericTorrentPath: '/repo/config/torrents/generic-1.torrent' })
        getSettings.mockResolvedValue({
            trackers: [
                { code: 'ULCX', url: 'https://ulcx.example.com', passKey: 'secret' },
                { code: 'ATH', url: 'https://ath.example.com', passKey: 'secret' },
            ],
        })
        createTrackerTorrent.mockResolvedValue({ trackerTorrentPath: '/config/tmp/torrents/tracker.torrent' })
        analyzeMediaFileAsText.mockResolvedValue('mediainfo output')
        const handler = await loadHandler()

        await handler({} as never)
        await flushPromises()
        await flushPromises()

        expect(updateTrackerUploadRequestStatus).toHaveBeenCalledWith('upload-1', 'partial_success', ['ATH'])
        expect(logger.warn).toHaveBeenCalledWith('Tracker upload request completed with partial success.', {
            id: 'upload-1',
            failedTrackerCodes: ['ATH'],
        })
    })

    it('marks the request as failed when all trackers fail to upload', async () => {
        const uploadError = new Error('upload failed')
        const uploadMock = vi.fn().mockRejectedValue(uploadError)
        createTrackerService.mockResolvedValue({ upload: uploadMock })
        readBody.mockResolvedValue(buildRequest())
        findGenericTorrentCacheByFilepath.mockResolvedValue(null)
        saveTrackerUploadRequest.mockResolvedValue({
            id: 'upload-1',
            ...buildRequest(),
            status: 'pending',
        })
        createGenericTorrent.mockResolvedValue({ genericTorrentPath: '/repo/config/torrents/generic-1.torrent' })
        getSettings.mockResolvedValue({
            trackers: [{ code: 'ULCX', url: 'https://ulcx.example.com', passKey: 'secret' }],
        })
        createTrackerTorrent.mockResolvedValue({ trackerTorrentPath: '/config/tmp/torrents/tracker.torrent' })
        analyzeMediaFileAsText.mockResolvedValue('mediainfo output')
        const handler = await loadHandler()

        await handler({} as never)
        await flushPromises()
        await flushPromises()

        expect(updateTrackerUploadRequestStatus).toHaveBeenCalledWith('upload-1', 'fail')
        expect(logger.error).toHaveBeenCalledWith('Tracker upload request failed for all trackers.', undefined, {
            id: 'upload-1',
            trackerCodes: ['ULCX'],
        })
        expect(logger.error).toHaveBeenCalledWith('Failed to upload to tracker.', uploadError, { trackerCode: 'ULCX' })
    })

    it('marks the request as failed when torrent creation fails', async () => {
        readBody.mockResolvedValue(buildRequest())
        findGenericTorrentCacheByFilepath.mockResolvedValue(null)
        saveTrackerUploadRequest.mockResolvedValue({
            id: 'upload-1',
            ...buildRequest(),
            status: 'pending',
        })
        const error = new Error('torrent failed')
        createGenericTorrent.mockRejectedValue(error)
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            id: 'upload-1',
            status: 'pending',
        })

        await flushPromises()

        expect(updateTrackerUploadRequestStatus).toHaveBeenNthCalledWith(1, 'upload-1', 'torrent_creation')
        expect(updateTrackerUploadRequestStatus).toHaveBeenCalledWith('upload-1', 'fail')
        expect(logger.error).toHaveBeenCalledWith('Failed to process tracker upload request.', error, {
            id: 'upload-1',
            filepath: '/media/Movie.2024.1080p.mkv',
        })
    })
})
