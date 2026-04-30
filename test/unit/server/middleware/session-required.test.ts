import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    warn: vi.fn(),
}

const deleteExpired = vi.fn<() => Promise<number>>()
const findActiveById = vi.fn<() => Promise<{ id: string } | null>>()
const sendRedirect = vi.fn((event: unknown, to: string) => ({ event, to }))
const getRequestURL = vi.fn<(event: unknown) => { pathname: string }>()
const getCookie = vi.fn<(event: unknown, name: string) => string | undefined>()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        getCookie,
        getRequestURL,
        sendRedirect,
    }))
    vi.doMock('../../../../server/repositories/session-repository', () => ({
        deleteExpired,
        findActiveById,
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

    it('redirects to login when session cookie is missing', async () => {
        getRequestURL.mockReturnValue({ pathname: '/' })
        getCookie.mockReturnValue(undefined)
        const event = { requestId: 'req-1' } as never
        const handler = await loadHandler()

        await expect(handler(event)).resolves.toEqual({ event, to: '/login' })
        expect(sendRedirect).toHaveBeenCalledWith(event, '/login')
    })

    it('redirects to login when session is not active', async () => {
        getRequestURL.mockReturnValue({ pathname: '/' })
        getCookie.mockReturnValue('session-1')
        findActiveById.mockResolvedValue(null)
        const event = { requestId: 'req-1' } as never
        const handler = await loadHandler()

        await expect(handler(event)).resolves.toEqual({ event, to: '/login' })
        expect(deleteExpired).toHaveBeenCalledTimes(1)
        expect(findActiveById).toHaveBeenCalledWith('session-1')
    })

    it('allows request with active session', async () => {
        getRequestURL.mockReturnValue({ pathname: '/' })
        getCookie.mockReturnValue('session-1')
        findActiveById.mockResolvedValue({ id: 'session-1' })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toBeUndefined()
        expect(deleteExpired).toHaveBeenCalledTimes(1)
        expect(sendRedirect).not.toHaveBeenCalled()
    })
})
