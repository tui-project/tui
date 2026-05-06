import { beforeEach, describe, expect, it, vi } from 'vitest'

const mkdir = vi.fn()
const rm = vi.fn()
const resolveMediaFilePath = vi.fn()
const resolveMediaFilePaths = vi.fn()
const probeMediaDuration = vi.fn()
const generateScreenshotsWithFfmpeg = vi.fn()
const uploadImage = vi.fn()
const createImageUploadProvider = vi.fn()
const getSettings = vi.fn()
const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    trace: vi.fn(),
}
const createError = vi.fn((payload: unknown) => payload)

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mkdir.mockResolvedValue(undefined)
    rm.mockResolvedValue(undefined)
    resolveMediaFilePath.mockResolvedValue('/media/movie.mkv')
    resolveMediaFilePaths.mockResolvedValue(['/media/show-s01e01.mkv', '/media/show-s01e02.mkv'])
    getSettings.mockResolvedValue({
        id: 'app-settings',
        mediaPaths: ['/media'],
        tmdbApiKey: '',
        ffmpegPath: 'ffmpeg',
        ffprobePath: 'ffprobe',
        movieScreenshotCount: 6,
        tvEpisodeScreenshotCount: 1,
        imgbbApiKey: 'imgbb-key',
    })
    probeMediaDuration.mockResolvedValue({ durationSeconds: 100 })
    generateScreenshotsWithFfmpeg.mockResolvedValue([
        { order: 1, outputPath: '/tmp/one.png' },
        { order: 2, outputPath: '/tmp/two.png' },
    ])
    uploadImage.mockReset()
    uploadImage.mockResolvedValueOnce({ url: 'https://full-1', displayUrl: 'https://display-1' }).mockResolvedValueOnce({ url: 'https://full-2', displayUrl: 'https://display-2' })
    createImageUploadProvider.mockReturnValue({ uploadImage })
})

async function loadService() {
    vi.doMock('node:fs/promises', () => ({
        mkdir,
        rm,
    }))
    vi.doMock('../../../../server/utils/file-system', () => ({
        resolveMediaFilePath,
        resolveMediaFilePaths,
    }))
    vi.doMock('../../../../server/services/ffmpeg', () => ({
        generateScreenshotsWithFfmpeg,
    }))
    vi.doMock('../../../../server/services/ffprobe', () => ({
        probeMediaDuration,
    }))
    vi.doMock('../../../../server/services/image-upload/provider', () => ({
        createImageUploadProvider,
    }))
    vi.doMock('../../../../server/repositories/settings-repository', () => ({
        getSettings,
    }))
    vi.doMock('h3', () => ({
        createError,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))

    return import('../../../../server/services/screenshot')
}

describe('screenshot generator service', () => {
    it('selects ordered timestamps in the usable playback range', async () => {
        const { selectTimestamps } = await loadService()

        expect(selectTimestamps(100, 4)).toEqual([26, 42, 58, 74])
    })

    it('generates, uploads, and maps screenshots', async () => {
        const { createScreenshots } = await loadService()

        await expect(createScreenshots('/media/movie.mkv', true, false)).resolves.toEqual({
            screenshots: [
                { order: 1, url: 'https://full-1', thumbnailUrl: 'https://display-1' },
                { order: 2, url: 'https://full-2', thumbnailUrl: 'https://display-2' },
            ],
        })

        expect(generateScreenshotsWithFfmpeg).toHaveBeenCalledWith(
            '/media/movie.mkv',
            expect.stringContaining('/config/tmp/screenshots/'),
            [21.429, 32.857, 44.286, 55.714, 67.143, 78.571],
            true
        )
        expect(uploadImage).toHaveBeenCalledTimes(2)
        expect(rm).toHaveBeenCalledTimes(1)
    })

    it('uses tv screenshot count for episodic content', async () => {
        generateScreenshotsWithFfmpeg
            .mockResolvedValueOnce([{ order: 1, outputPath: '/tmp/episode-one.png' }])
            .mockResolvedValueOnce([{ order: 1, outputPath: '/tmp/episode-two.png' }])
        const { createScreenshots } = await loadService()

        await expect(createScreenshots('/media/show', false, true)).resolves.toEqual({
            screenshots: [
                { order: 1, url: 'https://full-1', thumbnailUrl: 'https://display-1' },
                { order: 2, url: 'https://full-2', thumbnailUrl: 'https://display-2' },
            ],
        })

        expect(resolveMediaFilePaths).toHaveBeenCalledWith('/media/show')
        expect(resolveMediaFilePath).not.toHaveBeenCalled()
        expect(probeMediaDuration).toHaveBeenNthCalledWith(1, '/media/show-s01e01.mkv')
        expect(probeMediaDuration).toHaveBeenNthCalledWith(2, '/media/show-s01e02.mkv')
        expect(generateScreenshotsWithFfmpeg).toHaveBeenNthCalledWith(1, '/media/show-s01e01.mkv', expect.any(String), [50], false)
        expect(generateScreenshotsWithFfmpeg).toHaveBeenNthCalledWith(2, '/media/show-s01e02.mkv', expect.any(String), [50], false)
    })

    it('uses a single resolved file for movie content', async () => {
        const { createScreenshots } = await loadService()

        await createScreenshots('/media/movie-folder', false, false)

        expect(resolveMediaFilePath).toHaveBeenCalledWith('/media/movie-folder')
        expect(resolveMediaFilePaths).not.toHaveBeenCalled()
        expect(generateScreenshotsWithFfmpeg).toHaveBeenCalledWith('/media/movie.mkv', expect.any(String), [21.429, 32.857, 44.286, 55.714, 67.143, 78.571], false)
    })

    it('logs a warning when temp cleanup fails after upload', async () => {
        rm.mockRejectedValue(new Error('cleanup failed'))
        const { createScreenshots } = await loadService()

        await createScreenshots('/media/movie.mkv', false, false)

        expect(logger.warn).toHaveBeenCalledWith('Failed to remove temporary screenshot directory.', expect.objectContaining({ tempDir: expect.any(String) }))
    })

    it('rejects when screenshot settings are missing', async () => {
        getSettings.mockResolvedValue({
            id: 'app-settings',
            mediaPaths: ['/media'],
            tmdbApiKey: '',
            ffmpegPath: '',
            ffprobePath: ' ',
            movieScreenshotCount: 6,
            tvEpisodeScreenshotCount: 1,
            imgbbApiKey: '',
        })
        const { createScreenshots } = await loadService()

        await expect(createScreenshots('/media/movie.mkv', false, false)).rejects.toEqual({
            statusCode: 400,
            message: 'missing_screenshot_settings',
            data: {
                missingFields: ['FFmpeg Path', 'FFprobe Path', 'ImgBB API Key'],
            },
        })
    })
})
