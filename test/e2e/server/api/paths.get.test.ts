import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-paths-api-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-paths-api-'))
const mediaDir = mkdtempSync(join(tmpdir(), 'tui-e2e-media-paths-api-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true }), rm(mediaDir, { recursive: true, force: true })])
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

describe('GET /api/paths', async () => {
    await setup()

    beforeAll(async () => {
        await $fetch('/api/setup', {
            method: 'POST',
            body: { username: 'admin', password: 'Admin@123' },
        })
    })

    it('returns an empty list when no media paths are configured', async () => {
        const cookie = await getSessionCookie()

        const paths = await $fetch('/api/paths', { headers: { cookie } })

        expect(paths).toEqual([])
    })

    it('returns configured media root paths after settings are saved', async () => {
        const cookie = await getSessionCookie()

        const defaults = await $fetch<{
            imageHostProviders: unknown[]
            trackers: unknown[]
            torrentClients: unknown[]
        }>('/api/settings', { headers: { cookie } })

        await $fetch('/api/settings', {
            method: 'POST',
            headers: { cookie },
            body: {
                ...defaults,
                mediaPaths: [mediaDir],
                tmdbApiKey: 'test-key',
                movieScreenshotCount: 6,
                episodePackScreenshotCount: 1,
                logLevel: 3,
            },
        })

        const paths = await $fetch<Array<{ path: string; folder: boolean }>>('/api/paths', {
            headers: { cookie },
        })

        expect(paths).toEqual([{ path: mediaDir, folder: true }])
    })

    it('rejects a parent path that is outside the configured roots', async () => {
        const cookie = await getSessionCookie()

        await expect(() =>
            $fetch('/api/paths', {
                query: { parent: '/outside/any/root' },
                headers: { cookie },
            })
        ).rejects.toMatchObject({ statusCode: 400, data: { message: 'invalid_parent_path' } })
    })

    it('returns 401 without a valid session', async () => {
        await expect(() => $fetch('/api/paths')).rejects.toMatchObject({ statusCode: 401 })
    })
})
