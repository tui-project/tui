import { z } from 'zod'
import { parseValidatedBody } from '../../../utils/request-validator'
import { createLogger } from '../../../utils/logger'
import { createTrackerService } from '../../../services/tracker/tracker-factory'

const logger = createLogger('API')
const duplicatesRequestSchema = z.object({
    metadata: MetadataSchema,
})

export default defineEventHandler(async (event) => {
    const trackerCode = getRouterParam(event, 'trackerCode')!

    logger.trace('Tracker duplicates check request received.', { trackerCode })

    const request = await parseValidatedBody(event, duplicatesRequestSchema, {
        onInvalid: (issues) => logger.warn('Rejected tracker duplicates request with invalid payload.', { trackerCode, issues }),
    })

    const service = await createTrackerService(trackerCode)
    const duplicates = await service.findDuplicates(request.metadata)

    logger.trace('Tracker duplicates checked.', { trackerCode, count: duplicates.length })

    return { duplicates }
})
