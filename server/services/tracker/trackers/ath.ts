import { AUDIO_CODECS, HDR_TYPES, MEDIA_TYPES, RESOLUTIONS, SOURCE_TYPES, type SourceType } from '../../../model/metadata'
import { ManyToOneMap } from '../../../utils/bi-map'
import { hasEnglishAudio, isForeignContent, isRemux } from '../util/metadata-util'
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

const SD_RESOLUTIONS: string[] = [RESOLUTIONS['480i'], RESOLUTIONS['480p'], RESOLUTIONS['576i'], RESOLUTIONS['576p']]

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
        sd: SD_RESOLUTIONS.includes(metadata.resolution) ? '1' : '0',
    }
}

type SlotFamily = 'web' | 'encode' | 'remux'

const SLOT_FAMILY_MAP = ManyToOneMap<SourceType, SlotFamily>([
    [SOURCE_TYPES.REMUX, 'remux'],
    [SOURCE_TYPES.ENCODE, 'encode'],
    [SOURCE_TYPES.WEB_DL, 'web'],
    [SOURCE_TYPES.WEBRIP, 'web'],
    [SOURCE_TYPES.HDTV, 'web'],
])

// Within the web slot, higher rank trumps lower — HD/UHD order: HDTV < WEBRip < WEB-DL
const SOURCE_TRUMP_ORDER: Record<string, number> = {
    [SOURCE_TYPES.HDTV]: 1,
    [SOURCE_TYPES.WEBRIP]: 2,
    [SOURCE_TYPES.WEB_DL]: 3,
}

// At SD, HDTV ties with WEB ("HDTV | WEB") so neither trumps the other, but a WEB-DL still trumps a WEBRip
const SD_SOURCE_TRUMP_ORDER: Record<string, number> = {
    [SOURCE_TYPES.WEBRIP]: 1,
    [SOURCE_TYPES.WEB_DL]: 2,
}

// DV/HDR trumps HDR; DV/HDR10+ trumps HDR10+
const HDR_TIER_TRUMPS: Partial<Record<HdrTier, HdrTier>> = {
    DV_HDR: 'HDR',
    DV_HDR10PLUS: 'HDR10PLUS',
}

/**
 * Refer to:
 *  - splots guide   : https://aither.cc/wikis/26
 *  - trumping guide : https://aither.cc/wikis/54
 *                   : https://aither.cc/wikis/82
 *  - API spec       : https://aither.cc/pages/api
 */
async function findDuplicates(url: string, apiKey: string, metadata: TrackerUploadMetadata): Promise<DuplicateEntry[]> {
    const family = SLOT_FAMILY_MAP.getByKey(metadata.sourceType)
    const isSd = SD_RESOLUTIONS.includes(metadata.resolution)
    const resolutions = isSd ? SD_RESOLUTIONS : [metadata.resolution]

    const candidates = await getTorrents(url, apiKey, {
        tmdbId: metadata.tmdbId,
        mediaType: metadata.mediaType,
        resolutions,
        sourceTypes: SLOT_FAMILY_MAP.getByValue(family),
        seasonNumber: metadata.mediaType === MEDIA_TYPES.TV ? metadata.season : undefined,
        episodeNumber: metadata.mediaType === MEDIA_TYPES.TV ? (metadata.episode ?? 0) : undefined,
    })

    const hdr = metadata.hdr ?? []
    const uploadHdrTier = getHdrTier(hdr)
    const uploadSlot = getSlot(metadata.resolution, family, uploadHdrTier, metadata.videoCodec)
    const sourceTrumpOrder = isSd ? SD_SOURCE_TRUMP_ORDER : SOURCE_TRUMP_ORDER

    const uploadContex: TorrentContext = {
        slot: uploadSlot,
        hdrTier: uploadHdrTier,
        sourceRank: sourceTrumpOrder[metadata.sourceType] ?? 0,
        revision: Math.max(metadata.repack, metadata.proper, metadata.rerip),
        hasOriginalAudio: metadata.language.includes(metadata.originalLanguage),
    }

    const existingContexts = candidates.map((torrent) => {
        const hdrTier = getHdrTier(torrent.hdr)
        const existingFamily = SLOT_FAMILY_MAP.getByKey((torrent.sourceType ?? metadata.sourceType) as SourceType)
        const existingContext: TorrentContext = {
            slot: getSlot(torrent.resolution ?? metadata.resolution, existingFamily, hdrTier, torrent.videoCodec),
            hdrTier,
            sourceRank: sourceTrumpOrder[torrent.sourceType!] ?? 0,
            revision: Math.max(torrent.repack, torrent.proper, torrent.rerip),
            hasOriginalAudio: torrent.hasOriginalAudio,
        }

        return { torrent, existingContext }
    })

    const duplicates = existingContexts
        .filter(({ existingContext }) => DUPLICATE_RULES.some((rule) => rule(uploadContex, existingContext)))
        .map(({ torrent, existingContext }) => ({ name: torrent.name, url: torrent.url, trumpable: TRUMP_RULES.some((rule) => rule(uploadContex, existingContext)) }))

    logger.info('ATH duplicate check complete.', {
        title: metadata.title,
        candidates: candidates.length,
        duplicates: duplicates.length,
        trumpable: duplicates.filter((d) => d.trumpable).length,
    })
    logger.debug('ATH duplicates found.', { title: metadata.title, duplicates })

    return duplicates
}

type HdrTier = 'SDR' | 'HDR' | 'DV' | 'HDR10PLUS' | 'DV_HDR' | 'DV_HDR10PLUS'

type TorrentContext = {
    slot: string
    hdrTier: HdrTier
    sourceRank: number
    revision: number
    hasOriginalAudio: boolean
}

type TorrentDuplicateRule = (upload: TorrentContext, existing: TorrentContext) => boolean

const DUPLICATE_RULES: TorrentDuplicateRule[] = [
    // Same HDR tier in the same slot — direct duplicate
    (upload, existing) => upload.slot === existing.slot && upload.hdrTier === existing.hdrTier,
    // DV/HDR trumps HDR; DV/HDR10+ trumps HDR10+ — different tiers but share the slot
    (upload, existing) => upload.slot === existing.slot && HDR_TIER_TRUMPS[upload.hdrTier] === existing.hdrTier,
    // Single-slot categories (SD, 720p, 1080p remux) collapse all HDR tiers into one slot —
    // the slot string is a bare family name ('web', 'encode', 'remux') with no tier suffix
    (upload, existing) => upload.slot === existing.slot && /^(web|encode|remux)$/.test(upload.slot),
]

const TRUMP_RULES: TorrentDuplicateRule[] = [
    // DV/HDR over HDR, DV/HDR10+ over HDR10+
    (upload, existing) => HDR_TIER_TRUMPS[upload.hdrTier] === existing.hdrTier,
    // Higher revision number trumps lower (REPACK2 trumps REPACK1, any revision trumps none)
    (upload, existing) => upload.revision > existing.revision,
    // Higher source rank trumps lower (e.g. WEB-DL > WEBRip > HDTV); both must be ranked — absent rank means no trump
    (upload, existing) => upload.sourceRank > 0 && existing.sourceRank > 0 && upload.sourceRank > existing.sourceRank,
    // Upload carrying original audio trumps a dubbed-only release
    (upload, existing) => upload.hasOriginalAudio && !existing.hasOriginalAudio,
]

function getHdrTier(hdr: string[]): HdrTier {
    const hasDv = hdr.includes(HDR_TYPES.DV)
    const hasHdr10Plus = hdr.includes(HDR_TYPES.HDR10_PLUS)
    const hasHdr = hdr.includes(HDR_TYPES.HDR10) || hasHdr10Plus

    if (hasDv && hasHdr10Plus) return 'DV_HDR10PLUS'
    if (hasDv && hasHdr) return 'DV_HDR'
    if (hasDv) return 'DV'
    if (hasHdr10Plus) return 'HDR10PLUS'
    if (hasHdr) return 'HDR'
    return 'SDR'
}

// DV/HDR occupies the HDR slot and DV/HDR10+ occupies the HDR10+ slot (where they trump the non-DV release)
const SLOT_TIERS: Record<HdrTier, string> = {
    SDR: 'SDR',
    HDR: 'HDR',
    DV: 'DV',
    HDR10PLUS: 'HDR10PLUS',
    DV_HDR: 'HDR',
    DV_HDR10PLUS: 'HDR10PLUS',
}

/**
 * Computes the content slot a release occupies; two releases are duplicates when they
 * compete for the same slot.
 *
 * - SD and 720p afford a single slot per family (SD WEB / DVDRip / DVD Remux, 720p WEB / encode)
 * - 1080p+ WEB slots are split by HDR tier: SDR, DV, HDR (incl. DV/HDR), HDR10+ (incl. DV/HDR10+)
 * - 1080p+ encode slots are additionally split by x264 vs x265
 * - 1080p affords a single Remux slot; 2160p+ Remux slots are split by HDR tier
 *
 * The two 1080p x264 encode slots (Quality vs Retention, <20% size difference competes) cannot
 * be told apart without file sizes, so all x264 SDR encodes compete for one reported slot.
 */
function getSlot(resolution: string, family: SlotFamily, tier: HdrTier, videoCodec: string | undefined): string {
    if (SD_RESOLUTIONS.includes(resolution) || resolution === RESOLUTIONS['720p']) return family

    const slotTier = SLOT_TIERS[tier]
    if (family === 'encode') return `encode:${getCodecFamily(videoCodec)}:${slotTier}`
    if (family === 'remux') return resolution === RESOLUTIONS['2160p'] || resolution === RESOLUTIONS['4320p'] ? `remux:${slotTier}` : 'remux'
    return `web:${slotTier}`
}

// x264 and x265 encodes are separate slots
function getCodecFamily(codec: string | null | undefined): 'x264' | 'x265' | 'other' {
    if (!codec) return 'other'

    const c = codec.toLowerCase()
    if (c === 'x264') return 'x264'
    if (c === 'x265') return 'x265'
    return 'other'
}
