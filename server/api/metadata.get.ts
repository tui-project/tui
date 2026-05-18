import { createError } from 'h3'
import { basename } from 'node:path'
import { z } from 'zod'
import { getSettings } from '../repositories/settings-repository'
import { logger } from '../utils/logger'
import { parseMetadataFromName, type ParsedNameMetadata } from '../services/media-name-parser'
import { parseMetadataFromMediainfo, type ParsedMediainfoMetadata } from '../services/mediainfo'
import { findByExternalID, findByTitle, findLocale, getDetails, getExternalIDs, ID_TYPES } from '../services/tmdb'
import { isWithinAnyRoot, resolveMediaFilePath } from '../utils/file-system'
import { MEDIA_TYPES, type Metadata } from '../model/metadata'
import { parseValidatedQuery } from '../utils/request-validator'
import { findTvdbSpecial } from '../services/tvdb'

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
        if (details) {
            metadata.title = details.title
            metadata.originalTitle = details.original_title
            metadata.originalLanguage = details.original_language
            metadata.year = details.year
            metadata.imdbId = details.external_ids?.imdb_id
            metadata.tvdbId = details.external_ids?.tvdb_id
            if (metadata.title && metadata.mediaType === MEDIA_TYPES.TV) metadata.locale = await findLocale(metadata?.title, metadata.tmdbId, metadata.mediaType)
        }
    } else if (metadata.imdbId) {
        logger.debug('TMDB enrichment using IMDb ID.', { imdbId: metadata.imdbId, mediaType: metadata.mediaType })

        const findResult = await findByExternalID(metadata.imdbId, ID_TYPES.IMDB, metadata.mediaType)
        if (findResult) {
            metadata.tmdbId = findResult.id
            metadata.title = findResult.title
            metadata.originalTitle = findResult.original_title
            metadata.originalLanguage = findResult.original_language
            metadata.year = findResult.year
            metadata.imdbId = findResult.external_ids?.imdb_id ?? metadata.imdbId
            metadata.tvdbId = findResult.external_ids?.tvdb_id ?? undefined
            if (metadata.title && metadata.mediaType === MEDIA_TYPES.TV) metadata.locale = await findLocale(metadata.title, metadata.tmdbId, metadata.mediaType)
        }
    } else if (metadata.tvdbId !== undefined) {
        logger.debug('TMDB enrichment using TVDB ID.', { tvdbId: metadata.tvdbId, mediaType: metadata.mediaType })

        const findResult = await findByExternalID(String(metadata.tvdbId), ID_TYPES.TVDB, metadata.mediaType)
        if (findResult) {
            metadata.tmdbId = findResult.id
            metadata.title = findResult.title
            metadata.originalTitle = findResult.original_title
            metadata.originalLanguage = findResult.original_language
            metadata.year = findResult.year
            metadata.imdbId = findResult.external_ids?.imdb_id
            metadata.tvdbId = findResult.external_ids?.tvdb_id ?? undefined
            if (metadata.title && metadata.mediaType === MEDIA_TYPES.TV) metadata.locale = await findLocale(metadata.title, metadata.tmdbId, metadata.mediaType)
        }
    } else {
        logger.debug('TMDB enrichment using title lookup.', { title: metadata?.title, mediaType: metadata.mediaType })

        const searchResult = await findByTitle(metadata.title!, metadata.mediaType)
        if (searchResult) {
            metadata.tmdbId = searchResult.id
            metadata.title = searchResult.title
            metadata.originalTitle = searchResult.original_title
            metadata.originalLanguage = searchResult.original_language
            metadata.year = searchResult.year
            metadata.locale = searchResult.origin_country

            logger.debug('Fetching TMDB external IDs.', { tmdbId: metadata.tmdbId, mediaType: metadata.mediaType })

            const externalIDs = await getExternalIDs(String(metadata.tmdbId), metadata.mediaType)
            if (externalIDs) {
                metadata.imdbId = externalIDs.imdb_id
                metadata.tvdbId = externalIDs.tvdb_id
            }
        }
    }

    if (isSpecialEpisode(metadata) && metadata.tvdbId && metadata.specialName) {
        logger.debug('Attempting TVDb special lookup.', { tvdbId: metadata.tvdbId, specialName: metadata.specialName })

        const match = await findTvdbSpecial(metadata.tvdbId, metadata.specialName)
        if (match) {
            metadata.season = 0
            metadata.episode = match.episodeNumber
            metadata.specialName = match.title
        }
    }

    return metadata
}

function isSpecialEpisode(metadata: Metadata): boolean {
    return metadata.season === 0 || metadata.episode === 0
}
