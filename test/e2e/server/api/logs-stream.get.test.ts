import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-logs-stream-api-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-logs-stream-api-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true })])
})

describe('GET /api/logs/stream', async () => {
    await setup()

    beforeAll(async () => {
        await $fetch('/api/setup', {
            method: 'POST',
            body: { username: 'admin', password: 'Admin@123' },
        })
    })

    it('returns unauthorized without a valid session', async () => {
        const response = await fetch('/api/logs/stream')

        expect(response.status).toBe(401)
    })

    it('streams new structured log entries to an authenticated client', async () => {
        const cookie = await getSessionCookie()
        const response = await fetch('/api/logs/stream', { headers: { cookie } })

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toContain('text/event-stream')

        const probePath = '/api/log-stream-e2e-probe'
        const streamedEntry = readLogEntry(
            response,
            (entry) => entry.context !== null && typeof entry.context === 'object' && 'path' in entry.context && entry.context.path === probePath
        )

        await fetch(probePath)

        await expect(streamedEntry).resolves.toMatchObject({
            type: 'warn',
            scope: 'auth',
            msg: 'Missing session. Redirecting request to login page.',
            context: { path: probePath },
        })
    })
})

async function getSessionCookie() {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
    })
    const setCookie = response.headers.get('set-cookie') ?? ''
    const match = setCookie.match(/session_id=([^;]+)/)

    return match ? `session_id=${match[1]}` : ''
}

async function readLogEntry(response: Response, matches: (entry: LogEntry) => boolean) {
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
        while (true) {
            const { done, value } = await Promise.race([
                reader.read(),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for streamed log entry.')), 10000)),
            ])
            if (done) {
                throw new Error('Log stream closed before the expected entry arrived.')
            }

            buffer += decoder.decode(value, { stream: true })
            const events = buffer.split('\n\n')
            buffer = events.pop() ?? ''

            for (const event of events) {
                const data = event
                    .split('\n')
                    .find((line) => line.startsWith('data:'))
                    ?.slice(5)
                    .trim()
                if (data) {
                    const entry = JSON.parse(data) as LogEntry
                    if (matches(entry)) {
                        return entry
                    }
                }
            }
        }
    } finally {
        await reader.cancel()
    }
}
