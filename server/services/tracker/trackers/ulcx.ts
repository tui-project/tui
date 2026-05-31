import { MEDIA_TYPES, RESOLUTIONS, SOURCE_TYPES, SOURCES, VIDEO_CODECS, type Resolution, type VideoCodec } from '../../../model/metadata'
import { isDvd, isRemux, isHdtv, isEncode, isForeignContent, hasEnglishAudio } from '../util/metadata-util'
import type { RuleViolation, TrackerService, TrackerUploadMetadata } from '../tracker'
import { buildDubString, buildSeasonEpisodeString, buildSourceString, buildTypeString, shouldIncludeTvYear } from '../util/title-builder-util'
import { createUnit3dService } from '../unit3d-tracker'

/**
 * Refer to:
 *  - naming guide: https://upload.cx/wikis/7
 *  - bannd groups: https://upload.cx/wikis/6
 *  - API spec.   : https://upload.cx/wikis/38
 */
export function createUlcxTrackerService(url: string, apiKey: string): TrackerService {
    return createUnit3dService(url, apiKey, buildTitle, checkRules)
}

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
 * Full Disc, Remux Template            : Name AKA Original LOCALE Year S##E## Cut Ratio Hybrid REPACK PROPER RERip Resolution Edition Region 3D SOURCE TYPE Hi10P HDR Vcodec Dub Acodec Channels Object-Tag
 * Encode, WEB-DL, WEBRip, HDTV Template: Name AKA Original LOCALE Year S##E## Cut Ratio Hybrid REPACK PROPER RERip Resolution Edition 3D SOURCE TYPE Dub Acodec Channels Object Hi10P HDR Vcodec-Tag
 */
async function buildTitle(metadata: TrackerUploadMetadata) {
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
        if (metadata.hdr?.length) parts.push(metadata.hdr.join(' '))
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
        if (metadata.hdr?.length) parts.push(metadata.hdr.join(' '))
        if (!isDvd(metadata)) parts.push(metadata.videoCodec)
    }

    return `${parts.filter(Boolean).join(' ')}-${metadata.releaseGroup ?? 'NOGROUP'}`
}

function checkRules(metadata: TrackerUploadMetadata): RuleViolation[] {
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

    return violations
}
