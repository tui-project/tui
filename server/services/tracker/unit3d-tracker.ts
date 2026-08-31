import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { createLogger } from '../../utils/logger'
import { BiMap } from '../../utils/bi-map'
import { parseMetadataFromName } from '../media-name-parser'
import { TrackerError, type DuplicateEntry, type TrackerUploadOptions } from './tracker'

const logger = createLogger('tracker:unit3d')

export type TorrentResult = {
    name: string
    url: string
    mediaType: MediaType
    resolution: Resolution
    sourceType: SourceType
    videoCodec: VideoCodec
    videoBitrate: number
    hdr: HDR[]
    repack: number
    proper: number
    rerip: number
    hasOriginalAudio: boolean
    season?: number
    episode?: number
    service?: Service
    cut?: string
    ratio?: string
    hybrid: boolean
    releaseGroup?: string
}

type Attributes = {
    name: string
    category_id: number
    type_id: number
    resolution_id: number
    details_link: string
    media_info: string
}

const CATEGORY_IDS = BiMap<MediaType, number>([
    [MEDIA_TYPES.MOVIE, 1],
    [MEDIA_TYPES.TV, 2],
])

const TYPE_IDS = BiMap<SourceType, number>([
    [SOURCE_TYPES.REMUX, 2],
    [SOURCE_TYPES.ENCODE, 3],
    [SOURCE_TYPES.WEB_DL, 4],
    [SOURCE_TYPES.WEBRIP, 5],
    [SOURCE_TYPES.HDTV, 6],
])

const RESOLUTION_IDS = BiMap<Resolution, number>([
    [RESOLUTIONS['4320p'], 1],
    [RESOLUTIONS['2160p'], 2],
    [RESOLUTIONS['1080p'], 3],
    [RESOLUTIONS['1080i'], 4],
    [RESOLUTIONS['720p'], 5],
    [RESOLUTIONS['576p'], 6],
    [RESOLUTIONS['576i'], 7],
    [RESOLUTIONS['480p'], 8],
    [RESOLUTIONS['480i'], 9],
])

export async function upload(
    url: string,
    apiKey: string,
    torrentPath: string,
    metadata: Metadata,
    description: string,
    mediainfoText: string,
    title: string,
    options: TrackerUploadOptions,
    extraFields: Record<string, string> = {}
): Promise<string> {
    /*
     * refer to: https://hdinnovations.github.io/UNIT3D/torrent_api.html
     */
    const torrentBuffer = await readFile(torrentPath)

    const formData = new FormData()
    formData.append('torrent', new Blob([torrentBuffer], { type: 'application/x-bittorrent' }), basename(torrentPath))
    formData.append('name', title)
    formData.append('description', description)
    formData.append('mediainfo', mediainfoText)
    formData.append('category_id', String(CATEGORY_IDS.getByKey(metadata.mediaType as MediaType)))
    formData.append('type_id', String(TYPE_IDS.getByKey(metadata.sourceType as SourceType)))
    formData.append('resolution_id', String(RESOLUTION_IDS.getByKey(metadata.resolution as Resolution)))
    if (metadata.season != null) formData.append('season_number', String(metadata.season))
    if (metadata.season != null) formData.append('episode_number', String(metadata.episode ?? 0))
    formData.append('tmdb', String(metadata.tmdbId))
    formData.append('imdb', metadata.imdbId.replace(/^tt/, ''))
    if (metadata.tvdbId != null) formData.append('tvdb', String(metadata.tvdbId))
    formData.append('anonymous', options.anonymous ? '1' : '0')
    formData.append('mod_queue_opt_in', options.modQueueOptIn ? '1' : '0')
    for (const [key, value] of Object.entries(extraFields)) formData.append(key, value)

    logger.info('Uploading torrent to UNIT3D tracker.', { trackerUrl: url, title, torrentPath })
    logger.trace('UNIT3D upload request prepared.', { trackerUrl: url, title, fields: [...formData.keys()] })

    try {
        const response = await $fetch<{ data: string }>(`${url}/api/torrents/upload`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
            },
            body: formData,
            redirect: 'error',
        })

        logger.debug('UNIT3D upload response received.', { trackerUrl: url, title, response })
        logger.info('Torrent uploaded successfully to UNIT3D tracker.', { trackerUrl: url, title })

        return response.data
    } catch (error: unknown) {
        const err = error as { statusCode?: number; data?: unknown }
        const reason = parseUnit3dErrorMessage(err.data)
        logger.warn('UNIT3D torrent upload failed.', { trackerUrl: url, statusCode: err.statusCode, reason })
        throw new TrackerError(reason, err.statusCode, err.data)
    }
}

function parseUnit3dErrorMessage(data: unknown): string {
    if (!data || typeof data !== 'object') return JSON.stringify(data)

    const d = data as Record<string, unknown>
    const fields = (d.errors ?? d.data) as Record<string, string[]> | undefined
    if (fields && typeof fields === 'object') return Object.values(fields).flat().join(' ')

    if (typeof d.message === 'string') return d.message

    return JSON.stringify(data)
}

export async function getTorrents(
    url: string,
    apiKey: string,
    params: { tmdbId?: number; mediaType?: string; resolutions?: string[]; sourceTypes?: string[]; seasonNumber?: number; episodeNumber?: number }
): Promise<TorrentResult[]> {
    const parts: string[] = []
    if (params.tmdbId != null) parts.push(`tmdbId=${params.tmdbId}`)
    if (params.mediaType != null) parts.push(`categories[]=${CATEGORY_IDS.getByKey(params.mediaType as MediaType)}`)
    for (const resolution of params.resolutions ?? []) parts.push(`resolutions[]=${RESOLUTION_IDS.getByKey(resolution as Resolution)}`)
    for (const sourceType of params.sourceTypes ?? []) parts.push(`types[]=${TYPE_IDS.getByKey(sourceType as SourceType)}`)
    if (params.seasonNumber != null) parts.push(`seasonNumber=${params.seasonNumber}`)
    if (params.episodeNumber != null) parts.push(`episodeNumber=${params.episodeNumber}`)
    const query = parts.join('&')

    logger.trace('Fetching existing torrents from UNIT3D tracker.', { trackerUrl: url, query })

    try {
        const response = await $fetch<{ data: Array<{ attributes: Attributes }> }>(`${url}/api/torrents/filter?${query}`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
            },
        })
        logger.trace('UNIT3D torrent search response received.', { trackerUrl: url, response })
        return response.data.map((t) => mapTorrentAttributes(t.attributes))
    } catch (error: unknown) {
        logger.warn('Failed to fetch torrents from UNIT3D tracker.', { trackerUrl: url, error })
        return []
    }
}

function mapTorrentAttributes(attrs: Attributes): TorrentResult {
    const parsed = parseMetadataFromName(attrs.name)

    return {
        name: attrs.name,
        url: attrs.details_link,
        mediaType: CATEGORY_IDS.getByValue(attrs.category_id)!,
        resolution: RESOLUTION_IDS.getByValue(attrs.resolution_id)!,
        sourceType: TYPE_IDS.getByValue(attrs.type_id)!,
        videoCodec: parsed.videoCodec!,
        videoBitrate: parseVideoBitrate(attrs.media_info),
        hdr: parsed.hdr,
        repack: parsed.repack,
        proper: parsed.proper,
        rerip: parsed.rerip,
        //"Dubbed" = English dub only, no original audio track; all other releases carry original audio
        hasOriginalAudio: !/\bDubbed\b/i.test(attrs.name),
        season: parsed.season,
        episode: parsed.episode,
        service: parsed.service,
        cut: parsed.cut,
        ratio: parsed.ratio,
        hybrid: parsed.hybrid,
        releaseGroup: parsed.releaseGroup,
    }
}

function parseVideoBitrate(mediaInfo: string): number {
    const videoSection = /(?:^|\r?\n)Video(?:\s*#\d+)?\r?\n([\s\S]*?)(?=\r?\n(?:Audio|Text|Menu)(?:\s*#\d+)?\r?\n|$)/i.exec(mediaInfo)![1]!
    const match = /^Bit rate\s*:\s*([\d .]+)\s*([kmg]?)b\/s\s*$/im.exec(videoSection)!
    const value = Number.parseFloat(match[1]!.replaceAll(' ', ''))
    switch (match[2]!.toLowerCase()) {
        case 'g':
            return value * 1_000_000_000
        case 'm':
            return value * 1_000_000
        case 'k':
            return value * 1_000
        default:
            return value
    }
}

export function defaultFindDuplicates(candidates: TorrentResult[], metadata: Metadata): DuplicateEntry[] {
    const hasHdr = metadata.hdr.length > 0

    const duplicates = candidates
        .filter((t) => {
            const torrentHasHdr = t.hdr.length > 0
            if (hasHdr !== torrentHasHdr) return false
            if (metadata.mediaType === MEDIA_TYPES.TV) {
                if (t.season !== metadata.season) return false
                if (metadata.episode != null && t.episode !== metadata.episode) return false
            }
            return true
        })
        .map((t) => ({ name: t.name, url: t.url, trumpable: false }))

    logger.trace('Default UNIT3D duplicate check complete.', { title: metadata.title, candidateCount: candidates.length, duplicateCount: duplicates.length })
    return duplicates
}
