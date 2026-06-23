import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { saveTrackerRequest } from '../../../repositories/tracker-request-repository'
import { logger } from '../../../utils/logger'
import { parseValidatedBody } from '../../../utils/request-validator'
import { upload as trackerUpload } from '../../../services/tracker-upload'

const trackerItemSchema = z.object({
    code: z.string().trim().min(1),
    title: z.string().trim().min(1),
    titleModified: z.boolean(),
    anonymous: z.boolean(),
    modQueueOptIn: z.boolean(),
})

const trackerUploadRequestSchema = z.object({
    filepath: z.string().trim().min(1),
    metadata: MetadataSchema,
    description: z.string(),
    trackers: z.array(trackerItemSchema).min(1),
})

function getTrackerCodes(trackers: TrackerItem[]) {
    return trackers.map((t) => t.code)
}

export default defineEventHandler(async (event) => {
    logger.debug('Tracker upload request received.')

    const request = await parseValidatedBody(event, trackerUploadRequestSchema, {
        onInvalid: (issues) => logger.warn('Rejected tracker upload request with invalid payload.', { issues }),
    })

    const uploadRequestId = randomUUID()
    const uploadRequest = await saveTrackerRequest({
        id: uploadRequestId,
        filepath: request.filepath,
        metadata: request.metadata,
        description: request.description,
        trackers: request.trackers,
        status: STATUS.PENDING,
    })

    logger.info('Tracker upload request queued.', {
        id: uploadRequest.id,
        filepath: uploadRequest.filepath,
        trackerCodes: getTrackerCodes(uploadRequest.trackers),
        status: uploadRequest.status,
    })

    event.waitUntil(trackerUpload(uploadRequest.id, request.filepath, request.trackers, request.metadata, request.description))
    setResponseStatus(event, 201)

    return {
        id: uploadRequest.id,
        status: uploadRequest.status,
    }
})
