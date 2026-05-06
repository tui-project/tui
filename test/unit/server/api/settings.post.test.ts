import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
}

const readBody = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const saveSettings = vi.fn()
const stat = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        createError,
        readBody,
    }))
    vi.doMock('node:fs/promises', () => ({
        stat,
    }))
    vi.doMock('../../../../server/repositories/settings-repository', () => ({
        saveSettings,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    const { default: handler } = await import('../../../../server/api/settings.post')
    return handler
}

describe('POST /api/settings route handler', () => {
    it('rejects invalid request shape', async () => {
        readBody.mockResolvedValue({ mediaPaths: 'abc', tmdbApiKey: 'abc' })
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
    })

    it('rejects when media path does not exist', async () => {
        readBody.mockResolvedValue(baseRequest({ mediaPaths: ['/missing'] }))
        stat.mockRejectedValue(new Error('missing'))
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_media_path',
        })
    })

    it('rejects when media paths contain invalid entries after normalization', async () => {
        readBody.mockResolvedValue(baseRequest({ mediaPaths: ['/ok', '   '] }))
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
    })

    it('deduplicates paths and saves valid settings', async () => {
        readBody.mockResolvedValue(baseRequest({ mediaPaths: [' /a ', '/a', '/b'], tmdbApiKey: '  abc  ' }))
        stat.mockResolvedValue({})
        saveSettings.mockResolvedValue({
            mediaPaths: ['/a', '/b'],
            tmdbApiKey: 'abc',
            imageHostProviders: ['imgbb'],
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            tvEpisodeScreenshotCount: 3,
            imgbbApiKey: 'imgbb-key',
        })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            mediaPaths: ['/a', '/b'],
            tmdbApiKey: 'abc',
            imageHostProviders: ['imgbb'],
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            tvEpisodeScreenshotCount: 3,
            imgbbApiKey: 'imgbb-key',
        })
        expect(saveSettings).toHaveBeenCalledWith({
            mediaPaths: ['/a', '/b'],
            tmdbApiKey: 'abc',
            imageHostProviders: ['imgbb'],
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            tvEpisodeScreenshotCount: 3,
            imgbbApiKey: 'imgbb-key',
        })
        expect(logger.info).toHaveBeenCalledWith('Settings updated.')
    })

    it('rejects when tmdb api key is invalid', async () => {
        readBody.mockResolvedValue(baseRequest({ mediaPaths: ['/ok'], tmdbApiKey: 123 }))
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
    })

    it('allows blank ffmpeg path, ffprobe path, and imgbb api key', async () => {
        readBody.mockResolvedValue(baseRequest({ ffmpegPath: '   ', ffprobePath: ' ', imgbbApiKey: '   ' }))
        stat.mockResolvedValue({})
        saveSettings.mockResolvedValue({
            mediaPaths: ['/ok'],
            tmdbApiKey: 'abc',
            imageHostProviders: [],
            ffmpegPath: '',
            ffprobePath: '',
            movieScreenshotCount: 6,
            tvEpisodeScreenshotCount: 3,
            imgbbApiKey: '',
        })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            mediaPaths: ['/ok'],
            tmdbApiKey: 'abc',
            imageHostProviders: [],
            ffmpegPath: '',
            ffprobePath: '',
            movieScreenshotCount: 6,
            tvEpisodeScreenshotCount: 3,
            imgbbApiKey: '',
        })
    })

    it('rejects when image host providers contain unsupported values', async () => {
        readBody.mockResolvedValue(baseRequest({ imageHostProviders: ['imgbb', 'unknown'] }))
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
    })

    it('clears ImgBB API key when ImgBB is not selected', async () => {
        readBody.mockResolvedValue(baseRequest({ imageHostProviders: [], imgbbApiKey: 'still-present' }))
        stat.mockResolvedValue({})
        saveSettings.mockResolvedValue({
            mediaPaths: ['/ok'],
            tmdbApiKey: 'abc',
            imageHostProviders: [],
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            tvEpisodeScreenshotCount: 3,
            imgbbApiKey: '',
        })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            mediaPaths: ['/ok'],
            tmdbApiKey: 'abc',
            imageHostProviders: [],
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            tvEpisodeScreenshotCount: 3,
            imgbbApiKey: '',
        })
        expect(saveSettings).toHaveBeenCalledWith({
            mediaPaths: ['/ok'],
            tmdbApiKey: 'abc',
            imageHostProviders: [],
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            tvEpisodeScreenshotCount: 3,
            imgbbApiKey: '',
        })
    })
})

function baseRequest(
    overrides: Partial<{
        mediaPaths: unknown
        tmdbApiKey: unknown
        imageHostProviders: unknown
        ffmpegPath: unknown
        ffprobePath: unknown
        movieScreenshotCount: unknown
        tvEpisodeScreenshotCount: unknown
        imgbbApiKey: unknown
    }> = {}
) {
    return {
        mediaPaths: ['/ok'],
        tmdbApiKey: 'abc',
        imageHostProviders: ['imgbb'],
        ffmpegPath: 'ffmpeg',
        ffprobePath: 'ffprobe',
        movieScreenshotCount: 6,
        tvEpisodeScreenshotCount: 3,
        imgbbApiKey: 'imgbb-key',
        ...overrides,
    }
}
