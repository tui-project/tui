import { createError } from 'h3'
import { basename } from 'node:path'
import { z } from 'zod'
import { getSettings } from '../repositories/settings-repository'
import { logger } from '../utils/logger'
import { parseMetadataFromName, type ParsedNameMetadata } from '../services/media-name-parser'
import { parseMetadataFromMediainfo, type ParsedMediainfoMetadata } from '../services/mediainfo'
import { findByExternalID, findByTitle, getDetails, getExternalIDs, ID_TYPES } from '../services/tmdb'
import { isWithinAnyRoot, resolveMediaFilePath } from '../utils/file-system'
import type { Metadata } from '../model/metadata'
import { parseValidatedQuery } from '../utils/request-validator'

const metadataQuerySchema = z.object({
    path: z.string().trim().min(1),
})

export default defineEventHandler(async (event) => {
    logger.debug('Metadata request received.')

    const { path } = parseValidatedQuery(event, metadataQuerySchema, {
        errorMessage: 'invalid_path',
        onInvalid: (issues) => logger.warn('Rejected metadata request with invalid path query.', { issues }),
    })

    const settings = await getSettings()
    if (!isWithinAnyRoot(path, settings.mediaPaths)) {
        logger.warn('Rejected metadata request because path is outside configured roots.', { path: path })

        throw createError({
            statusCode: 400,
            message: 'invalid_path',
        })
    }

    const filename = basename(path)
    const metadataFromFilename = parseMetadataFromName(filename)
    logger.trace('Parsed filename metadata.', { metadataFromFilename })

    const mediaFilePath = await resolveMediaFilePath(path)
    logger.trace('Resolved media file path for metadata analysis.', { inputPath: path, mediaFilePath })

    const metadataFromMediainfo = await parseMetadataFromMediainfo(mediaFilePath, metadataFromFilename.sourceType)
    logger.trace('Parsed mediainfo metadata.', { metadataFromMediainfo })

    const metadata = await buildMetadata(filename, metadataFromFilename, metadataFromMediainfo)
    logger.debug('Metadata response.', { metadata })

    return metadata
})
async function buildMetadata(fileName: string, metadataFromFilename: ParsedNameMetadata, metadataFromMediainfo: ParsedMediainfoMetadata): Promise<Metadata> {
    const metadata: Metadata = {
        fileName,
        ...metadataFromFilename,
        ...metadataFromMediainfo,
    }
    metadata.mediaType = metadata.season === undefined ? 'movie' : 'tv'

    if (metadata.tmdbId) {
        logger.debug('TMDB enrichment using existing TMDB ID.', { tmdbId: metadata.tmdbId, mediaType: metadata.mediaType })

        const details = await getDetails(String(metadata.tmdbId), metadata.mediaType)
        metadata.title = details.title
        metadata.originalTitle = details.original_title
        metadata.originalLanguage = details.original_language
        metadata.year = details.year
    } else if (metadata.imdbId) {
        logger.debug('TMDB enrichment using IMDb ID.', { imdbId: metadata.imdbId, mediaType: metadata.mediaType })

        const searchResult = await findByExternalID(metadata.imdbId, ID_TYPES.IMDB, metadata.mediaType)
        metadata.tmdbId = searchResult.id
        metadata.title = searchResult.title
        metadata.originalTitle = searchResult.original_title
        metadata.originalLanguage = searchResult.original_language
        metadata.year = searchResult.year
    } else if (metadata.tvdbId !== undefined) {
        logger.debug('TMDB enrichment using TVDB ID.', { tvdbId: metadata.tvdbId, mediaType: metadata.mediaType })

        const searchResult = await findByExternalID(String(metadata.tvdbId), ID_TYPES.TVDB, metadata.mediaType)
        metadata.tmdbId = searchResult.id
        metadata.title = searchResult.title
        metadata.originalTitle = searchResult.original_title
        metadata.originalLanguage = searchResult.original_language
        metadata.year = searchResult.year
    } else {
        logger.debug('TMDB enrichment using title lookup.', { title: metadata?.title, mediaType: metadata.mediaType })

        const searchResult = await findByTitle(metadata.title ?? '', metadata.mediaType)
        metadata.tmdbId = searchResult.id
        metadata.title = searchResult.title
        metadata.originalTitle = searchResult.original_title
        metadata.originalLanguage = searchResult.original_language
        metadata.year = searchResult.year
    }

    logger.debug('Fetching TMDB external IDs.', { tmdbId: metadata.tmdbId, mediaType: metadata.mediaType })

    const externalIDs = await getExternalIDs(String(metadata.tmdbId ?? ''), metadata.mediaType)
    metadata.imdbId = externalIDs.imdb_id
    metadata.tvdbId = externalIDs.tvdb_id ?? undefined

    return metadata
}
