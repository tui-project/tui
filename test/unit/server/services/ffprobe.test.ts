import { beforeEach, describe, expect, it, vi } from 'vitest'

const runCommand = vi.fn()
const getSettings = vi.fn()
const createError = vi.fn((payload: unknown) => payload)
const logger = {
    trace: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
}

beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    getSettings.mockResolvedValue({
        ffprobePath: '/usr/local/bin/ffprobe',
    })
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

    return import('../../../../server/services/ffprobe')
}

describe('ffprobe service', () => {
    it('parses media duration from stdout', async () => {
        runCommand.mockResolvedValue({ stdout: '123.45', stderr: '' })
        const { probeMediaDuration } = await loadService()

        await expect(probeMediaDuration('/media/movie.mkv')).resolves.toEqual({
            durationSeconds: 123.45,
        })
        expect(runCommand).toHaveBeenCalledWith('/usr/local/bin/ffprobe', [
            '-v',
            'error',
            '-show_entries',
            'format=duration',
            '-of',
            'default=noprint_wrappers=1:nokey=1',
            '/media/movie.mkv',
        ])
    })

    it('rejects invalid durations', async () => {
        runCommand.mockResolvedValue({ stdout: 'not-a-number', stderr: '' })
        const { probeMediaDuration } = await loadService()

        await expect(probeMediaDuration('/media/movie.mkv')).rejects.toEqual({
            statusCode: 500,
            message: 'screenshot_probe_failed',
        })
    })

    it('rejects command failures', async () => {
        runCommand.mockRejectedValue(new Error('boom'))
        const { probeMediaDuration } = await loadService()

        await expect(probeMediaDuration('/media/movie.mkv')).rejects.toEqual({
            statusCode: 500,
            message: 'screenshot_probe_failed',
        })
        expect(logger.warn).toHaveBeenCalledWith('Failed to probe media duration.', {
            ffprobePath: '/usr/local/bin/ffprobe',
            filePath: '/media/movie.mkv',
        })
    })
})
