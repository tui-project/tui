import { beforeEach, describe, expect, it, vi } from 'vitest'

const parseValidatedQuery = vi.fn()
const getLogo = vi.fn()
const logger = { trace: vi.fn(), warn: vi.fn() }

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('MEDIA_TYPES', { MOVIE: 'movie', TV: 'tv' })
})

async function loadHandler() {
    vi.doMock('../../../../server/services/tmdb', () => ({ getLogo }))
    vi.doMock('../../../../server/utils/logger', () => ({ createLogger: () => logger }))
    vi.doMock('../../../../server/utils/request-validator', () => ({ parseValidatedQuery }))
    return (await import('../../../../server/api/logo.get')).default
}

describe('GET /api/logo route handler', () => {
    it('returns the selected logo', async () => {
        parseValidatedQuery.mockReturnValue({ tmdbId: 42, mediaType: 'tv', originalLanguage: 'ja' })
        getLogo.mockResolvedValue('https://image.tmdb.org/t/p/original/logo.png')
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toBe('https://image.tmdb.org/t/p/original/logo.png')
        expect(getLogo).toHaveBeenCalledWith(42, 'tv', 'ja')
        expect(logger.trace).toHaveBeenCalledWith('Logo response ready.', { logo: 'https://image.tmdb.org/t/p/original/logo.png' })
    })

    it('logs invalid query details through the validator callback', async () => {
        parseValidatedQuery.mockImplementation((_event, _schema, options) => {
            options.onInvalid([{ message: 'invalid' }])
            throw new Error('invalid_request')
        })
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toThrow('invalid_request')
        expect(logger.warn).toHaveBeenCalledWith('Rejected logo request with invalid query.', { issues: [{ message: 'invalid' }] })
    })
})
