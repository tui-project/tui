import { MEDIA_TYPES, SOURCE_TYPES, SOURCES, type SourceType } from '../../../model/metadata'
import { getTvdbSeries } from '../../tvdb'
import type { RuleViolation, TrackerService, TrackerUploadMetadata } from '../tracker'
import { createUnit3dService } from '../unit3d-tracker'

/**
 * Refer to: https://upload.cx/wikis/6
 */
const BANNED_GROUPS = new Set(
    [
        '4K4U',
        'Alcaide_Kira',
        'AROMA',
        'd3g',
        'EDGE2020',
        'EMBER',
        'FGT',
        'FnP',
        'FRDS',
        'Grym',
        'HDT',
        'Hi10',
        'iAHD',
        'INFINITY',
        'ION10',
        'iVy',
        'Judas',
        'LAMA',
        'MeGusta',
        'NAHOM',
        'Niblets',
        'nikt0',
        'NuBz',
        'OFT',
        'PHOCiS',
        'QxR',
        'R&H',
        'Ralphy',
        'RARBG',
        'seedpool',
        'Sicario',
        'SM737',
        'SPDVD',
        'SPx',
        'SWTYBLZ',
        'TAoE',
        'TGx',
        'Tigole',
        'TSP',
        'TSPxL',
        'VXT',
        'Vyndros',
        'Will1869',
        'x0r',
        'YIFY',
    ].map((g) => g.toLowerCase())
)

function checkRules(metadata: TrackerUploadMetadata): RuleViolation[] {
    const violations: RuleViolation[] = []

    if (metadata.releaseGroup && BANNED_GROUPS.has(metadata.releaseGroup.toLowerCase())) {
        violations.push({
            rule: 'banned_release_group',
            message: `Release group "${metadata.releaseGroup}" is banned on ULCX.`,
        })
    }

    if (metadata.source === SOURCES.DVD) {
        violations.push({
            rule: 'invalid_source',
            message: 'Source "DVD" is not allowed on ULCX. Use NTSC DVD, PAL DVD, or HDDVD instead.',
        })
    }

    return violations
}

export function createUlcxTrackerService(url: string, apiKey: string): TrackerService {
    return createUnit3dService(url, apiKey, buildTitle, checkRules)
}

/**
 * Full Disc, Remux Template            : Name AKA Original LOCALE Year S##E## Cut Ratio Hybrid REPACK PROPER RERip Resolution Edition Region 3D SOURCE TYPE Hi10P HDR Vcodec Dub Acodec Channels Object-Tag
 * Encode, WEB-DL, WEBRip, HDTV Template: Name AKA Original LOCALE Year S##E## Cut Ratio Hybrid REPACK PROPER RERip Resolution Edition 3D SOURCE TYPE Dub Acodec Channels Object Hi10P HDR Vcodec-Tag
 *
 * Refer to: https://upload.cx/wikis/7
 */
async function buildTitle(metadata: TrackerUploadMetadata) {
    const isRemux = metadata.sourceType === SOURCE_TYPES.REMUX
    const parts: string[] = [metadata.title]

    if (metadata?.originalTitle !== metadata.title) parts.push(`AKA ${metadata.originalTitle}`)
    if (metadata.locale) parts.push(metadata.locale)
    if (metadata.mediaType === MEDIA_TYPES.MOVIE) {
        parts.push(String(metadata.year))
    } else if (metadata.mediaType === MEDIA_TYPES.TV && metadata.tvdbId) {
        const series = await getTvdbSeries(metadata.tvdbId)
        if (series && hasYearQualifier(series.title)) parts.push(String(metadata.year))
    }
    parts.push(buildSeasonEpisodeString(metadata.season, metadata.episode, metadata.episodeEnd, metadata.specialName))
    if (metadata.cut) parts.push(metadata.cut)
    if (metadata.ratio) parts.push(metadata.ratio)
    if (metadata.hybrid && metadata.sourceType !== SOURCE_TYPES.WEB_DL) parts.push('Hybrid')
    if (metadata.repack) parts.push(metadata.repack === 1 ? 'REPACK' : `REPACK${metadata.repack}`)
    if (metadata.proper) parts.push(metadata.proper === 1 ? 'PROPER' : `PROPER${metadata.proper}`)
    if (metadata.rerip) parts.push(metadata.rerip === 1 ? 'RERIP' : `RERIP${metadata.rerip}`)
    if (!isDvdSource(metadata.source)) parts.push(metadata.resolution)
    parts.push(buildSourceString(metadata))
    parts.push(buildTypeString(metadata.sourceType))

    if (isRemux) {
        if (metadata.hi10p) parts.push('Hi10P')
        if (metadata.hdr && metadata.hdr.length > 0) parts.push(metadata.hdr.join(' '))
        parts.push(metadata.videoCodec)
        parts.push(buildDubString(metadata.language, metadata.originalLanguage))
        parts.push(metadata.audioCodec)
        parts.push(metadata.audioChannels)
        if (metadata.audioMetadata) parts.push(metadata.audioMetadata)
    } else {
        parts.push(buildDubString(metadata.language, metadata.originalLanguage))
        parts.push(metadata.audioCodec)
        parts.push(metadata.audioChannels)
        if (metadata.audioMetadata) parts.push(metadata.audioMetadata)
        if (metadata.hi10p) parts.push('Hi10P')
        if (metadata.hdr && metadata.hdr.length > 0) parts.push(metadata.hdr.join(' '))
        parts.push(metadata.videoCodec)
    }

    return `${parts.filter(Boolean).join(' ')}-${metadata.releaseGroup ?? 'NOGROUP'}`
}

function hasYearQualifier(title: string): boolean {
    const YEAR_QUALIFIER_PATTERN = /\(\d{4}\)$/
    return YEAR_QUALIFIER_PATTERN.test(title.trim())
}

function buildSeasonEpisodeString(season?: number, episode?: number, episodeEnd?: number, specialName?: string): string {
    if (season === undefined) return ''
    const s = `S${String(season).padStart(2, '0')}`
    if (episode === undefined) return s
    const se = episodeEnd !== undefined ? `${s}E${String(episode).padStart(2, '0')}-${String(episodeEnd).padStart(2, '0')}` : `${s}E${String(episode).padStart(2, '0')}`
    if (specialName && (season === 0 || episode === 0)) return `${se} ${specialName}`
    return se
}

function isDvdSource(source: string): boolean {
    return source === SOURCES.DVD || source === SOURCES.NTSC_DVD || source === SOURCES.PAL_DVD || source === SOURCES.HD_DVD
}

function buildSourceString(metadata: TrackerUploadMetadata): string {
    switch (metadata.source) {
        case SOURCES.WEB:
            return metadata.service ?? ''
        case SOURCES.DVD:
            return 'DVD'
        case SOURCES.NTSC_DVD:
            return 'NTSC DVD'
        case SOURCES.PAL_DVD:
            return 'PAL DVD'
        case SOURCES.HD_DVD:
            return 'HDDVD'
        case SOURCES.BLURAY_3D:
            return '3D BluRay'
        case SOURCES.BLURAY:
            return 'BluRay'
        case SOURCES.UHD_BLURAY:
            return 'UHD BluRay'
        default:
            return ''
    }
}

function buildTypeString(sourceType: SourceType): string {
    switch (sourceType) {
        case SOURCE_TYPES.REMUX:
            return 'REMUX'
        case SOURCE_TYPES.WEB_DL:
            return 'WEB-DL'
        case SOURCE_TYPES.WEBRIP:
            return 'WEBRip'
        default:
            return ''
    }
}

function buildDubString(languages: string[], originalLanguage: string) {
    if (!languages?.length) return ''
    if (languages.length === 2 && languages.includes(originalLanguage)) return 'Dual-Audio'
    if (languages.length === 1 && languages.includes('en') && !languages.includes(originalLanguage)) return 'Dubbed'
    return ''
}
