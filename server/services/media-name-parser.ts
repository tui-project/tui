import path from 'node:path'
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
    rerip: number
    hybrid: boolean
    releaseGroup?: string
    title: string
    hdr: HDR[]
    videoCodec: VideoCodec | undefined
}

export function parseMetadataFromName(name: string): ParsedNameMetadata {
    logger.debug('Parsing media metadata from name.', { name })

    const nameWithoutExtension = stripFileExtension(name)
    const tokens = nameWithoutExtension.split(/[.\s_-]+/).filter(Boolean)
    const upperTokens = tokens.map((token) => token.toUpperCase())
    const { season, episode, episodeEnd, index, tokenEnd } = parseSeasonEpisode(nameWithoutExtension)
    const title = parseTitle(nameWithoutExtension, index, nameWithoutExtension !== name)
    const specialName = parseSpecialName(nameWithoutExtension, season, episode, tokenEnd)
    const source = parseSource(upperTokens)
    const sourceType = parseSourceType(upperTokens, source)
    const service = parseService(upperTokens)
    const cut = parseCut(nameWithoutExtension)
    const repack = parseRepackProper(upperTokens, 'REPACK')
    const proper = parseRepackProper(upperTokens, 'PROPER')
    const rerip = parseRepackProper(upperTokens, 'RERIP')
    const hybrid = upperTokens.some((token) => token === 'HYBRID')
    const ratio = parseRatio(nameWithoutExtension)
    const releaseGroup = parseReleaseGroup(nameWithoutExtension)
    const hdr = parseHdr(nameWithoutExtension)
    const videoCodec = parseVideoCodec(nameWithoutExtension)

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
        hybrid,
        releaseGroup,
        hdr,
        videoCodec,
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

function parseSource(tokens: string[]): Source {
    if (hasWeb(tokens)) return SOURCES.WEB
    if (tokens.includes(SOURCES.UHDTV)) return SOURCES.UHDTV
    if (tokens.includes(SOURCES.HDTV)) return SOURCES.HDTV

    const hasBluRay = tokens.includes('BLURAY')
    if (hasBluRay) {
        if (tokens.includes('UHD')) return SOURCES.UHD_BLURAY
        if (tokens.includes('3D')) return SOURCES.BLURAY_3D

        return SOURCES.BLURAY
    }

    const hasDvd = tokens.includes('DVD')
    if (hasDvd) {
        if (tokens.includes('HD')) return SOURCES.HD_DVD
        if (tokens.includes('NTSC')) return SOURCES.NTSC_DVD
        if (tokens.includes('PAL')) return SOURCES.PAL_DVD

        return SOURCES.DVD
    }

    return SOURCES.BLURAY
}

function hasWeb(tokens: string[]): boolean {
    return tokens.includes('WEBDL') || tokens.includes('WEB') || tokens.includes('WEBRIP')
}

function parseSourceType(tokens: string[], source: Source): SourceType {
    if (source === SOURCES.HDTV || source === SOURCES.UHDTV) return SOURCE_TYPES.HDTV
    if (tokens.includes(SOURCE_TYPES.REMUX)) return SOURCE_TYPES.REMUX
    if (hasWeb(tokens)) {
        if (tokens.includes(SOURCE_TYPES.WEBRIP)) {
            return SOURCE_TYPES.WEBRIP
        } else {
            return SOURCE_TYPES.WEB_DL
        }
    }

    return SOURCE_TYPES.ENCODE
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
    if (/super[.\s_-]*duper[.\s_-]*cut/i.test(name)) return 'Super Duper Cut'
    if (/director'?s[.\s_-]*cut/i.test(name)) return "Director's Cut"
    if (/special[.\s_-]*edition/i.test(name)) return 'Special Edition'
    if (/extended/i.test(name)) return 'Extended'
    if (/unrated/i.test(name)) return 'Unrated'

    return undefined
}

function parseRatio(name: string): Ratio {
    if (/\bIMAX\b/i.test(name)) return RATIOS.IMAX
    if (/open[.\s_-]*matte/i.test(name)) return RATIOS.OPEN_MATTE
    if (/\bMAR\b/.test(name)) return RATIOS.MAR

    return undefined
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

function parseHdr(name: string): HDR[] {
    const hdr: HDR[] = []

    if (/(?<![A-Z0-9])DV(?![A-Z0-9])/i.test(name) || /DOLBY.?VISION/i.test(name)) hdr.push(HDR_TYPES.DV)
    if (/(?<![A-Z0-9])HDR10[+P](?![A-Z0-9])/i.test(name) || /HDR10PLUS/i.test(name)) hdr.push(HDR_TYPES.HDR10_PLUS)
    if (/(?<![A-Z0-9])HDR(?![A-Z0-9])/i.test(name)) hdr.push(HDR_TYPES.HDR10)
    if (/(?<![A-Z0-9])HLG(?![A-Z0-9])/i.test(name)) hdr.push(HDR_TYPES.HLG)

    return hdr
}

function parseVideoCodec(name: string): VideoCodec | undefined {
    const codecMap: [RegExp, VideoCodec][] = [
        [/\bx265\b/i, VIDEO_CODECS.X265],
        [/\bx264\b/i, VIDEO_CODECS.X264],
        [/\bHEVC\b/i, VIDEO_CODECS.HEVC],
        [/\bH\.265\b/i, VIDEO_CODECS.H265],
        [/\bH\.264\b/i, VIDEO_CODECS.H264],
        [/\bAVC\b/i, VIDEO_CODECS.AVC],
        [/\bVC-1\b/i, VIDEO_CODECS.VC_1],
        [/\bMPEG-2\b/i, VIDEO_CODECS.MPEG_2],
        [/\bMPEG-1\b/i, VIDEO_CODECS.MPEG_1],
        [/\bVP9\b/i, VIDEO_CODECS.VP9],
        [/\bAV1\b/i, VIDEO_CODECS.AV1],
    ]

    for (const [re, codec] of codecMap) {
        if (re.test(name)) return codec
    }

    return undefined
}
