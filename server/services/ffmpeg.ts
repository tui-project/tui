import { createError } from 'h3'
import { join } from 'node:path'
import { runCommand } from '../utils/process'
import { logger } from '../utils/logger'
import { getSettings } from '../repositories/settings-repository'

export interface FfmpegVersion {
    version: string
    major: number | null
}

export interface ScreenshotJob {
    order: number
    outputPath: string
}

export async function generateScreenshotsWithFfmpeg(filePath: string, outputDir: string, timestamps: number[], hdr: boolean) {
    const settings = await getSettings()
    const ffmpegPath = settings.ffmpegPath
    const jobs = timestamps.map((timestamp, index) => ({
        order: index + 1,
        outputPath: join(outputDir, `${crypto.randomUUID()}.png`),
        timestamp,
    }))

    logger.debug('Generating screenshots with FFmpeg.', {
        ffmpegPath,
        filePath,
        jobCount: jobs.length,
        hdr,
        outputDir,
    })

    for (const job of jobs) {
        const args = ['-y', '-ss', String(job.timestamp), '-i', filePath, '-frames:v', '1']

        if (hdr) {
            args.push('-vf', 'zscale=t=linear:npl=100,tonemap=hable,zscale=t=bt709:m=bt709:r=tv,format=yuv420p')
        }

        args.push(job.outputPath)

        try {
            await runCommand(ffmpegPath, args)
        } catch {
            logger.warn('Failed to generate screenshot with FFmpeg.', { ffmpegPath, filePath, timestamp: job.timestamp })
            throw createError({
                statusCode: 500,
                message: 'screenshot_generation_failed',
            })
        }
    }

    logger.debug('Generated screenshots with FFmpeg.', { filePath, jobCount: jobs.length, outputDir })
    return jobs.map(({ order, outputPath }) => ({
        order,
        outputPath,
    }))
}
