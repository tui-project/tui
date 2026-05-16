import { z } from 'zod'
import { TRACKER_UPLOAD_STATUSES } from '../../../model/tracker-upload-request'
import { findTrackerUploadRequestById, resetTrackerUploadRequest } from '../../../repositories/tracker-request-repository'
import { logger } from '../../../utils/logger'
import { parseValidatedBody } from '../../../utils/request-validator'
import { upload as trackerUpload } from '../../../services/tracker-upload'
import type { TrackerUploadMetadata } from '../../../services/tracker/tracker'

const patchBodySchema = z.object({
    action: z.literal('retry'),
})

const retryableStatuses = new Set<string>([TRACKER_UPLOAD_STATUSES.FAIL, TRACKER_UPLOAD_STATUSES.PARTIAL_SUCCESS])

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!

    parseValidatedBody(event, patchBodySchema, {
        onInvalid: (issues) => logger.warn('Rejected tracker request patch with invalid payload.', { id, issues }),
    })

    const existing = await findTrackerUploadRequestById(id)

    if (!existing) {
        throw createError({ statusCode: 404, message: 'not_found' })
    }

    if (!retryableStatuses.has(existing.status)) {
        throw createError({ statusCode: 409, message: 'not_retryable' })
    }

    logger.info('Retrying tracker upload request.', { id, previousStatus: existing.status })

    const trackersToRetry =
        existing.status === TRACKER_UPLOAD_STATUSES.PARTIAL_SUCCESS && existing.failedTrackerCodes?.length
            ? existing.trackers.filter((t) => existing.failedTrackerCodes!.includes(t.code))
            : existing.trackers

    const reset = await resetTrackerUploadRequest(id)
    if (!reset) {
        throw createError({ statusCode: 500, message: 'reset_failed' })
    }

    event.waitUntil(trackerUpload(id, existing.filepath, trackersToRetry, existing.metadata as TrackerUploadMetadata, existing.description))

    return { id: reset.id, status: reset.status }
})
