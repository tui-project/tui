import { getTvdbSeries } from '../../tvdb'
import type { TrackerUploadMetadata } from '../tracker'

export function hasYearQualifier(title: string): boolean {
    return /\(\d{4}\)$/.test(title.trim())
}

export async function shouldIncludeTvYear(metadata: TrackerUploadMetadata): Promise<boolean> {
    if (!metadata.tvdbId) return false
    const series = await getTvdbSeries(metadata.tvdbId)
    return series != null && hasYearQualifier(series.title)
}

export function buildSeasonEpisodeString(season?: number, episode?: number, episodeEnd?: number, specialName?: string): string {
    if (season === undefined) return ''
    const s = `S${String(season).padStart(2, '0')}`
    if (episode === undefined) return s
    const se = episodeEnd !== undefined ? `${s}E${String(episode).padStart(2, '0')}-${String(episodeEnd).padStart(2, '0')}` : `${s}E${String(episode).padStart(2, '0')}`
    if (specialName && (season === 0 || episode === 0)) return `${se} ${specialName}`
    return se
}

export function buildSourceString(metadata: TrackerUploadMetadata): string {
    switch (metadata.source) {
        case SOURCES.WEB:
            return metadata.service ?? ''
        case SOURCES.NTSC_DVD:
            return 'NTSC DVD'
        case SOURCES.PAL_DVD:
            return 'PAL DVD'
        case SOURCES.HD_DVD:
            return 'HDDVD'
        case SOURCES.DVD:
            return 'DVD'
        case SOURCES.BLURAY_3D:
            return '3D BluRay'
        case SOURCES.BLURAY:
            return 'BluRay'
        case SOURCES.UHD_BLURAY:
            return 'UHD BluRay'
        case SOURCES.HDTV:
            return 'HDTV'
        case SOURCES.UHDTV:
            return 'UHDTV'
        default:
            return ''
    }
}

export function buildTypeString(sourceType: SourceType): string {
    switch (sourceType) {
        case SOURCE_TYPES.REMUX:
            return 'REMUX'
        case SOURCE_TYPES.WEB_DL:
            return 'WEB-DL'
        case SOURCE_TYPES.WEBRIP:
            return 'WEBRip'
        default:
            return ''
    }
}

export function buildDubString(languages: string[], originalLanguage: string): string {
    if (!languages?.length) return ''
    if (languages.length === 2 && languages.includes(originalLanguage)) return 'Dual-Audio'
    if (languages.length === 1 && languages.includes('en') && !languages.includes(originalLanguage)) return 'Dubbed'
    return ''
}
