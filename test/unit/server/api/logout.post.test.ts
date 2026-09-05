import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
}

const getCookie = vi.fn<(event: unknown, name: string) => string | undefined>()
const deleteCookie = vi.fn()
const setResponseStatus = vi.fn()
const removeSessionById = vi.fn<() => Promise<number>>()
const getSettings = vi.fn()

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
        removeSessionById,
    }))
    vi.doMock('../../../../server/repositories/settings-repository', () => ({
        getSettings,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        createLogger: () => logger,
    }))

    const { default: handler } = await import('../../../../server/api/logout.post')
    return handler
}

describe('POST /api/logout route handler', () => {
    it('removes session and clears cookie when session cookie exists', async () => {
        const event = {} as never
        getCookie.mockReturnValue('session-1')
        removeSessionById.mockResolvedValue(1)
        getSettings.mockResolvedValue({ secureSessionCookie: false })

        const handler = await loadHandler()
        const response = await handler(event)

        expect(removeSessionById).toHaveBeenCalledWith('session-1')
        expect(logger.info).toHaveBeenCalledWith('Logout succeeded and session removed.')
        expect(deleteCookie).toHaveBeenCalledWith(event, 'session_id', { path: '/', secure: false })
        expect(response).toBeUndefined()
        expect(setResponseStatus).toHaveBeenCalledWith(event, 204)
    })

    it('clears cookie and succeeds when session cookie is missing', async () => {
        const event = {} as never
        getCookie.mockReturnValue(undefined)
        getSettings.mockResolvedValue({ secureSessionCookie: true })

        const handler = await loadHandler()
        const response = await handler(event)

        expect(removeSessionById).not.toHaveBeenCalled()
        expect(deleteCookie).toHaveBeenCalledWith(event, 'session_id', { path: '/', secure: true })
        expect(response).toBeUndefined()
        expect(setResponseStatus).toHaveBeenCalledWith(event, 204)
    })
})
