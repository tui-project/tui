import { z } from 'zod'
import { getTrackerRequest, resetTrackerRequest } from '../../../repositories/tracker-request-repository'
import { logger } from '../../../utils/logger'
import { parseValidatedBody } from '../../../utils/request-validator'
import { upload as trackerUpload } from '../../../services/tracker-upload'

const patchBodySchema = z.object({
    action: z.literal('retry'),
})

const RETRYABLE_STATUSES = new Set<string>([STATUS.FAIL, STATUS.PARTIAL_SUCCESS])

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!

    parseValidatedBody(event, patchBodySchema, {
        onInvalid: (issues) => logger.warn('Rejected tracker request patch with invalid payload.', { id, issues }),
    })

    const existing = await getTrackerRequest(id)

    if (!existing) {
        throw createError({ statusCode: 404, message: 'not_found' })
    }

    if (!RETRYABLE_STATUSES.has(existing.status)) {
        throw createError({ statusCode: 409, message: 'not_retryable' })
    }

    logger.info('Retrying tracker upload request.', { id, previousStatus: existing.status })

    const trackersToRetry =
        existing.status === STATUS.PARTIAL_SUCCESS && existing.failedTrackerCodes?.length
            ? existing.trackers.filter((t) => existing.failedTrackerCodes!.includes(t.code))
            : existing.trackers

    const reset = await resetTrackerRequest(id)
    if (!reset) {
        throw createError({ statusCode: 500, message: 'reset_failed' })
    }

    event.waitUntil(trackerUpload(id, existing.filepath, trackersToRetry, existing.metadata, existing.description))

    return { id: reset.id, status: reset.status }
})
