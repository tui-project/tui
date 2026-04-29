import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    info: vi.fn(),
}

const userCount = vi.fn<() => Promise<number>>()
const sendRedirect = vi.fn((event: unknown, to: string) => ({ event, to }))
const getRequestURL = vi.fn<(event: unknown) => { pathname: string }>()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        getRequestURL,
        sendRedirect,
    }))
    vi.doMock('../../../../server/repositories/user-repository', () => ({
        userCount,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    const { default: handler } = await import('../../../../server/middleware/setup-required')
    return handler
}

describe('setup required middleware', () => {
    it('bypasses setup page routes', async () => {
        getRequestURL.mockReturnValue({ pathname: '/setup' })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toBeUndefined()
        expect(userCount).not.toHaveBeenCalled()
        expect(sendRedirect).not.toHaveBeenCalled()
    })

    it('bypasses setup api routes', async () => {
        getRequestURL.mockReturnValue({ pathname: '/api/setup/status' })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toBeUndefined()
        expect(userCount).not.toHaveBeenCalled()
        expect(sendRedirect).not.toHaveBeenCalled()
    })

    it('redirects to /setup when setup is required', async () => {
        getRequestURL.mockReturnValue({ pathname: '/login' })
        userCount.mockResolvedValue(0)

        const event = { requestId: 'req-1' } as never
        const handler = await loadHandler()

        await expect(handler(event)).resolves.toEqual({ event, to: '/setup' })
        expect(sendRedirect).toHaveBeenCalledWith(event, '/setup')
        expect(logger.info).toHaveBeenCalledWith('Setup required. Redirecting request to setup page.', { path: '/login' })
    })

    it('does not redirect when setup is completed', async () => {
        getRequestURL.mockReturnValue({ pathname: '/login' })
        userCount.mockResolvedValue(1)

        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toBeUndefined()
        expect(sendRedirect).not.toHaveBeenCalled()
        expect(logger.info).not.toHaveBeenCalled()
    })
})
