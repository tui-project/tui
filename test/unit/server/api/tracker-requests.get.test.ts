import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    warn: vi.fn(),
}

const findAllTrackerUploadRequests = vi.fn()
const parseValidatedQuery = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('../../../../server/repositories/tracker-request-repository', () => ({
        findAllTrackerUploadRequests,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({ logger }))
    vi.doMock('../../../../server/utils/request-validator', () => ({ parseValidatedQuery }))

    const { default: handler } = await import('../../../../server/api/tracker/requests.get')
    return handler
}

describe('GET /api/tracker/requests route handler', () => {
    it('returns recent upload requests for the given limit', async () => {
        parseValidatedQuery.mockReturnValue({ limit: 6 })
        findAllTrackerUploadRequests.mockResolvedValue([
            {
                id: 'upload-2',
                filepath: '/media/Show.S01E01.mkv',
                status: 'torrent_creation',
                trackerCodes: ['FNP'],
                torrentCreationProgress: 42,
                createdAt: new Date('2026-05-10T00:00:00.000Z'),
                updatedAt: new Date('2026-05-10T00:00:30.000Z'),
            },
        ])

        const handler = await loadHandler()
        const mockEvent = {}

        await expect(handler(mockEvent)).resolves.toEqual([
            {
                id: 'upload-2',
                filepath: '/media/Show.S01E01.mkv',
                status: 'torrent_creation',
                trackerCodes: ['FNP'],
                torrentCreationProgress: 42,
                failedTrackerCodes: undefined,
                createdAt: new Date('2026-05-10T00:00:00.000Z'),
                updatedAt: new Date('2026-05-10T00:00:30.000Z'),
            },
        ])
        expect(findAllTrackerUploadRequests).toHaveBeenCalledWith(6)
        expect(parseValidatedQuery).toHaveBeenCalledWith(mockEvent, expect.any(Object), {
            errorMessage: 'invalid_query',
            onInvalid: expect.any(Function),
        })
        expect(logger.debug).toHaveBeenCalledWith('Recent tracker upload requests received.')
    })

    it('logs a warning when the query parameters are invalid', async () => {
        const issues = [{ message: 'Expected number, received string' }]
        parseValidatedQuery.mockImplementation((_event, _schema, options: { onInvalid?: (issues: unknown[]) => void }) => {
            options.onInvalid?.(issues)
            throw new Error('invalid_query')
        })

        const handler = await loadHandler()

        await expect(handler({})).rejects.toThrow('invalid_query')
        expect(logger.warn).toHaveBeenCalledWith('Rejected tracker requests query with invalid parameters.', { issues })
    })

    it('passes undefined to the repository when limit is not provided', async () => {
        parseValidatedQuery.mockReturnValue({ limit: undefined })
        findAllTrackerUploadRequests.mockResolvedValue([])

        const handler = await loadHandler()

        await handler({})

        expect(findAllTrackerUploadRequests).toHaveBeenCalledWith(undefined)
    })
})
