import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-setup-post-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-setup-post-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true })])
})

describe('POST /api/setup', async () => {
    await setup()

    it('returns bad request when setup password does not meet strength rules', async () => {
        try {
            await $fetch('/api/setup', {
                method: 'POST',
                body: {
                    username: 'admin',
                    password: 'weakpassword',
                },
            })
            throw new Error('Expected request to fail with bad request.')
        } catch (error: unknown) {
            const apiError = error as {
                statusCode?: number
                data?: { code?: string; message?: string }
            }
            expect(apiError.statusCode).toBe(400)
            expect(apiError.data).toMatchObject({
                code: 'weak_password',
                message: 'password must include lower, upper, digit, and special characters',
            })
        }
    })

    it('creates setup user when payload is valid', async () => {
        await expect(
            $fetch('/api/setup', {
                method: 'POST',
                body: {
                    username: 'admin',
                    password: 'Admin@123',
                },
            })
        ).resolves.toMatchObject({
            username: 'admin',
        })
    })

    it('returns conflict when setup is already completed', async () => {
        try {
            await $fetch('/api/setup', {
                method: 'POST',
                body: {
                    username: 'admin-2',
                    password: 'Admin@123',
                },
            })
            throw new Error('Expected request to fail with conflict.')
        } catch (error: unknown) {
            const apiError = error as {
                statusCode?: number
                data?: { code?: string; message?: string }
            }
            expect(apiError.statusCode).toBe(409)
            expect(apiError.data).toMatchObject({
                code: 'setup_completed',
                message: 'setup already completed',
            })
        }
    })
})
