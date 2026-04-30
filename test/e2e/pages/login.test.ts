import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, createPage, setup } from '@nuxt/test-utils/e2e'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-login-page-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-login-page-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true })])
})

describe('login page flow', async () => {
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

    it('logs in and redirects to the app home page', async () => {
        const page = await createPage('/login')

        await page.waitForSelector('text=Sign in to continue.')

        await page.getByPlaceholder('enter your username').fill('admin')
        await page.getByPlaceholder('enter your password').fill('Admin@123')
        await page.getByRole('button', { name: 'Log in' }).click()

        await page.waitForURL('**/')
        await page.waitForSelector('text=Home page')
    })

    it('redirects to login when opening app routes without a session', async () => {
        const page = await createPage('/')

        await page.waitForURL('**/login')
        await page.waitForSelector('text=Sign in to continue.')
    })

    it('shows an error for invalid credentials', async () => {
        const page = await createPage('/login')

        await page.getByPlaceholder('enter your username').fill('admin')
        await page.getByPlaceholder('enter your password').fill('Wrong@123')
        await page.getByRole('button', { name: 'Log in' }).click()

        await page.waitForSelector('text=Invalid username or password.')
        expect(page.url()).toMatch(/\/login$/)
    })
})
