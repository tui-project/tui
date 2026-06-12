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
const findDuplicatesMock = vi.fn()
const createTrackerService = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('getRouterParam', getRouterParam)
    getRouterParam.mockReturnValue('ATH')
    createTrackerService.mockResolvedValue({ findDuplicates: findDuplicatesMock })
})

async function loadHandler() {
    vi.doMock('h3', () => ({ createError, readBody, getRouterParam }))
    vi.doMock('../../../../server/utils/logger', () => ({ logger }))
    vi.doMock('../../../../server/services/tracker/tracker-factory', () => ({ createTrackerService }))

    const { default: handler } = await import('../../../../server/api/tracker/[trackerCode]/duplicates.post')
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

describe('POST /api/tracker/[trackerCode]/duplicates route handler', () => {
    it('returns duplicates from the tracker service', async () => {
        const duplicates = [{ name: 'Movie.2024.1080p.BluRay.ENCODE.x264-GROUP', url: 'https://tracker.example.com/torrents/1', trumpable: false }]
        readBody.mockResolvedValue({ metadata: validMetadata })
        findDuplicatesMock.mockResolvedValue(duplicates)
        const handler = await loadHandler()

        const result = await handler({} as never)

        expect(result).toEqual({ duplicates })
        expect(createTrackerService).toHaveBeenCalledWith('ATH')
        expect(findDuplicatesMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Movie' }))
        expect(logger.debug).toHaveBeenCalledWith('Tracker duplicates check request received.', { trackerCode: 'ATH' })
        expect(logger.debug).toHaveBeenCalledWith('Tracker duplicates checked.', { trackerCode: 'ATH', count: 1 })
    })

    it('returns an empty duplicates array when no duplicates are found', async () => {
        readBody.mockResolvedValue({ metadata: validMetadata })
        findDuplicatesMock.mockResolvedValue([])
        const handler = await loadHandler()

        const result = await handler({} as never)

        expect(result).toEqual({ duplicates: [] })
    })

    it('rejects a request with missing metadata', async () => {
        readBody.mockResolvedValue({})
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({ statusCode: 400, message: 'invalid_request' })
        expect(logger.warn).toHaveBeenCalledWith('Rejected tracker duplicates request with invalid payload.', expect.objectContaining({ trackerCode: 'ATH' }))
    })

    it('rejects a request with invalid metadata', async () => {
        readBody.mockResolvedValue({ metadata: { ...validMetadata, year: 'not-a-number' } })
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({ statusCode: 400, message: 'invalid_request' })
        expect(logger.warn).toHaveBeenCalledWith('Rejected tracker duplicates request with invalid payload.', expect.objectContaining({ trackerCode: 'ATH' }))
    })
})
