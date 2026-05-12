import { MEDIA_TYPES, RESOLUTIONS, SOURCE_TYPES, SOURCES, type SourceType } from '../../../model/metadata'
import type { TrackerService, TrackerUploadMetadata } from '../tracker'
import { createUnit3dService } from '../unit3d-tracker'

export function createUlcxTrackerService(url: string, apiKey: string): TrackerService {
    return createUnit3dService(url, apiKey, buildTitle)
}

function buildTitle(metadata: TrackerUploadMetadata) {
    //Refer to: https://upload.cx/wikis/7

    const isRemux = metadata.sourceType === SOURCE_TYPES.REMUX
    const parts: string[] = [metadata.title]

    if (metadata?.originalTitle !== metadata.title) parts.push(`AKA ${metadata.originalTitle}`)
    // LOCALE — not available in metadata model; skip
    // Year - needs changes:
    if (metadata.mediaType === MEDIA_TYPES.MOVIE) parts.push(String(metadata.year))
    parts.push(buildSeasonEpisodeString(metadata.season, metadata.episode))
    if (metadata.cut) parts.push(metadata.cut)
    if (metadata.ratio) parts.push(metadata.ratio)
    if (metadata.hybrid && metadata.sourceType !== SOURCE_TYPES.WEB_DL) parts.push('Hybrid')
    if (metadata.repack) parts.push(metadata.repack === 1 ? 'REPACK' : `REPACK${metadata.repack}`)
    if (metadata.proper) parts.push(metadata.proper === 1 ? 'PROPER' : `PROPER${metadata.proper}`)
    if (metadata.rerip) parts.push('RERip')
    if (metadata.threeD) parts.push('3D')
    if (metadata.source === SOURCES.DVD) parts.push(metadata.resolution)
    parts.push(buildSourceString(metadata))
    parts.push(buildTypeString(metadata.sourceType))

    if (isRemux) {
        // Hi10P — not available; requires 10-bit depth flag; skip
        if (metadata.hdr && metadata.hdr.length > 0) parts.push(metadata.hdr.join(' '))
        parts.push(metadata.videoCodec)
        // Dub — not available; requires language/originalLanguage analysis; skip
        parts.push(metadata.audioCodec)
        parts.push(metadata.audioChannels)
        if (metadata.audioMetadata) parts.push(metadata.audioMetadata)
    } else {
        // Dub — not available; requires language/originalLanguage analysis; skip
        parts.push(metadata.audioCodec)
        parts.push(metadata.audioChannels)
        if (metadata.audioMetadata) parts.push(metadata.audioMetadata)
        // Hi10P — not available; requires 10-bit depth flag; skip
        if (metadata.hdr && metadata.hdr.length > 0) parts.push(metadata.hdr.join(' '))
        parts.push(metadata.videoCodec)
    }

    return `${parts.filter(Boolean).join(' ')}-${metadata.releaseGroup ?? 'NOGROUP'}`
}

function buildSeasonEpisodeString(season?: number, episode?: number): string {
    if (season === undefined) return ''
    const s = `S${String(season).padStart(2, '0')}`
    if (episode !== undefined) return `${s}E${String(episode).padStart(2, '0')}`
    return s
}

function buildSourceString(metadata: TrackerUploadMetadata): string {
    if (metadata.source === SOURCES.WEB) return metadata.service ?? ''
    if (metadata.source === SOURCES.BLURAY) return metadata.resolution === RESOLUTIONS['2160p'] ? 'UHD BluRay' : 'BluRay'
    if (metadata.source === SOURCES.DVD) return 'DVD'
    return ''
}

function buildTypeString(sourceType: SourceType): string {
    if (sourceType === SOURCE_TYPES.REMUX) return 'REMUX'
    if (sourceType === SOURCE_TYPES.WEB_DL) return 'WEB-DL'
    if (sourceType === SOURCE_TYPES.WEBRIP) return 'WEBRip'
    return ''
}
