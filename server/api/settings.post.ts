import { stat } from 'node:fs/promises'
import { createError, readBody } from 'h3'
import { saveSettings } from '../repositories/settings-repository'
import { logger } from '../utils/logger'
import { normalisePositiveInteger, normaliseString } from '../utils/string'

interface SettingsRequest {
    mediaPaths?: unknown
    tmdbApiKey?: unknown
    ffmpegPath?: unknown
    ffprobePath?: unknown
    movieScreenshotCount?: unknown
    tvEpisodeScreenshotCount?: unknown
    imgbbApiKey?: unknown
}

export default defineEventHandler(async (event) => {
    logger.debug('Settings update request received.')

    const request = await readBody<SettingsRequest>(event)
    const mediaPaths = normaliseMediaPaths(request.mediaPaths)
    const tmdbApiKey = normaliseString(request.tmdbApiKey)
    const ffmpegPath = normaliseString(request.ffmpegPath)
    const ffprobePath = normaliseString(request.ffprobePath)
    const movieScreenshotCount = normalisePositiveInteger(request.movieScreenshotCount)
    const tvEpisodeScreenshotCount = normalisePositiveInteger(request.tvEpisodeScreenshotCount)
    const imgbbApiKey = normaliseString(request.imgbbApiKey)

    if (
        !mediaPaths ||
        tmdbApiKey === null ||
        ffmpegPath === null ||
        ffprobePath === null ||
        movieScreenshotCount === null ||
        tvEpisodeScreenshotCount === null ||
        imgbbApiKey === null
    ) {
        logger.warn('Rejected settings update with invalid payload.')

        throw createError({
            statusCode: 400,
            message: 'invalid_request',
        })
    }

    for (const mediaPath of mediaPaths) {
        const exists = await pathExists(mediaPath)
        if (!exists) {
            logger.warn('Rejected settings update due to non-existent media path.', { mediaPath })

            throw createError({
                statusCode: 400,
                message: 'invalid_media_path',
            })
        }
    }

    const settings = await saveSettings({ mediaPaths, tmdbApiKey, ffmpegPath, ffprobePath, movieScreenshotCount, tvEpisodeScreenshotCount, imgbbApiKey })
    logger.info('Settings updated.')

    return settings
})

function normaliseMediaPaths(input: unknown) {
    if (!Array.isArray(input)) {
        return null
    }

    const trimmed = input
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)

    if (trimmed.length !== input.length) {
        return null
    }

    return [...new Set(trimmed)]
}

async function pathExists(path: string) {
    try {
        await stat(path)
        return true
    } catch {
        return false
    }
}
