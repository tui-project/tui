import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-login-api-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-login-api-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true })])
})

describe('POST /api/login', async () => {
    await setup()

    it('creates a one-hour session for valid credentials', async () => {
        await $fetch('/api/setup', {
            method: 'POST',
            body: {
                username: 'admin',
                password: 'Admin@123',
            },
        })

        const startedAt = Date.now()
        const response = await $fetch('/api/login', {
            method: 'POST',
            body: {
                username: 'admin',
                password: 'Admin@123',
            },
        })
        const expiresAt = Date.parse(response.expiresAt)

        expect(response).toMatchObject({
            userId: expect.any(String),
            sessionId: expect.any(String),
            expiresAt: expect.any(String),
        })
        expect(expiresAt - startedAt).toBeGreaterThanOrEqual(59 * 60 * 1000)
        expect(expiresAt - startedAt).toBeLessThanOrEqual(61 * 60 * 1000)
    })

    it('returns unauthorized for invalid credentials', async () => {
        await expect(() =>
            $fetch('/api/login', {
                method: 'POST',
                body: {
                    username: 'admin',
                    password: 'Wrong@123',
                },
            })
        ).rejects.toMatchObject({
            data: {
                message: 'invalid_credentials',
            },
            statusCode: 401,
        })
    })
})
