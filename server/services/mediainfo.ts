import { logger } from '../utils/logger'
import { runCommand } from '../utils/process'
import { getSettings } from '../repositories/settings-repository'

type MediaInfoTrackType = 'General' | 'Video' | 'Audio' | 'Text'

interface MediaInfoTrack {
    '@type': string
    [key: string]: unknown
}

interface MediaInfoResult {
    media?: {
        track: MediaInfoTrack[]
    }
}

export interface ParsedMediainfoMetadata {
    resolution?: Resolution
    videoCodec?: VideoCodec
    videoStandard?: VideoStandard
    frameRate?: number
    hi10p: boolean
    hdr: HDR[]
    language: string[]
    audioCodec?: AudioCodec
    audioChannels?: AudioChannels
    audioMetadata: AudioMetadata
    hasTrueHDCompatibilityTrack?: boolean
    hasEnglishSubs: boolean
    tmdbId?: number
    imdbId?: string
    tvdbId?: number
}

export async function parseMetadataFromMediainfo(filePath: string, sourceType: SourceType): Promise<ParsedMediainfoMetadata> {
    logger.debug('Parsing metadata from mediainfo result.', { filePath, sourceType })

    const mediainfo = await analyzeMediaFile(filePath)
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

    const standard = toStringValue(video, 'Standard')
    const videoStandard = parseVideoStandard(standard)

    const frameRate = parseNumberValue(video, 'FrameRate')

    const formatProfile = toStringValue(video, 'Format_Profile')
    const hi10p = parseHi10p(format, formatProfile)

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
    const hasTrueHDCompatibilityTrack = audioCodec === AUDIO_CODECS.TRUEHD ? parseTrueHDCompatibilityTrack(tracks) : undefined
    const hasEnglishSubs = parseHasEnglishSubs(tracks)

    const extra = getTrackValue(general, 'extra')
    const extraTrack = extra && typeof extra === 'object' ? (extra as MediaInfoTrack) : undefined
    const imdbId = toStringValue(extraTrack, 'IMDB')
    const tmdbId = parseIntegerValue(extraTrack, 'TMDB')
    const tvdbId = parseIntegerValue(extraTrack, 'TVDB')

    const parsedMetadata = {
        resolution,
        videoCodec,
        videoStandard,
        frameRate,
        hi10p,
        hdr,
        audioCodec,
        audioChannels,
        audioMetadata,
        hasTrueHDCompatibilityTrack,
        hasEnglishSubs,
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
        videoStandard: parsedMetadata.videoStandard,
        frameRate: parsedMetadata.frameRate,
        hdr: parsedMetadata.hdr,
        audioCodec: parsedMetadata.audioCodec,
        audioChannels: parsedMetadata.audioChannels,
        languageCount: parsedMetadata.language.length,
        hasTmdbId: parsedMetadata.tmdbId !== undefined,
        hasImdbId: Boolean(parsedMetadata.imdbId),
        hasTvdbId: parsedMetadata.tvdbId !== undefined,
        hasEnglishSubs: parsedMetadata.hasEnglishSubs,
    })

    return parsedMetadata
}

export async function analyzeMediaFileAsText(filePath: string): Promise<string> {
    const settings = await getSettings()
    const mediainfoPath = settings.mediainfoPath

    logger.debug('Starting mediainfo CLI analysis.', { filePath, mediainfoPath })

    try {
        const { stdout } = await runCommand(mediainfoPath, [filePath])
        logger.info('Completed mediainfo CLI analysis.', { filePath, mediainfoPath })
        return stdout
    } catch (error: unknown) {
        logger.error('Mediainfo CLI analysis failed.', error, { filePath, mediainfoPath })
        return ''
    }
}

async function analyzeMediaFile(filePath: string): Promise<MediaInfoResult> {
    const settings = await getSettings()
    const mediainfoPath = settings.mediainfoPath

    logger.debug('Starting mediainfo analysis.', { filePath, mediainfoPath })

    try {
        const { stdout } = await runCommand(mediainfoPath, ['--Output=JSON', filePath])
        const result = JSON.parse(stdout) as MediaInfoResult
        logger.info('Completed mediainfo analysis.', { filePath, mediainfoPath })
        return result
    } catch (error: unknown) {
        logger.error('Mediainfo analysis failed.', error, { filePath, mediainfoPath })
        return {}
    }
}

function getTracks(result: MediaInfoResult): MediaInfoTrack[] {
    return result.media!.track as MediaInfoTrack[]
}

function findTrack(tracks: MediaInfoTrack[], type: MediaInfoTrackType) {
    return tracks.find((track) => String(getTrackValue(track, '@type')).toLowerCase() === type.toLowerCase())
}

function findDefaultAudioTrack(tracks: MediaInfoTrack[]) {
    let firstAudio: MediaInfoTrack | undefined

    for (const track of tracks) {
        if (!isTrackType(track, 'Audio')) continue
        if (!firstAudio) firstAudio = track
        if (toStringValue(track, 'Default').toLowerCase() === 'yes') return track
    }

    return firstAudio
}

function getTrackValue(track: MediaInfoTrack | undefined, key: string): unknown {
    if (!track) return ''
    return (track as unknown as Record<string, unknown>)[key] ?? ''
}

function isTrackType(track: MediaInfoTrack, expectedType: MediaInfoTrackType) {
    return toStringValue(track, '@type').toLowerCase() === expectedType.toLowerCase()
}

function toStringValue(track: MediaInfoTrack | undefined, key: string): string {
    const value = getTrackValue(track, key)
    const stringValue = String(value).trim()

    return stringValue === '<nil>' ? '' : stringValue
}

function parseResolution(height: string, scanType: string): Resolution | undefined {
    const normalizedScanType = scanType.trim().toLowerCase()
    const suffix = normalizedScanType === 'interlaced' || normalizedScanType === 'mbaff' ? 'i' : 'p'

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
        case '1040':
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

function parseVideoStandard(standard: string): VideoStandard | undefined {
    if (standard === 'NTSC') return VIDEO_STANDARDS.NTSC
    if (standard === 'PAL') return VIDEO_STANDARDS.PAL

    return undefined
}

function parseNumberValue(track: MediaInfoTrack | undefined, key: string): number | undefined {
    const stringValue = toStringValue(track, key)
    if (!stringValue) return undefined

    const match = stringValue.match(/\d+(\.\d+)?/)
    if (!match) return undefined

    return Number(match[0])
}

function parseHi10p(format: string, formatProfile: string): boolean {
    return format === 'AVC' && formatProfile.includes('High 10')
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
    logger.debug('Parse audio codec', { audioFormat, formatCommercialIfAny })

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
        case audioFormat === 'DTS' && formatCommercialIfAny === 'DTS-HD MA + DTS:X':
            return AUDIO_CODECS.DTS_X
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
    logger.debug('Parse audio channels', { channels, channelLayout })

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
        case channels === '8' &&
            (channelLayout === 'C L R Ls Rs Lb Rb LFE' ||
                channelLayout === 'L R C LFE Ls Rs Lb Rb' ||
                channelLayout === 'C L R Ls Rs LFE Lw Rw' ||
                channelLayout === 'C L R LFE Lb Rb Lss Rss Objects'):
            return AUDIO_CHANNELS['7.1']
        default:
            logger.warn('Unable to detect audio channels from mediainfo.', { channels, channelLayout })
            return undefined
    }
}

function parseAudioMetadata(formatCommercialIfAny: string, title: string): AudioMetadata {
    if (!formatCommercialIfAny || formatCommercialIfAny === 'Dolby Digital Plus') return undefined

    if (formatCommercialIfAny.includes('Atmos') || title.includes('Atmos')) return AUDIO_METADATA_TYPES.ATMOS
    if (formatCommercialIfAny.includes('Auro3D') || title.includes('Auro3D')) return AUDIO_METADATA_TYPES.AURO3D

    logger.warn('Unable to detect audio metadata from mediainfo.', { formatCommercialIfAny })
    return undefined
}

function parseAudioLanguages(tracks: MediaInfoTrack[]): string[] {
    const unique = new Set<string>()

    for (const track of tracks) {
        if (!isTrackType(track, 'Audio')) continue
        if (isCommentaryAudioTrack(track)) continue

        const language = normalizeAudioLanguage(toStringValue(track, 'Language'))
        if (!language) continue

        unique.add(language)
    }

    return [...unique].sort((a, b) => a.localeCompare(b))
}

function isCommentaryAudioTrack(track: MediaInfoTrack): boolean {
    return toStringValue(track, 'Title').trim().toLowerCase().startsWith('commentary')
}

function normalizeAudioLanguage(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return ''
    const dashIndex = trimmed.indexOf('-')
    return (dashIndex > 0 ? trimmed.slice(0, dashIndex) : trimmed).trim().toLowerCase()
}

function parseTrueHDCompatibilityTrack(tracks: MediaInfoTrack[]): boolean {
    return tracks.some((track) => {
        if (!isTrackType(track, 'Audio')) return false
        if (isCommentaryAudioTrack(track)) return false
        const codec = parseAudioCodec(toStringValue(track, 'Format'), toStringValue(track, 'Format_Commercial_IfAny'))

        return codec === AUDIO_CODECS.DD || codec === AUDIO_CODECS.DD_PLUS
    })
}

function parseHasEnglishSubs(tracks: MediaInfoTrack[]): boolean {
    return tracks.some((track) => {
        if (!isTrackType(track, 'Text')) return false
        const language = toStringValue(track, 'Language').trim().toLowerCase()
        return language === 'en' || language.startsWith('en-')
    })
}

function parseIntegerValue(track: MediaInfoTrack | undefined, key: string): number | undefined {
    const stringValue = toStringValue(track, key)
    if (!stringValue) return undefined

    const match = stringValue.match(/\d+/)
    if (!match) return undefined

    return Number(match[0])
}
