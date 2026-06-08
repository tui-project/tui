import { AUDIO_CODECS, HDR_TYPES, MEDIA_TYPES, RESOLUTIONS, SOURCE_TYPES, type SourceType } from '../../../model/metadata'
import { hasEnglishAudio, isForeignContent, isRemux } from '../util/metadata-util'
import { getLanguageDisplayName } from '../../../repositories/language-repository'
import type { RuleViolation, TrackerService, TrackerUploadMetadata, TrackerUploadOptions } from '../tracker'
import { buildDubString, buildSeasonEpisodeString, buildSourceString, buildTypeString, shouldIncludeTvYear } from '../util/title-builder-util'
import { upload } from '../unit3d-tracker'

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
 *  - naming guide: https://aither.cc/wikis/51
 *  - bannd groups: https://aither.cc/pages/blacklist/releasegroups
 *  - API spec.   : https://aither.cc/pages/api
 */
export function athTrackerService(url: string, apiKey: string): TrackerService {
    return {
        getTitle: buildTitle,
        checkRules,
        upload: (torrentPath: string, metadata: TrackerUploadMetadata, description: string, mediainfoText: string, title: string, options: TrackerUploadOptions) =>
            upload(url, apiKey, torrentPath, metadata, description, mediainfoText, title, options, getExtraFields(metadata)),
    }
}

/**
 * WEB-DL / WEBRip / Encode: Title [AKA Original] LOCALE Year S##E## [Cut] [Ratio] [Hybrid] [REPACK] [PROPER] [RERIP] [Language] Resolution [Service] Source Type [Dub] AudioCodec Channels [Metadata] [HDR] VideoCodec-Tag
 * Remux                   : Title [AKA Original] LOCALE Year S##E## [Cut] [Ratio] [Hybrid] [REPACK] [PROPER] [RERIP] [Language] Resolution Source REMUX [HDR] VideoCodec [Dub] AudioCodec Channels [Metadata]-Tag
 */
async function buildTitle(metadata: TrackerUploadMetadata): Promise<string> {
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
