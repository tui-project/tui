import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
}
const setLogLevel = vi.fn()

const readBody = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const getSettings = vi.fn()
const saveSettings = vi.fn()
const stat = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('setResponseStatus', vi.fn())
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
        getSettings,
        saveSettings,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
        setLogLevel,
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

    it('rejects selected image host provider without api key', async () => {
        readBody.mockResolvedValue(
            baseRequest({
                imageHostProviders: [{ code: 'imgbb', name: 'ImgBB', selected: true }],
            })
        )
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
    })

    it('rejects selected tracker without api key and pass key', async () => {
        readBody.mockResolvedValue(
            baseRequest({
                trackers: [{ code: 'ULCX', name: 'Upload.cx', selected: true }],
            })
        )
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
    })

    it('rejects missing ffmpeg paths even when no image host provider is selected', async () => {
        readBody.mockResolvedValue(
            baseRequest({
                imageHostProviders: [{ code: 'imgbb', name: 'ImgBB', selected: false }],
                ffmpegPath: undefined,
                ffprobePath: undefined,
            })
        )
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

    it('saves only the supported repository payload', async () => {
        readBody.mockResolvedValue(baseRequest({ mediaPaths: [' /a ', '/a', '/b'], tmdbApiKey: '  abc  ' }))
        stat.mockResolvedValue({})
        getSettings.mockResolvedValue({
            id: 'app-settings',
            mediaPaths: ['/a', '/b'],
            tmdbApiKey: 'abc',
            imageHostProviders: [{ code: 'imgbb', name: 'ImgBB', url: 'https://api.imgbb.com/1/upload?key=', selected: true, apiKey: 'imgbb-key' }],
            trackers: [{ code: 'ULCX', name: 'Upload.cx', url: 'https://upload.cx', selected: true, apiKey: 'api-key', passKey: 'pass-key' }],
            mediainfoPath: 'mediainfo',
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            episodePackScreenshotCount: 1,
            logLevel: 3,
        })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            mediaPaths: ['/a', '/b'],
            tmdbApiKey: 'abc',
            imageHostProviders: [{ code: 'imgbb', name: 'ImgBB', selected: true, apiKey: 'imgbb-key' }],
            trackers: [{ code: 'ULCX', name: 'Upload.cx', selected: true, apiKey: 'api-key', passKey: 'pass-key' }],
            mediainfoPath: 'mediainfo',
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            episodePackScreenshotCount: 1,
            logLevel: 3,
        })
        expect(saveSettings).toHaveBeenCalledWith({
            mediaPaths: ['/a', '/b'],
            tmdbApiKey: 'abc',
            imageHostProviders: [
                {
                    code: 'imgbb',
                    name: 'ImgBB',
                    url: '',
                    selected: true,
                    apiKey: 'imgbb-key',
                },
            ],
            trackers: [
                {
                    code: 'ULCX',
                    name: 'Upload.cx',
                    url: '',
                    selected: true,
                    apiKey: 'api-key',
                    passKey: 'pass-key',
                },
            ],
            mediainfoPath: 'mediainfo',
            ffmpegPath: 'ffmpeg',
            ffprobePath: 'ffprobe',
            movieScreenshotCount: 6,
            episodePackScreenshotCount: 3,
            logLevel: 3,
        })
    })
})

function baseRequest(
    overrides: Partial<{
        mediaPaths: unknown
        tmdbApiKey: unknown
        imageHostProviders: unknown
        trackers: unknown
        mediainfoPath: unknown
        ffmpegPath: unknown
        ffprobePath: unknown
        movieScreenshotCount: unknown
        episodePackScreenshotCount: unknown
        logLevel: unknown
    }> = {}
) {
    return {
        mediaPaths: ['/ok'],
        tmdbApiKey: 'abc',
        imageHostProviders: [{ code: 'imgbb', name: 'ImgBB', selected: true, apiKey: 'imgbb-key' }],
        trackers: [{ code: 'ULCX', name: 'Upload.cx', selected: true, apiKey: 'api-key', passKey: 'pass-key' }],
        mediainfoPath: 'mediainfo',
        ffmpegPath: 'ffmpeg',
        ffprobePath: 'ffprobe',
        movieScreenshotCount: 6,
        episodePackScreenshotCount: 3,
        logLevel: 3,
        ...overrides,
    }
}
