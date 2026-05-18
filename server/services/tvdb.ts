import { logger } from '../utils/logger'

const SKYHOOK_BASE_URL = 'https://skyhook.sonarr.tv/v1/tvdb/shows/en'

interface SkyHookSeries {
    tvdbId: number
    title: string
    episodes?: SkyHookEpisode[]
}

interface SkyHookEpisode {
    tvdbId: number
    seasonNumber: number
    episodeNumber: number
    title: string
}

export interface TvdbSpecial {
    episodeNumber: number
    title: string
}

export async function getTvdbSeries(tvdbId: number): Promise<SkyHookSeries | null> {
    const url = `${SKYHOOK_BASE_URL}/${tvdbId}`
    logger.debug('SkyHook series lookup request prepared.', { tvdbId })

    try {
        return await $fetch<SkyHookSeries>(url)
    } catch (error: unknown) {
        logger.warn('SkyHook series lookup failed.', { tvdbId, error: toLoggableFetchError(error) })
        return null
    }
}

function toLoggableFetchError(error: unknown) {
    if (!error || typeof error !== 'object') return { message: String(error) }

    const payload = error as { name?: unknown; message?: unknown; statusCode?: unknown }
    return {
        name: typeof payload.name === 'string' ? payload.name : undefined,
        message: typeof payload.message === 'string' ? payload.message : undefined,
        statusCode: typeof payload.statusCode === 'number' ? payload.statusCode : undefined,
    }
}

export async function findTvdbSpecial(tvdbId: number, specialName: string): Promise<TvdbSpecial | null> {
    logger.debug('SkyHook special lookup request prepared.', { tvdbId, specialName })

    const series = await getTvdbSeries(tvdbId)
    if (!series) return null

    const specials = (series.episodes ?? []).filter((ep) => ep.seasonNumber === 0)
    if (specials.length === 0) {
        logger.debug('No season 0 episodes found on SkyHook.', { tvdbId })
        return null
    }

    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
    const needle = normalise(specialName)

    const exact = specials.find((ep) => normalise(ep.title) === needle)
    if (exact) {
        logger.debug('Exact TVDb special match found.', { tvdbId, episodeNumber: exact.episodeNumber, title: exact.title })
        return { episodeNumber: exact.episodeNumber, title: exact.title }
    }

    // Fuzzy: score by number of needle words present in episode title
    const needleWords = needle.split(' ').filter(Boolean)
    let bestScore = 0
    let bestMatch: SkyHookEpisode | null = null
    for (const ep of specials) {
        const epNorm = normalise(ep.title)
        const score = needleWords.filter((w) => epNorm.includes(w)).length
        if (score > bestScore) {
            bestScore = score
            bestMatch = ep
        }
    }

    if (bestMatch && bestScore > 0) {
        logger.debug('Fuzzy TVDb special match found.', { tvdbId, episodeNumber: bestMatch.episodeNumber, title: bestMatch.title, score: bestScore })
        return { episodeNumber: bestMatch.episodeNumber, title: bestMatch.title }
    }

    logger.debug('No TVDb special match found.', { tvdbId, specialName })
    return null
}
