import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
}
const readBody = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const setResponseStatus = vi.fn()
const createTrackerUploadRequest = vi.fn()

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
    vi.doMock('../../../../server/repositories/tracker-upload-request-repository', () => ({
        createTrackerUploadRequest,
    }))

    const { default: handler } = await import('../../../../server/api/tracker/upload.post')
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

describe('POST /api/tracker/upload route handler', () => {
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
        expect(setResponseStatus).toHaveBeenCalledWith({}, 201)
        expect(createTrackerUploadRequest).toHaveBeenCalledWith({
            id: expect.any(String),
            description: 'Release description',
            filepath: '/media/Movie.2024.1080p.mkv',
            metadata: buildRequest().metadata,
            trackerCodes: ['FNP'],
            status: 'pending',
        })
        expect(logger.info).toHaveBeenCalledWith('Tracker upload request accepted.', {
            id: 'upload-1',
            filepath: '/media/Movie.2024.1080p.mkv',
            trackerCodes: ['FNP'],
            status: 'pending',
        })
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
})
