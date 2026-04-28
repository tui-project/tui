import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-status-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-status-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true })])
})

describe('GET /api/setup/status', async () => {
    await setup()

    it('returns setupRequired as true when no user exists', async () => {
        await expect($fetch('/api/setup/status')).resolves.toEqual({
            setupRequired: true,
        })
    })

    it('returns setupRequired as false when a user exists', async () => {
        await $fetch('/api/setup', {
            method: 'POST',
            body: {
                username: 'admin',
                password: 'Admin@123',
            },
        })

        await expect($fetch('/api/setup/status')).resolves.toEqual({
            setupRequired: false,
        })
    })
})
