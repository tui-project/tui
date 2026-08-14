import { z } from 'zod'
import { parseValidatedBody } from '../../../utils/request-validator'
import { createLogger } from '../../../utils/logger'
import { createTrackerService } from '../../../services/tracker/tracker-factory'

const logger = createLogger('API')

const titleRequestSchema = z.object({
    metadata: MetadataSchema,
})

export default defineEventHandler(async (event) => {
    const trackerCode = getRouterParam(event, 'trackerCode')!

    logger.trace('Tracker title request received.', { trackerCode })

    const request = await parseValidatedBody(event, titleRequestSchema, {
        onInvalid: (issues) => logger.warn('Rejected tracker title request with invalid payload.', { trackerCode, issues }),
    })

    const service = await createTrackerService(trackerCode)
    const title = await service.getTitle(request.metadata)

    logger.trace('Tracker title built.', { trackerCode, title })

    return { title }
})
