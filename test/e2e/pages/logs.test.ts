import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, createPage, fetch, setup } from '@nuxt/test-utils/e2e'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-logs-page-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-logs-page-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true })])
})

describe('logs page flow', async () => {
    await setup({ browser: true })

    beforeAll(async () => {
        await $fetch('/api/setup', {
            method: 'POST',
            body: { username: 'admin', password: 'Admin@123' },
        })
    })

    it('receives, filters, opens, and copies a live structured log entry', { timeout: 60000 }, async () => {
        const page = await createPage('/login')

        await page.getByPlaceholder('enter your username').fill('admin')
        await page.getByPlaceholder('enter your password').fill('Admin@123')
        await page.getByRole('button', { name: 'Log in' }).click()
        await page.waitForURL('**/')

        await page.goto(page.url().replace(/\/$/, '') + '/logs')
        await page.waitForURL('**/logs')
        await page.getByText('Live', { exact: true }).waitFor()

        const probePath = '/api/log-page-e2e-probe'
        await fetch(probePath)

        const search = page.getByPlaceholder('Text or key=value, e.g. trackerCode=ATH')
        await search.fill(`path=${probePath}`)

        const entry = page.getByRole('button', { name: 'View log details: Missing session. Redirecting request to login page.' })
        await entry.waitFor()
        await entry.click()

        const dialog = page.getByRole('dialog')
        await dialog.getByRole('heading', { name: 'Log entry details' }).waitFor()
        await expect(dialog.locator('pre').textContent()).resolves.toContain(`"path": "${probePath}"`)

        await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
        await dialog.getByRole('button', { name: 'Copy JSON' }).click()
        await dialog.getByRole('button', { name: 'Copied' }).waitFor()
    })
})
