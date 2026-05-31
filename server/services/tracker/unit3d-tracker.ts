import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { MEDIA_TYPES, RESOLUTIONS, SOURCE_TYPES, type MediaType, type Resolution, type SourceType } from '../../model/metadata'
import { logger } from '../../utils/logger'
import type { RuleViolation, TrackerService, TrackerUploadMetadata, TrackerUploadOptions } from './tracker'

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

export function createUnit3dService(
    url: string,
    apiKey: string,
    buildTitle?: (metadata: TrackerUploadMetadata) => Promise<string>,
    checkRules?: (metadata: TrackerUploadMetadata) => RuleViolation[],
    appendExtraFields?: (formData: FormData, metadata: TrackerUploadMetadata) => void
): TrackerService {
    /*
     * refer to: https://hdinnovations.github.io/UNIT3D/torrent_api.html
     */
    async function upload(torrentPath: string, metadata: TrackerUploadMetadata, description: string, mediainfoText: string, options: TrackerUploadOptions) {
        const { title, anonymous, modQueueOptIn } = options
        const torrentBuffer = await readFile(torrentPath)

        const formData = new FormData()
        formData.append('torrent', new Blob([torrentBuffer], { type: 'application/x-bittorrent' }), basename(torrentPath))
        formData.append('name', title)
        formData.append('description', description)
        formData.append('mediainfo', mediainfoText)
        formData.append('category_id', String(CATEGORY_IDS[metadata.mediaType as MediaType]))
        formData.append('type_id', String(TYPE_IDS[metadata.sourceType as SourceType]))
        formData.append('resolution_id', String(RESOLUTION_IDS[metadata.resolution as Resolution]))
        if (metadata.season != null) formData.append('season_number', String(metadata.season))
        if (metadata.season != null) formData.append('episode_number', String(metadata.episode ?? 0))
        formData.append('tmdb', String(metadata.tmdbId))
        formData.append('imdb', metadata.imdbId.replace(/^tt/, ''))
        if (metadata.tvdbId != null) formData.append('tvdb', String(metadata.tvdbId))
        formData.append('anonymous', anonymous ? '1' : '0')
        formData.append('mod_queue_opt_in', modQueueOptIn ? '1' : '0')
        appendExtraFields?.(formData, metadata)

        logger.info('Uploading torrent to UNIT3D tracker.', { trackerUrl: url, title, torrentPath })
        logger.debug('request', { formData: Object.fromEntries(formData.entries()) })

        let torrentDownloadUrl: string
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
            torrentDownloadUrl = response.data
        } catch (error: unknown) {
            const err = error as { statusCode?: number; data?: unknown }
            const uploadError = new Error(`Upload failed: HTTP ${err.statusCode ?? 'unknown'} — ${JSON.stringify(err.data)}`)
            throw uploadError
        }

        logger.info('Torrent uploaded successfully to UNIT3D tracker.', { trackerUrl: url, title, torrentDownloadUrl })
        return torrentDownloadUrl
    }

    return {
        getTitle: buildTitle ?? (() => Promise.resolve('')),
        checkRules: checkRules ?? (() => []),
        upload,
    }
}
