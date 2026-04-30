import { describe, expect, it } from 'vitest'

describe('session repository', () => {
    it('creates a session record', async () => {
        const { create } = await import('../../../../server/repositories/session-repository')

        const session = await create({
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
        const { create, findActiveById } = await import('../../../../server/repositories/session-repository')

        await create({
            id: 'session-active',
            userId: 'user-1',
            expiresAt: '2030-01-01T00:00:00.000Z',
        })

        const session = await findActiveById('session-active', '2029-01-01T00:00:00.000Z')
        expect(session).toMatchObject({
            id: 'session-active',
            userId: 'user-1',
        })
    })

    it('returns null for expired sessions', async () => {
        const { create, findActiveById } = await import('../../../../server/repositories/session-repository')

        await create({
            id: 'session-expired',
            userId: 'user-1',
            expiresAt: '2020-01-01T00:00:00.000Z',
        })

        await expect(findActiveById('session-expired', '2029-01-01T00:00:00.000Z')).resolves.toBeNull()
    })

    it('deletes expired sessions', async () => {
        const { create, deleteExpired, findActiveById } = await import('../../../../server/repositories/session-repository')

        await create({
            id: 'session-expired',
            userId: 'user-1',
            expiresAt: '2020-01-01T00:00:00.000Z',
        })
        await create({
            id: 'session-active',
            userId: 'user-1',
            expiresAt: '2030-01-01T00:00:00.000Z',
        })

        await expect(deleteExpired('2029-01-01T00:00:00.000Z')).resolves.toBe(1)
        await expect(findActiveById('session-expired', '2029-01-01T00:00:00.000Z')).resolves.toBeNull()
        await expect(findActiveById('session-active', '2029-01-01T00:00:00.000Z')).resolves.toMatchObject({
            id: 'session-active',
        })
    })

    it('removes a session by id', async () => {
        const { create, findActiveById, removeById } = await import('../../../../server/repositories/session-repository')

        await create({
            id: 'session-remove-me',
            userId: 'user-1',
            expiresAt: '2030-01-01T00:00:00.000Z',
        })

        await expect(removeById('session-remove-me')).resolves.toBe(1)
        await expect(findActiveById('session-remove-me', '2029-01-01T00:00:00.000Z')).resolves.toBeNull()
    })
})
