import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { MEDIA_TYPES, RESOLUTIONS, SOURCE_TYPES, SOURCES, type MediaType, type Resolution, type SourceType } from '../../model/metadata'
import { logger } from '../../utils/logger'
import type { TrackerService, TrackerUploadMetadata, TrackerUploadOptions } from './tracker'

const CATEGORY_IDS: Record<MediaType, number> = {
    [MEDIA_TYPES.MOVIE]: 1,
    [MEDIA_TYPES.TV]: 2,
}

const TYPE_IDS: Record<SourceType, number> = {
    [SOURCE_TYPES.REMUX]: 2,
    [SOURCE_TYPES.ENCODE]: 3,
    [SOURCE_TYPES.WEB_DL]: 4,
    [SOURCE_TYPES.WEBRIP]: 5,
    [SOURCE_TYPES.HDTV]: 6,
}

const RESOLUTION_IDS: Record<Resolution, number> = {
    [RESOLUTIONS['4320p']]: 1,
    [RESOLUTIONS['2160p']]: 2,
    [RESOLUTIONS['1080p']]: 3,
    [RESOLUTIONS['1080i']]: 4,
    [RESOLUTIONS['720p']]: 5,
    [RESOLUTIONS['576p']]: 6,
    [RESOLUTIONS['576i']]: 7,
    [RESOLUTIONS['480p']]: 8,
    [RESOLUTIONS['480i']]: 9,
}

// Returns 'UHD BluRay' for 2160p BluRay, 'BluRay' otherwise, or streaming service code for WEB sources
function buildSourceString(metadata: TrackerUploadMetadata): string {
    if (metadata.source === SOURCES.WEB) return metadata.service ?? ''
    if (metadata.source === SOURCES.BLURAY) return metadata.resolution === '2160p' ? 'UHD BluRay' : 'BluRay'
    if (metadata.source === SOURCES.DVD) return 'DVD'
    return ''
}

// TYPE is omitted for encodes and HDTV per FNP naming convention
function buildTypeString(sourceType: SourceType): string {
    if (sourceType === SOURCE_TYPES.REMUX) return 'REMUX'
    if (sourceType === SOURCE_TYPES.WEB_DL) return 'WEB-DL'
    if (sourceType === SOURCE_TYPES.WEBRIP) return 'WEBRip'
    return ''
}

function buildSeasonEpisodeString(season?: number, episode?: number): string {
    if (season === undefined) return ''
    const s = `S${String(season).padStart(2, '0')}`
    if (episode !== undefined) return `${s}E${String(episode).padStart(2, '0')}`
    return s
}

/**
 *  Refer to: https://fearnopeer.com/wikis/5
 */
function getCommonTitle(metadata: TrackerUploadMetadata): string {
    // Full Disc / REMUX template:  Name AKA Original LOCALE Year S##E## Cut Ratio Hybrid REPACK PROPER RERip Resolution Edition Region 3D SOURCE TYPE Hi10P HDR Vcodec Dub Acodec Channels Object-Tag
    // Encode / WEB-DL / WEBRip / HDTV template: Name AKA Original LOCALE Year S##E## Cut Ratio Hybrid REPACK PROPER RERip Resolution Edition 3D SOURCE TYPE Dub Acodec Channels Object Hi10P HDR Vcodec-Tag
    const isFullDiscOrRemux = metadata.sourceType === SOURCE_TYPES.REMUX
    const parts: string[] = []

    // Name
    parts.push(metadata.title)

    // AKA Original
    if (metadata?.originalTitle !== metadata.title) {
        parts.push(`AKA ${metadata.originalTitle}`)
    }

    // LOCALE — not available in metadata model; skip
    // TODO: add locale field to Metadata to disambiguate same-name titles (e.g. "The Office US")

    // Year - TV content only includes the year if multiple series of the same name exist. (Needs logic for this)
    parts.push(String(metadata.year))

    // S##E##
    parts.push(buildSeasonEpisodeString(metadata.season, metadata.episode))

    // Cut — e.g. Director's Cut, Extended, Unrated
    if (metadata.cut) parts.push(metadata.cut)

    // Ratio — not available in metadata model; skip
    // TODO: add ratio field to Metadata for IMAX, Open Matte, MAR

    // Hybrid
    if (metadata.hybrid) parts.push('Hybrid')

    // REPACK
    if (metadata.repack) parts.push('REPACK')

    // PROPER
    if (metadata.proper) parts.push('PROPER')

    // RERip — not available in metadata model; skip
    // TODO: add rerip field to Metadata

    // Resolution
    parts.push(metadata.resolution)

    // Edition — not available in metadata model; skip
    // TODO: add edition field to Metadata (e.g. "Criterion Collection", "Remastered")

    // Region — Full Disc only (not REMUX); not available in metadata model; skip
    // TODO: add region field to Metadata (3-letter disc region code, e.g. "GER", "USA") and a isFullDisc flag to gate it

    // 3D — not available in metadata model; skip
    // TODO: add 3d boolean field to Metadata

    // SOURCE
    parts.push(buildSourceString(metadata))

    // TYPE — omitted for encodes and HDTV
    parts.push(buildTypeString(metadata.sourceType))

    if (isFullDiscOrRemux) {
        // Full Disc / REMUX order: Hi10P HDR Vcodec Dub Acodec Channels Object

        // Hi10P — not available; requires 10-bit depth flag; skip
        // TODO: derive from videoCodec (AVC/H.264/x264) + bit-depth once added to Metadata

        if (metadata.hdr && metadata.hdr.length > 0) parts.push(metadata.hdr.join(' '))
        parts.push(metadata.videoCodec)

        // Dub — not available; requires language/originalLanguage analysis; skip
        // TODO: derive Dual-Audio / Dubbed / Multi from metadata.language and metadata.originalLanguage

        parts.push(metadata.audioCodec)
        parts.push(metadata.audioChannels)
        if (metadata.audioMetadata) parts.push(metadata.audioMetadata)
    } else {
        // Encode / WEB-DL / WEBRip / HDTV order: Dub Acodec Channels Object Hi10P HDR Vcodec

        // Dub — not available; requires language/originalLanguage analysis; skip
        // TODO: derive Dual-Audio / Dubbed / Multi from metadata.language and metadata.originalLanguage

        parts.push(metadata.audioCodec)
        parts.push(metadata.audioChannels)
        if (metadata.audioMetadata) parts.push(metadata.audioMetadata)

        // Hi10P — not available; requires 10-bit depth flag; skip
        // TODO: derive from videoCodec (AVC/H.264/x264) + bit-depth once added to Metadata

        if (metadata.hdr && metadata.hdr.length > 0) parts.push(metadata.hdr.join(' '))
        parts.push(metadata.videoCodec)
    }

    return `${parts.filter(Boolean).join(' ')}-${metadata.releaseGroup ?? 'NOGROUP'}`
}

export function createUnit3dService(url: string, apiKey: string, buildTitle?: (metadata: TrackerUploadMetadata) => string): TrackerService {
    /*
     * refer to: https://hdinnovations.github.io/UNIT3D/torrent_api.html
     */
    async function upload(torrentPath: string, metadata: TrackerUploadMetadata, description: string, mediainfoText: string, options: TrackerUploadOptions) {
        const { title, anonymous } = options
        const torrentBuffer = await readFile(torrentPath)

        const formData = new FormData()
        formData.append('torrent', new Blob([torrentBuffer], { type: 'application/x-bittorrent' }), basename(torrentPath))
        formData.append('name', title)
        formData.append('description', description)
        formData.append('mediainfo', mediainfoText)
        formData.append('category_id', String(CATEGORY_IDS[metadata.mediaType as MediaType]))
        formData.append('type_id', String(TYPE_IDS[metadata.sourceType as SourceType]))
        formData.append('resolution_id', String(RESOLUTION_IDS[metadata.resolution as Resolution]))
        formData.append('tmdb', String(metadata.tmdbId))
        formData.append('anonymous', String(anonymous))
        formData.append('imdb', metadata.imdbId.replace(/^tt/, ''))
        if (metadata.tvdbId != null) formData.append('tvdb', String(metadata.tvdbId))
        if (metadata.season != null) formData.append('season_number', String(metadata.season))
        if (metadata.episode != null) formData.append('episode_number', String(metadata.episode))

        logger.info('Uploading torrent to UNIT3D tracker.', { trackerUrl: url, title, torrentPath })

        const response = await fetch(`${url}/api/torrents/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData,
        })

        if (!response.ok) {
            let errorDetail: string
            try {
                errorDetail = JSON.stringify(await response.json())
            } catch {
                errorDetail = await response.text()
            }
            throw new Error(`Upload failed with status ${response.status}: ${errorDetail}`)
        }

        logger.debug('request', { formData })
        logger.info('Torrent uploaded successfully to UNIT3D tracker.', { trackerUrl: url, title })
    }

    return {
        getTitle: buildTitle ?? getCommonTitle,
        upload,
    }
}
