import { logger } from '../utils/logger'
import { normaliseSearchString } from '../utils/string'

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

export interface TvdbSpecialRange {
    episodeStart: number
    episodeEnd: number
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

    const needle = normaliseSearchString(specialName)
    const exact = specials.find((ep) => normaliseSearchString(ep.title) === needle)
    if (exact) {
        logger.debug('Exact TVDb special match found.', { tvdbId, episodeNumber: exact.episodeNumber, title: exact.title })
        return { episodeNumber: exact.episodeNumber, title: exact.title }
    }

    // Fuzzy: score by number of needle words present in episode title
    const needleWords = needle.split(' ').filter(Boolean)
    let bestScore = 0
    let bestMatch: SkyHookEpisode | null = null
    for (const ep of specials) {
        const epNorm = normaliseSearchString(ep.title)
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

export async function findTvdbSpecialRange(tvdbId: number, episodeStart: number, episodeEnd: number): Promise<TvdbSpecialRange | null> {
    logger.debug('SkyHook special range lookup request prepared.', { tvdbId, episodeStart, episodeEnd })

    const series = await getTvdbSeries(tvdbId)
    if (!series) return null

    const specials = (series.episodes ?? []).filter((ep) => ep.seasonNumber === 0)
    const rangeEpisodes = specials.filter((ep) => ep.episodeNumber >= episodeStart && ep.episodeNumber <= episodeEnd)

    if (rangeEpisodes.length === 0) {
        logger.debug('No season 0 episodes found in range.', { tvdbId, episodeStart, episodeEnd })
        return null
    }

    const title = extractCommonTitle(rangeEpisodes.map((ep) => ep.title))
    logger.debug('TVDb special range resolved.', { tvdbId, episodeStart, episodeEnd: rangeEpisodes[rangeEpisodes.length - 1]!.episodeNumber, title })

    return {
        episodeStart: rangeEpisodes[0]!.episodeNumber,
        episodeEnd: rangeEpisodes[rangeEpisodes.length - 1]!.episodeNumber,
        title,
    }
}

function extractCommonTitle(titles: string[]): string {
    if (titles.length === 1) return titles[0]!

    // Strip "Part N:" or "Part N -" style suffixes to find a shared base title
    const stripped = titles.map((t) => t.replace(/[,:]?\s*Part\s+\d+\s*[:-].*$/i, '').trim())
    const first = stripped[0]!
    if (stripped.every((t) => t === first)) return first

    // Fall back to longest common prefix across original titles
    let prefix = titles[0]!
    for (const title of titles.slice(1)) {
        while (!title.startsWith(prefix)) {
            prefix = prefix.slice(0, -1)
        }
    }
    return prefix.replace(/[\s,:-]+$/, '').trim() || titles[0]!
}
