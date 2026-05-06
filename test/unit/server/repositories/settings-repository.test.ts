import { beforeEach, describe, expect, it, vi } from 'vitest'

let storedSettings: Record<string, unknown> | null = null

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    storedSettings = null
})

async function loadRepository() {
    vi.doMock('../../../../server/utils/db', () => ({
        settingsCollection: {
            findOneAsync: vi.fn(async () => storedSettings),
            updateAsync: vi.fn(async (_query, settings) => {
                storedSettings = settings
            }),
        },
    }))

    return import('../../../../server/repositories/settings-repository')
}

describe('settings repository', () => {
    it('returns empty settings before settings are saved', async () => {
        const { getSettings } = await loadRepository()
        await expect(getSettings()).resolves.toMatchObject({
            id: 'app-settings',
            mediaPaths: [],
            tmdbApiKey: '',
        })
    })

    it('saves and returns settings', async () => {
        const { getSettings, saveSettings } = await loadRepository()
        await saveSettings({
            mediaPaths: ['/media/a', '/media/b'],
            tmdbApiKey: 'abc',
            imageHostProviders: ['imgbb'],
            ffmpegPath: '',
            ffprobePath: '',
            movieScreenshotCount: 6,
            tvEpisodeScreenshotCount: 1,
            imgbbApiKey: '',
        })

        await expect(getSettings()).resolves.toMatchObject({
            id: 'app-settings',
            mediaPaths: ['/media/a', '/media/b'],
            tmdbApiKey: 'abc',
        })
    })

    it('overwrites settings on save', async () => {
        const { getSettings, saveSettings } = await loadRepository()
        await saveSettings({
            mediaPaths: ['/media/old'],
            tmdbApiKey: 'old',
            imageHostProviders: [],
            ffmpegPath: '',
            ffprobePath: '',
            movieScreenshotCount: 6,
            tvEpisodeScreenshotCount: 1,
            imgbbApiKey: '',
        })
        await saveSettings({
            mediaPaths: ['/media/new'],
            tmdbApiKey: 'new',
            imageHostProviders: ['imgbb'],
            ffmpegPath: '',
            ffprobePath: '',
            movieScreenshotCount: 6,
            tvEpisodeScreenshotCount: 1,
            imgbbApiKey: '',
        })

        await expect(getSettings()).resolves.toMatchObject({
            id: 'app-settings',
            mediaPaths: ['/media/new'],
            tmdbApiKey: 'new',
        })
    })
})
