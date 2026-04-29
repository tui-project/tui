import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPage, setup } from '@nuxt/test-utils/e2e'
import { afterAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-setup-page-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-setup-page-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true })])
})

describe('setup page flow', async () => {
    await setup({
        browser: true,
    })

    it.each(['/', '/login', '/about'])('shows the setup page when setup is required from %s', async (route) => {
        const page = await createPage(route)

        await page.waitForSelector('text=Create your admin user account.')
        expect(page.url()).toMatch(/\/setup$/)
    })

    it('completes setup from the page and redirects to login', async () => {
        const page = await createPage('/setup')

        await page.waitForSelector('text=Create your admin user account.')

        await page.getByPlaceholder('choose a username').fill('admin')
        await page.getByPlaceholder('choose a password').fill('Admin@123')
        await page.getByRole('button', { name: 'Complete setup' }).click()

        await page.waitForURL('**/login')
        await page.waitForSelector('text=Login Page')
    })

    it('shows the completed setup message when submitting again', async () => {
        const page = await createPage('/setup')

        await page.getByPlaceholder('choose a username').fill('second-admin')
        await page.getByPlaceholder('choose a password').fill('Admin@123')
        await page.getByRole('button', { name: 'Complete setup' }).click()

        await page.waitForSelector('text=Setup is already completed. Please log in.')
        expect(page.url()).toMatch(/\/setup$/)
    })
})
