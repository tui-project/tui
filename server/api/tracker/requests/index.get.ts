import { z } from 'zod'
import { getTrackerRequests, getTrackerRequestsByGroup } from '../../../repositories/tracker-request-repository'
import { logger } from '../../../utils/logger'
import { parseValidatedQuery } from '../../../utils/request-validator'

const requestsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    size: z.coerce.number().int().positive().default(12),
    groupId: z.string().trim().min(1).optional(),
    withGroupCount: z
        .string()
        .optional()
        .transform((v) => v === 'true'),
})

export default defineEventHandler(async (event) => {
    logger.debug('Get tracker upload requests request received.')

    const { page, size, groupId, withGroupCount } = parseValidatedQuery(event, requestsQuerySchema, {
        errorMessage: 'invalid_query',
        onInvalid: (issues) => logger.warn('Rejected tracker requests query with invalid parameters.', { issues }),
    })

    if (groupId) {
        const items = await getTrackerRequestsByGroup(groupId)

        return {
            items,
            total: items.length,
        }
    }

    return await getTrackerRequests(page, size, withGroupCount)
})
