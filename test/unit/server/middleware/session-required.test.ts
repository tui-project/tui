import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    trace: vi.fn(),
    warn: vi.fn(),
}

const deleteExpiredSessions = vi.fn<() => Promise<number>>()
const findActiveSessionById = vi.fn<() => Promise<{ id: string } | null>>()
const sendRedirect = vi.fn((event: unknown, to: string) => ({ event, to }))
const sendError = vi.fn((event: unknown, error: unknown) => ({ event, error }))
const createError = vi.fn((opts: { statusCode: number; message: string }) => opts)
const getRequestURL = vi.fn<(event: unknown) => { pathname: string }>()
const getCookie = vi.fn<(event: unknown, name: string) => string | undefined>()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        createError,
        getCookie,
        getRequestURL,
        sendError,
        sendRedirect,
    }))
    vi.doMock('../../../../server/repositories/session-repository', () => ({
        deleteExpiredSessions,
        findActiveSessionById,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    const { default: handler } = await import('../../../../server/middleware/session-required')
    return handler
}

describe('session required middleware', () => {
    it('bypasses login route', async () => {
        getRequestURL.mockReturnValue({ pathname: '/login' })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toBeUndefined()
        expect(getCookie).not.toHaveBeenCalled()
    })

    it('redirects to login when session cookie is missing on a page route', async () => {
        getRequestURL.mockReturnValue({ pathname: '/' })
        getCookie.mockReturnValue(undefined)
        const event = { requestId: 'req-1' } as never
        const handler = await loadHandler()

        await expect(handler(event)).resolves.toEqual({ event, to: '/login' })
        expect(sendRedirect).toHaveBeenCalledWith(event, '/login')
        expect(sendError).not.toHaveBeenCalled()
    })

    it('returns 401 when session cookie is missing on an API route', async () => {
        getRequestURL.mockReturnValue({ pathname: '/api/settings' })
        getCookie.mockReturnValue(undefined)
        const event = { requestId: 'req-1' } as never
        const handler = await loadHandler()

        await handler(event)

        expect(sendError).toHaveBeenCalledWith(event, { statusCode: 401, message: 'Unauthorized' })
        expect(sendRedirect).not.toHaveBeenCalled()
    })

    it('redirects to login when session is not active on a page route', async () => {
        getRequestURL.mockReturnValue({ pathname: '/' })
        getCookie.mockReturnValue('session-1')
        findActiveSessionById.mockResolvedValue(null)
        const event = { requestId: 'req-1' } as never
        const handler = await loadHandler()

        await expect(handler(event)).resolves.toEqual({ event, to: '/login' })
        expect(deleteExpiredSessions).toHaveBeenCalledTimes(1)
        expect(findActiveSessionById).toHaveBeenCalledWith('session-1')
        expect(sendError).not.toHaveBeenCalled()
    })

    it('returns 401 when session is not active on an API route', async () => {
        getRequestURL.mockReturnValue({ pathname: '/api/tracker/requests' })
        getCookie.mockReturnValue('session-1')
        findActiveSessionById.mockResolvedValue(null)
        const event = { requestId: 'req-1' } as never
        const handler = await loadHandler()

        await handler(event)

        expect(sendError).toHaveBeenCalledWith(event, { statusCode: 401, message: 'Unauthorized' })
        expect(sendRedirect).not.toHaveBeenCalled()
    })

    it('allows request with active session', async () => {
        getRequestURL.mockReturnValue({ pathname: '/' })
        getCookie.mockReturnValue('session-1')
        findActiveSessionById.mockResolvedValue({ id: 'session-1' })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toBeUndefined()
        expect(deleteExpiredSessions).toHaveBeenCalledTimes(1)
        expect(sendRedirect).not.toHaveBeenCalled()
        expect(sendError).not.toHaveBeenCalled()
    })
})
