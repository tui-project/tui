import { mkdtempSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { $fetch, createPage, setup } from '@nuxt/test-utils/e2e'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const databaseDir = mkdtempSync(join(tmpdir(), 'tui-e2e-db-description-page-'))
const logDir = mkdtempSync(join(tmpdir(), 'tui-e2e-log-description-page-'))

process.env.DATABASE_DIR = databaseDir
process.env.LOG_DIR = logDir

afterAll(async () => {
    await Promise.all([rm(databaseDir, { recursive: true, force: true }), rm(logDir, { recursive: true, force: true })])
})

const metadata = {
    releaseGroup: 'GROUP',
    mediaType: 'movie',
    title: 'Movie',
    originalTitle: 'Movie',
    year: 2024,
    language: ['English'],
    originalLanguage: 'English',
    sourceType: 'ENCODE',
    source: 'BluRay',
    repack: 0,
    proper: 0,
    rerip: 0,
    hybrid: false,
    hi10p: false,
    hasEnglishSubs: false,
    resolution: '1080p',
    hdr: [],
    videoCodec: 'H.264',
    videoBitrate: 12_000_000,
    audioCodec: 'DTS-HD MA',
    audioChannels: '5.1',
    tmdbId: 1,
    imdbId: 'tt1234567',
}

describe('description preview security', async () => {
    await setup({ browser: true })

    beforeAll(async () => {
        await $fetch('/api/setup', {
            method: 'POST',
            body: { username: 'admin', password: 'Admin@123' },
        })
    })

    it('removes executable HTML when previewing without changing the description', { timeout: 60000 }, async () => {
        const page = await createPage('/login')
        await page.getByPlaceholder('enter your username').fill('admin')
        await page.getByPlaceholder('enter your password').fill('Admin@123')
        await page.getByRole('button', { name: 'Log in' }).click()
        await page.waitForURL('**/')

        // Keep the actual upload UI and renderer, without accessing media or external services.
        const responses: Record<string, unknown> = {
            '/api/paths': [{ path: '/media/Movie.2024.mkv', folder: false }],
            '/api/metadata': { filename: 'Movie.2024.mkv', metadata },
            '/api/settings': { trackers: [{ selected: true, code: 'ULCX', name: 'Upload.cx' }] },
            '/api/tracker/ULCX/title': { title: 'Movie 2024' },
            '/api/tracker/ULCX/rules': { violations: [] },
            '/api/tracker/ULCX/duplicates': { duplicates: [] },
        }
        await page.route('**/api/**', async (route) => {
            const response = responses[new URL(route.request().url()).pathname]
            if (response) await route.fulfill({ json: response })
            else await route.continue()
        })
        await page.getByRole('link', { name: 'Upload', exact: true }).click()
        await page.waitForURL('**/upload')
        await page.getByRole('combobox').click()
        await page.getByRole('option', { name: '/media/Movie.2024.mkv' }).click()
        await page.getByText('Selected file', { exact: true }).waitFor()
        await page.getByRole('button', { name: 'Next', exact: true }).click()
        await page.getByPlaceholder('Enter title', { exact: true }).waitFor()
        await page.getByRole('button', { name: 'Next', exact: true }).click()
        await page.getByRole('checkbox', { name: 'Upload.cx (ULCX)' }).check()
        await page.getByRole('button', { name: 'Next', exact: true }).click()
        await page.getByRole('heading', { name: 'Review Upload' }).waitFor()
        await page.getByRole('button', { name: 'Next', exact: true }).click()

        const description = `[b]Safe title[/b]<img src="/missing-preview-image" alt="Probe" onerror="document.title='injected'">[comparison=<img src=x onerror="document.title='injected'">]Body[/comparison]<a href="javascript:alert(1)">Unsafe link</a>`
        await page.getByRole('textbox', { name: 'Description' }).fill(description)
        const originalTitle = await page.title()
        await page.getByRole('button', { name: 'Preview', exact: true }).click()
        await page.getByText('Safe title', { exact: true }).waitFor()
        const image = page.getByRole('img', { name: 'Probe' })
        expect(await image.getAttribute('onerror')).toBeNull()
        expect(await page.getByText('Unsafe link', { exact: true }).getAttribute('href')).toBeNull()
        expect(await page.locator('[onerror]').count()).toBe(0)
        // Dispatch deterministically, regardless of whether the missing image has finished loading.
        await image.dispatchEvent('error')
        expect(await page.title()).toBe(originalTitle)

        await page.getByRole('button', { name: 'Write', exact: true }).click()
        expect(await page.getByRole('textbox', { name: 'Description' }).inputValue()).toBe(description)
        await page.close()
    })
})
