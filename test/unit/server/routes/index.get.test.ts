import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
}

const sendRedirect = vi.fn((event: unknown, to: string) => ({ event, to }))

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        sendRedirect,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    const { default: handler } = await import('../../../../server/routes/index.get')
    return handler
}

describe('GET / route handler', () => {
    it('redirects to /login', async () => {
        const handler = await loadHandler()
        const event = { requestId: 'req-2' } as never

        await expect(handler(event)).resolves.toEqual({ event, to: '/login' })
        expect(sendRedirect).toHaveBeenCalledWith(event, '/login')
        expect(logger.trace).toHaveBeenCalledWith('Root route request received.')
        expect(logger.debug).toHaveBeenCalledWith('Setup completed. Redirecting user to login page.')
    })
})
