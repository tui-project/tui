import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    warn: vi.fn(),
}

const getTrackerRequests = vi.fn()
const getTrackerRequestsByGroup = vi.fn()
const parseValidatedQuery = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('../../../../server/repositories/tracker-request-repository', () => ({
        getTrackerRequests,
        getTrackerRequestsByGroup,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({ logger }))
    vi.doMock('../../../../server/utils/request-validator', () => ({ parseValidatedQuery }))

    const { default: handler } = await import('../../../../server/api/tracker/requests/index.get')
    return handler
}

describe('GET /api/tracker/requests route handler', () => {
    it('returns a paginated list of requests for the given page and size', async () => {
        parseValidatedQuery.mockReturnValue({ page: 1, size: 6, groupId: undefined, withGroupCount: false })
        getTrackerRequests.mockResolvedValue({
            items: [{ id: 'upload-2', filepath: '/media/Show.S01E01.mkv', groupId: 'group-1', status: 'torrent_creation', trackers: [] }],
            total: 1,
        })

        const handler = await loadHandler()
        const mockEvent = {}

        await expect(handler(mockEvent)).resolves.toEqual({
            items: [{ id: 'upload-2', filepath: '/media/Show.S01E01.mkv', groupId: 'group-1', status: 'torrent_creation', trackers: [] }],
            total: 1,
        })
        expect(getTrackerRequests).toHaveBeenCalledWith(1, 6, false)
        expect(getTrackerRequestsByGroup).not.toHaveBeenCalled()
        expect(parseValidatedQuery).toHaveBeenCalledWith(mockEvent, expect.any(Object), {
            errorMessage: 'invalid_query',
            onInvalid: expect.any(Function),
        })
    })

    it('forwards withGroupCount to the repository', async () => {
        parseValidatedQuery.mockReturnValue({ page: 2, size: 10, groupId: undefined, withGroupCount: true })
        getTrackerRequests.mockResolvedValue({
            items: [
                { id: 'a', groupId: 'group-a', trackers: [], groupCount: 3 },
                { id: 'b', groupId: 'group-b', trackers: [], groupCount: 1 },
            ],
            total: 2,
        })

        const handler = await loadHandler()

        await expect(handler({})).resolves.toEqual({
            items: [
                { id: 'a', groupId: 'group-a', trackers: [], groupCount: 3 },
                { id: 'b', groupId: 'group-b', trackers: [], groupCount: 1 },
            ],
            total: 2,
        })
        expect(getTrackerRequests).toHaveBeenCalledWith(2, 10, true)
    })

    it('returns the full group when a groupId is provided', async () => {
        parseValidatedQuery.mockReturnValue({ page: 1, size: 12, groupId: 'group-1', withGroupCount: false })
        getTrackerRequestsByGroup.mockResolvedValue([
            { id: 'upload-2', groupId: 'group-1', status: 'success', trackers: [] },
            { id: 'upload-1', groupId: 'group-1', status: 'fail', trackers: [] },
        ])

        const handler = await loadHandler()

        await expect(handler({})).resolves.toEqual({
            items: [
                { id: 'upload-2', groupId: 'group-1', status: 'success', trackers: [] },
                { id: 'upload-1', groupId: 'group-1', status: 'fail', trackers: [] },
            ],
            total: 2,
        })
        expect(getTrackerRequestsByGroup).toHaveBeenCalledWith('group-1')
        expect(getTrackerRequests).not.toHaveBeenCalled()
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

    it('uses default page and size when not provided in query', async () => {
        parseValidatedQuery.mockReturnValue({ page: 1, size: 12, groupId: undefined, withGroupCount: false })
        getTrackerRequests.mockResolvedValue({ items: [], total: 0 })

        const handler = await loadHandler()

        await handler({})

        expect(getTrackerRequests).toHaveBeenCalledWith(1, 12, false)
    })
})

it('transforms withGroupCount via the schema passed to parseValidatedQuery', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedSchema: any
    parseValidatedQuery.mockImplementation((_event: unknown, schema: unknown) => {
        capturedSchema = schema
        return { page: 1, size: 12, groupId: undefined, withGroupCount: false }
    })
    getTrackerRequests.mockResolvedValue({ items: [], total: 0 })

    const handler = await loadHandler()
    await handler({})

    expect(capturedSchema.parse({ withGroupCount: 'true' }).withGroupCount).toBe(true)
    expect(capturedSchema.parse({}).withGroupCount).toBe(false)
    expect(capturedSchema.parse({ withGroupCount: 'false' }).withGroupCount).toBe(false)
})
