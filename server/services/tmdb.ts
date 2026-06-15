import { getSettings } from '../repositories/settings-repository'
import { logger } from '../utils/logger'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_API_KEY_REQUIRED_ERROR = 'tmdb api key is required'

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
    media_type: MediaType
    origin_country?: string[]
    external_ids: TMDbExternalIDs
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
    locale?: string
    external_ids: TMDbExternalIDs
}

export async function findByTitle(title: string, mediaType: MediaType): Promise<TMDbSearchResult | null> {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
        logger.debug('TMDB title lookup skipped due to empty title.')
        return null
    }

    logger.debug('TMDB title lookup request prepared.', { mediaType, endpoint: 'search/multi', trimmedTitle })

    const apiKey = await getApiKey()
    const path = `${TMDB_BASE_URL}/search/multi`

    try {
        const response = await $fetch<{ results: TMDbItem[] }>(path, {
            query: {
                api_key: apiKey,
                query: encodeURIComponent(trimmedTitle),
            },
        })

        const results = response.results.filter((item) => item.media_type === mediaType).map((item) => toSearchResult(item, mediaType))
        const match = results[0]
        if (!match) {
            logger.debug('TMDB title lookup returned no matching result.', { mediaType, resultCount: results.length })
            return null
        }

        if (match.media_type === MEDIA_TYPES.TV) {
            const locale = detectLocale(match, results, mediaType)
            return { ...match, locale }
        } else {
            return match
        }
    } catch (error: unknown) {
        logger.warn('TMDB request failed.', { path, error })
        return null
    }
}

async function getApiKey() {
    const settings = await getSettings()
    const apiKey = settings.tmdbApiKey.trim()

    if (!apiKey) {
        logger.warn('TMDB API key missing from settings.')
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

    for (const char of normalized) {
        if (char.charCodeAt(0) > 127) {
            return undefined
        }
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

function detectLocale(match: TMDbSearchResult, allResults: TMDbSearchResult[], mediaType: MediaType): string | undefined {
    const duplicates = allResults.filter((item) => item.title === match.title && (mediaType !== MEDIA_TYPES.MOVIE || item.year === match.year)).sort((a, b) => a.year - b.year)
    if (duplicates.length < 2 || duplicates[0]?.id === match.id) return undefined
    if (duplicates[0]?.origin_country === match.origin_country) return undefined

    return match.origin_country
}

export async function findLocale(title: string, tmdbId: number, mediaType: MediaType): Promise<string | undefined> {
    logger.debug('TMDB locale search request prepared.', { mediaType, endpoint: 'search/multi', title, tmdbId })

    const apiKey = await getApiKey()
    const path = `${TMDB_BASE_URL}/search/multi`

    try {
        const response = await $fetch<{ results: TMDbItem[] }>(path, {
            query: {
                api_key: apiKey,
                query: encodeURIComponent(title),
            },
        })
        const results = response.results.filter((item) => item.media_type === mediaType).map((item) => toSearchResult(item, mediaType))
        const match = results.find((item) => item.id === tmdbId)
        if (!match) return undefined

        return detectLocale(match, results, mediaType)
    } catch (error: unknown) {
        logger.warn('TMDB request failed.', { path, error })
        return undefined
    }
}

export async function findByExternalID(externalID: string, idType: IDType, mediaType: MediaType): Promise<TMDbSearchResult | null> {
    const normalizedExternalID = normalizeTMDbID(externalID)
    if (!normalizedExternalID) {
        logger.debug('TMDB external id lookup skipped due to empty id.', { mediaType, idType })
        return null
    }

    if (idType !== ID_TYPES.IMDB && idType !== ID_TYPES.TVDB) {
        logger.warn('TMDB external id lookup skipped due to unsupported id type.', { mediaType, idType })
        return null
    }

    const apiKey = await getApiKey()
    const path = `${TMDB_BASE_URL}/find/${normalizedExternalID}`

    logger.debug('TMDB external id lookup request prepared.', { mediaType, idType, endpoint: path, externalID: normalizedExternalID })

    try {
        const response = await $fetch<{ movie_results: TMDbItem[]; tv_results: TMDbItem[] }>(path, {
            query: {
                api_key: apiKey,
                external_source: idType,
            },
        })

        const selected = mediaType === MEDIA_TYPES.MOVIE ? response.movie_results[0] : response.tv_results[0]
        if (!selected) {
            logger.debug('TMDB external id lookup returned no result for requested media type.', {
                mediaType,
                idType,
                movieResultCount: response.movie_results.length,
                tvResultCount: response.tv_results.length,
            })
            return null
        }

        const externalIds: TMDbExternalIDs = {
            imdb_id: selected.external_ids.imdb_id,
            tvdb_id: selected.external_ids.tvdb_id,
        }

        return toSearchResult({ ...selected, external_ids: externalIds }, mediaType)
    } catch (error: unknown) {
        logger.warn('TMDB request failed.', { path, error })
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
    const normalizedTMDbID = normalizeTMDbID(tmdbID)
    if (!normalizedTMDbID) {
        logger.warn('TMDB details lookup skipped due to empty TMDB ID.', { mediaType })
        return null
    }

    const apiKey = await getApiKey()
    const path = `${TMDB_BASE_URL}/${mediaType}/${normalizedTMDbID}`

    logger.debug('TMDB details request prepared.', { mediaType, endpoint: path, tmdbID: normalizedTMDbID })

    try {
        const response = await $fetch<TMDbItem>(path, {
            query: {
                api_key: apiKey,
                append_to_response: 'external_ids',
            },
        })

        return toSearchResult(response, mediaType)
    } catch (error: unknown) {
        logger.warn('TMDB request failed.', { path, error })
        return null
    }
}

export async function getExternalIDs(tmdbID: string, mediaType: MediaType): Promise<TMDbExternalIDs | null> {
    const normalizedTMDbID = normalizeTMDbID(tmdbID)
    if (!normalizedTMDbID) {
        logger.warn('TMDB external ids lookup skipped due to empty TMDB ID.', { mediaType })
        return null
    }

    const apiKey = await getApiKey()
    const path = `${TMDB_BASE_URL}/${mediaType}/${normalizedTMDbID}/external_ids`

    logger.debug('TMDB external ids request prepared.', { mediaType, endpoint: path, tmdbID: normalizedTMDbID })

    try {
        return await $fetch<TMDbExternalIDs>(path, {
            query: {
                api_key: apiKey,
            },
        })
    } catch (error: unknown) {
        logger.warn('TMDB request failed.', { path, error })
        return null
    }
}

export async function getLanguages(): Promise<{ iso_639_1: string; english_name: string }[] | null> {
    const apiKey = await getApiKey()
    const path = `${TMDB_BASE_URL}/configuration/languages`

    logger.debug('TMDB languages request prepared.')

    try {
        return await $fetch<{ iso_639_1: string; english_name: string }[]>(path, {
            query: { api_key: apiKey },
        })
    } catch (error: unknown) {
        logger.warn('TMDB request failed.', { path, error })
        return null
    }
}

export async function getAlternativeTitles(tmdbId: number, mediaType: MediaType): Promise<{ iso_3166_1: string; title: string; type: string }[]> {
    const apiKey = await getApiKey()
    const path = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}/alternative_titles`

    logger.debug('TMDB alternative titles request prepared.', { mediaType, endpoint: path, tmdbId })

    try {
        const response = await $fetch<{ results?: { iso_3166_1: string; title: string; type: string }[]; titles?: { iso_3166_1: string; title: string; type: string }[] }>(path, {
            query: { api_key: apiKey },
        })

        const entries = response.results ?? response.titles ?? []

        logger.trace('TMDB alternative titles response', { entries })

        return entries
    } catch (error: unknown) {
        logger.warn('TMDB request failed.', { path, error })
        return []
    }
}
