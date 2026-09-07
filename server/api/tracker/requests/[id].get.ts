import { createError, getRouterParam } from 'h3'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { getTrackerRequest } from '../../../repositories/tracker-request-repository'
import { createLogger } from '../../../utils/logger'

const logger = createLogger('API')

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!

    logger.debug('Get tracker upload request received.', { id })

    const request = await getTrackerRequest(id)
    if (!request) {
        logger.warn('Tracker upload request not found.', { id })
        throw createError({ statusCode: 404, message: 'not_found' })
    }

    const source = await stat(request.filepath).catch(() => {
        logger.warn('Tracker upload request source path is unavailable.', { id })
        throw createError({ statusCode: 400, message: 'source_unavailable' })
    })

    return {
        filepath: request.filepath,
        folder: source.isDirectory(),
        filename: basename(request.filepath),
        metadata: request.metadata,
        description: request.description,
    }
})
