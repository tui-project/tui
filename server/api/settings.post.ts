import { stat } from 'node:fs/promises'
import { createError, readBody } from 'h3'
import { saveSettings } from '../repositories/settings-repository'
import { logger } from '../utils/logger'

interface SettingsRequest {
    mediaPaths?: unknown
    tmdbApiKey?: unknown
}

export default defineEventHandler(async (event) => {
    logger.debug('Settings update request received.')

    const request = await readBody<SettingsRequest>(event)
    const mediaPaths = normalizeMediaPaths(request.mediaPaths)
    const tmdbApiKey = normalizeTMDbAPIKey(request.tmdbApiKey)

    if (!mediaPaths || tmdbApiKey === null) {
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

    const settings = await saveSettings({ mediaPaths, tmdbApiKey })
    logger.info('Settings updated.')

    return settings
})

function normalizeMediaPaths(input: unknown) {
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

function normalizeTMDbAPIKey(input: unknown) {
    if (typeof input !== 'string') {
        return null
    }

    return input.trim()
}

async function pathExists(path: string) {
    try {
        await stat(path)
        return true
    } catch {
        return false
    }
}
