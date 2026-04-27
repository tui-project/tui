import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDataDir } from '../../setupFile'

describe('server db', () => {
    it('creates a users datastore in the configured data directory', async () => {
        const db = await import('../../../../server/utils/db')
        await db.userCollection.autoloadPromise

        const datafile = await stat(join(getDataDir(), 'users.db'))

        expect(datafile.isFile()).toBe(true)
    })

    it('persists user documents to the users datafile', async () => {
        const { userCollection } = await import('../../../../server/utils/db')
        await userCollection.autoloadPromise

        await userCollection.insertAsync({
            id: 'user-1',
            username: 'abc',
            passwordHash: 'hashed-password',
        })

        const users = await userCollection.findAsync({ username: 'abc' })
        const datafile = await readFile(join(getDataDir(), 'users.db'), 'utf8')

        expect(users).toHaveLength(1)
        expect(users[0]).toMatchObject({
            id: 'user-1',
            username: 'abc',
            passwordHash: 'hashed-password',
        })
        expect(datafile).toContain('"username":"abc"')
    })
})
