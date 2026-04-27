import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let dataDir: string

describe('server db', () => {
    beforeEach(async () => {
        vi.resetModules()
        dataDir = await mkdtemp(join(tmpdir(), 'tui-nedb-'))
        process.env.DATABASE_DIR = dataDir
    })

    afterEach(async () => {
        delete process.env.DATABASE_DIR
        await rm(dataDir, { recursive: true, force: true })
    })

    it('creates a users datastore in the configured data directory', async () => {
        const db = await import('../../server/utils/db')
        await db.usersDb.autoloadPromise

        const datafile = await stat(join(dataDir, 'users.db'))

        expect(datafile.isFile()).toBe(true)
    })

    it('persists user documents to the users datafile', async () => {
        const { usersDb } = await import('../../server/utils/db')
        await usersDb.autoloadPromise

        await usersDb.insertAsync({
            id: 'user-1',
            username: 'abc',
            passwordHash: 'hashed-password',
        })

        const users = await usersDb.findAsync({ username: 'abc' })
        const datafile = await readFile(join(dataDir, 'users.db'), 'utf8')

        expect(users).toHaveLength(1)
        expect(users[0]).toMatchObject({
            id: 'user-1',
            username: 'abc',
            passwordHash: 'hashed-password',
        })
        expect(datafile).toContain('"username":"abc"')
    })
})
