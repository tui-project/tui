import { describe, expect, it } from 'vitest'

describe('user repository', () => {
    it('creates and counts users', async () => {
        const { userCount, userCreate } = await import('../../../../server/repositories/user-repository')

        await expect(userCount()).resolves.toBe(0)

        const user = await userCreate({
            id: 'user-1',
            username: 'abc',
            passwordHash: 'hashed-password',
        })

        expect(user).toMatchObject({
            id: 'user-1',
            username: 'abc',
            passwordHash: 'hashed-password',
        })
        await expect(userCount()).resolves.toBe(1)
    })

    it('finds all users sorted by username', async () => {
        const { userCreate, userFindAll, findByUsername } = await import('../../../../server/repositories/user-repository')

        await userCreate({
            id: 'user-2',
            username: 'zara',
            passwordHash: 'hashed-password',
        })
        await userCreate({
            id: 'user-1',
            username: 'anna',
            passwordHash: 'hashed-password',
        })

        const users = await userFindAll()
        const anna = await findByUsername('anna')

        expect(users.map((user) => user.username)).toEqual(['anna', 'zara'])
        expect(anna).toMatchObject({
            id: 'user-1',
            username: 'anna',
        })
    })
})
