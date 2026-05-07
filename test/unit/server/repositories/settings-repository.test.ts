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
                storedSettings = settings as Record<string, unknown>
            }),
        },
    }))

    return import('../../../../server/repositories/settings-repository')
}

describe('settings repository', () => {
    it('returns default settings when nothing is stored', async () => {
        const { getSettings, DEFAULT_SETTINGS } = await loadRepository()

        await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS)
    })

    it('merges saved provider and tracker values into defaults by code', async () => {
        storedSettings = {
            id: 'app-settings',
            mediaPaths: ['/media/a'],
            tmdbApiKey: 'abc',
            imageHostProviders: [{ code: 'imgbb', selected: true, apiKey: 'imgbb-key' }],
            trackers: [{ code: 'ATH', selected: true, apiKey: 'ath-api', passKey: 'ath-pass' }],
        }
        const { getSettings } = await loadRepository()

        await expect(getSettings()).resolves.toMatchObject({
            id: 'app-settings',
            mediaPaths: ['/media/a'],
            tmdbApiKey: 'abc',
            imageHostProviders: expect.arrayContaining([{ code: 'imgbb', name: 'ImgBB', url: 'https://api.imgbb.com/1/upload?key=', selected: true, apiKey: 'imgbb-key' }]),
            trackers: expect.arrayContaining([{ code: 'ATH', name: 'Aither', selected: true, apiKey: 'ath-api', passKey: 'ath-pass', url: 'https://aither.cc' }]),
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
        })
    })

    it('saves only the whitelisted fields', async () => {
        const { saveSettings } = await loadRepository()

        await saveSettings({
            mediaPaths: ['/media/a'],
            tmdbApiKey: 'abc',
            imageHostProviders: [{ code: 'imgbb', name: 'ImgBB', url: 'https://example.com', selected: true, apiKey: 'imgbb-key' }],
            trackers: [{ code: 'FNP', name: 'FearNoPeer', url: 'https://fearnopeer.com', selected: true, apiKey: 'api-key', passKey: 'pass-key' }],
            ffmpegPath: '/custom/ffmpeg',
            ffprobePath: '/custom/ffprobe',
            movieScreenshotCount: 9,
            tvEpisodeScreenshotCount: 2,
        })

        expect(storedSettings).toEqual({
            id: 'app-settings',
            mediaPaths: ['/media/a'],
            tmdbApiKey: 'abc',
            imageHostProviders: [{ code: 'imgbb', selected: true, apiKey: 'imgbb-key' }],
            trackers: [{ code: 'FNP', selected: true, apiKey: 'api-key', passKey: 'pass-key' }],
            ffmpegPath: '/custom/ffmpeg',
            ffprobePath: '/custom/ffprobe',
            movieScreenshotCount: 9,
            tvEpisodeScreenshotCount: 2,
        })
    })
})
