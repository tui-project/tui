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

function getCommonTitle(metadata: TrackerUploadMetadata): string {
    const parts: string[] = [metadata.title]

    if (metadata.mediaType === MEDIA_TYPES.TV && metadata.season != null) {
        const season = String(metadata.season).padStart(2, '0')
        const episode = metadata.episode != null ? `E${String(metadata.episode).padStart(2, '0')}` : ''
        parts.push(`S${season}${episode}`)
    }

    parts.push(`(${metadata.year})`)
    if (metadata.cut) parts.push(metadata.cut)
    if (metadata.proper) parts.push('PROPER')
    if (metadata.repack) parts.push('REPACK')
    parts.push(metadata.resolution)

    if (metadata.source === SOURCES.WEB) {
        if (metadata.service) parts.push(metadata.service)
    }
    parts.push(metadata.source)

    parts.push(metadata.sourceType)
    parts.push(metadata.videoCodec)
    if (metadata.hybrid) parts.push('HYBRiD')

    if (metadata.hdr && metadata.hdr.length > 0) {
        parts.push(...metadata.hdr)
    }

    parts.push(metadata.audioCodec)
    if (metadata.audioMetadata) parts.push(metadata.audioMetadata)
    parts.push(metadata.audioChannels)

    const base = parts.join(' ')
    return metadata.releaseGroup ? `${base}-${metadata.releaseGroup}` : base
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
