import { getSettings } from '../repositories/settings-repository'
import { createLogger } from '../utils/logger'
import { normaliseSearchString } from '../utils/string'

const logger = createLogger('tmdb')

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/original'
const TMDB_API_KEY_REQUIRED_ERROR = 'tmdb api key is required'
const NON_LATIN_SCRIPT_REGEX = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u

export const ID_TYPES = {
    IMDB: 'imdb_id',
    TVDB: 'tvdb_id',
} as const
type IDType = (typeof ID_TYPES)[keyof typeof ID_TYPES]

interface TMDbItem {
    id: number
    title?: string
    name?: string
    original_title?: string
    original_name?: string
    original_language: string
    release_date?: string
    first_air_date?: string
    media_type?: MediaType
    origin_country?: string[]
    external_ids: TMDbExternalIDs
    alternative_titles?: {
        results?: TMDbAlternativeTitle[]
        titles?: TMDbAlternativeTitle[]
    }
    images?: {
        logos: TMDbImage[]
    }
}

export interface TMDbAlternativeTitle {
    iso_3166_1: string
    title: string
    type: string
}

export interface TMDbExternalIDs {
    imdb_id: string
    tvdb_id?: number
}

export interface TMDbSearchResult {
    id: number
    title: string
    original_title: string
    original_language: string
    year: number
    media_type: MediaType
    origin_country?: string
    external_ids: TMDbExternalIDs
    alternative_titles: TMDbAlternativeTitle[]
    logo_url?: string
}

interface TMDbImage {
    iso_3166_1: string | null
    iso_639_1: string | null
    file_path: string
}

export async function findByTitle(title: string, mediaType: MediaType, year?: number): Promise<TMDbSearchResult | null> {
    logger.trace('Find by title', { title, mediaType, year })

    const trimmedTitle = title.trim().normalize('NFC')
    if (!trimmedTitle) {
        logger.warn('Find by title failed due to empty title.', { mediaType })
        return null
    }

    const apiKey = await getApiKey()
    const path = `${TMDB_BASE_URL}/search/${mediaType}`

    logger.trace('Find by title request prepared.', { mediaType, endpoint: path, trimmedTitle })

    try {
        const response = await $fetch<{ results: TMDbItem[] }>(path, {
            query: {
                api_key: apiKey,
                query: trimmedTitle,
                ...(year !== undefined && { [mediaType === 'movie' ? 'primary_release_year' : 'first_air_date_year']: year }),
            },
        })

        logger.trace('Find by title response received.', { title, mediaType, response })

        const normalizedTitle = normaliseSearchString(title)
        const match = response.results
            .map((item) => toSearchResult(item, mediaType))
            .toSorted((left, right) => getTitleMatchScore(right, normalizedTitle, year) - getTitleMatchScore(left, normalizedTitle, year))[0]

        if (!match) {
            logger.warn('Find by title response returned no matching result for media type.', { mediaType })
            return null
        } else {
            return match
        }
    } catch (error: unknown) {
        logger.warn('Find by title request failed.', { mediaType, endpoint: path, trimmedTitle, error })
        return null
    }
}

async function getApiKey() {
    const settings = await getSettings()
    const apiKey = settings.tmdbApiKey.trim()

    if (!apiKey) {
        logger.warn('API key missing from settings.')
        throw new Error(TMDB_API_KEY_REQUIRED_ERROR)
    }

    return apiKey
}

function toSearchResult(item: TMDbItem, mediaType: MediaType): TMDbSearchResult {
    return {
        id: item.id,
        title: firstNonEmpty(sanitiseText(item.title), sanitiseText(item.name))!,
        original_title: firstNonEmpty(sanitiseText(item.original_title), sanitiseText(item.original_name))!,
        original_language: item.original_language,
        year: extractYearFromDate(firstNonEmpty(item.release_date, item.first_air_date))!,
        media_type: mediaType,
        origin_country: item.origin_country?.[0],
        external_ids: item.external_ids,
        alternative_titles: item.alternative_titles?.results ?? item.alternative_titles?.titles ?? [],
        logo_url: selectLogoUrl(item.images?.logos ?? [], item.original_language),
    }
}

function firstNonEmpty(...values: Array<string | undefined>) {
    return values.find((value) => value && value.length > 0)
}

function sanitiseText(value: string | undefined) {
    if (!value) {
        return undefined
    }

    const normalized = value.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    if (!normalized) {
        return undefined
    }

    if (NON_LATIN_SCRIPT_REGEX.test(normalized)) {
        return undefined
    }

    return normalized
}

function extractYearFromDate(value: string | undefined) {
    if (!value || value.length < 4) {
        return undefined
    }

    const year = Number.parseInt(value.slice(0, 4), 10)
    if (Number.isNaN(year)) {
        return undefined
    }

    return year
}

function selectLogoUrl(logos: TMDbImage[], originalLanguage: string) {
    const logo = logos.find((item) => item.iso_3166_1 === 'US' && item.iso_639_1 === 'en') ?? logos.find((item) => item.iso_639_1 === originalLanguage)

    return logo ? `${TMDB_IMAGE_BASE_URL}${logo.file_path}` : undefined
}

function getTitleMatchScore(result: TMDbSearchResult, normalizedTitle: string, year: number | undefined): number {
    const titleMatches = [result.title, result.original_title, ...result.alternative_titles.map(({ title }) => title)].some(
        (candidate) => normaliseSearchString(candidate) === normalizedTitle
    )

    return Number(year !== undefined && result.year === year) * 2 + Number(titleMatches)
}

export async function findLocale(title: string, tmdbId: number, mediaType: MediaType): Promise<string | undefined> {
    logger.trace('Find Locale.', { title, tmdbId, mediaType })

    const trimmedTitle = title.trim().normalize('NFC')
    const apiKey = await getApiKey()
    const path = `${TMDB_BASE_URL}/search/multi`

    logger.trace('Locale search request prepared.', { title: trimmedTitle, tmdbId, mediaType, endpoint: path })

    try {
        const response = await $fetch<{ results: TMDbItem[] }>(path, {
            query: {
                api_key: apiKey,
                query: trimmedTitle,
            },
        })

        logger.trace('Locale search response received.', { title: trimmedTitle, tmdbId, mediaType, response })

        const results = response.results.filter((item) => item.media_type === mediaType).map((item) => toSearchResult(item, mediaType))
        const match = results.find((item) => item.id === tmdbId)
        if (!match) return undefined

        return detectLocale(match, results, mediaType)
    } catch (error: unknown) {
        logger.warn('Locale search request failed.', { title: trimmedTitle, tmdbId, mediaType, endpoint: path, error })
        return undefined
    }
}

function detectLocale(match: TMDbSearchResult, allResults: TMDbSearchResult[], mediaType: MediaType): string | undefined {
    logger.trace('Detecting locale.', { match, allResults })

    const duplicates = allResults.filter((item) => item.title === match.title && (mediaType !== MEDIA_TYPES.MOVIE || item.year === match.year)).sort((a, b) => a.year - b.year)
    if (duplicates.length < 2 || duplicates[0]?.id === match.id) return undefined
    if (duplicates[0]?.origin_country === match.origin_country) return undefined

    return match.origin_country
}

export async function findByExternalID(externalID: string, idType: IDType, mediaType: MediaType): Promise<TMDbSearchResult | null> {
    logger.trace('Find by external ID.', { externalID, idType, mediaType })

    const normalizedExternalID = normalizeTMDbID(externalID)
    if (!normalizedExternalID) {
        logger.warn('Find by external ID failed due to empty id.', { mediaType, idType })
        return null
    }

    if (idType !== ID_TYPES.IMDB && idType !== ID_TYPES.TVDB) {
        logger.warn('Find by external ID failed due to unsupported id type.', { mediaType, idType })
        return null
    }

    const apiKey = await getApiKey()
    const path = `${TMDB_BASE_URL}/find/${normalizedExternalID}`

    logger.trace('Find by external ID request prepared.', { mediaType, idType, endpoint: path, externalID: normalizedExternalID })

    try {
        const response = await $fetch<{ movie_results: TMDbItem[]; tv_results: TMDbItem[] }>(path, {
            query: {
                api_key: apiKey,
                external_source: idType,
            },
        })

        logger.trace('Find by external ID response received.', { externalID, idType, mediaType, response })

        const selected = mediaType === MEDIA_TYPES.MOVIE ? response.movie_results[0] : response.tv_results[0]
        if (!selected) {
            logger.warn('Find by external ID response returned no result for requested media type.', {
                mediaType,
            })
            return null
        }

        const externalIds: TMDbExternalIDs = {
            imdb_id: selected.external_ids.imdb_id,
            tvdb_id: selected.external_ids.tvdb_id,
        }

        return toSearchResult({ ...selected, external_ids: externalIds }, mediaType)
    } catch (error: unknown) {
        logger.warn('Find by external ID request failed.', { mediaType, idType, endpoint: path, externalID: normalizedExternalID, error })
        return null
    }
}

function normalizeTMDbID(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/^movie\//, '')
        .replace(/^tv\//, '')
        .trim()
}

export async function getDetails(tmdbID: string, mediaType: MediaType): Promise<TMDbSearchResult | null> {
    logger.trace('Get details', { tmdbID, mediaType })

    const normalizedTMDbID = normalizeTMDbID(tmdbID)
    if (!normalizedTMDbID) {
        logger.warn('Get details lookup skipped due to empty ID.', { mediaType })
        return null
    }

    const apiKey = await getApiKey()
    const path = `${TMDB_BASE_URL}/${mediaType}/${normalizedTMDbID}`

    logger.trace('Get details request prepared.', { mediaType, endpoint: path, tmdbID: normalizedTMDbID })

    try {
        const response = await $fetch<TMDbItem>(path, {
            query: {
                api_key: apiKey,
                append_to_response: 'external_ids,alternative_titles,images',
            },
        })

        logger.trace('Get details response received.', { mediaType, tmdbID: normalizedTMDbID, response })

        return toSearchResult(response, mediaType)
    } catch (error: unknown) {
        logger.warn('Get details request failed.', { mediaType, endpoint: path, tmdbID: normalizedTMDbID, error })
        return null
    }
}
