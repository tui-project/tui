import { open } from 'node:fs/promises'
import MediaInfoFactory from 'mediainfo.js'
import type { MediaInfoResult, Track } from 'mediainfo.js'
import { logger } from '../utils/logger'
import {
    AUDIO_CHANNELS,
    AUDIO_CODECS,
    AUDIO_METADATA_TYPES,
    HDR_TYPES,
    RESOLUTIONS,
    VIDEO_CODECS,
    SOURCE_TYPES,
    type AudioChannels,
    type AudioCodec,
    type AudioMetadata,
    type HDR,
    type Resolution,
    type SourceType,
    type VideoCodec,
} from '../model/metadata'

type MediaInfoOutputFormat = 'object' | 'text'

interface AnalyzeMediaFileOptions {
    output: MediaInfoOutputFormat
}

export interface ParsedMediainfoMetadata {
    resolution?: Resolution
    videoCodec?: VideoCodec
    hdr: HDR[]
    language: string[]
    audioCodec?: AudioCodec
    audioChannels?: AudioChannels
    audioMetadata: AudioMetadata
    tmdbId?: number
    imdbId?: string
    tvdbId?: number
}

export async function parseMetadataFromMediainfo(filePath: string, sourceType: SourceType): Promise<ParsedMediainfoMetadata> {
    logger.debug('Parsing metadata from mediainfo result.', { filePath, sourceType })

    const mediainfo = await analyzeMediaFile(filePath, { output: 'object' })
    const tracks = getTracks(mediainfo)
    const general = findTrack(tracks, 'General')
    const video = findTrack(tracks, 'Video')
    const audio = findDefaultAudioTrack(tracks)

    const height = toStringValue(video, 'Height')
    const scanType = toStringValue(video, 'ScanType')
    const resolution = parseResolution(height, scanType)

    const format = toStringValue(video, 'Format')
    const formatVersion = toStringValue(video, 'Format_Version')
    const videoCodec = parseVideoCodec(format, formatVersion, sourceType)

    const hdrFormat = toStringValue(video, 'HDR_Format')
    const hdrCompatibility = toStringValue(video, 'HDR_Format_Compatibility')
    const hdr = parseHdr(hdrFormat, hdrCompatibility)

    const audioFormat = toStringValue(audio, 'Format')
    const audioFormatCommercial = toStringValue(audio, 'Format_Commercial_IfAny')
    const audioCodec = parseAudioCodec(audioFormat, audioFormatCommercial)

    const channels = toStringValue(audio, 'Channels')
    const channelLayout = toStringValue(audio, 'ChannelLayout')
    const audioChannels = parseAudioChannels(channels, channelLayout)

    const audioTitle = toStringValue(audio, 'Title')
    const audioMetadata = parseAudioMetadata(audioFormatCommercial, audioTitle)

    const language = parseAudioLanguages(tracks)

    const imdbId = toStringValue(general, 'extra.IMDB')
    const tmdbId = parseIntegerValue(general, 'extra.TMDB')
    const tvdbId = parseIntegerValue(general, 'extra.TVDB')

    const parsedMetadata = {
        resolution,
        videoCodec,
        hdr,
        audioCodec,
        audioChannels,
        audioMetadata,
        language,
        tmdbId,
        imdbId,
        tvdbId,
    }

    logger.debug('Parsed metadata from mediainfo result.', {
        filePath,
        sourceType,
        trackCount: tracks.length,
        resolution: parsedMetadata.resolution,
        videoCodec: parsedMetadata.videoCodec,
        hdr: parsedMetadata.hdr,
        audioCodec: parsedMetadata.audioCodec,
        audioChannels: parsedMetadata.audioChannels,
        languageCount: parsedMetadata.language.length,
        hasTmdbId: parsedMetadata.tmdbId !== undefined,
        hasImdbId: Boolean(parsedMetadata.imdbId),
        hasTvdbId: parsedMetadata.tvdbId !== undefined,
    })

    return parsedMetadata
}

function getTracks(result: MediaInfoResult): Track[] {
    return result.media!.track as Track[]
}

function findTrack(tracks: Track[], type: string) {
    return tracks.find((track) => String(getTrackValue(track, '@type')).toLowerCase() === type.toLowerCase())
}

function getTrackValue(track: Track | undefined, key: string): unknown {
    if (!track) return ''

    const root = track as unknown as Record<string, unknown>
    if (!key.includes('.')) return root[key] ?? ''

    const path = key.split('.')
    let current: unknown = root

    for (const part of path) {
        if (!current || typeof current !== 'object') return ''

        const next = (current as Record<string, unknown>)[part]
        if (next === undefined || next === null) return ''

        current = next
    }

    return current
}

function findDefaultAudioTrack(tracks: Track[]) {
    let firstAudio: Track | undefined

    for (const track of tracks) {
        if (!isTrackType(track, 'Audio')) continue
        if (!firstAudio) firstAudio = track
        if (toStringValue(track, 'Default').toLowerCase() === 'yes') return track
    }

    return firstAudio
}

function isTrackType(track: Track, expectedType: string) {
    return toStringValue(track, '@type').toLowerCase() === expectedType.toLowerCase()
}

function toStringValue(track: Track | undefined, key: string): string {
    const value = getTrackValue(track, key)
    const stringValue = String(value).trim()

    return stringValue === '<nil>' ? '' : stringValue
}

function parseResolution(height: string, scanType: string): Resolution | undefined {
    const suffix = scanType.trim().toLowerCase() === 'interlaced' ? 'i' : 'p'

    switch (height.trim()) {
        case '4320':
            return RESOLUTIONS['4320p']
        case '2160':
        case '2074':
        case '1744':
            return RESOLUTIONS['2160p']
        case '1080':
        case '1072':
        case '1036':
            return suffix === 'i' ? RESOLUTIONS['1080i'] : RESOLUTIONS['1080p']
        case '720':
            return RESOLUTIONS['720p']
        case '576':
            return suffix === 'i' ? RESOLUTIONS['576i'] : RESOLUTIONS['576p']
        case '480':
            return suffix === 'i' ? RESOLUTIONS['480i'] : RESOLUTIONS['480p']
        default:
            logger.warn('Unable to detect resolution from mediainfo.', { height, scanType })
            return undefined
    }
}

function parseVideoCodec(format: string, formatVersion: string, sourceType: SourceType): VideoCodec | undefined {
    switch (true) {
        case format === 'AVC' && sourceType === SOURCE_TYPES.WEBRIP:
            return VIDEO_CODECS.X264
        case format === 'AVC' && sourceType === SOURCE_TYPES.WEB_DL:
            return VIDEO_CODECS.H264
        case format === 'HEVC' && sourceType === SOURCE_TYPES.WEBRIP:
            return VIDEO_CODECS.X265
        case format === 'HEVC' && sourceType === SOURCE_TYPES.WEB_DL:
            return VIDEO_CODECS.H265
        case format === 'MPEG Video' && formatVersion === '1':
            return VIDEO_CODECS.MPEG_1
        case format === 'MPEG Video' && formatVersion === '2':
            return VIDEO_CODECS.MPEG_2
        case format === 'AVC':
            return VIDEO_CODECS.AVC
        case format === 'HEVC':
            return VIDEO_CODECS.HEVC
        case format === 'VC-1':
            return VIDEO_CODECS.VC_1
        case format === 'VP9':
            return VIDEO_CODECS.VP9
        case format === 'AV1':
            return VIDEO_CODECS.AV1
        default:
            logger.warn('Unknown video codec from mediainfo.', { format, formatVersion, sourceType })
            return undefined
    }
}

function parseHdr(hdrFormat: string, hdrCompatibility: string): HDR[] {
    if (!hdrFormat && !hdrCompatibility) return []

    const values = new Set<HDR>()

    if (hdrFormat.includes('Dolby Vision')) values.add(HDR_TYPES.DV)

    if (hdrFormat.includes('HDR10+')) {
        values.add(HDR_TYPES.HDR10_PLUS)
    } else if (hdrFormat.includes('HDR') || (hdrFormat === 'SMPTE ST 2086' && hdrCompatibility === 'HDR10')) {
        values.add(HDR_TYPES.HDR10)
    }

    if (hdrFormat.includes('HLG')) values.add(HDR_TYPES.HLG)

    if (hdrCompatibility.includes('HDR10+')) {
        values.add(HDR_TYPES.HDR10_PLUS)
    } else if (hdrCompatibility.includes('HDR10')) {
        values.add(HDR_TYPES.HDR10)
    }

    const hdr = [...values].sort((a, b) => a.localeCompare(b))
    if (hdr.length === 0) {
        logger.warn('Unable to detect HDR from mediainfo.', { hdrFormat, hdrCompatibility })
    }

    return hdr
}

function parseAudioCodec(audioFormat: string, formatCommercialIfAny: string): AudioCodec | undefined {
    switch (true) {
        case audioFormat === 'E-AC-3':
        case audioFormat === 'EAC3':
        case audioFormat === 'DDP':
            return AUDIO_CODECS.DD_PLUS
        case audioFormat === 'AC-3':
        case audioFormat === 'AC3':
        case audioFormat === 'DD':
            return AUDIO_CODECS.DD
        case audioFormat === 'AAC':
            return AUDIO_CODECS.AAC
        case audioFormat === 'DTS' && formatCommercialIfAny === 'DTS-HD Master Audio':
            return AUDIO_CODECS.DTS_HD_MA
        case audioFormat === 'DTS':
            return AUDIO_CODECS.DTS
        case audioFormat === 'FLAC':
            return AUDIO_CODECS.FLAC
        case audioFormat === 'MLP FBA':
            return AUDIO_CODECS.TRUEHD
        default:
            logger.warn('Unable to detect audio codec from mediainfo.', { audioFormat, formatCommercialIfAny })
            return undefined
    }
}

function parseAudioChannels(channels: string, channelLayout: string): AudioChannels | undefined {
    switch (true) {
        case channels === '1':
            return AUDIO_CHANNELS['1.0']
        case channels === '2':
            return AUDIO_CHANNELS['2.0']
        case channels === '3':
            return AUDIO_CHANNELS['3.0']
        case channels === '6' && (channelLayout === 'C L R Ls Rs LFE' || channelLayout === 'L R C LFE Ls Rs'):
            return AUDIO_CHANNELS['5.1']
        case channels === '7' && channelLayout === 'C L R Ls Rs LFE Cb':
            return AUDIO_CHANNELS['6.1']
        case channels === '8' && (channelLayout === 'C L R Ls Rs Lb Rb LFE' || channelLayout === 'L R C LFE Ls Rs Lb Rb' || channelLayout === 'C L R Ls Rs LFE Lw Rw'):
            return AUDIO_CHANNELS['7.1']
        default:
            logger.warn('Unable to detect audio channels from mediainfo.', { channels, channelLayout })
            return undefined
    }
}

function parseAudioMetadata(formatCommercialIfAny: string, title: string): AudioMetadata {
    if (!formatCommercialIfAny) return undefined

    if (formatCommercialIfAny.includes('Atmos') || title.includes('Atmos')) return AUDIO_METADATA_TYPES.ATMOS
    if (formatCommercialIfAny.includes('Auro3D') || title.includes('Auro3D')) return AUDIO_METADATA_TYPES.AURO3D

    logger.warn('Unable to detect audio metadata from mediainfo.', { formatCommercialIfAny })
    return undefined
}

function parseAudioLanguages(tracks: Track[]): string[] {
    const unique = new Set<string>()

    for (const track of tracks) {
        if (!isTrackType(track, 'Audio')) continue

        const title = toStringValue(track, 'Title').trim().toLowerCase()
        if (title.startsWith('commentary')) continue

        const language = normalizeAudioLanguage(toStringValue(track, 'Language'))
        if (!language) continue

        unique.add(language)
    }

    return [...unique].sort((a, b) => a.localeCompare(b))
}

function normalizeAudioLanguage(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return ''
    const dashIndex = trimmed.indexOf('-')
    return (dashIndex > 0 ? trimmed.slice(0, dashIndex) : trimmed).trim().toLowerCase()
}

function parseIntegerValue(track: Track | undefined, key: string): number | undefined {
    const stringValue = toStringValue(track, key)
    if (!stringValue) return undefined

    const match = stringValue.match(/\d+/)
    if (!match) return undefined

    return Number(match[0])
}

export async function analyzeMediaFileAsText(filePath: string): Promise<string> {
    return analyzeMediaFile(filePath, { output: 'text' })
}

async function analyzeMediaFile(filePath: string, options: { output: 'object' }): Promise<MediaInfoResult>
async function analyzeMediaFile(filePath: string, options: { output: 'text' }): Promise<string>

async function analyzeMediaFile(filePath: string, options: AnalyzeMediaFileOptions): Promise<MediaInfoResult | string> {
    logger.debug('Starting mediainfo analysis.', { filePath, output: options.output })

    const mediaInfo = await MediaInfoFactory({ format: options.output })
    const fileHandle = await open(filePath, 'r')

    try {
        const stats = await fileHandle.stat()
        const result = await mediaInfo.analyzeData(
            () => stats.size,
            async (size: number, offset: number) => {
                const chunk = Buffer.alloc(size)
                const { bytesRead } = await fileHandle.read(chunk, 0, size, offset)

                return chunk.subarray(0, bytesRead)
            }
        )

        logger.info('Completed mediainfo analysis.', { filePath, output: options.output, fileSize: stats.size })
        return options.output === 'text' ? String(result) : (result as MediaInfoResult)
    } catch (error: unknown) {
        logger.error('Mediainfo analysis failed.', error)
        return options.output === 'text' ? '' : {}
    } finally {
        await fileHandle.close()
    }
}
