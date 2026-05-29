import path from 'node:path'
import { RATIOS, SERVICES, SOURCE_TYPES, SOURCES, type Cut, type Ratio, type Service, type Source, type SourceType } from '../model/metadata'
import { logger } from '../utils/logger'

export interface ParsedNameMetadata {
    season?: number
    episode?: number
    episodeEnd?: number
    specialName?: string
    sourceType: SourceType
    source: Source
    service: Service
    cut: Cut
    ratio: Ratio
    repack: number
    proper: number
    rerip: boolean
    threeD: boolean
    hybrid: boolean
    releaseGroup?: string
    title: string
}

export function parseMetadataFromName(name: string): ParsedNameMetadata {
    logger.debug('Parsing media metadata from name.', { name })

    const nameWithoutExtension = stripFileExtension(name)
    const tokens = nameWithoutExtension.split(/[.\s_-]+/).filter(Boolean)
    const upperTokens = tokens.map((token) => token.toUpperCase())
    const { season, episode, episodeEnd, index, tokenEnd } = parseSeasonEpisode(nameWithoutExtension)
    const title = parseTitle(nameWithoutExtension, index, nameWithoutExtension !== name)
    const specialName = parseSpecialName(nameWithoutExtension, season, episode, tokenEnd)
    const sourceType = parseSourceType(upperTokens)
    const source = parseSource(upperTokens, sourceType)
    const service = parseService(upperTokens)
    const cut = parseCut(nameWithoutExtension)
    const repack = parseRepackProper(upperTokens, 'REPACK')
    const proper = parseRepackProper(upperTokens, 'PROPER')
    const rerip = upperTokens.some((token) => token === 'RERIP')
    const threeD = upperTokens.some((token) => token === '3D')
    const hybrid = upperTokens.some((token) => token === 'HYBRID')
    const ratio = parseRatio(nameWithoutExtension)
    const releaseGroup = parseReleaseGroup(nameWithoutExtension)

    const parsedMetadata = {
        title,
        season,
        episode,
        episodeEnd,
        specialName,
        sourceType,
        source,
        service,
        cut,
        ratio,
        repack,
        proper,
        rerip,
        threeD,
        hybrid,
        releaseGroup,
    }

    logger.debug('Parsed media metadata from name.', parsedMetadata)

    return parsedMetadata
}

function parseRepackProper(upperTokens: string[], keyword: string): number {
    for (let n = 9; n >= 2; n--) {
        if (upperTokens.includes(`${keyword}${n}`)) return n
    }
    return upperTokens.includes(keyword) ? 1 : 0
}

function stripFileExtension(name: string) {
    const extension = path.extname(name)

    if (!extension || !/^.[A-Za-z0-9]{2,5}$/.test(extension)) {
        return name
    }

    if (extension === extension.toUpperCase()) {
        return name
    }

    const basename = path.basename(name, extension)

    return /[-_.\s]/.test(basename) ? basename : name
}

function parseSeasonEpisode(name: string) {
    const rangeMatch = /S(\d{1,2})E(\d{1,3})-E?(\d{1,3})/i.exec(name)
    if (rangeMatch) {
        return {
            season: Number(rangeMatch[1]),
            episode: Number(rangeMatch[2]),
            episodeEnd: Number(rangeMatch[3]),
            index: rangeMatch.index,
            tokenEnd: rangeMatch.index + rangeMatch[0].length,
        }
    }

    const seasonEpisodeMatch = /S(\d{1,2})E(\d{1,3})/i.exec(name)
    if (seasonEpisodeMatch) {
        return {
            season: Number(seasonEpisodeMatch[1]),
            episode: Number(seasonEpisodeMatch[2]),
            episodeEnd: undefined,
            index: seasonEpisodeMatch.index,
            tokenEnd: seasonEpisodeMatch.index + seasonEpisodeMatch[0].length,
        }
    }

    const seasonOnlyMatch = /S(\d{1,2})(?!E)/i.exec(name)

    return {
        season: seasonOnlyMatch ? Number(seasonOnlyMatch[1]) : undefined,
        episode: undefined,
        episodeEnd: undefined,
        index: seasonOnlyMatch ? seasonOnlyMatch.index : -1,
        tokenEnd: seasonOnlyMatch ? seasonOnlyMatch.index + seasonOnlyMatch[0].length : -1,
    }
}

function parseSpecialName(name: string, season: number | undefined, episode: number | undefined, tokenEnd: number): string | undefined {
    const isSpecial = (season === 0 && episode !== undefined) || (season !== undefined && season > 0 && episode === 0)
    if (!isSpecial || tokenEnd < 0) return undefined

    const afterToken = name.slice(tokenEnd).replace(/-([^-]+)$/, '')
    const technicalMarkerMatch = findFileMetadataIndex(afterToken)
    const end = technicalMarkerMatch >= 0 ? technicalMarkerMatch : afterToken.length
    let raw = afterToken
        .slice(0, end)
        .replace(/^[.\s_-]+/, '')
        .replace(/[.\s_-]+$/, '')
        .replace(/[._-]+/g, ' ')
        .trim()

    const cut = parseCut(raw)
    if (cut) raw = raw.replace(cut, '').trim()

    return raw || undefined
}

function parseSourceType(tokens: string[]): SourceType {
    switch (true) {
        case tokens.includes(SOURCE_TYPES.REMUX):
            return SOURCE_TYPES.REMUX
        case tokens.includes('WEBDL'):
        case tokens.includes('WEB'):
            return SOURCE_TYPES.WEB_DL
        case tokens.includes(SOURCE_TYPES.WEBRIP):
            return SOURCE_TYPES.WEBRIP
        case tokens.includes(SOURCE_TYPES.HDTV):
            return SOURCE_TYPES.HDTV
        default:
            return SOURCE_TYPES.ENCODE
    }
}

function parseSource(tokens: string[], sourceType: SourceType): Source {
    switch (true) {
        case sourceType == SOURCE_TYPES.WEB_DL || sourceType == SOURCE_TYPES.WEBRIP:
            return 'Web'
        case tokens.includes(SOURCES.DVD):
            return 'DVD'
        default:
            return 'BluRay'
    }
}

function parseService(tokens: string[]): Service {
    const normalizedServices = Object.values(SERVICES) as string[]
    const serviceByToken = new Map<string, string>(normalizedServices.map((service) => [service.toUpperCase(), service]))

    for (const token of [...tokens].reverse()) {
        const service = serviceByToken.get(token)
        if (service) {
            logger.debug('Matched media service token.', { token, service })
            return service as Service
        }
    }

    logger.debug('No media service token matched.')
    return undefined
}

function parseCut(name: string): Cut {
    switch (true) {
        case /super[.\s_-]*duper[.\s_-]*cut/i.test(name):
            return 'Super Duper Cut'
        case /director'?s[.\s_-]*cut/i.test(name):
            return "Director's Cut"
        case /special[.\s_-]*edition/i.test(name):
            return 'Special Edition'
        case /extended/i.test(name):
            return 'Extended'
        case /unrated/i.test(name):
            return 'Unrated'
        default:
            return undefined
    }
}

function parseRatio(name: string): Ratio {
    switch (true) {
        case /\bIMAX\b/i.test(name):
            return RATIOS.IMAX
        case /open[.\s_-]*matte/i.test(name):
            return RATIOS.OPEN_MATTE
        case /\bMAR\b/.test(name):
            return RATIOS.MAR
        default:
            return undefined
    }
}

function parseReleaseGroup(name: string) {
    const match = /-([^-]+)$/.exec(name)
    return match ? match[1]!.replace(/\)+$/, '').trim() : ''
}

function parseTitle(name: string, seasonEpisodeIndex: number, isFileName: boolean) {
    const beforeGroup = name.replace(/-([^-]+)$/, '')
    const fileMetadataIndex = findFileMetadataIndex(beforeGroup)
    const cutIndex = seasonEpisodeIndex >= 0 ? seasonEpisodeIndex : fileMetadataIndex >= 0 ? fileMetadataIndex : beforeGroup.length
    const rawTitle = beforeGroup.slice(0, cutIndex)

    if (isFileName) {
        return rawTitle
            .replace(/[._]+/g, ' ')
            .replace(/\s*\(\d{4}\)\s*$/, '')
            .trim()
    }

    return rawTitle
        .replace(/[._-]+/g, ' ')
        .replace(/\s*\(\d{4}\)\s*$/, '')
        .trim()
}

function findFileMetadataIndex(name: string) {
    const metadataStartPatterns = [
        /\b(?:19|20)\d{2}\b/,
        /\b(?:480|576|720|1080|2160|4320)[pi]\b/i,
        /\((?=(?:480|576|720|1080|2160|4320)[pi]\b)/i,
        /\bREMUX\b/i,
        /\bBlu[.\s_-]*ray\b/i,
        /\bWEB[.\s_-]*(?:DL|RIP)?\b/i,
    ]
    const indexes = metadataStartPatterns.map((pattern) => pattern.exec(name)?.index ?? -1).filter((index) => index >= 0)

    return indexes.length > 0 ? Math.min(...indexes) : -1
}
