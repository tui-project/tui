import {
    AUDIO_CODECS,
    HDR_TYPES,
    MEDIA_TYPES,
    type Resolution,
    RESOLUTIONS,
    SD_RESOLUTIONS,
    SOURCE_TYPES,
    type VideoCodec,
    WEB_SOURCE_TYPES,
    type SourceType,
} from '../../../model/metadata'
import { hasEnglishAudio, isForeignContent, isRemux, isSDResolution, isWebSource } from '../util/metadata-util'
import { type HdrTier, type TorrentContext, type TorrentRule, SLOT_TIERS, HDR_TIER_TRUMPS, getHdrTier, getCodecFamily, WEB_SOURCE_RANK } from '../util/tracker-util'
import { getLanguageDisplayName } from '../../../repositories/language-repository'
import type { DuplicateEntry, RuleViolation, TrackerService, TrackerUploadMetadata, TrackerUploadOptions } from '../tracker'
import { buildDubString, buildSeasonEpisodeString, buildSourceString, buildTypeString, shouldIncludeTvYear } from '../util/title-builder-util'
import { getTorrents, upload } from '../unit3d-tracker'
import { logger } from '../../../utils/logger'

// null means banned for ALL source types; a Set means banned only for those specific types
const BANNED_GROUPS: Map<string, Set<SourceType> | null> = new Map(
    (
        [
            ['4K4U', null],
            ['afm72', null],
            ['Alcaide_Kira', null],
            ['AROMA', null],
            ['Bandi', null],
            ['BeechyBoy', new Set([SOURCE_TYPES.WEB_DL])],
            ['ben the men', null],
            ['BiTOR', null],
            ['Bluespots', null],
            ['BOLS', null],
            ['Chivaman', new Set([SOURCE_TYPES.ENCODE])],
            ['ColorTV', null],
            ['CREATiVE24', null],
            ['d3g', null],
            ['DepraveD', null],
            ['edge2020', new Set([SOURCE_TYPES.REMUX, SOURCE_TYPES.ENCODE])],
            ['EMBER', null],
            ['EVO', new Set([SOURCE_TYPES.ENCODE])],
            ['FGT', null],
            ['Flights', new Set([SOURCE_TYPES.REMUX])],
            ['FreetheFish', null],
            ['Garshasp', null],
            ['Ghost', null],
            ['Grym', null],
            ['HDS', null],
            ['HDT', new Set([SOURCE_TYPES.REMUX])],
            ['Hi10', null],
            ['HiQVE', null],
            ['ImE', null],
            ['ION10', null],
            ['iVy', null],
            ['j3rico', new Set([SOURCE_TYPES.ENCODE])],
            ['Judas', null],
            ['LAMA', null],
            ['Langbard', null],
            ['LION', null],
            ['MeGusta', null],
            ['MGE', new Set([SOURCE_TYPES.WEB_DL])],
            ['MONOLITH', null],
            ['MRCS', null],
            ['NaNi', null],
            ['Natty', null],
            ['nikt0', null],
            ['noxxus', new Set([SOURCE_TYPES.ENCODE])],
            ['OEPlus', null],
            ['OFT', null],
            ['OsC', null],
            ['Panda', null],
            ['PANDEMONiUM', null],
            ['PHOCiS', null],
            ['PiRaTeS', null],
            ['PYC', null],
            ['QxR', null],
            ['r00t', null],
            ['Ralphy', null],
            ['RARBG', null],
            ['RCVR', new Set([SOURCE_TYPES.ENCODE, SOURCE_TYPES.WEBRIP])],
            ['RetroPeeps', null],
            ['RZeroX', null],
            ['SAMPA', null],
            ['SasukeducK', new Set([SOURCE_TYPES.WEB_DL])],
            ['Sicario', null],
            ['SiCFoI', null],
            ['Silence', null],
            ['SkipTT', null],
            ['SM737', null],
            ['SPDVD', null],
            ['SPiRiT', new Set([SOURCE_TYPES.ENCODE])],
            ['STUTTERSHIT', null],
            ['SumVision', new Set([SOURCE_TYPES.WEB_DL])],
            ['SWTYBLZ', null],
            ['t3nzin', null],
            ['TAoE', null],
            ['TEKNO3D', null],
            ['Telly', null],
            ['TGx', null],
            ['Tigole', null],
            ['TSP', null],
            ['TSPxL', null],
            ['TWA', null],
            ['UnKn0wn', null],
            ['VD0N', null],
            ['VXT', null],
            ['Vyndros', null],
            ['W32', null],
            ['Weasley[HONE]', new Set([SOURCE_TYPES.WEB_DL, SOURCE_TYPES.WEBRIP])],
            ['Will1869', null],
            ['WKS', null],
            ['x0r', null],
            ['YAWNiX', new Set([SOURCE_TYPES.ENCODE])],
            ['YIFY', null],
            ['YTS', null],
            ['YTS.MX', null],
        ] as [string, Set<SourceType> | null][]
    ).map(([g, types]) => [g.toLowerCase(), types])
)

/**
 * Refer to:
 *  - naming guide : https://aither.cc/wikis/51
 *  - bannd groups : https://aither.cc/pages/blacklist/releasegroups
 *  - API spec     : https://aither.cc/pages/api
 */
export function athTrackerService(url: string, apiKey: string): TrackerService {
    return {
        getTitle,
        checkRules,
        upload: (torrentPath: string, metadata: TrackerUploadMetadata, description: string, mediainfoText: string, title: string, options: TrackerUploadOptions) =>
            upload(url, apiKey, torrentPath, metadata, description, mediainfoText, title, options, getExtraFields(metadata)),
        findDuplicates: (metadata: TrackerUploadMetadata) => findDuplicates(url, apiKey, metadata),
    }
}

/**
 * WEB-DL / WEBRip / Encode: Title [AKA Original] LOCALE Year S##E## [Cut] [Ratio] [Hybrid] [REPACK] [PROPER] [RERIP] [Language] Resolution [Service] Source Type [Dub] AudioCodec Channels [Metadata] [HDR] VideoCodec-Tag
 * Remux                   : Title [AKA Original] LOCALE Year S##E## [Cut] [Ratio] [Hybrid] [REPACK] [PROPER] [RERIP] [Language] Resolution Source REMUX [HDR] VideoCodec [Dub] AudioCodec Channels [Metadata]-Tag
 */
async function getTitle(metadata: TrackerUploadMetadata): Promise<string> {
    const parts: string[] = [metadata.title]

    if (metadata.originalTitle && metadata.originalTitle !== metadata.title) parts.push(`AKA ${metadata.originalTitle}`)
    if (metadata.locale) parts.push(metadata.locale)
    if (metadata.mediaType === MEDIA_TYPES.MOVIE) {
        parts.push(String(metadata.year))
    } else if (metadata.mediaType === MEDIA_TYPES.TV && (await shouldIncludeTvYear(metadata))) {
        parts.push(String(metadata.year))
    }
    parts.push(buildSeasonEpisodeString(metadata.season, metadata.episode, metadata.episodeEnd, metadata.specialName))
    if (metadata.cut) parts.push(metadata.cut)
    if (metadata.ratio) parts.push(metadata.ratio)
    if (metadata.hybrid) parts.push('Hybrid')
    if (metadata.repack) parts.push(metadata.repack === 1 ? 'REPACK' : `REPACK${metadata.repack}`)
    if (metadata.proper) parts.push(metadata.proper === 1 ? 'PROPER' : `PROPER${metadata.proper}`)
    if (metadata.rerip) parts.push(metadata.rerip === 1 ? 'RERIP' : `RERIP${metadata.rerip}`)
    parts.push(await buildLanguageString(metadata.language))
    parts.push(metadata.resolution)
    parts.push(buildSourceString(metadata))
    parts.push(buildTypeString(metadata.sourceType))

    if (isRemux(metadata)) {
        if (metadata.hdr?.length) parts.push(metadata.hdr.join(' '))
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
        if (metadata.hdr?.length) parts.push(metadata.hdr.join(' '))
        parts.push(metadata.videoCodec)
    }

    const tag = metadata.releaseGroup ? `-${metadata.releaseGroup}` : ''
    return `${parts.filter(Boolean).join(' ')}${tag}`
}

async function buildLanguageString(languages: string[]): Promise<string> {
    if (!languages.length) return ''
    if (languages.includes('en')) return ''

    const displayName = await getLanguageDisplayName(languages[0]!)

    return displayName ? displayName.toUpperCase() : ''
}

function checkRules(metadata: TrackerUploadMetadata): RuleViolation[] {
    const violations: RuleViolation[] = []

    if (metadata.releaseGroup) {
        const group = metadata.releaseGroup.toLowerCase()
        if (BANNED_GROUPS.has(group)) {
            const forbiddenTypes = BANNED_GROUPS.get(group)!
            const isBanned = forbiddenTypes === null || forbiddenTypes.has(metadata.sourceType)
            if (isBanned) {
                violations.push({
                    rule: 'banned_release_group',
                    message: `Release group "${metadata.releaseGroup}" is banned${forbiddenTypes === null ? '' : ` for ${[...forbiddenTypes].join(', ')} releases`}.`,
                })
            }
        }
    }

    if (metadata.audioCodec === AUDIO_CODECS.TRUEHD && !metadata.hasTrueHDCompatibilityTrack) {
        violations.push({
            rule: 'truehd_missing_compatibility_track',
            message: 'TrueHD audio requires a standalone DD or DD+ compatibility track.',
        })
    }

    if (isForeignContent(metadata)) {
        if (!hasEnglishAudio(metadata) && !metadata.hasEnglishSubs) {
            violations.push({
                rule: 'missing_english',
                message: 'Non-English releases without an English dub must include English subtitles.',
            })
        }

        if (!metadata.language.includes(metadata.originalLanguage)) {
            violations.push({
                rule: 'missing_original_language_audio',
                message: 'Foreign-language content should include the original language audio track.',
            })
        }
    }

    if (!hasEnglishAudio(metadata) && !metadata.language.includes(metadata.originalLanguage)) {
        violations.push({
            rule: 'missing_required_audio',
            message: 'Audio tracks must include at least the original language or an English dub.',
        })
    }

    if (violations.length > 0) {
        logger.info('ATH rule violations found.', { title: metadata.title, violations: violations.map((v) => v.rule) })
    }

    return violations
}

function getExtraFields(metadata: TrackerUploadMetadata): Record<string, string> {
    const hdr = metadata.hdr ?? []

    return {
        dv: hdr.includes(HDR_TYPES.DV) ? '1' : '0',
        hdr: hdr.includes(HDR_TYPES.HDR10) ? '1' : '0',
        hdr10p: hdr.includes(HDR_TYPES.HDR10_PLUS) ? '1' : '0',
        sd: isSDResolution(metadata.resolution) ? '1' : '0',
    }
}

// At SD, HDTV ties with WEB ("HDTV | WEB") so neither trumps the other, but a WEB-DL still trumps a WEBRip
const SD_SOURCE_TRUMP_ORDER: Record<string, number> = {
    [SOURCE_TYPES.WEBRIP]: 1,
    [SOURCE_TYPES.WEB_DL]: 2,
}

/**
 * Refer to:
 *  - slots guide    : https://aither.cc/wikis/26
 *  - trumping guide : https://aither.cc/wikis/54
 *                   : https://aither.cc/wikis/82
 *  - API spec       : https://aither.cc/pages/api
 */
async function findDuplicates(url: string, apiKey: string, metadata: TrackerUploadMetadata): Promise<DuplicateEntry[]> {
    const resolutions = isSDResolution(metadata.resolution) ? SD_RESOLUTIONS : [metadata.resolution]
    const isWebFamily = isWebSource(metadata.sourceType)

    const candidates = await getTorrents(url, apiKey, {
        tmdbId: metadata.tmdbId,
        mediaType: metadata.mediaType,
        resolutions,
        sourceTypes: isWebFamily ? WEB_SOURCE_TYPES : [metadata.sourceType],
        seasonNumber: metadata.mediaType === MEDIA_TYPES.TV ? metadata.season : undefined,
        episodeNumber: metadata.mediaType === MEDIA_TYPES.TV ? (metadata.episode ?? 0) : undefined,
    })

    const hdr = metadata.hdr ?? []
    const uploadHdrTier = getHdrTier(hdr)
    const sourceTrumpOrder = isSDResolution(metadata.resolution) ? SD_SOURCE_TRUMP_ORDER : WEB_SOURCE_RANK

    const uploadContext: TorrentContext = {
        slot: getSlot(metadata.resolution, metadata.sourceType, uploadHdrTier, metadata.videoCodec, metadata.service, metadata.cut, metadata.ratio),
        hdrTier: uploadHdrTier,
        sourceRank: sourceTrumpOrder[metadata.sourceType] ?? 0,
        revision: Math.max(metadata.repack, metadata.proper, metadata.rerip),
        hasOriginalAudio: metadata.language.includes(metadata.originalLanguage),
        hybrid: metadata.hybrid,
    }

    const existingContexts = candidates.map((torrent) => {
        const hdrTier = getHdrTier(torrent.hdr)
        const existingContext: TorrentContext = {
            slot: getSlot(torrent.resolution, torrent.sourceType, hdrTier, torrent.videoCodec, torrent.service, torrent.cut, torrent.ratio),
            hdrTier,
            sourceRank: sourceTrumpOrder[torrent.sourceType] ?? 0,
            revision: Math.max(torrent.repack, torrent.proper, torrent.rerip),
            hasOriginalAudio: torrent.hasOriginalAudio,
            hybrid: torrent.hybrid,
        }
        return { torrent, existingContext }
    })

    const duplicates = existingContexts
        .filter(({ existingContext }) => uploadContext.slot === existingContext.slot)
        .map(({ torrent, existingContext }) => ({ name: torrent.name, url: torrent.url, trumpable: TRUMP_RULES.some((rule) => rule(uploadContext, existingContext)) }))

    logger.info('ATH duplicate check complete.', {
        title: metadata.title,
        candidates: candidates.length,
        duplicates: duplicates.length,
        trumpable: duplicates.filter((d) => d.trumpable).length,
    })
    logger.debug('ATH duplicates found.', { title: metadata.title, duplicates })

    return duplicates
}

/**
 * Computes the content slot a release occupies; two releases are duplicates when they share a slot.
 *
 * Slot format: {family}:{resBand}:{service}:{cut}:{ratio}:{hdrTier}[:{codec}]
 *
 * - All families split by service, cut, and ratio — different editions/providers coexist
 * - SD and 720p WEB/encode collapse all HDR tiers (single slot per band)
 * - 1080p+ WEB slots split by HDR tier: SDR, DV, HDR (incl. DV/HDR), HDR10+ (incl. DV/HDR10+)
 * - 1080p+ encode slots additionally split by x264 vs x265; SD/720p encodes do not split by codec
 * - 1080p remux collapses all HDR tiers; 2160p+ remux splits by HDR tier
 */
function getSlot(resolution: Resolution, sourceType: SourceType, tier: HdrTier, videoCodec: VideoCodec, service?: string, cut?: string, ratio?: string): string {
    const collapsesHdr = isSDResolution(resolution) || resolution === RESOLUTIONS['720p']
    const resBand = isSDResolution(resolution) ? 'sd' : resolution
    const slotTier = collapsesHdr ? '' : SLOT_TIERS[tier]
    const svc = service ?? ''
    const cutPart = cut ?? ''
    const ratioPart = ratio ?? ''

    switch (sourceType) {
        case SOURCE_TYPES.REMUX: {
            const hdrPart = resolution === RESOLUTIONS['2160p'] || resolution === RESOLUTIONS['4320p'] ? SLOT_TIERS[tier] : ''
            return `remux:${resBand}:${svc}:${cutPart}:${ratioPart}:${hdrPart}`
        }
        case SOURCE_TYPES.ENCODE: {
            const codec = collapsesHdr ? '' : getCodecFamily(videoCodec)
            return `encode:${resBand}:${svc}:${cutPart}:${ratioPart}:${slotTier}:${codec}`
        }
        default:
            return `web:${resBand}:${svc}:${cutPart}:${ratioPart}:${slotTier}`
    }
}

const TRUMP_RULES: TorrentRule[] = [
    // Disc DV trumps a hybrid source in the same DV slot
    (upload, existing) => !upload.hybrid && existing.hybrid && upload.hdrTier === 'DV',
    // DV/HDR over HDR, DV/HDR10+ over HDR10+
    (upload, existing) => HDR_TIER_TRUMPS[upload.hdrTier] === existing.hdrTier,
    // Higher revision number trumps lower (REPACK2 trumps REPACK1, any revision trumps none)
    (upload, existing) => upload.revision > existing.revision,
    // Higher source rank trumps lower (e.g. WEB-DL > WEBRip > HDTV); both must be ranked — absent rank means no trump
    (upload, existing) => upload.sourceRank > 0 && existing.sourceRank > 0 && upload.sourceRank > existing.sourceRank,
    // Upload carrying original audio trumps a dubbed-only release
    (upload, existing) => upload.hasOriginalAudio && !existing.hasOriginalAudio,
]
