import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    info: vi.fn(),
}

const getCookie = vi.fn<(event: unknown, name: string) => string | undefined>()
const deleteCookie = vi.fn()
const setResponseStatus = vi.fn()
const removeById = vi.fn<() => Promise<number>>()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        deleteCookie,
        getCookie,
        setResponseStatus,
    }))
    vi.doMock('../../../../server/repositories/session-repository', () => ({
        removeById,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    const { default: handler } = await import('../../../../server/api/logout.post')
    return handler
}

describe('POST /api/logout route handler', () => {
    it('removes session and clears cookie when session cookie exists', async () => {
        const event = {} as never
        getCookie.mockReturnValue('session-1')
        removeById.mockResolvedValue(1)

        const handler = await loadHandler()
        const response = await handler(event)

        expect(removeById).toHaveBeenCalledWith('session-1')
        expect(deleteCookie).toHaveBeenCalledWith(event, 'session_id', { path: '/' })
        expect(response).toBeUndefined()
        expect(setResponseStatus).toHaveBeenCalledWith(event, 204)
    })

    it('clears cookie and succeeds when session cookie is missing', async () => {
        const event = {} as never
        getCookie.mockReturnValue(undefined)

        const handler = await loadHandler()
        const response = await handler(event)

        expect(removeById).not.toHaveBeenCalled()
        expect(deleteCookie).toHaveBeenCalledWith(event, 'session_id', { path: '/' })
        expect(response).toBeUndefined()
        expect(setResponseStatus).toHaveBeenCalledWith(event, 204)
    })
})
