import { beforeEach, describe, expect, it, vi } from 'vitest'

const runCommand = vi.fn()
const getSettings = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const logger = {
    debug: vi.fn(),
    warn: vi.fn(),
}

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    getSettings.mockResolvedValue({
        ffmpegPath: '/usr/local/bin/ffmpeg',
    })
    runCommand.mockResolvedValue({ stdout: '', stderr: '' })
})

async function loadService() {
    vi.doMock('../../../../server/utils/process', () => ({
        runCommand,
    }))
    vi.doMock('../../../../server/repositories/settings-repository', () => ({
        getSettings,
    }))
    vi.doMock('../../../../server/utils/logger', () => ({
        logger,
    }))
    vi.doMock('h3', () => ({
        createError,
    }))

    return import('../../../../server/services/ffmpeg')
}

describe('ffmpeg screenshot service', () => {
    it('creates screenshot jobs and adds hdr tonemapping when needed', async () => {
        const uuidSpy = vi.spyOn(crypto, 'randomUUID').mockReturnValueOnce('one').mockReturnValueOnce('two')
        const { generateScreenshotsWithFfmpeg } = await loadService()

        await expect(generateScreenshotsWithFfmpeg('/media/movie.mkv', '/tmp/screens', [12.5, 42], true)).resolves.toEqual([
            { order: 1, outputPath: '/tmp/screens/one.png' },
            { order: 2, outputPath: '/tmp/screens/two.png' },
        ])

        expect(runCommand).toHaveBeenNthCalledWith(1, '/usr/local/bin/ffmpeg', [
            '-y',
            '-ss',
            '12.5',
            '-i',
            '/media/movie.mkv',
            '-frames:v',
            '1',
            '-vf',
            'zscale=t=linear:npl=100,tonemap=hable,zscale=t=bt709:m=bt709:r=tv,format=yuv420p',
            '/tmp/screens/one.png',
        ])
        expect(runCommand).toHaveBeenNthCalledWith(2, '/usr/local/bin/ffmpeg', [
            '-y',
            '-ss',
            '42',
            '-i',
            '/media/movie.mkv',
            '-frames:v',
            '1',
            '-vf',
            'zscale=t=linear:npl=100,tonemap=hable,zscale=t=bt709:m=bt709:r=tv,format=yuv420p',
            '/tmp/screens/two.png',
        ])
        expect(logger.debug).toHaveBeenCalledTimes(2)
        uuidSpy.mockRestore()
    })

    it('omits hdr filter for sdr content', async () => {
        vi.spyOn(crypto, 'randomUUID').mockReturnValue('plain')
        const { generateScreenshotsWithFfmpeg } = await loadService()

        await generateScreenshotsWithFfmpeg('/media/movie.mkv', '/tmp/screens', [9], false)

        expect(runCommand).toHaveBeenCalledWith('/usr/local/bin/ffmpeg', ['-y', '-ss', '9', '-i', '/media/movie.mkv', '-frames:v', '1', '/tmp/screens/plain.png'])
    })

    it('wraps ffmpeg failures in an h3 error', async () => {
        vi.spyOn(crypto, 'randomUUID').mockReturnValue('broken')
        runCommand.mockRejectedValue(new Error('ffmpeg failed'))
        const { generateScreenshotsWithFfmpeg } = await loadService()

        await expect(generateScreenshotsWithFfmpeg('/media/movie.mkv', '/tmp/screens', [10], false)).rejects.toEqual({
            statusCode: 500,
            message: 'screenshot_generation_failed',
        })
        expect(logger.warn).toHaveBeenCalledWith('Failed to generate screenshot with FFmpeg.', {
            ffmpegPath: '/usr/local/bin/ffmpeg',
            filePath: '/media/movie.mkv',
            timestamp: 10,
        })
    })
})
