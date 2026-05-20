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

    it('merges saved torrent client values into defaults by code', async () => {
        storedSettings = {
            id: 'app-settings',
            torrentClients: [{ code: 'QUI', selected: true, url: 'http://localhost:7474', apiKey: 'qui-key' }],
        }
        const { getSettings } = await loadRepository()

        await expect(getSettings()).resolves.toMatchObject({
            torrentClients: [{ code: 'QUI', name: 'qui', selected: true, url: 'http://localhost:7474', apiKey: 'qui-key' }],
        })
    })

    it('returns default torrent clients when stored value is not an array', async () => {
        storedSettings = {
            id: 'app-settings',
            torrentClients: null,
        }
        const { getSettings, DEFAULT_SETTINGS } = await loadRepository()

        const result = await getSettings()
        expect(result.torrentClients).toEqual(DEFAULT_SETTINGS.torrentClients)
    })

    it('saves only the whitelisted fields', async () => {
        const { saveSettings } = await loadRepository()

        await saveSettings({
            mediaPaths: ['/media/a'],
            tmdbApiKey: 'abc',
            imageHostProviders: [{ code: 'imgbb', name: 'ImgBB', url: 'https://example.com', selected: true, apiKey: 'imgbb-key' }],
            trackers: [{ code: 'ULCX', name: 'Upload.cx', url: 'https://upload.cx', selected: true, apiKey: 'api-key', passKey: 'pass-key' }],
            torrentClients: [{ code: 'QUI', name: 'qui', selected: true, url: 'http://localhost:7474', apiKey: 'qui-key' }],
            ffmpegPath: '/custom/ffmpeg',
            ffprobePath: '/custom/ffprobe',
            movieScreenshotCount: 9,
            episodePackScreenshotCount: 2,
        })

        expect(storedSettings).toEqual({
            id: 'app-settings',
            mediaPaths: ['/media/a'],
            tmdbApiKey: 'abc',
            imageHostProviders: [{ code: 'imgbb', selected: true, apiKey: 'imgbb-key' }],
            trackers: [{ code: 'ULCX', selected: true, apiKey: 'api-key', passKey: 'pass-key' }],
            torrentClients: [{ code: 'QUI', selected: true, url: 'http://localhost:7474', apiKey: 'qui-key' }],
            ffmpegPath: '/custom/ffmpeg',
            ffprobePath: '/custom/ffprobe',
            movieScreenshotCount: 9,
            episodePackScreenshotCount: 2,
        })
    })
})
