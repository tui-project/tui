import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    debug: vi.fn(),
    warn: vi.fn(),
}
const readBody = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const getSettings = vi.fn()
const isWithinAnyRoot = vi.fn()
const createScreenshots = vi.fn()

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)

    getSettings.mockResolvedValue({
        id: 'app-settings',
        mediaPaths: ['/media'],
        tmdbApiKey: '',
        ffmpegPath: 'ffmpeg',
        ffprobePath: 'ffprobe',
        movieScreenshotCount: 6,
        tvEpisodeScreenshotCount: 3,
        imgbbApiKey: 'imgbb-key',
    })
    isWithinAnyRoot.mockReturnValue(true)
    createScreenshots.mockResolvedValue({
        screenshots: [{ order: 1, url: 'https://full', thumbnailUrl: 'https://display' }],
    })
})

async function loadHandler() {
    vi.doMock('h3', () => ({
        createError,
        readBody,
    }))
    vi.doMock('../../../../server/repositories/settings-repository', () => ({
        getSettings,
    }))
    vi.doMock('../../../../server/services/screenshot', () => ({
        createScreenshots,
    }))
    vi.doMock('../../../../server/utils/file-system', () => ({
        isWithinAnyRoot,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    const { default: handler } = await import('../../../../server/api/screenshots.post')
    return handler
}

describe('POST /api/screenshots route handler', () => {
    it('rejects invalid request payload', async () => {
        readBody.mockResolvedValue({ path: '', hdr: 'nope', tv: false })
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_request',
        })
    })

    it('rejects paths outside configured roots', async () => {
        readBody.mockResolvedValue({ path: '/outside/file.mkv', hdr: false, tv: false })
        isWithinAnyRoot.mockReturnValue(false)
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_path',
        })
    })

    it('returns uploaded screenshots for valid requests', async () => {
        readBody.mockResolvedValue({ path: '/media/file.mkv', hdr: true, tv: true })
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            screenshots: [{ order: 1, url: 'https://full', thumbnailUrl: 'https://display' }],
        })
        expect(createScreenshots).toHaveBeenCalledWith('/media/file.mkv', true, true)
    })
})
