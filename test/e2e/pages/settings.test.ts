import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, createPage, setup } from '@nuxt/test-utils/e2e'
import { afterAll, beforeAll, describe, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-settings-page-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-settings-page-'))
const mediaDir = mkdtempSync(join(tmpdir(), 'tui-e2e-media-settings-page-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true }), rm(mediaDir, { recursive: true, force: true })])
})

describe('settings page flow', async () => {
    await setup({
        browser: true,
    })

    beforeAll(async () => {
        await $fetch('/api/setup', {
            method: 'POST',
            body: {
                username: 'admin',
                password: 'Admin@123',
            },
        })
    })

    it('saves media paths and keeps them after reload', { timeout: 60000 }, async () => {
        const page = await createPage('/login')

        await page.waitForSelector('text=Sign in to continue.')
        await page.getByPlaceholder('enter your username').fill('admin')
        await page.getByPlaceholder('enter your password').fill('Admin@123')
        await page.getByRole('button', { name: 'Log in' }).click()
        await page.waitForURL('**/')
        await page.waitForSelector('text=Dashboard')

        await page.goto(page.url().replace(/\/$/, '') + '/settings')
        await page.waitForURL('**/settings')
        await page.waitForSelector('text=Configure settings for the application.')

        // UInputTags adds on Enter key press
        const mediaPathInput = page.getByPlaceholder('/path/to/media/folder')
        await mediaPathInput.fill(mediaDir)
        await mediaPathInput.press('Enter')
        await page.getByText(mediaDir).waitFor({ timeout: 10000 })

        // TMDB API key is required by the form schema before Save succeeds
        const tmdbInput = page.getByPlaceholder('Enter TMDB API key')
        await tmdbInput.fill('test-api-key-for-e2e')

        await page.getByRole('button', { name: 'Save' }).click()
        await page.waitForSelector('text=Settings successfully saved.', { timeout: 10000 })

        await page.reload()
        await page.getByText(mediaDir).waitFor({ timeout: 10000 })
    })
})
