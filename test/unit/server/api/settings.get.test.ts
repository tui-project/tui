import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}

const getSettings = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('../../../../server/repositories/settings-repository', () => ({
        getSettings,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    const { default: handler } = await import('../../../../server/api/settings.get')
    return handler
}

describe('GET /api/settings route handler', () => {
    it('removes id and urls from the response', async () => {
        getSettings.mockResolvedValue({
            id: 'app-settings',
            mediaPaths: ['/a'],
            tmdbApiKey: 'abc',
            imageHostProviders: [{ code: 'imgbb', name: 'ImgBB', url: 'https://api.imgbb.com/1/upload?key=', selected: true, apiKey: 'imgbb-key' }],
            trackers: [{ code: 'ULCX', name: 'Upload.cx', url: 'https://upload.cx', selected: true, apiKey: 'api-key', passKey: 'pass-key' }],
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            episodePackScreenshotCount: 1,
        })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            mediaPaths: ['/a'],
            tmdbApiKey: 'abc',
            imageHostProviders: [{ code: 'imgbb', name: 'ImgBB', selected: true, apiKey: 'imgbb-key' }],
            trackers: [{ code: 'ULCX', name: 'Upload.cx', selected: true, apiKey: 'api-key', passKey: 'pass-key' }],
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            episodePackScreenshotCount: 1,
        })
    })
})
