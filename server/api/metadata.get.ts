import { createError } from 'h3'
import { basename } from 'node:path'
import { z } from 'zod'
import { getSettings } from '../repositories/settings-repository'
import { createLogger } from '../utils/logger'
import { parseMetadataFromName, type ParsedNameMetadata } from '../services/media-name-parser'
import { parseMetadataFromMediainfo, type ParsedMediainfoMetadata } from '../services/mediainfo'
import { findByExternalID, findByTitle, findLocale, getDetails, ID_TYPES, type TMDbAlternativeTitle } from '../services/tmdb'
import { isWithinAnyRoot, resolveMediaFilePath } from '../utils/file-system'
import { parseValidatedQuery } from '../utils/request-validator'
import { findTvdbSpecial, findTvdbSpecialRange } from '../services/tvdb'

const logger = createLogger('API')

const metadataQuerySchema = z.object({
    path: z.string().trim().min(1),
})

export default defineEventHandler(async (event) => {
    logger.trace('Metadata request received.')

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
    const mediaFilePath = await resolveMediaFilePath(path)
    const metadataFromMediainfo = await parseMetadataFromMediainfo(mediaFilePath, metadataFromFilename.sourceType)
    const { metadata, logoUrl } = await buildMetadata(metadataFromFilename, metadataFromMediainfo)

    logger.trace('Metadata response ready.', { filename, mediaType: metadata.mediaType })

    return { filename, metadata, logoUrl }
})

async function buildMetadata(metadataFromFilename: ParsedNameMetadata, metadataFromMediainfo: ParsedMediainfoMetadata): Promise<{ metadata: PartialMetadata; logoUrl?: string }> {
    logger.trace('Building metadata', { metadataFromFilename, metadataFromMediainfo })

    let logoUrl: string | undefined
    const { videoStandard, frameRate, ...mediainfoFields } = metadataFromMediainfo
    const metadata: PartialMetadata = { ...metadataFromFilename, ...withDefined(mediainfoFields) }
    metadata.mediaType = metadata.season === undefined ? 'movie' : 'tv'

    if (!metadata.tmdbId) await resolveTmdbId(metadata, metadata.mediaType)
    if (metadata.tmdbId) {
        logger.trace('Enriching metadata from TMDB details.', { tmdbId: metadata.tmdbId, mediaType: metadata.mediaType })

        const details = await getDetails(String(metadata.tmdbId), metadata.mediaType)
        if (details) {
            logger.debug('TMDB enrichment using details.', { tmdbId: metadata.tmdbId, mediaType: metadata.mediaType, details })

            metadata.title = details.title
            metadata.originalTitle = selectOriginalTitle(details.original_title, details.alternative_titles, details.origin_country, details.title)
            metadata.originalLanguage = details.original_language
            metadata.year = details.year
            metadata.imdbId = details.external_ids?.imdb_id ?? metadata.imdbId
            metadata.tvdbId = details.external_ids?.tvdb_id ?? metadata.tvdbId
            metadata.originCountry = details.origin_country
            logoUrl = details.logo_url

            if (metadata.title && metadata.mediaType === MEDIA_TYPES.TV && !metadata.locale) {
                metadata.locale = await findLocale(metadata.title, metadata.tmdbId, metadata.mediaType)
            }
        }
    }

    if (isSpecialEpisode(metadata) && metadata.tvdbId) {
        if (metadata.episode != null && metadata.episodeEnd != null) {
            const match = await findTvdbSpecialRange(metadata.tvdbId, metadata.episode, metadata.episodeEnd)
            if (match) {
                logger.debug('TVDb special range lookup.', { tvdbId: metadata.tvdbId, episodeStart: metadata.episode, episodeEnd: metadata.episodeEnd, match })

                metadata.season = 0
                metadata.episode = match.episodeStart
                metadata.episodeEnd = match.episodeEnd
                metadata.specialName = match.title
            }
        } else if (metadata.episode != null) {
            const match = await findTvdbSpecial(metadata.tvdbId, metadata.episode, metadata.specialName)
            if (match) {
                logger.debug('TVDb special lookup.', { tvdbId: metadata.tvdbId, episode: metadata.episode, specialName: metadata.specialName, match })

                metadata.season = 0
                metadata.episode = match.episodeNumber
                metadata.specialName = match.title
            }
        }
    }

    if (metadata.source === SOURCES.BLURAY && metadata.resolution === RESOLUTIONS['2160p']) {
        metadata.source = SOURCES.UHD_BLURAY
    }

    if (metadata.source === SOURCES.DVD) {
        if (videoStandard === VIDEO_STANDARDS.PAL || frameRate === 25 || frameRate === 50) {
            metadata.source = SOURCES.PAL_DVD
        } else if (videoStandard === VIDEO_STANDARDS.NTSC || frameRate) {
            metadata.source = SOURCES.NTSC_DVD
        }
    }

    logger.debug('Metadata build completed.', { metadata })

    return { metadata, logoUrl }
}

async function resolveTmdbId(metadata: PartialMetadata, mediaType: MediaType): Promise<void> {
    logger.trace('Resolving TMDB ID.', {
        ...(metadata.imdbId && { imdbId: metadata.imdbId }),
        ...(metadata.tvdbId && { tvdbId: metadata.tvdbId }),
        title: metadata.title,
        mediaType,
    })

    if (metadata.imdbId) {
        const findResult = await findByExternalID(metadata.imdbId, ID_TYPES.IMDB, mediaType)
        if (findResult) {
            logger.debug('TMDB ID resolved using IMDb ID.', { imdbId: metadata.imdbId, mediaType, findResult })
            metadata.tmdbId = findResult.id
        }
    } else if (metadata.tvdbId !== undefined) {
        const findResult = await findByExternalID(String(metadata.tvdbId), ID_TYPES.TVDB, mediaType)
        if (findResult) {
            logger.debug('TMDB ID resolved using TVDB ID.', { tvdbId: metadata.tvdbId, mediaType, findResult })
            metadata.tmdbId = findResult.id
        }
    } else {
        let searchResult = await findByTitle(metadata.title!, mediaType, metadata.year)
        if (!searchResult && metadata.year !== undefined) {
            searchResult = await findByTitle(metadata.title!, mediaType)
        }

        if (searchResult) {
            logger.debug('TMDB ID resolved using title lookup.', { title: metadata.title, year: metadata.year, mediaType, searchResult })
            metadata.tmdbId = searchResult.id
        }
    }
}

function selectOriginalTitle(
    originalTitle: string | undefined,
    alternativeTitles: TMDbAlternativeTitle[] = [],
    originCountry: string | undefined,
    preferredTitle: string | undefined
): string | undefined {
    logger.trace('Selecting a transliteration from TMDB alternative titles.', { originCountry, alternativeTitles })

    const rankedTitles = alternativeTitles
        .map((title) => ({ title, selectionPriority: getSelectionPriority(title, originCountry) }))
        .filter(({ title, selectionPriority }) => title.type.toLowerCase() !== 'festival title' && isLatinTitle(title.title) && selectionPriority > 0)
        .toSorted(
            (left, right) =>
                right.selectionPriority - left.selectionPriority ||
                Number(right.title.title === preferredTitle) - Number(left.title.title === preferredTitle) ||
                Number(hasLatinDiacritics(right.title.title)) - Number(hasLatinDiacritics(left.title.title)) ||
                left.title.title.localeCompare(right.title.title)
        )
    const transliteration = rankedTitles.find(({ title }) => isRomanizationType(title.type))?.title.title
    const selected = transliteration ?? (originalTitle && originalTitle !== preferredTitle ? originalTitle : (rankedTitles[0]?.title.title ?? originalTitle))

    logger.debug('Selected original title from TMDB details.', { originCountry, alternativeTitles, originalTitle, selected })

    return selected
}

function getSelectionPriority(entry: TMDbAlternativeTitle, originCountry: string | undefined): number {
    if (isRomanizationType(entry.type)) return 3
    if (entry.iso_3166_1 === originCountry) return 2
    if (entry.iso_3166_1 === 'US') return 1
    return 0
}

function isLatinTitle(title: string): boolean {
    return /\p{Script=Latin}/u.test(title) && !/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(title)
}

function isRomanizationType(type: string): boolean {
    return type.toLowerCase() === 'transliteration' || type.toLowerCase() === 'romanized'
}

function hasLatinDiacritics(title: string): boolean {
    return /[^\p{ASCII}]/u.test(title)
}

function isSpecialEpisode(metadata: PartialMetadata): boolean {
    return metadata.season === 0 || metadata.episode === 0
}

function withDefined<T extends object>(obj: T): T {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}
