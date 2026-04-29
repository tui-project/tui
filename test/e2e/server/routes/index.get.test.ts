import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-root-route-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-root-route-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true })])
})

describe('GET /', async () => {
    await setup()

    it('redirects to /setup when setup is required', async () => {
        const response = await $fetch('/', { responseType: 'text' })
        expect(response).toContain('Setup Page')
    })

    it('redirects non-setup routes to /setup when setup is required', async () => {
        const response = await $fetch('/login', { responseType: 'text' })
        expect(response).toContain('Setup Page')
    })

    it('redirects to /login when setup is completed', async () => {
        await $fetch('/api/setup', {
            method: 'POST',
            body: {
                username: 'admin',
                password: 'Admin@123',
            },
        })

        const response = await $fetch('/', { responseType: 'text' })
        expect(response).toContain('Login Page')
    })
})
