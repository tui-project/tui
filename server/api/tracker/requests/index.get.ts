import { z } from 'zod'
import type { TrackerRequest } from '#shared/types/tracker-request'
import { findAllTrackerUploadRequests } from '../../../repositories/tracker-request-repository'
import { logger } from '../../../utils/logger'
import { parseValidatedQuery } from '../../../utils/request-validator'

const requestsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    size: z.coerce.number().int().positive().default(12),
})

export default defineEventHandler(async (event): Promise<TrackerRequest[]> => {
    logger.debug('Get tracker upload requests request received.')

    const { page, size } = parseValidatedQuery(event, requestsQuerySchema, {
        errorMessage: 'invalid_query',
        onInvalid: (issues) => logger.warn('Rejected tracker requests query with invalid parameters.', { issues }),
    })

    return await findAllTrackerUploadRequests(page, size)
})
