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
    title: string | undefined
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

export async function findTvdbSpecial(tvdbId: number, episodeNumber: number, specialName?: string): Promise<TvdbSpecial | null> {
    logger.debug('SkyHook special lookup request prepared.', { tvdbId, episodeNumber, specialName })

    const series = await getTvdbSeries(tvdbId)
    if (!series) return null

    const specials = (series.episodes ?? []).filter((ep) => ep.seasonNumber === 0)
    if (specials.length === 0) {
        logger.debug('No season 0 episodes found on SkyHook.', { tvdbId })
        return null
    }

    const byNumber = specials.find((ep) => ep.episodeNumber === episodeNumber) ?? null

    if (byNumber && specialName) {
        const needle = normaliseSearchString(specialName)
        const byNumberTitle = byNumber.title ? normaliseSearchString(byNumber.title) : undefined

        if (byNumberTitle === needle) {
            logger.debug('TVDb special matched by episode number with exact title.', { tvdbId, episodeNumber: byNumber.episodeNumber, title: byNumber.title })
            return { episodeNumber: byNumber.episodeNumber, title: byNumber.title! }
        }

        // Title doesn't match — only override the episode number if another special scores strictly higher
        const byNumberScore = byNumberTitle ? scoreTitleMatch(needle, byNumberTitle) : 0
        const betterMatch = findBestTitleMatch(specials, needle, byNumberScore)
        if (betterMatch && betterMatch.episodeNumber !== byNumber.episodeNumber) {
            logger.debug('TVDb special matched by title (overriding episode number).', { tvdbId, episodeNumber: betterMatch.episodeNumber, title: betterMatch.title })
            return { episodeNumber: betterMatch.episodeNumber, title: betterMatch.title! }
        }

        // No better title match — trust the episode number
        const fallbackTitle = byNumber.title ?? specialName
        logger.debug('TVDb special matched by episode number (no better title match).', { tvdbId, episodeNumber: byNumber.episodeNumber, title: fallbackTitle })
        return { episodeNumber: byNumber.episodeNumber, title: fallbackTitle }
    }

    if (byNumber && byNumber.title) {
        logger.debug('TVDb special matched by episode number (no special name to compare).', { tvdbId, episodeNumber: byNumber.episodeNumber, title: byNumber.title })
        return { episodeNumber: byNumber.episodeNumber, title: byNumber.title }
    }

    // Episode number not found — fall back to title matching if available
    if (specialName) {
        const match = findBestTitleMatch(specials, normaliseSearchString(specialName))
        if (match) {
            logger.debug('TVDb special matched by title (episode number not found).', { tvdbId, episodeNumber: match.episodeNumber, title: match.title })
            return { episodeNumber: match.episodeNumber, title: match.title! }
        }
    }

    logger.debug('No TVDb special match found.', { tvdbId, episodeNumber, specialName })
    return null
}

function scoreTitleMatch(needle: string, normalisedTitle: string): number {
    return needle.split(' ').filter((w) => normalisedTitle.includes(w)).length
}

function findBestTitleMatch(specials: SkyHookEpisode[], needle: string, minScore = 0): SkyHookEpisode | null {
    const exact = specials.find((ep) => ep.title && normaliseSearchString(ep.title) === needle)
    if (exact) return exact

    let bestScore = minScore
    let bestMatch: SkyHookEpisode | null = null
    for (const ep of specials) {
        if (!ep.title) continue
        const score = scoreTitleMatch(needle, normaliseSearchString(ep.title))
        if (score > bestScore) {
            bestScore = score
            bestMatch = ep
        }
    }

    return bestMatch
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

    const title = extractCommonTitle(rangeEpisodes.map((ep) => ep.title).filter((t): t is string => t !== undefined))
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
