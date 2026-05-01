import { describe, expect, it } from 'vitest'

describe('session repository', () => {
    it('creates a session record', async () => {
        const { createSession } = await import('../../../../server/repositories/session-repository')

        const session = await createSession({
            id: 'session-1',
            userId: 'user-1',
            expiresAt: '2030-01-01T00:00:00.000Z',
        })

        expect(session).toMatchObject({
            id: 'session-1',
            userId: 'user-1',
            expiresAt: '2030-01-01T00:00:00.000Z',
        })
    })

    it('finds an active session by id', async () => {
        const { createSession, findActiveSessionById } = await import('../../../../server/repositories/session-repository')

        await createSession({
            id: 'session-active',
            userId: 'user-1',
            expiresAt: '2030-01-01T00:00:00.000Z',
        })

        const session = await findActiveSessionById('session-active', '2029-01-01T00:00:00.000Z')
        expect(session).toMatchObject({
            id: 'session-active',
            userId: 'user-1',
        })
    })

    it('returns null for expired sessions', async () => {
        const { createSession, findActiveSessionById } = await import('../../../../server/repositories/session-repository')

        await createSession({
            id: 'session-expired',
            userId: 'user-1',
            expiresAt: '2020-01-01T00:00:00.000Z',
        })

        await expect(findActiveSessionById('session-expired', '2029-01-01T00:00:00.000Z')).resolves.toBeNull()
    })

    it('deletes expired sessions', async () => {
        const { createSession, deleteExpiredSessions, findActiveSessionById } = await import('../../../../server/repositories/session-repository')

        await createSession({
            id: 'session-expired',
            userId: 'user-1',
            expiresAt: '2020-01-01T00:00:00.000Z',
        })
        await createSession({
            id: 'session-active',
            userId: 'user-1',
            expiresAt: '2030-01-01T00:00:00.000Z',
        })

        await expect(deleteExpiredSessions('2029-01-01T00:00:00.000Z')).resolves.toBe(1)
        await expect(findActiveSessionById('session-expired', '2029-01-01T00:00:00.000Z')).resolves.toBeNull()
        await expect(findActiveSessionById('session-active', '2029-01-01T00:00:00.000Z')).resolves.toMatchObject({
            id: 'session-active',
        })
    })

    it('removes a session by id', async () => {
        const { createSession, findActiveSessionById, removeSessionById } = await import('../../../../server/repositories/session-repository')

        await createSession({
            id: 'session-remove-me',
            userId: 'user-1',
            expiresAt: '2030-01-01T00:00:00.000Z',
        })

        await expect(removeSessionById('session-remove-me')).resolves.toBe(1)
        await expect(findActiveSessionById('session-remove-me', '2029-01-01T00:00:00.000Z')).resolves.toBeNull()
    })
})
