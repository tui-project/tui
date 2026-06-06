import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-logout-api-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-logout-api-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true })])
})

async function getSessionCookie(): Promise<string> {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
    })
    const setCookie = response.headers.get('set-cookie') ?? ''
    const match = setCookie.match(/session_id=([^;]+)/)
    return match ? `session_id=${match[1]}` : ''
}

describe('POST /api/logout', async () => {
    await setup()

    beforeAll(async () => {
        await $fetch('/api/setup', {
            method: 'POST',
            body: { username: 'admin', password: 'Admin@123' },
        })
    })

    it('returns 401 when called without a session cookie', async () => {
        const response = await fetch('/api/logout', { method: 'POST' })

        expect(response.status).toBe(401)
    })

    it('clears the session cookie and returns 204', async () => {
        const cookie = await getSessionCookie()

        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: { cookie },
        })

        expect(response.status).toBe(204)

        const setCookie = response.headers.get('set-cookie') ?? ''
        expect(setCookie).toContain('session_id=')
        expect(setCookie).toMatch(/expires=Thu, 01 Jan 1970|Max-Age=0/i)
    })

    it('invalidates the session so subsequent authenticated requests are rejected', async () => {
        const cookie = await getSessionCookie()

        await fetch('/api/logout', {
            method: 'POST',
            headers: { cookie },
        })

        await expect(() =>
            $fetch('/api/settings', {
                headers: { cookie },
            })
        ).rejects.toMatchObject({ statusCode: 401 })
    })
})
