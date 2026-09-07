import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getTrackerRequest, stat, warn } = vi.hoisted(() => ({ getTrackerRequest: vi.fn(), stat: vi.fn(), warn: vi.fn() }))
vi.mock('../../../../server/repositories/tracker-request-repository', () => ({ getTrackerRequest }))
vi.mock('node:fs/promises', () => ({ stat }))
vi.mock('../../../../server/utils/logger', () => ({ createLogger: () => ({ debug: vi.fn(), warn }) }))
vi.mock('h3', () => ({ createError: (payload: unknown) => payload, getRouterParam: () => 'request-1' }))

beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

describe('GET /api/tracker/requests/:id', () => {
    it.each([false, true])('returns reusable data for a folder: %s', async (folder) => {
        const request = { filepath: '/media/Movie', metadata: { title: 'Edited title' }, description: 'Saved description', status: 'success', trackers: [] }
        getTrackerRequest.mockResolvedValue(request)
        stat.mockResolvedValue({ isDirectory: () => folder })
        const { default: handler } = await import('../../../../server/api/tracker/requests/[id].get')
        expect(await handler({} as never)).toEqual({
            filepath: request.filepath,
            folder,
            filename: 'Movie',
            metadata: request.metadata,
            description: request.description,
        })
        expect(getTrackerRequest).toHaveBeenCalledWith('request-1')
        expect(stat).toHaveBeenCalledWith(request.filepath)
    })

    it('reports a missing request', async () => {
        getTrackerRequest.mockResolvedValue(null)
        const { default: handler } = await import('../../../../server/api/tracker/requests/[id].get')
        await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 404, message: 'not_found' })
        expect(warn).toHaveBeenCalled()
        expect(stat).not.toHaveBeenCalled()
    })

    it('reports an unavailable source', async () => {
        getTrackerRequest.mockResolvedValue({ filepath: '/missing' })
        stat.mockRejectedValue(new Error('ENOENT'))
        const { default: handler } = await import('../../../../server/api/tracker/requests/[id].get')
        await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 400, message: 'source_unavailable' })
        expect(warn).toHaveBeenCalled()
    })
})
