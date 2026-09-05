import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
}
const readBody = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const getSettings = vi.fn()
const resolvePathWithinAnyRoot = vi.fn()
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
        episodePackScreenshotCount: 3,
        imgbbApiKey: 'imgbb-key',
    })
    resolvePathWithinAnyRoot.mockImplementation(async (path) => path)
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
        resolvePathWithinAnyRoot,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        createLogger: () => logger,
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
        resolvePathWithinAnyRoot.mockResolvedValue(null)
        const handler = await loadHandler()

        await expect(handler({} as never)).rejects.toEqual({
            statusCode: 400,
            message: 'invalid_path',
        })
    })

    it('returns uploaded screenshots for valid requests', async () => {
        readBody.mockResolvedValue({ path: '/media/file.mkv', hdr: true, tv: true })
        resolvePathWithinAnyRoot.mockResolvedValue('/canonical/media/file.mkv')
        const handler = await loadHandler()

        await expect(handler({} as never)).resolves.toEqual({
            screenshots: [{ order: 1, url: 'https://full', thumbnailUrl: 'https://display' }],
        })
        expect(createScreenshots).toHaveBeenCalledWith('/canonical/media/file.mkv', true, true)
    })
})
