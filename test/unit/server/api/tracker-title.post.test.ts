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
const getRouterParam = vi.fn()
const getTitleMock = vi.fn()
const createTrackerService = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('getRouterParam', getRouterParam)
    getRouterParam.mockReturnValue('ULCX')
    createTrackerService.mockResolvedValue({ getTitle: getTitleMock, upload: vi.fn() })
})

async function loadHandler() {
    vi.doMock('h3', () => ({ createError, readBody, getRouterParam }))
    vi.doMock('../../../../server/utils/logger', () => ({ logger }))
    vi.doMock('../../../../server/services/tracker/tracker-factory', () => ({ createTrackerService }))

    const { default: handler } = await import('../../../../server/api/tracker/[trackerCode]/title.post')
    return handler
}

const validMetadata = {
    title: 'Movie',
    originalTitle: 'Movie',
    releaseGroup: 'GROUP',
    mediaType: 'movie',
    year: 2024,
    language: ['English'],
    originalLanguage: 'English',
    sourceType: 'ENCODE',
    source: 'BluRay',
    repack: 0,
    proper: 0,
    rerip: 0,
    hybrid: false,
    hi10p: false,
    resolution: '1080p',
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    tmdbId: 1,
    imdbId: 'tt1234567',
}

describe('POST /api/tracker/[trackerCode]/title route handler', () => {
    it('returns the tracker-specific generated title', async () => {
        readBody.mockResolvedValue({ metadata: validMetadata })
        getTitleMock.mockReturnValue('Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP')
        const handler = await loadHandler()

        const result = await handler({} as never)

        expect(result).toEqual({ title: 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP' })
        expect(createTrackerService).toHaveBeenCalledWith('ULCX')
        expect(getTitleMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Movie' }))
        expect(logger.debug).toHaveBeenCalledWith('Tracker title request received.', { trackerCode: 'ULCX' })
        expect(logger.debug).toHaveBeenCalledWith('Tracker title built.', { trackerCode: 'ULCX', title: 'Movie 2024 1080p BluRay ENCODE H.264 DTS-HD MA 5.1-GROUP' })
    })

    it('passes episodeEnd through to getTitle when present', async () => {
        const tvMetadata = {
            ...validMetadata,
            mediaType: 'tv',
            season: 0,
            episode: 3,
            episodeEnd: 8,
            specialName: 'The Selection',
            tvdbId: 311711,
        }
        readBody.mockResolvedValue({ metadata: tvMetadata })
        getTitleMock.mockReturnValue('The Good Place S00E03-08 The Selection 1080p AMZN WEB-DL DD+ 2.0 H.264-MRKT')
        const handler = await loadHandler()

        await handler({} as never)

        expect(getTitleMock).toHaveBeenCalledWith(expect.objectContaining({ episodeEnd: 8 }))
    })

    it('rejects a request with missing metadata', async () => {
        readBody.mockResolvedValue({})
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({ statusCode: 400, message: 'invalid_request' })
        expect(logger.warn).toHaveBeenCalledWith('Rejected tracker title request with invalid payload.', expect.objectContaining({ trackerCode: 'ULCX' }))
    })

    it('rejects a request with invalid metadata', async () => {
        readBody.mockResolvedValue({ metadata: { ...validMetadata, year: 'not-a-number' } })
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({ statusCode: 400, message: 'invalid_request' })
        expect(logger.warn).toHaveBeenCalledWith('Rejected tracker title request with invalid payload.', expect.objectContaining({ trackerCode: 'ULCX' }))
    })
})
