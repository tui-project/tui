import { mkdtempSync } from 'node:fs'
import { readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
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

    it('falls back to cwd config/database when DATABASE_DIR is not set', async () => {
        const originalCwd = process.cwd()
        const tempCwd = mkdtempSync(join(tmpdir(), 'tui-unit-cwd-'))

        try {
            delete process.env.DATABASE_DIR
            process.chdir(tempCwd)
            vi.resetModules()

            const db = await import('../../../../server/utils/db')
            await db.userCollection.autoloadPromise

            const datafile = await stat(join(tempCwd, 'config', 'database', 'users.db'))
            expect(datafile.isFile()).toBe(true)
        } finally {
            process.chdir(originalCwd)
            await rm(tempCwd, { recursive: true, force: true })
        }
    })
})
