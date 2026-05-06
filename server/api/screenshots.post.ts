import { createError, readBody } from 'h3'
import { getSettings } from '../repositories/settings-repository'
import { createScreenshots } from '../services/screenshot'
import { isWithinAnyRoot } from '../utils/file-system'
import { logger } from '../utils/logger'
import { normaliseBoolean, normaliseRequiredString } from '../utils/string'

interface ScreenshotRequest {
    path?: unknown
    hdr?: unknown
    tv?: unknown
}

export default defineEventHandler(async (event) => {
    logger.debug('Screenshot request received.')

    const request = await readBody<ScreenshotRequest>(event)
    const path = normaliseRequiredString(request.path)
    const hdr = normaliseBoolean(request.hdr)
    const tv = normaliseBoolean(request.tv)

    if (!path || hdr === null || tv === null) {
        logger.warn('Rejected screenshot request with invalid payload.')
        throw createError({
            statusCode: 400,
            message: 'invalid_request',
        })
    }

    const settings = await getSettings()
    if (!isWithinAnyRoot(path, settings.mediaPaths)) {
        logger.warn('Rejected screenshot request because path is outside configured roots.', { path })
        throw createError({
            statusCode: 400,
            message: 'invalid_path',
        })
    }

    return createScreenshots(path, hdr, tv)
})
