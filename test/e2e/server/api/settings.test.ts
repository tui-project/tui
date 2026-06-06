import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-settings-api-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-settings-api-'))
const mediaDir = mkdtempSync(join(tmpdir(), 'tui-e2e-media-settings-api-'))

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

describe('GET and POST /api/settings', async () => {
    await setup()

    beforeAll(async () => {
        await $fetch('/api/setup', {
            method: 'POST',
            body: { username: 'admin', password: 'Admin@123' },
        })
    })

    it('GET returns default settings for a fresh install', async () => {
        const cookie = await getSessionCookie()

        const settings = await $fetch('/api/settings', {
            headers: { cookie },
        })

        expect(settings).toMatchObject({
            mediaPaths: [],
            tmdbApiKey: '',
            mediainfoPath: 'mediainfo',
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            episodePackScreenshotCount: 1,
            logLevel: 3,
        })
        expect(Array.isArray((settings as { imageHostProviders: unknown[] }).imageHostProviders)).toBe(true)
        expect(Array.isArray((settings as { trackers: unknown[] }).trackers)).toBe(true)
        expect(Array.isArray((settings as { torrentClients: unknown[] }).torrentClients)).toBe(true)
    })

    it('GET returns 401 without a valid session', async () => {
        await expect(() => $fetch('/api/settings')).rejects.toMatchObject({ statusCode: 401 })
    })

    it('POST saves settings and returns the updated values', async () => {
        const cookie = await getSessionCookie()

        const defaults = await $fetch<{
            imageHostProviders: unknown[]
            trackers: unknown[]
            torrentClients: unknown[]
        }>('/api/settings', { headers: { cookie } })

        const updated = await $fetch('/api/settings', {
            method: 'POST',
            headers: { cookie },
            body: {
                ...defaults,
                mediaPaths: [mediaDir],
                tmdbApiKey: 'test-api-key',
                movieScreenshotCount: 4,
                episodePackScreenshotCount: 2,
                logLevel: 2,
            },
        })

        expect(updated).toMatchObject({
            mediaPaths: [mediaDir],
            tmdbApiKey: 'test-api-key',
            movieScreenshotCount: 4,
            episodePackScreenshotCount: 2,
            logLevel: 2,
        })
    })

    it('POST persists settings and GET returns the saved values', async () => {
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
                tmdbApiKey: 'persisted-key',
                movieScreenshotCount: 3,
                episodePackScreenshotCount: 1,
                logLevel: 3,
            },
        })

        const fetched = await $fetch('/api/settings', { headers: { cookie } })

        expect(fetched).toMatchObject({
            mediaPaths: [mediaDir],
            tmdbApiKey: 'persisted-key',
            movieScreenshotCount: 3,
        })
    })

    it('POST rejects a media path that does not exist on disk', async () => {
        const cookie = await getSessionCookie()

        const defaults = await $fetch<{
            imageHostProviders: unknown[]
            trackers: unknown[]
            torrentClients: unknown[]
        }>('/api/settings', { headers: { cookie } })

        await expect(() =>
            $fetch('/api/settings', {
                method: 'POST',
                headers: { cookie },
                body: {
                    ...defaults,
                    mediaPaths: ['/this/path/does/not/exist'],
                    tmdbApiKey: 'k',
                    movieScreenshotCount: 1,
                    episodePackScreenshotCount: 1,
                    logLevel: 3,
                },
            })
        ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('POST returns 401 without a valid session', async () => {
        await expect(() =>
            $fetch('/api/settings', {
                method: 'POST',
                body: {
                    mediaPaths: [],
                    tmdbApiKey: '',
                    imageHostProviders: [],
                    trackers: [],
                    torrentClients: [],
                    mediainfoPath: 'mediainfo',
                    ffmpegPath: 'ffmpeg',
                    ffprobePath: 'ffprobe',
                    movieScreenshotCount: 6,
                    episodePackScreenshotCount: 1,
                    logLevel: 3,
                },
            })
        ).rejects.toMatchObject({ statusCode: 401 })
    })
})
