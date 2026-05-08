import { z } from 'zod'
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

    logger.info('Tracker upload request accepted.', {
        filepath: request.filepath,
        trackerCodes: request.trackerCodes,
        metadata: request.metadata,
        description: request.description,
    })

    setResponseStatus(event, 201)
})
