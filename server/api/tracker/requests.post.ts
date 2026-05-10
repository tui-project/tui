import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { TRACKER_UPLOAD_STATUSES } from '../../model/tracker-upload-request'
import { findGenericTorrentCacheByFilepath, saveGenericTorrentCache } from '../../repositories/generic-torrent-cache-repository'
import { createTrackerUploadRequest, updateTrackerUploadRequestStatus, updateTrackerUploadRequestTorrentCreationProgress } from '../../repositories/tracker-request-repository'
import { createGenericTorrent } from '../../services/torrent'
import { logger } from '../../utils/logger'
import { parseValidatedBody } from '../../utils/request-validator'
import { AUDIO_CHANNELS, AUDIO_CODECS, AUDIO_METADATA_TYPES, CUTS, HDR_TYPES, MEDIA_TYPES, RESOLUTIONS, SERVICES, SOURCES, SOURCE_TYPES, VIDEO_CODECS } from '../../model/metadata'

const trimmedRequiredStringSchema = z.string().trim().min(1)
const trimmedOptionalStringSchema = z.string().trim().min(1).optional()
const optionalIntegerSchema = z.number().int().optional()
const requiredYearSchema = z
    .number()
    .int()
    .refine((value) => /^\d{4}$/.test(String(value)), {
        message: 'Invalid year format',
    })

const MetadataSchema = z
    .object({
        title: trimmedRequiredStringSchema,
        originalTitle: trimmedOptionalStringSchema,
        releaseGroup: trimmedOptionalStringSchema,
        mediaType: z.enum(MEDIA_TYPES),
        year: requiredYearSchema,
        season: optionalIntegerSchema,
        episode: optionalIntegerSchema,
        language: z.array(trimmedRequiredStringSchema),
        originalLanguage: trimmedRequiredStringSchema,
        source: z.enum(SOURCES),
        sourceType: z.enum(SOURCE_TYPES),
        service: z.enum(SERVICES).optional(),
        repack: z.boolean(),
        proper: z.boolean(),
        cut: z.enum(CUTS).optional(),
        hybrid: z.boolean(),
        resolution: z.enum(RESOLUTIONS),
        hdr: z.array(z.enum(HDR_TYPES)).optional(),
        videoCodec: z.enum(VIDEO_CODECS),
        audioCodec: z.enum(AUDIO_CODECS),
        audioChannels: z.enum(AUDIO_CHANNELS),
        audioMetadata: z.enum(AUDIO_METADATA_TYPES).optional(),
        tmdbId: z.number().int(),
        imdbId: trimmedOptionalStringSchema,
        tvdbId: optionalIntegerSchema,
    })
    .superRefine((metadata, ctx) => {
        if (metadata.mediaType === MEDIA_TYPES.TV && metadata.season == null) {
            ctx.addIssue({
                code: 'custom',
                path: ['season'],
                message: 'Season is required for TV media',
            })
        }

        if (metadata.mediaType === MEDIA_TYPES.TV && metadata.tvdbId == null) {
            ctx.addIssue({
                code: 'custom',
                path: ['tvdbId'],
                message: 'TVDB ID is required for TV media',
            })
        }

        if (metadata.source === SOURCES.WEB && metadata.service == null) {
            ctx.addIssue({
                code: 'custom',
                path: ['service'],
                message: 'Service is required for Web sources',
            })
        }
    })

const trackerUploadRequestSchema = z.object({
    filepath: trimmedRequiredStringSchema,
    metadata: MetadataSchema,
    description: z.string(),
    trackerCodes: z.array(trimmedRequiredStringSchema).min(1),
})

export default defineEventHandler(async (event) => {
    logger.debug('Tracker upload request received.')

    const request = await parseValidatedBody(event, trackerUploadRequestSchema, {
        onInvalid: (issues) => logger.warn('Rejected tracker upload request with invalid payload.', { issues }),
    })

    const uploadRequestId = randomUUID()
    const uploadRequest = await createTrackerUploadRequest({
        id: uploadRequestId,
        filepath: request.filepath,
        metadata: request.metadata,
        description: request.description,
        trackerCodes: request.trackerCodes,
        status: TRACKER_UPLOAD_STATUSES.PENDING,
        torrentCreationProgress: 0,
    })

    logger.info('Tracker upload request queued.', {
        id: uploadRequest.id,
        filepath: request.filepath,
        trackerCodes: request.trackerCodes,
        status: uploadRequest.status,
    })

    processTrackerUploadRequest(uploadRequest.id, request.filepath, request.trackerCodes)
    setResponseStatus(event, 201)

    return {
        id: uploadRequest.id,
        status: uploadRequest.status,
    }
})

async function processTrackerUploadRequest(uploadRequestId: string, filepath: string, trackerCodes: string[]) {
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

        await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.UPLOADING)

        logger.info('Tracker upload request ready for tracker uploads.', {
            id: uploadRequestId,
            filepath,
            trackerCodes,
            status: TRACKER_UPLOAD_STATUSES.UPLOADING,
            genericTorrentPath,
        })
    } catch (error: unknown) {
        await updateTrackerUploadRequestStatus(uploadRequestId, TRACKER_UPLOAD_STATUSES.FAIL)
        logger.error('Failed to create generic torrent for tracker upload request.', error, {
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
