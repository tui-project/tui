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
const checkRulesMock = vi.fn()
const createTrackerService = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('getRouterParam', getRouterParam)
    getRouterParam.mockReturnValue('ULCX')
    createTrackerService.mockResolvedValue({ getTitle: vi.fn(), upload: vi.fn(), checkRules: checkRulesMock })
})

async function loadHandler() {
    vi.doMock('h3', () => ({ createError, readBody, getRouterParam }))
    vi.doMock('../../../../server/utils/logger', () => ({ logger }))
    vi.doMock('../../../../server/services/tracker/tracker-factory', () => ({ createTrackerService }))

    const { default: handler } = await import('../../../../server/api/tracker/[trackerCode]/rules.post')
    return handler
}

const validMetadata = {
    title: 'Movie',
    originalTitle: 'Movie',
    releaseGroup: 'YIFY',
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
    hdr: [],
    videoCodec: 'H.264',
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    tmdbId: 1,
    imdbId: 'tt1234567',
    hasEnglishSubs: false,
}

describe('POST /api/tracker/[trackerCode]/rules route handler', () => {
    it('returns violations from the tracker service', async () => {
        const violations = [{ rule: 'banned_release_group', message: 'Release group "YIFY" is banned on ULCX.' }]
        readBody.mockResolvedValue({ metadata: validMetadata })
        checkRulesMock.mockReturnValue(violations)
        const handler = await loadHandler()

        const result = await handler({} as never)

        expect(result).toEqual({ violations })
        expect(createTrackerService).toHaveBeenCalledWith('ULCX')
        expect(checkRulesMock).toHaveBeenCalledWith(expect.objectContaining({ releaseGroup: 'YIFY' }))
        expect(logger.debug).toHaveBeenCalledWith('Tracker rules check request received.', { trackerCode: 'ULCX' })
        expect(logger.debug).toHaveBeenCalledWith('Tracker rules checked.', { trackerCode: 'ULCX', violations })
    })

    it('returns an empty violations array when no rules are violated', async () => {
        readBody.mockResolvedValue({ metadata: { ...validMetadata, releaseGroup: 'BHDStudio' } })
        checkRulesMock.mockReturnValue([])
        const handler = await loadHandler()

        const result = await handler({} as never)

        expect(result).toEqual({ violations: [] })
    })

    it('rejects a request with missing metadata', async () => {
        readBody.mockResolvedValue({})
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({ statusCode: 400, message: 'invalid_request' })
        expect(logger.warn).toHaveBeenCalledWith('Rejected tracker rules request with invalid payload.', expect.objectContaining({ trackerCode: 'ULCX' }))
    })

    it('rejects a request with invalid metadata', async () => {
        readBody.mockResolvedValue({ metadata: { ...validMetadata, year: 'not-a-number' } })
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({ statusCode: 400, message: 'invalid_request' })
        expect(logger.warn).toHaveBeenCalledWith('Rejected tracker rules request with invalid payload.', expect.objectContaining({ trackerCode: 'ULCX' }))
    })
})
