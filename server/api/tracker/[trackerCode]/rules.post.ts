import { z } from 'zod'
import { parseValidatedBody } from '../../../utils/request-validator'
import { createLogger } from '../../../utils/logger'
import { createTrackerService } from '../../../services/tracker/tracker-factory'

const logger = createLogger('API')

const rulesRequestSchema = z.object({
    metadata: MetadataSchema,
})

export default defineEventHandler(async (event) => {
    const trackerCode = getRouterParam(event, 'trackerCode')!

    logger.trace('Tracker rules check request received.', { trackerCode })

    const request = await parseValidatedBody(event, rulesRequestSchema, {
        onInvalid: (issues) => logger.warn('Rejected tracker rules request with invalid payload.', { trackerCode, issues }),
    })

    const service = await createTrackerService(trackerCode)
    const violations = service.checkRules(request.metadata)

    logger.trace('Tracker rules checked.', { trackerCode, count: violations.length })

    return { violations }
})
