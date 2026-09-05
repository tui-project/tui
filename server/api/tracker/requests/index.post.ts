import { randomUUID } from 'node:crypto'
import { createError } from 'h3'
import { z } from 'zod'
import { getSettings } from '../../../repositories/settings-repository'
import { saveTrackerRequest } from '../../../repositories/tracker-request-repository'
import { upload as trackerUpload } from '../../../services/tracker-upload'
import { resolvePathWithinAnyRoot } from '../../../utils/file-system'
import { createLogger } from '../../../utils/logger'
import { parseValidatedBody } from '../../../utils/request-validator'

const logger = createLogger('API')

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
    logger.trace('Tracker upload request received.')

    const request = await parseValidatedBody(event, trackerUploadRequestSchema, {
        onInvalid: (issues) => logger.warn('Rejected tracker upload request with invalid payload.', { issues }),
    })

    const settings = await getSettings()
    const canonicalFilepath = await resolvePathWithinAnyRoot(request.filepath, settings.mediaPaths)
    if (!canonicalFilepath) {
        logger.warn('Rejected tracker upload request because filepath is outside configured roots.', { filepath: request.filepath })
        throw createError({ statusCode: 400, message: 'invalid_path' })
    }

    const uploadRequestId = randomUUID()
    const uploadRequest = await saveTrackerRequest({
        id: uploadRequestId,
        filepath: canonicalFilepath,
        metadata: request.metadata,
        description: request.description,
        trackers: request.trackers,
        status: STATUS.PENDING,
    })

    logger.debug('Tracker upload request initiated.', {
        id: uploadRequest.id,
        filepath: uploadRequest.filepath,
        trackerCodes: getTrackerCodes(uploadRequest.trackers),
        status: uploadRequest.status,
    })

    event.waitUntil(trackerUpload(uploadRequest.id, canonicalFilepath, request.trackers, request.metadata, request.description))
    setResponseStatus(event, 201)

    return {
        id: uploadRequest.id,
        status: uploadRequest.status,
    }
})
