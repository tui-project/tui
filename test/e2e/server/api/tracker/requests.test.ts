import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-tracker-requests-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-tracker-requests-'))

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

const VALID_METADATA = {
    title: 'Test Movie',
    mediaType: 'movie',
    year: 2024,
    language: ['English'],
    originalLanguage: 'en',
    source: 'BluRay',
    sourceType: 'REMUX',
    repack: 0,
    proper: 0,
    rerip: 0,
    hybrid: false,
    hi10p: false,
    resolution: '1080p',
    videoCodec: 'AVC',
    audioCodec: 'TrueHD',
    audioChannels: '7.1',
    tmdbId: 12345,
    imdbId: 'tt1234567',
}

const VALID_TRACKER_ITEM = {
    code: 'ULCX',
    title: 'Test.Movie.2024.1080p.BluRay.REMUX.AVC.TrueHD.7.1-GROUP',
    titleModified: false,
    anonymous: false,
    modQueueOptIn: false,
}

describe('tracker upload requests', async () => {
    await setup()

    beforeAll(async () => {
        await $fetch('/api/setup', {
            method: 'POST',
            body: { username: 'admin', password: 'Admin@123' },
        })
    })

    it('GET returns an empty list when no requests exist', async () => {
        const cookie = await getSessionCookie()

        const requests = await $fetch('/api/tracker/requests', {
            headers: { cookie },
        })

        expect(requests).toEqual([])
    })

    it('GET returns 401 without a valid session', async () => {
        await expect(() => $fetch('/api/tracker/requests')).rejects.toMatchObject({ statusCode: 401 })
    })

    it('POST creates an upload request and returns 201 with pending status', async () => {
        const cookie = await getSessionCookie()

        const result = await $fetch('/api/tracker/requests', {
            method: 'POST',
            headers: { cookie },
            body: {
                filepath: '/some/movie.mkv',
                metadata: VALID_METADATA,
                description: '[b]A test upload[/b]',
                trackers: [VALID_TRACKER_ITEM],
            },
            ignoreResponseError: true,
        })

        expect(result).toMatchObject({
            id: expect.any(String),
            status: 'pending',
        })
    })

    it('POST request is retrievable via GET after creation', async () => {
        const cookie = await getSessionCookie()

        const created = await $fetch<{ id: string; status: string }>('/api/tracker/requests', {
            method: 'POST',
            headers: { cookie },
            body: {
                filepath: '/another/movie.mkv',
                metadata: VALID_METADATA,
                description: 'Another upload',
                trackers: [VALID_TRACKER_ITEM],
            },
            ignoreResponseError: true,
        })

        const requests = await $fetch<Array<{ id: string }>>('/api/tracker/requests', {
            headers: { cookie },
        })

        expect(requests.some((r) => r.id === created.id)).toBe(true)
    })

    it('GET respects the optional limit query parameter', async () => {
        const cookie = await getSessionCookie()

        const requests = await $fetch<unknown[]>('/api/tracker/requests', {
            query: { limit: 1 },
            headers: { cookie },
        })

        expect(requests.length).toBeLessThanOrEqual(1)
    })

    it('POST rejects an invalid body with 400', async () => {
        const cookie = await getSessionCookie()

        await expect(() =>
            $fetch('/api/tracker/requests', {
                method: 'POST',
                headers: { cookie },
                body: { filepath: '', trackers: [] },
            })
        ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('POST returns 401 without a valid session', async () => {
        await expect(() =>
            $fetch('/api/tracker/requests', {
                method: 'POST',
                body: {
                    filepath: '/movie.mkv',
                    metadata: VALID_METADATA,
                    description: '',
                    trackers: [VALID_TRACKER_ITEM],
                },
            })
        ).rejects.toMatchObject({ statusCode: 401 })
    })

    it('PATCH returns 404 for a non-existent request id', async () => {
        const cookie = await getSessionCookie()

        await expect(() =>
            $fetch('/api/tracker/requests/non-existent-id', {
                method: 'PATCH',
                headers: { cookie },
                body: { action: 'retry' },
            })
        ).rejects.toMatchObject({ statusCode: 404, data: { message: 'not_found' } })
    })

    it('PATCH resets a failed request to pending and returns the updated record', async () => {
        const cookie = await getSessionCookie()

        const created = await $fetch<{ id: string }>('/api/tracker/requests', {
            method: 'POST',
            headers: { cookie },
            body: {
                filepath: '/movie.mkv',
                metadata: VALID_METADATA,
                description: '',
                trackers: [VALID_TRACKER_ITEM],
            },
            ignoreResponseError: true,
        })

        // wait briefly for the async upload to fail (the file doesn't exist)
        await new Promise((resolve) => setTimeout(resolve, 500))

        const retried = await $fetch<{ id: string; status: string }>(`/api/tracker/requests/${created.id}`, {
            method: 'PATCH',
            headers: { cookie },
            body: { action: 'retry' },
        })

        expect(retried).toMatchObject({ id: created.id, status: 'pending' })
    })

    it('PATCH returns 401 without a valid session', async () => {
        await expect(() =>
            $fetch('/api/tracker/requests/some-id', {
                method: 'PATCH',
                body: { action: 'retry' },
            })
        ).rejects.toMatchObject({ statusCode: 401 })
    })
})
