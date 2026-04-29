import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
}

const readBody = vi.fn<() => Promise<{ username?: string; password?: string }>>()
const setResponseStatus = vi.fn()
const userCount = vi.fn<() => Promise<number>>()
const userCreate = vi.fn<() => Promise<{ id: string; username: string; passwordHash: string }>>()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        readBody,
        setResponseStatus,
    }))
    vi.doMock('../../../../server/repositories/user-repository', () => ({
        userCount,
        userCreate,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    const { default: handler } = await import('../../../../server/api/setup.post')
    return handler
}

describe('POST /api/setup route handler', () => {
    it('returns conflict when setup is already completed', async () => {
        userCount.mockResolvedValue(1)

        const handler = await loadHandler()
        const event = {} as never

        await expect(handler(event)).resolves.toEqual({
            code: 'setup_completed',
            message: 'setup already completed',
        })
        expect(setResponseStatus).toHaveBeenCalledWith(event, 409)
        expect(logger.warn).toHaveBeenCalled()
    })

    it('returns bad request when username or password is missing', async () => {
        userCount.mockResolvedValue(0)
        readBody.mockResolvedValue({ username: 'admin', password: '   ' })

        const handler = await loadHandler()
        const event = {} as never

        await expect(handler(event)).resolves.toEqual({
            code: 'invalid_request',
            message: 'username and password are required',
        })
        expect(setResponseStatus).toHaveBeenCalledWith(event, 400)
        expect(logger.warn).toHaveBeenCalled()
    })

    it('returns bad request when setup password is weak', async () => {
        userCount.mockResolvedValue(0)
        readBody.mockResolvedValue({ username: 'admin', password: 'weakpassword' })

        const handler = await loadHandler()
        const event = {} as never

        await expect(handler(event)).resolves.toEqual({
            code: 'weak_password',
            message: 'password must include lower, upper, digit, and special characters',
        })
        expect(setResponseStatus).toHaveBeenCalledWith(event, 400)
        expect(logger.warn).toHaveBeenCalled()
    })

    it('creates setup user when payload is valid', async () => {
        userCount.mockResolvedValue(0)
        readBody.mockResolvedValue({ username: '  admin  ', password: 'Admin@123' })
        userCreate.mockResolvedValue({
            id: 'generated-id',
            username: 'admin',
            passwordHash: 'hashed-value',
        })

        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            id: 'generated-id',
            username: 'admin',
        })
        expect(userCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                username: 'admin',
                id: expect.any(String),
                passwordHash: expect.stringMatching(/^[a-f0-9]+:[a-f0-9]+$/),
            })
        )
        expect(logger.info).toHaveBeenCalledWith('Setup completed and admin user created.', { username: 'admin' })
    })
})
