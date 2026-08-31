import {
    type HdrTier,
    type TorrentContext,
    type TorrentRule,
    SLOT_TIERS,
    HDR_TIER_TRUMPS,
    correctionTrumps,
    getHdrTier,
    getVideoCodecFamily,
    hasAdditionalMainAudioLanguage,
    hasDualAudioReleaseName,
    WEB_SOURCE_RANK,
} from '../util/tracker-util'
import type { DuplicateEntry, RuleViolation, TrackerService, TrackerUploadOptions } from '../tracker'
import { buildDubString, buildSeasonEpisodeString, buildSourceString, buildTypeString, shouldIncludeTvYear } from '../util/title-builder-util'
import { getTorrents, upload } from '../unit3d-tracker'
import { createLogger } from '../../../utils/logger'

const logger = createLogger('tracker:ath')

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
        upload: (torrentPath: string, metadata: Metadata, description: string, mediainfoText: string, title: string, options: TrackerUploadOptions) =>
            upload(url, apiKey, torrentPath, metadata, description, mediainfoText, title, options, getExtraFields(metadata)),
        findDuplicates: (metadata: Metadata) => findDuplicates(url, apiKey, metadata),
    }
}

/**
 * WEB-DL / WEBRip / Encode: Title [AKA Original] LOCALE Year S##E## [Cut] [Ratio] [Hybrid] [REPACK] [PROPER] [RERIP] [Language] Resolution [Service] Source Type [Dub] AudioCodec Channels [Metadata] [HDR] VideoCodec-Tag
 * Remux                   : Title [AKA Original] LOCALE Year S##E## [Cut] [Ratio] [Hybrid] [REPACK] [PROPER] [RERIP] [Language] Resolution Source REMUX [HDR] VideoCodec [Dub] AudioCodec Channels [Metadata]-Tag
 */
async function getTitle(metadata: Metadata): Promise<string> {
    logger.trace('Strting tracker title build.', { metadata })

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
        if (metadata.hdr.length) parts.push(metadata.hdr.join(' '))
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
        if (metadata.hdr.length) parts.push(metadata.hdr.join(' '))
        parts.push(metadata.videoCodec)
    }

    const tag = metadata.releaseGroup ? `-${metadata.releaseGroup}` : ''
    const title = `${parts.filter(Boolean).join(' ')}${tag}`

    logger.debug('Tracker title built complete.', { metadataTitle: metadata.title, trackerTitle: title })

    return title
}

async function buildLanguageString(languages: string[]): Promise<string> {
    if (!languages.length) return ''
    if (languageListIncludes(languages, 'mul')) return getLanguageDisplayName('mul').toUpperCase()
    if (languageListIncludes(languages, 'en')) return ''

    const displayName = getLanguageDisplayName(languages[0]!)

    return displayName ? displayName.toUpperCase() : ''
}

function checkRules(metadata: Metadata): RuleViolation[] {
    logger.trace('Starting tracker rules check.', { metadata })

    const violations: RuleViolation[] = []

    if (metadata.releaseGroup && isBannedReleaseGroup(metadata.releaseGroup, metadata.sourceType)) {
        const forbiddenTypes = BANNED_GROUPS.get(metadata.releaseGroup.toLowerCase())!
        violations.push({
            rule: 'banned_release_group',
            message: `Release group "${metadata.releaseGroup}" is banned${forbiddenTypes === null ? '' : ` for ${[...forbiddenTypes].join(', ')} releases`}.`,
        })
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
    }

    if (!hasEnglishAudio(metadata) && !hasOriginalAudio(metadata)) {
        violations.push({
            rule: 'missing_required_audio',
            message: 'Audio tracks must include at least the original language or an English dub.',
        })
    }

    if (hasAdditionalMainAudioLanguage(metadata)) {
        violations.push({
            rule: 'additional_main_audio_language',
            message: 'Main audio tracks may only use the original language or English.',
        })
    }

    const codecViolation = getCodecViolation(metadata)
    if (codecViolation) violations.push(codecViolation)

    if (metadata.resolution === RESOLUTIONS['1440p']) {
        violations.push({
            rule: 'check_2160p_source_availability',
            message: '1440p is only allowed when no 2160p source is available. Confirm source availability before uploading.',
        })
    }

    if (isSDResolution(metadata.resolution)) {
        violations.push({
            rule: 'check_hd_retail_source_availability',
            message: 'SD WEB, DVDRip, and DVD Remux releases are only allowed when no equivalent HD retail source is available. Confirm source availability before uploading.',
        })
    }

    logger.debug('Tracker rules check completed.', { metadataTitle: metadata.title, violationCount: violations.length, violations: violations.map((violation) => violation.rule) })

    return violations
}

function isBannedReleaseGroup(releaseGroup: string | undefined, sourceType: SourceType): boolean {
    if (!releaseGroup) return false
    const forbiddenTypes = BANNED_GROUPS.get(releaseGroup.toLowerCase())

    return forbiddenTypes === null || forbiddenTypes?.has(sourceType) === true
}

function getCodecViolation(metadata: Metadata): RuleViolation | undefined {
    if (metadata.sourceType === SOURCE_TYPES.REMUX || isSDResolution(metadata.resolution)) return undefined

    const codecFamily = getVideoCodecFamily(metadata.videoCodec)
    const { valid, allowedCodec } =
        metadata.sourceType === SOURCE_TYPES.ENCODE ? getEncodeCodecEligibility(metadata) : getWebCodecEligibility(metadata.resolution, metadata.hdr, codecFamily)

    if (valid) return undefined
    return { rule: 'invalid_video_codec', message: `${metadata.resolution} ${metadata.sourceType} releases must use ${allowedCodec}.` }
}

function getEncodeCodecEligibility(metadata: Metadata): { valid: boolean; allowedCodec?: string } {
    switch (metadata.resolution) {
        case RESOLUTIONS['720p']:
            return { valid: metadata.videoCodec === VIDEO_CODECS.X264, allowedCodec: VIDEO_CODECS.X264 }
        case RESOLUTIONS['1080p']:
            return metadata.hdr.length
                ? { valid: metadata.videoCodec === VIDEO_CODECS.X265, allowedCodec: VIDEO_CODECS.X265 }
                : { valid: metadata.videoCodec === VIDEO_CODECS.X264 || metadata.videoCodec === VIDEO_CODECS.X265, allowedCodec: `${VIDEO_CODECS.X264} or ${VIDEO_CODECS.X265}` }
        case RESOLUTIONS['2160p']:
            return { valid: metadata.videoCodec === VIDEO_CODECS.X265, allowedCodec: VIDEO_CODECS.X265 }
        default:
            return { valid: true }
    }
}

function getWebCodecEligibility(resolution: Resolution, hdr: HDR[], codecFamily: ReturnType<typeof getVideoCodecFamily>): { valid: boolean; allowedCodec?: string } {
    switch (resolution) {
        case RESOLUTIONS['720p']:
            return { valid: codecFamily === 'avc', allowedCodec: 'H.264' }
        case RESOLUTIONS['1080p']:
        case RESOLUTIONS['1440p']:
            return hdr.length ? { valid: codecFamily === 'hevc', allowedCodec: 'H.265' } : { valid: codecFamily === 'avc', allowedCodec: 'H.264' }
        case RESOLUTIONS['2160p']:
            return { valid: codecFamily === 'hevc', allowedCodec: 'H.265' }
        default:
            return { valid: true }
    }
}

function getExtraFields(metadata: Metadata): Record<string, string> {
    return {
        dv: metadata.hdr.includes(HDR_TYPES.DV) ? '1' : '0',
        hdr: metadata.hdr.includes(HDR_TYPES.HDR10) ? '1' : '0',
        hdr10p: metadata.hdr.includes(HDR_TYPES.HDR10_PLUS) ? '1' : '0',
        sd: isSDResolution(metadata.resolution) ? '1' : '0',
    }
}

// At SD, HDTV ties with WEB ("HDTV | WEB") so neither trumps the other, but a WEB-DL still trumps a WEBRip
const SD_SOURCE_TRUMP_ORDER: Record<string, number> = {
    [SOURCE_TYPES.WEBRIP]: 1,
    [SOURCE_TYPES.WEB_DL]: 2,
}

type AthTorrentContext = TorrentContext & { isDualAudio: boolean }

/**
 * Refer to:
 *  - slots guide    : https://aither.cc/wikis/26
 *  - trumping guide : https://aither.cc/wikis/54
 *                   : https://aither.cc/wikis/82
 *  - API spec       : https://aither.cc/pages/api
 */
async function findDuplicates(url: string, apiKey: string, metadata: Metadata): Promise<DuplicateEntry[]> {
    logger.trace('Starting tracker duplicate check.', { metadata })

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

    logger.trace('Candidate torrents from tracker for duplicate check', { candidates })

    const uploadHdrTier = getHdrTier(metadata.hdr)
    const sourceTrumpOrder = isSDResolution(metadata.resolution) ? SD_SOURCE_TRUMP_ORDER : WEB_SOURCE_RANK

    const uploadContext: AthTorrentContext = {
        slot: getSlot(metadata.resolution, metadata.sourceType, uploadHdrTier, metadata.videoCodec, metadata.cut),
        hdrTier: uploadHdrTier,
        sourceRank: sourceTrumpOrder[metadata.sourceType] ?? 0,
        repack: metadata.repack,
        proper: metadata.proper,
        rerip: metadata.rerip,
        hasOriginalAudio: hasOriginalAudio(metadata),
        isDualAudio: isDualAudio(metadata),
        hybrid: metadata.hybrid,
        isBannedReleaseGroup: isBannedReleaseGroup(metadata.releaseGroup, metadata.sourceType),
    }

    const existingContexts = candidates.map((torrent) => {
        const hdrTier = getHdrTier(torrent.hdr)
        const existingContext: AthTorrentContext = {
            slot: getSlot(torrent.resolution, torrent.sourceType, hdrTier, torrent.videoCodec, torrent.cut),
            hdrTier,
            sourceRank: sourceTrumpOrder[torrent.sourceType] ?? 0,
            repack: torrent.repack,
            proper: torrent.proper,
            rerip: torrent.rerip,
            hasOriginalAudio: torrent.hasOriginalAudio,
            isDualAudio: hasDualAudioReleaseName(torrent.name),
            hybrid: torrent.hybrid,
            isBannedReleaseGroup: isBannedReleaseGroup(torrent.releaseGroup, torrent.sourceType),
        }
        return { torrent, existingContext }
    })

    const duplicates = existingContexts
        .filter(({ existingContext }) => uploadContext.slot === existingContext.slot)
        .map(({ torrent, existingContext }) => ({ name: torrent.name, url: torrent.url, trumpable: TRUMP_RULES.some((rule) => rule(uploadContext, existingContext)) }))

    logger.debug('Tracker duplicate check complete.', {
        title: metadata.title,
        candidates: candidates.length,
        duplicates: duplicates.length,
        trumpable: duplicates.filter((d) => d.trumpable).length,
    })
    return duplicates
}

/**
 * Computes the content slot a release occupies; two releases are duplicates when they share a slot.
 *
 * Slot format: {family}:{resBand}:{cut}:{hdrTier}[:{codec}]
 *
 * - Alternate cuts coexist; providers and aspect-ratio tags do not create slots
 * - SD and 720p WEB/encode collapse all HDR tiers (single slot per band)
 * - 1080p+ WEB slots split by HDR tier: SDR, DV, HDR (incl. DV/HDR), HDR10+ (incl. DV/HDR10+)
 * - 1080p+ encode slots additionally split by x264 vs x265; SD/720p encodes do not split by codec
 * - 1080p remux collapses all HDR tiers; 2160p+ remux splits by HDR tier
 */
function getSlot(resolution: Resolution, sourceType: SourceType, tier: HdrTier, videoCodec: VideoCodec, cut?: string): string {
    const collapsesHdr = isSDResolution(resolution) || resolution === RESOLUTIONS['720p']
    const resBand = isSDResolution(resolution) ? 'sd' : resolution
    const slotTier = collapsesHdr ? '' : SLOT_TIERS[tier]
    const cutPart = cut ?? ''

    switch (sourceType) {
        case SOURCE_TYPES.REMUX: {
            const hdrPart = resolution === RESOLUTIONS['2160p'] || resolution === RESOLUTIONS['4320p'] ? SLOT_TIERS[tier] : ''
            return `remux:${resBand}:${cutPart}:${hdrPart}`
        }
        case SOURCE_TYPES.ENCODE: {
            const codec = collapsesHdr ? '' : getVideoCodecFamily(videoCodec)
            return `encode:${resBand}:${cutPart}:${slotTier}:${codec}`
        }
        default:
            return `web:${resBand}:${cutPart}:${slotTier}`
    }
}

const TRUMP_RULES: TorrentRule<AthTorrentContext>[] = [
    // An allowed upload can trump an existing release from a banned group
    (upload, existing) => !upload.isBannedReleaseGroup && existing.isBannedReleaseGroup,
    // Disc DV trumps a hybrid source in the same DV slot
    (upload, existing) => !upload.hybrid && existing.hybrid && upload.hdrTier.startsWith('DV'),
    // DV/HDR over HDR, DV/HDR10+ over HDR10+
    (upload, existing) => HDR_TIER_TRUMPS[upload.hdrTier] === existing.hdrTier,
    // A corrected release trumps its original; numbered corrections only compare within the same correction kind
    (upload, existing) => correctionTrumps(upload, existing),
    // Higher source rank trumps lower (e.g. WEB-DL > WEBRip > HDTV); both must be ranked — absent rank means no trump
    (upload, existing) => upload.sourceRank > 0 && existing.sourceRank > 0 && upload.sourceRank > existing.sourceRank,
    // Dual audio trumps either original-only or dubbed-only audio
    (upload, existing) => upload.isDualAudio && !existing.isDualAudio,
]
