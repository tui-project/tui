import { z } from 'zod'
import { MetadataSchema } from '../../../model/metadata'
import { parseValidatedBody } from '../../../utils/request-validator'
import { logger } from '../../../utils/logger'
import { createTrackerService } from '../../../services/tracker/tracker-factory'

const titleRequestSchema = z.object({
    metadata: MetadataSchema,
})

export default defineEventHandler(async (event) => {
    const trackerCode = getRouterParam(event, 'trackerCode')!

    logger.debug('Tracker title request received.', { trackerCode })

    const request = await parseValidatedBody(event, titleRequestSchema, {
        onInvalid: (issues) => logger.warn('Rejected tracker title request with invalid payload.', { trackerCode, issues }),
    })

    const service = await createTrackerService(trackerCode)
    const title = service.getTitle(request.metadata)

    logger.debug('Tracker title built.', { trackerCode, title })

    return { title }
})
