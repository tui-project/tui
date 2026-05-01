import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
}

const readBody = vi.fn<() => Promise<{ username?: string; password?: string }>>()
const createError = vi.fn((payload: unknown) => payload)
const setCookie = vi.fn()
const findUserByUsername = vi.fn<() => Promise<{ id: string; username: string; passwordHash: string } | null>>()
const createSession = vi.fn<() => Promise<{ id: string; userId: string; expiresAt: string }>>()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        createError,
        readBody,
        setCookie,
    }))
    vi.doMock('../../../../server/repositories/user-repository', () => ({
        findUserByUsername,
    }))
    vi.doMock('../../../../server/repositories/session-repository', () => ({
        createSession,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    const { default: handler } = await import('../../../../server/api/login.post')
    return handler
}

describe('POST /api/login route handler', () => {
    it('returns bad request for missing required fields', async () => {
        readBody.mockResolvedValue({ username: 'admin', password: '   ' })

        const handler = await loadHandler()
        const event = {} as never

        await expect(handler(event)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
    })

    it('returns unauthorized for invalid credentials', async () => {
        readBody.mockResolvedValue({ username: 'admin', password: 'bad' })
        findUserByUsername.mockResolvedValue(null)

        const handler = await loadHandler()
        const event = {} as never

        await expect(handler(event)).rejects.toEqual({
            statusCode: 401,
            message: 'invalid_credentials',
        })
    })

    it('returns unauthorized when stored password hash is malformed', async () => {
        readBody.mockResolvedValue({ username: 'admin', password: 'Admin@123' })
        findUserByUsername.mockResolvedValue({
            id: 'user-1',
            username: 'admin',
            passwordHash: 'malformed-hash',
        })

        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 401,
            message: 'invalid_credentials',
        })
    })

    it('returns unauthorized when stored hash length does not match derived key length', async () => {
        readBody.mockResolvedValue({ username: 'admin', password: 'Admin@123' })
        findUserByUsername.mockResolvedValue({
            id: 'user-1',
            username: 'admin',
            passwordHash: '00112233445566778899aabbccddeeff:abcd',
        })

        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 401,
            message: 'invalid_credentials',
        })
    })

    it('creates a one-hour session for valid credentials', async () => {
        readBody.mockResolvedValue({ username: 'admin', password: 'Admin@123' })
        findUserByUsername.mockResolvedValue({
            id: 'user-1',
            username: 'admin',
            passwordHash:
                '00112233445566778899aabbccddeeff:4a68d98b0cfe03a11f7d8af6f2aa0ae88e03e68fcd8ddf943a79d8dec33bbaa5bb8b01647a0a9417bd9d8dc1a318f1454eecc7cc642e363e8929fae3b7a8d9e4',
        })
        createSession.mockResolvedValue({
            id: 'session-1',
            userId: 'user-1',
            expiresAt: '2030-01-01T01:00:00.000Z',
        })

        const handler = await loadHandler()
        const response = await handler({} as never)

        expect(createSession).toHaveBeenCalledWith(
            expect.objectContaining({
                id: expect.any(String),
                userId: 'user-1',
                expiresAt: expect.any(String),
            })
        )
        expect(response).toEqual({
            sessionId: 'session-1',
            userId: 'user-1',
            expiresAt: '2030-01-01T01:00:00.000Z',
        })
        expect(setCookie).toHaveBeenCalledWith(
            {},
            'session_id',
            'session-1',
            expect.objectContaining({
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                expires: expect.any(Date),
            })
        )
    })
})
