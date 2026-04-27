
import { describe, expect, it } from 'vitest'

describe('user repository', () => {
    it('creates and counts users', async () => {
        const { count, create } = await import('../../../../server/repositories/user-repository')

        await expect(count()).resolves.toBe(0)

        const user = await create({
            id: 'user-1',
            username: 'abc',
            passwordHash: 'hashed-password',
        })

        expect(user).toMatchObject({
            id: 'user-1',
            username: 'abc',
            passwordHash: 'hashed-password',
        })
        await expect(count()).resolves.toBe(1)
    })

    it('finds all users sorted by username', async () => {
        const { create, findAll } = await import('../../../../server/repositories/user-repository')

        await create({
            id: 'user-2',
            username: 'zara',
            passwordHash: 'hashed-password',
        })
        await create({
            id: 'user-1',
            username: 'anna',
            passwordHash: 'hashed-password',
        })

        const users = await findAll()

        expect(users.map((user) => user.username)).toEqual(['anna', 'zara'])
    })
})
