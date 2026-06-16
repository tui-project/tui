import {
    type HdrTier,
    type TorrentContext as BaseTorrentContext,
    type TorrentRule,
    SLOT_TIERS,
    HDR_TIER_TRUMPS,
    getHdrTier,
    getCodecFamily,
    WEB_SOURCE_RANK,
} from '../util/tracker-util'
import type { RuleViolation, TrackerService, TrackerUploadOptions } from '../tracker'
import { buildDubString, buildSeasonEpisodeString, buildSourceString, buildTypeString, shouldIncludeTvYear } from '../util/title-builder-util'
import { getTorrents, upload } from '../unit3d-tracker'
import { logger } from '../../../utils/logger'

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

/**
 * Refer to:
 *  - naming guide: https://upload.cx/wikis/7
 *  - bannd groups: https://upload.cx/wikis/6
 *  - API spec    : https://upload.cx/wikis/38
 */
export function ulcxTrackerService(url: string, apiKey: string): TrackerService {
    return {
        getTitle: buildTitle,
        checkRules,
        upload: (torrentPath, metadata, description, mediainfoText, title: string, options: TrackerUploadOptions) =>
            upload(url, apiKey, torrentPath, metadata, description, mediainfoText, title, options),
        findDuplicates: (metadata: Metadata) => findDuplicates(url, apiKey, metadata),
    }
}

/**
 * Full Disc, Remux Template            : Name AKA Original LOCALE Year S##E## Cut Ratio Hybrid REPACK PROPER RERip Resolution Edition Region 3D SOURCE TYPE Hi10P HDR Vcodec Dub Acodec Channels Object-Tag
 * Encode, WEB-DL, WEBRip, HDTV Template: Name AKA Original LOCALE Year S##E## Cut Ratio Hybrid REPACK PROPER RERip Resolution Edition 3D SOURCE TYPE Dub Acodec Channels Object Hi10P HDR Vcodec-Tag
 */
async function buildTitle(metadata: Metadata) {
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
    if (metadata.hybrid && metadata.sourceType !== SOURCE_TYPES.WEB_DL) parts.push('Hybrid')
    if (metadata.repack) parts.push(metadata.repack === 1 ? 'REPACK' : `REPACK${metadata.repack}`)
    if (metadata.proper) parts.push(metadata.proper === 1 ? 'PROPER' : `PROPER${metadata.proper}`)
    if (metadata.rerip) parts.push(metadata.rerip === 1 ? 'RERIP' : `RERIP${metadata.rerip}`)
    if (!isDvd(metadata)) parts.push(metadata.resolution)
    parts.push(buildSourceString(metadata))
    parts.push(buildTypeString(metadata.sourceType))

    if (isRemux(metadata)) {
        if (metadata.hi10p) parts.push('Hi10P')
        if (metadata.hdr.length) parts.push(metadata.hdr.join(' '))
        if (!isDvd(metadata)) parts.push(metadata.videoCodec)
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
        if (metadata.hdr.length) parts.push(metadata.hdr.join(' '))
        if (!isDvd(metadata)) parts.push(metadata.videoCodec)
    }

    return `${parts.filter(Boolean).join(' ')}-${metadata.releaseGroup ?? 'NOGROUP'}`
}

function checkRules(metadata: Metadata): RuleViolation[] {
    const violations: RuleViolation[] = []

    if (metadata.releaseGroup && BANNED_GROUPS.has(metadata.releaseGroup.toLowerCase())) {
        violations.push({
            rule: 'banned_release_group',
            message: `Release group "${metadata.releaseGroup}" is banned.`,
        })
    }

    if (metadata.source === SOURCES.DVD) {
        violations.push({
            rule: 'invalid_source',
            message: 'Source "DVD" is not allowed. Use NTSC DVD, PAL DVD, or HDDVD instead.',
        })
    }

    if (!isDvd(metadata) && isRemux(metadata)) {
        const allowed: VideoCodec[] = [VIDEO_CODECS.MPEG_2, VIDEO_CODECS.VC_1, VIDEO_CODECS.AVC, VIDEO_CODECS.HEVC]
        if (!allowed.includes(metadata.videoCodec)) {
            violations.push({
                rule: 'invalid_video_codec',
                message: `Video codec "${metadata.videoCodec}" is not allowed for Remuxes. Allowed: ${allowed.join(', ')}.`,
            })
        }
    }

    const hdtvSource = metadata.source === SOURCES.HDTV || metadata.source === SOURCES.UHDTV
    if (metadata.sourceType === SOURCE_TYPES.WEB_DL || (hdtvSource && isHdtv(metadata))) {
        const allowed: VideoCodec[] = [VIDEO_CODECS.H264, VIDEO_CODECS.H265, VIDEO_CODECS.VP9, VIDEO_CODECS.MPEG_2]
        if (!allowed.includes(metadata.videoCodec)) {
            violations.push({
                rule: 'invalid_video_codec',
                message: `Video codec "${metadata.videoCodec}" is not allowed for WEB-DL and untouched HDTV. Allowed: ${allowed.join(', ')}.`,
            })
        }
    }

    if (!isDvd(metadata) && (isEncode(metadata) || metadata.sourceType === SOURCE_TYPES.WEBRIP)) {
        const allowed: VideoCodec[] = [VIDEO_CODECS.X264, VIDEO_CODECS.X265]
        if (!allowed.includes(metadata.videoCodec)) {
            violations.push({
                rule: 'invalid_video_codec',
                message: `Video codec "${metadata.videoCodec}" is not allowed for Encodes and WEBRips. Allowed: ${allowed.join(', ')}.`,
            })
        }
    }

    if (isEncode(metadata)) {
        const minimumResolutions: Resolution[] = [RESOLUTIONS['720p'], RESOLUTIONS['1080i'], RESOLUTIONS['1080p'], RESOLUTIONS['2160p'], RESOLUTIONS['4320p']]
        if (!minimumResolutions.includes(metadata.resolution)) {
            violations.push({
                rule: 'resolution_too_low',
                message: `Encodes must be at least 720p. "${metadata.resolution}" is not allowed.`,
            })
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
                message: 'Foreign-language content must include at least English subtitles or an English audio dub.',
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
        logger.info('ULCX rule violations found.', { title: metadata.title, violations: violations.map((v) => v.rule) })
    }

    return violations
}

type TorrentContext = BaseTorrentContext & { isNoGrp: boolean }

/**
 * Refer to:
 *  - rules    : https://upload.cx/pages/1
 *  - API spec : https://upload.cx/wikis/38
 */
async function findDuplicates(url: string, apiKey: string, metadata: Metadata) {
    const sourceTypes = isWebSource(metadata.sourceType) ? WEB_SOURCE_TYPES : [metadata.sourceType]

    const candidates = await getTorrents(url, apiKey, {
        tmdbId: metadata.tmdbId,
        mediaType: metadata.mediaType,
        resolutions: [metadata.resolution],
        sourceTypes,
        seasonNumber: metadata.mediaType === MEDIA_TYPES.TV ? metadata.season : undefined,
        episodeNumber: metadata.mediaType === MEDIA_TYPES.TV ? (metadata.episode ?? 0) : undefined,
    })

    const uploadHdrTier = getHdrTier(metadata.hdr)
    const uploadContext: TorrentContext = {
        slot: getSlot(metadata.sourceType, uploadHdrTier, metadata.videoCodec, metadata.service, metadata.cut, metadata.ratio),
        hdrTier: uploadHdrTier,
        sourceRank: WEB_SOURCE_RANK[metadata.sourceType] ?? 0,
        revision: Math.max(metadata.repack, metadata.proper, metadata.rerip),
        hasOriginalAudio: metadata.language.includes(metadata.originalLanguage),
        hybrid: metadata.hybrid,
        isNoGrp: !metadata.releaseGroup,
    }

    const existingContexts = candidates.map((torrent) => {
        const hdrTier = getHdrTier(torrent.hdr)
        const context: TorrentContext = {
            slot: getSlot(torrent.sourceType, hdrTier, torrent.videoCodec, torrent.service, torrent.cut, torrent.ratio),
            hdrTier,
            sourceRank: WEB_SOURCE_RANK[torrent.sourceType] ?? 0,
            revision: Math.max(torrent.repack, torrent.proper, torrent.rerip),
            hasOriginalAudio: torrent.hasOriginalAudio,
            hybrid: torrent.hybrid,
            isNoGrp: /\bNOGROUP\b/i.test(torrent.name),
        }
        return { torrent, context }
    })

    const duplicates = existingContexts
        .filter(({ context }) => uploadContext.slot === context.slot)
        .map(({ torrent, context }) => ({ name: torrent.name, url: torrent.url, trumpable: TRUMP_RULES.some((rule) => rule(uploadContext, context)) }))

    logger.info('ULCX duplicate check complete.', {
        title: metadata.title,
        candidates: candidates.length,
        duplicates: duplicates.length,
        trumpable: duplicates.filter((d) => d.trumpable).length,
    })
    logger.debug('ULCX duplicates found.', { title: metadata.title, duplicates })

    return duplicates
}

const TRUMP_RULES: TorrentRule<TorrentContext>[] = [
    // Disc DV trumps a hybrid source in the same DV slot
    (upload, existing) => !upload.hybrid && existing.hybrid && upload.hdrTier === 'DV',
    // DV/HDR over HDR, DV/HDR10+ over HDR10+
    (upload, existing) => HDR_TIER_TRUMPS[upload.hdrTier] === existing.hdrTier,
    // Higher revision (REPACK/PROPER/RERIP) trumps lower
    (upload, existing) => upload.revision > existing.revision,
    // WEB-DL trumps WEBRip from the same provider (same slot, higher source rank)
    (upload, existing) => upload.sourceRank > 0 && existing.sourceRank > 0 && upload.sourceRank > existing.sourceRank,
    // Upload carrying original audio trumps a dubbed-only release
    (upload, existing) => upload.hasOriginalAudio && !existing.hasOriginalAudio,
    // A named group trumps a NOGROUP release
    (upload, existing) => !upload.isNoGrp && existing.isNoGrp,
]

/**
 * Computes the content slot a release occupies; two releases are duplicates when they share a slot.
 *
 * Slot format: {family}:{service}:{cut}:{ratio}:{hdrTier}[:{codec}]
 *
 * - All families split by service, cut, and ratio — different editions/providers coexist
 * - WEB slots split by HDR tier: SDR, DV, HDR (incl. DV/HDR), HDR10+ (incl. DV/HDR10+)
 * - Encode slots additionally split by x264 vs x265
 * - Remux slots split by HDR tier; cut/ratio allow different editions to coexist
 */
function getSlot(sourceType: SourceType, tier: HdrTier, videoCodec: VideoCodec, service?: Service, cut?: string, ratio?: string): string {
    const slotTier = SLOT_TIERS[tier]
    const svc = service ?? ''
    const cutPart = cut ?? ''
    const ratioPart = ratio ?? ''

    switch (sourceType) {
        case SOURCE_TYPES.REMUX:
            return `remux:${svc}:${cutPart}:${ratioPart}:${slotTier}`
        case SOURCE_TYPES.ENCODE:
            return `encode:${svc}:${cutPart}:${ratioPart}:${slotTier}:${getCodecFamily(videoCodec)}`
        // WEB-DL, WEBRip, HDTV — provider-scoped slot; WEB-DL and WEBRip from the same provider
        // share a slot so that WEB-DL can trump WEBRip (they are not separate coexisting slots)
        default:
            return `web:${svc}:${cutPart}:${ratioPart}:${slotTier}`
    }
}
