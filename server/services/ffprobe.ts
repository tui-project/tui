import { createError } from 'h3'
import { runCommand } from '../utils/process'
import { logger } from '../utils/logger'
import { getSettings } from '../repositories/settings-repository'

export interface FfprobeVersion {
    version: string
    major: number | null
}

export interface MediaProbeResult {
    durationSeconds: number
}

export async function probeMediaDuration(filePath: string): Promise<MediaProbeResult> {
    const settings = await getSettings()
    const ffprobePath = settings.ffprobePath

    logger.trace('Probing media duration with FFprobe.', { ffprobePath, filePath })

    try {
        const { stdout } = await runCommand(ffprobePath, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath])
        const durationSeconds = Number.parseFloat(stdout)

        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
            throw new Error('invalid_duration')
        }

        logger.debug('Probed media duration with FFprobe.', { filePath, durationSeconds })

        return {
            durationSeconds,
        }
    } catch {
        logger.warn('Failed to probe media duration.', { ffprobePath, filePath })
        throw createError({
            statusCode: 500,
            message: 'screenshot_probe_failed',
        })
    }
}
