import { z } from 'zod'
import { MetadataSchema } from '../../../model/metadata'
import { parseValidatedBody } from '../../../utils/request-validator'
import { logger } from '../../../utils/logger'
import { createTrackerService } from '../../../services/tracker/tracker-factory'

const rulesRequestSchema = z.object({
    metadata: MetadataSchema,
})

export default defineEventHandler(async (event) => {
    const trackerCode = getRouterParam(event, 'trackerCode')!

    logger.debug('Tracker rules check request received.', { trackerCode })

    const request = await parseValidatedBody(event, rulesRequestSchema, {
        onInvalid: (issues) => logger.warn('Rejected tracker rules request with invalid payload.', { trackerCode, issues }),
    })

    const service = await createTrackerService(trackerCode)
    const violations = service.checkRules(request.metadata)

    logger.debug('Tracker rules checked.', { trackerCode, violations })

    return { violations }
})
