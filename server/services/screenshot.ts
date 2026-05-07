import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { generateScreenshotsWithFfmpeg } from './ffmpeg'
import { probeMediaDuration } from './ffprobe'
import { createImageUploadProvider } from './image-upload/provider'
import { resolveMediaFilePath, resolveMediaFilePaths } from '../utils/file-system'
import { logger } from '../utils/logger'
import { getSettings } from '../repositories/settings-repository'
import type { Settings } from '../model/settings'

export interface ScreenshotResult {
    screenshots: Array<{
        order: number
        url: string
        thumbnailUrl: string
    }>
}

export async function createScreenshots(inputPath: string, hdr: boolean, tv: boolean): Promise<ScreenshotResult> {
    logger.debug('Starting screenshot generation.', { inputPath, hdr, tv })

    const settings = await getSettings()
    validatSettings(settings)

    const mediaFilePaths = tv ? await resolveMediaFilePaths(inputPath) : [await resolveMediaFilePath(inputPath)]
    const provider = await createImageUploadProvider()
    const tempDir = join(process.cwd(), 'config', 'tmp', 'screenshots', randomUUID())
    const screenshotCount = tv ? settings.tvEpisodeScreenshotCount : settings.movieScreenshotCount

    logger.trace('Screenshot generation prepared.', {
        inputPath,
        mediaFileCount: mediaFilePaths.length,
        screenshotCount,
        tempDir,
        tv,
    })
    await mkdir(tempDir, { recursive: true })

    try {
        const screenshotBatches = await Promise.all(
            mediaFilePaths.map(async (mediaFilePath) => {
                const probeResult = await probeMediaDuration(mediaFilePath)
                const timestamps = selectTimestamps(probeResult.durationSeconds, screenshotCount)
                logger.trace('Selected screenshot timestamps.', { mediaFilePath, timestamps })

                return generateScreenshotsWithFfmpeg(mediaFilePath, tempDir, timestamps, hdr)
            })
        )
        const localScreenshots = screenshotBatches.flat().map((screenshot, index) => ({
            ...screenshot,
            order: index + 1,
        }))

        logger.trace('Generated local screenshots.', { count: localScreenshots.length, tempDir })
        const uploadedScreenshots = await Promise.all(
            localScreenshots.map(async (screenshot) => {
                const uploaded = await provider.uploadImage(screenshot.outputPath)

                return {
                    order: screenshot.order,
                    url: uploaded.url,
                    thumbnailUrl: uploaded.displayUrl,
                }
            })
        )

        logger.debug('Screenshot generation completed.', { inputPath, screenshotCount: uploadedScreenshots.length, tv })
        return {
            screenshots: uploadedScreenshots,
        }
    } finally {
        await removeTempDir(tempDir)
    }
}

export function selectTimestamps(durationSeconds: number, screenshotCount: number) {
    const segmentSize = 0.8 / (screenshotCount + 1)

    return Array.from({ length: screenshotCount }, (_, index) => {
        const ratio = 0.1 + segmentSize * (index + 1)
        return Number((durationSeconds * ratio).toFixed(3))
    })
}

async function removeTempDir(tempDir: string) {
    try {
        await rm(tempDir, { recursive: true, force: true })
    } catch {
        logger.warn('Failed to remove temporary screenshot directory.', { tempDir })
    }
}

function validatSettings(settings: Settings) {
    const imgbbSettings = settings.imageHostProviders.find((provider) => provider.code === 'imgbb' && provider.selected)

    if (!imgbbSettings) {
        logger.warn('Screenshot generation blocked because no image host provider is enabled.')
        throw createError({
            statusCode: 400,
            message: 'missing_screenshot_settings',
            data: {
                missingFields: ['Image Host Provider'],
            },
        })
    }

    const missingFields = [
        settings.ffmpegPath?.trim() ? null : 'FFmpeg Path',
        settings.ffprobePath?.trim() ? null : 'FFprobe Path',
        imgbbSettings.apiKey?.trim() ? null : 'ImgBB API Key',
    ].filter((field): field is string => field !== null)

    if (missingFields.length === 0) {
        logger.trace('Screenshot settings validated successfully.')
    } else {
        logger.warn('Screenshot generation blocked because required settings are missing.', { missingFields })
        throw createError({
            statusCode: 400,
            message: 'missing_screenshot_settings',
            data: {
                missingFields,
            },
        })
    }
}
