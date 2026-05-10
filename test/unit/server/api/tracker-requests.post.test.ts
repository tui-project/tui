import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}
const readBody = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const setResponseStatus = vi.fn()
const createTrackerUploadRequest = vi.fn()
const findGenericTorrentCacheByFilepath = vi.fn()
const saveGenericTorrentCache = vi.fn()
const updateTrackerUploadRequestStatus = vi.fn()
const updateTrackerUploadRequestTorrentCreationProgress = vi.fn()
const createGenericTorrent = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('setResponseStatus', setResponseStatus)
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
        createTrackerUploadRequest,
        updateTrackerUploadRequestStatus,
        updateTrackerUploadRequestTorrentCreationProgress,
    }))
    vi.doMock('../../../../server/services/torrent', () => ({
        createGenericTorrent,
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
            repack: false,
            proper: false,
            cut: undefined,
            hybrid: false,
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
        trackerCodes: ['FNP'],
        ...overrides,
    }
}

async function flushPromises() {
    await Promise.resolve()
    await Promise.resolve()
}

describe('POST /api/tracker/requests route handler', () => {
    it('rejects invalid request payload', async () => {
        readBody.mockResolvedValue(buildRequest({ filepath: '   ', trackerCodes: [] }))
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
        createTrackerUploadRequest.mockResolvedValue({
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
        expect(createTrackerUploadRequest).toHaveBeenCalledWith({
            id: expect.any(String),
            description: 'Release description',
            filepath: '/media/Movie.2024.1080p.mkv',
            metadata: buildRequest().metadata,
            trackerCodes: ['FNP'],
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
        expect(logger.info).toHaveBeenLastCalledWith('Tracker upload request ready for tracker uploads.', {
            id: 'upload-1',
            filepath: '/media/Movie.2024.1080p.mkv',
            trackerCodes: ['FNP'],
            status: 'uploading',
            genericTorrentPath: '/repo/config/torrents/generic-1.torrent',
        })
    })

    it('reuses a cached generic torrent for matching filepath', async () => {
        readBody.mockResolvedValue(buildRequest())
        findGenericTorrentCacheByFilepath.mockResolvedValue({
            filepath: '/media/Movie.2024.1080p.mkv',
            genericTorrentPath: '/repo/config/torrents/cached.torrent',
        })
        createTrackerUploadRequest.mockResolvedValue({
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
            trackerCodes: ['FNP'],
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

    it('marks the request as failed when torrent creation fails', async () => {
        readBody.mockResolvedValue(buildRequest())
        findGenericTorrentCacheByFilepath.mockResolvedValue(null)
        createTrackerUploadRequest.mockResolvedValue({
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
        expect(logger.error).toHaveBeenCalledWith('Failed to create generic torrent for tracker upload request.', error, {
            id: 'upload-1',
            filepath: '/media/Movie.2024.1080p.mkv',
        })
    })
})
