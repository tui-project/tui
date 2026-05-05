import type { MediaType } from '../model/metadata'
import { getSettings } from '../repositories/settings-repository'
import { logger } from '../utils/logger'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3/'

export const TMDB_API_KEY_REQUIRED_ERROR = 'tmdb api key is required'

export const ID_TYPES = {
    IMDB: 'imdb_id',
    TVDB: 'tvdb_id',
} as const

export type IDType = (typeof ID_TYPES)[keyof typeof ID_TYPES]

export interface TMDbExternalIDs {
    imdb_id?: string
    tvdb_id?: number | null
}

export interface TMDbSearchResult {
    id?: number
    title?: string
    original_title?: string
    original_language?: string
    year?: number
    media_type?: MediaType
}

interface TMDbItem {
    id?: number
    title?: string
    name?: string
    original_title?: string
    original_name?: string
    original_language?: string
    release_date?: string
    first_air_date?: string
    media_type?: MediaType
}

export async function findByTitle(title: string, mediaType: MediaType): Promise<TMDbSearchResult> {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
        logger.debug('TMDB title lookup skipped due to empty title.', { mediaType })
        return {}
    }

    logger.debug('TMDB title lookup request prepared.', { mediaType, endpoint: 'search/multi', title: trimmedTitle })
    const payload = await requestTMDb<{ results?: TMDbItem[] }>('search/multi', { query: trimmedTitle })

    const results = payload?.results ?? []
    const match = results.find((item) => item.media_type === mediaType)
    if (!match) {
        logger.debug('TMDB title lookup returned no matching result.', { mediaType, resultCount: results.length })
    }

    return toSearchResult(match, mediaType)
}

export async function findByExternalID(externalID: string, idType: IDType, mediaType: MediaType): Promise<TMDbSearchResult> {
    const normalizedExternalID = normalizeTMDbID(externalID)
    if (!normalizedExternalID) {
        logger.debug('TMDB external id lookup skipped due to empty id.', { mediaType, idType })
        return {}
    }

    if (idType !== ID_TYPES.IMDB && idType !== ID_TYPES.TVDB) {
        logger.warn('TMDB external id lookup skipped due to unsupported id type.', { mediaType, idType })
        return {}
    }

    const path = `find/${normalizedExternalID}`
    logger.debug('TMDB external id lookup request prepared.', { mediaType, idType, endpoint: path, externalID: normalizedExternalID })
    const payload = await requestTMDb<{ movie_results?: TMDbItem[]; tv_results?: TMDbItem[] }>(path, {
        external_source: idType,
    })

    const movieResults = payload?.movie_results ?? []
    const tvResults = payload?.tv_results ?? []
    const selected = mediaType === 'movie' ? movieResults[0] : tvResults[0]
    if (!selected) {
        logger.debug('TMDB external id lookup returned no result for requested media type.', {
            mediaType,
            idType,
            movieResultCount: movieResults.length,
            tvResultCount: tvResults.length,
        })
    }

    return toSearchResult(selected, mediaType)
}

export async function getDetails(tmdbID: string, mediaType: MediaType): Promise<TMDbSearchResult> {
    const normalizedTMDbID = normalizeTMDbID(tmdbID)
    if (!normalizedTMDbID) {
        logger.warn('TMDB details lookup skipped due to empty TMDB ID.', { mediaType })
        return {}
    }

    const path = `${mediaType}/${normalizedTMDbID}`
    logger.debug('TMDB details request prepared.', { mediaType, endpoint: path, tmdbID: normalizedTMDbID })
    const payload = await requestTMDb<TMDbItem>(path)

    return toSearchResult(payload ?? undefined, mediaType)
}

export async function getExternalIDs(tmdbID: string, mediaType: MediaType): Promise<TMDbExternalIDs> {
    const normalizedTMDbID = normalizeTMDbID(tmdbID)
    if (!normalizedTMDbID) {
        logger.warn('TMDB external ids lookup skipped due to empty TMDB ID.', { mediaType })
        return {}
    }

    const path = `${mediaType}/${normalizedTMDbID}/external_ids`
    logger.debug('TMDB external ids request prepared.', { mediaType, endpoint: path, tmdbID: normalizedTMDbID })
    const payload = await requestTMDb<TMDbExternalIDs>(path)

    return payload ?? {}
}

async function requestTMDb<T>(path: string, query: Record<string, string> = {}) {
    const apiKey = await getApiKey()
    const url = new URL(path, TMDB_BASE_URL)
    url.searchParams.set('api_key', apiKey)

    for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value)
    }

    try {
        return await $fetch<T>(url.toString())
    } catch (error: unknown) {
        logger.warn('TMDB request failed.', {
            path,
            error: toLoggableFetchError(error),
        })
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

function toLoggableFetchError(error: unknown) {
    if (!error || typeof error !== 'object') {
        return {
            message: String(error),
        }
    }

    const payload = error as {
        name?: unknown
        message?: unknown
        statusCode?: unknown
        data?: {
            status_message?: unknown
            status_code?: unknown
        }
    }

    return {
        name: typeof payload.name === 'string' ? payload.name : undefined,
        message: typeof payload.message === 'string' ? payload.message : undefined,
        statusCode: typeof payload.statusCode === 'number' ? payload.statusCode : undefined,
        tmdbStatusCode: typeof payload.data?.status_code === 'number' ? payload.data.status_code : undefined,
        tmdbStatusMessage: typeof payload.data?.status_message === 'string' ? payload.data.status_message : undefined,
    }
}

function toSearchResult(item: TMDbItem | undefined, mediaType: MediaType): TMDbSearchResult {
    if (!item?.id) {
        return {}
    }

    return {
        id: item.id,
        title: firstNonEmpty(sanitiseText(item.title), sanitiseText(item.name)),
        original_title: firstNonEmpty(sanitiseText(item.original_title), sanitiseText(item.original_name)),
        original_language: item.original_language,
        year: extractYearFromDate(firstNonEmpty(item.release_date, item.first_air_date)),
        media_type: mediaType,
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

function normalizeTMDbID(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/^movie\//, '')
        .replace(/^tv\//, '')
        .trim()
}
