import { z } from 'zod'
import { findAllTrackerUploadRequests } from '../../repositories/tracker-request-repository'
import { logger } from '../../utils/logger'
import { parseValidatedQuery } from '../../utils/request-validator'

const requestsQuerySchema = z.object({
    limit: z.coerce.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
    // logger.debug('Recent tracker upload requests received.')

    const { limit } = parseValidatedQuery(event, requestsQuerySchema, {
        errorMessage: 'invalid_query',
        onInvalid: (issues) => logger.warn('Rejected tracker requests query with invalid parameters.', { issues }),
    })
    const requests = await findAllTrackerUploadRequests(limit)

    return requests.map((request) => ({
        id: request.id,
        filepath: request.filepath,
        status: request.status,
        trackers: request.trackers ?? [],
        torrentCreationProgress: request.torrentCreationProgress,
        failedTrackerCodes: request.failedTrackerCodes,
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
    }))
})
