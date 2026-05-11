import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { TRACKER_UPLOAD_STATUSES, type TrackerItem } from '../../model/tracker-upload-request'
import { findGenericTorrentCacheByFilepath, saveGenericTorrentCache } from '../../repositories/generic-torrent-cache-repository'
import { saveTrackerUploadRequest, updateTrackerUploadRequestStatus, updateTrackerUploadRequestTorrentCreationProgress } from '../../repositories/tracker-request-repository'
import { getSettings } from '../../repositories/settings-repository'
import { createGenericTorrent, createTrackerTorrent } from '../../services/torrent'
import { analyzeMediaFileAsText } from '../../services/mediainfo'
import { resolveMediaFilePath } from '../../utils/file-system'
import { createTrackerService } from '../../services/tracker/tracker-factory'
import type { TrackerUploadMetadata } from '../../services/tracker/tracker'
import { logger } from '../../utils/logger'
import { parseValidatedBody } from '../../utils/request-validator'
import { MetadataSchema } from '../../model/metadata'

const trackerItemSchema = z.object({
    code: z.string().trim().min(1),
    title: z.string().trim().min(1),
    titleModified: z.boolean(),
    anonymous: z.boolean(),
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
    const uploadRequest = await saveTrackerUploadRequest({
        id: uploadRequestId,
        filepath: request.filepath,
        metadata: request.metadata,
        description: request.description,
        trackers: request.trackers,
        status: TRACKER_UPLOAD_STATUSES.PENDING,
        torrentCreationProgress: 0,
    })

    logger.info('Tracker upload request queued.', {
        id: uploadRequest.id,
        filepath: uploadRequest.filepath,
        trackerCodes: getTrackerCodes(uploadRequest.trackers),
        status: uploadRequest.status,
    })

    processTrackerUploadRequest(uploadRequest.id, request.filepath, request.trackers, request.metadata, request.description)
    setResponseStatus(event, 201)

    return {
        id: uploadRequest.id,
        status: uploadRequest.status,
    }
})

async function processTrackerUploadRequest(uploadRequestId: string, filepath: string, trackers: TrackerItem[], metadata: TrackerUploadMetadata, description: string) {
    const trackerCodes = getTrackerCodes(trackers)

    try {
        await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.TORRENT_CREATION)
        logger.info('Tracker upload request started generic torrent creation.', {
            id: uploadRequestId,
            filepath,
            trackerCodes,
            status: TRACKER_UPLOAD_STATUSES.TORRENT_CREATION,
        })

        const cachedGenericTorrent = await findGenericTorrentCacheByFilepath(filepath)
        const genericTorrentPath = cachedGenericTorrent ? cachedGenericTorrent.genericTorrentPath : await createGenericTorrentForUploadRequest(uploadRequestId, filepath)

        if (cachedGenericTorrent) {
            logger.debug('Reusing cached generic torrent for tracker upload request.', {
                id: uploadRequestId,
                filepath,
                trackerCodes,
                genericTorrentPath,
            })
        } else {
            await saveGenericTorrentCache({ filepath, genericTorrentPath })
        }

        const trackerTorrentPaths = await createTrackerTorrents(genericTorrentPath, filepath, trackerCodes)

        await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.UPLOADING)
        logger.info('Tracker upload request uploading to trackers.', {
            id: uploadRequestId,
            filepath,
            trackerCodes,
            status: TRACKER_UPLOAD_STATUSES.UPLOADING,
            genericTorrentPath,
            trackerTorrentPaths,
        })

        const mediaFilePath = await resolveMediaFilePath(filepath)
        const mediainfoText = await analyzeMediaFileAsText(mediaFilePath)
        logger.debug('Mediainfo text ready for tracker upload.', { id: uploadRequestId, mediaFilePath })

        const failedTrackerCodes = await uploadToTrackers(trackerTorrentPaths, trackers, metadata, description, mediainfoText)

        if (failedTrackerCodes.length === 0) {
            await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.SUCCESS)
            logger.info('Tracker upload request completed successfully.', { id: uploadRequestId, trackerCodes })
        } else if (failedTrackerCodes.length < trackerCodes.length) {
            await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.PARTIAL_SUCCESS, failedTrackerCodes)
            logger.warn('Tracker upload request completed with partial success.', { id: uploadRequestId, failedTrackerCodes })
        } else {
            await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.FAIL)
            logger.error('Tracker upload request failed for all trackers.', undefined, { id: uploadRequestId, trackerCodes })
        }
    } catch (error: unknown) {
        await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.FAIL)
        logger.error('Failed to process tracker upload request.', error, {
            id: uploadRequestId,
            filepath,
        })
    }
}

async function createGenericTorrentForUploadRequest(uploadRequestId: string, filepath: string) {
    const { genericTorrentPath } = await createGenericTorrent({
        sourcePath: filepath,
        onProgress: async (progressPercent) => await updateTrackerUploadRequestTorrentCreationProgress(uploadRequestId, progressPercent),
    })

    return genericTorrentPath
}

async function uploadToTrackers(trackerTorrentPaths: Record<string, string>, trackers: TrackerItem[], metadata: TrackerUploadMetadata, description: string, mediainfoText: string) {
    const failedTrackerCodes: string[] = []

    for (const tracker of trackers) {
        const torrentPath = trackerTorrentPaths[tracker.code]
        if (!torrentPath) {
            logger.warn('Skipping tracker upload: no torrent path found.', { trackerCode: tracker.code })
            failedTrackerCodes.push(tracker.code)

            continue
        }

        try {
            const trackerService = await createTrackerService(tracker.code)
            await trackerService.upload(torrentPath, metadata, description, mediainfoText, { title: tracker.title, anonymous: tracker.anonymous })
        } catch (error: unknown) {
            logger.error('Failed to upload to tracker.', error, { trackerCode: tracker.code })
            failedTrackerCodes.push(tracker.code)
        }
    }

    return failedTrackerCodes
}

async function createTrackerTorrents(genericTorrentPath: string, filepath: string, trackerCodes: string[]): Promise<Record<string, string>> {
    const settings = await getSettings()
    const trackersByCode = Object.fromEntries(settings.trackers.map((t) => [t.code, t]))
    const results: Record<string, string> = {}

    for (const code of trackerCodes) {
        const tracker = trackersByCode[code]

        if (!tracker?.passKey) {
            logger.warn('Skipping tracker-specific torrent: passKey not configured.', { trackerCode: code })
            continue
        }

        const announceUrl = `${tracker.url}/announce/${tracker.passKey}`
        const { trackerTorrentPath } = await createTrackerTorrent({
            genericTorrentPath,
            trackerCode: code,
            announceUrl,
            sourcePath: filepath,
        })

        results[code] = trackerTorrentPath
    }

    return results
}
