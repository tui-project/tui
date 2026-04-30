import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-setup-api-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-setup-api-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true })])
})

describe('POST /api/setup', async () => {
    await setup()

    it('creates the first admin user and enables the login flow', async () => {
        const response = await $fetch('/api/setup', {
            method: 'POST',
            body: {
                username: 'admin',
                password: 'Admin@123',
            },
        })

        expect(response).toMatchObject({
            username: 'admin',
        })
        expect(response.id).toEqual(expect.any(String))

        const rootResponse = await $fetch('/', { responseType: 'text' })
        expect(rootResponse).toContain('Sign in to continue.')
    })

    it('rejects follow-up setup requests after setup is completed', async () => {
        await expect(() =>
            $fetch('/api/setup', {
                method: 'POST',
                body: {
                    username: 'second-admin',
                    password: 'Admin@123',
                },
            })
        ).rejects.toMatchObject({
            data: {
                message: 'setup_completed',
            },
            statusCode: 409,
        })
    })
})
