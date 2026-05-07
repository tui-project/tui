import { createError } from 'h3'
import { z } from 'zod'
import { getSettings } from '../repositories/settings-repository'
import { createScreenshots } from '../services/screenshot'
import { isWithinAnyRoot } from '../utils/file-system'
import { logger } from '../utils/logger'
import { parseValidatedBody } from '../utils/request-validator'

const screenshotRequestSchema = z.object({
    path: z.string().trim().min(1),
    hdr: z.boolean(),
    tv: z.boolean(),
})

export default defineEventHandler(async (event) => {
    logger.debug('Screenshot request received.')

    const { path, hdr, tv } = await parseValidatedBody(event, screenshotRequestSchema, {
        onInvalid: (issues) => logger.warn('Rejected screenshot request with invalid payload.', { issues }),
    })

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
