import { z } from 'zod'
import { getLogo } from '../services/tmdb'
import { createLogger } from '../utils/logger'
import { parseValidatedQuery } from '../utils/request-validator'

const logger = createLogger('API')

const logoQuerySchema = z.object({
    tmdbId: z.coerce.number().int().positive(),
    mediaType: z.enum([MEDIA_TYPES.MOVIE, MEDIA_TYPES.TV]),
    originalLanguage: z.string().trim().min(1),
})

export default defineEventHandler(async (event) => {
    const query = parseValidatedQuery(event, logoQuerySchema, {
        onInvalid: (issues) => logger.warn('Rejected logo request with invalid query.', { issues }),
    })

    logger.trace('Logo request received.', query)

    const logo = await getLogo(query.tmdbId, query.mediaType, query.originalLanguage)

    logger.trace('Logo response ready.', { logo })

    return logo
})
