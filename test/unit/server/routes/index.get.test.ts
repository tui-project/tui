import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
}

const userCount = vi.fn<() => Promise<number>>()
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
    vi.doMock('../../../../server/repositories/user-repository', () => ({
        userCount,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    const { default: handler } = await import('../../../../server/routes/index.get')
    return handler
}

describe('GET / route handler', () => {
    it('redirects to /setup when setup is required', async () => {
        userCount.mockResolvedValue(0)

        const handler = await loadHandler()
        const event = { requestId: 'req-1' } as never

        await expect(handler(event)).resolves.toEqual({ event, to: '/setup' })
        expect(sendRedirect).toHaveBeenCalledWith(event, '/setup')
        expect(logger.trace).toHaveBeenCalledWith('Root route request received.')
        expect(logger.info).toHaveBeenCalledWith('Setup required. Redirecting user to setup page.')
        expect(logger.debug).not.toHaveBeenCalled()
    })

    it('redirects to /login when setup is completed', async () => {
        userCount.mockResolvedValue(1)

        const handler = await loadHandler()
        const event = { requestId: 'req-2' } as never

        await expect(handler(event)).resolves.toEqual({ event, to: '/login' })
        expect(sendRedirect).toHaveBeenCalledWith(event, '/login')
        expect(logger.trace).toHaveBeenCalledWith('Root route request received.')
        expect(logger.debug).toHaveBeenCalledWith('Setup completed. Redirecting user to login page.')
        expect(logger.info).not.toHaveBeenCalled()
    })
})
