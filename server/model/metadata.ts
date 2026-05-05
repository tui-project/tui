export interface Metadata {
    fileName: string
    releaseGroup?: string
    mediaType?: MediaType
    title?: string
    originalTitle?: string
    year?: number
    season?: number
    episode?: number
    language?: string[]
    originalLanguage?: string
    sourceType?: SourceType
    source?: Source
    service?: Service
    repack?: boolean
    proper?: boolean
    cut?: Cut
    hybrid?: boolean
    resolution?: Resolution
    hdr?: HDR[]
    videoCodec?: VideoCodec
    audioCodec?: AudioCodec
    audioChannels?: AudioChannels
    audioMetadata?: AudioMetadata
    tmdbId?: number
    imdbId?: string
    tvdbId?: number
}

export const MEDIA_TYPES = {
    MOVIE: 'movie',
    TV: 'tv',
} as const
export type MediaType = (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES]

export const SOURCES = {
    WEB: 'Web',
    BLURAY: 'BluRay',
    DVD: 'DVD',
} as const
export type Source = (typeof SOURCES)[keyof typeof SOURCES]

export const SOURCE_TYPES = {
    REMUX: 'REMUX',
    ENCODE: 'ENCODE',
    WEB_DL: 'WEB-DL',
    WEBRIP: 'WEBRIP',
    HDTV: 'HDTV',
} as const
export type SourceType = (typeof SOURCE_TYPES)[keyof typeof SOURCE_TYPES]

export const SERVICES = {
    NF: 'NF',
    AMZN: 'AMZN',
    DSNP: 'DSNP',
    HMAX: 'HMAX',
    HULU: 'HULU',
    ATVP: 'ATVP',
    PMTP: 'PMTP',
    MY5: 'MY5',
    ALL4: 'ALL4',
    IT: 'iT',
} as const
export type Service = (typeof SERVICES)[keyof typeof SERVICES] | undefined

export const RESOLUTIONS = {
    '480i': '480i',
    '480p': '480p',
    '576i': '576i',
    '576p': '576p',
    '720p': '720p',
    '1080i': '1080i',
    '1080p': '1080p',
    '2160p': '2160p',
    '4320p': '4320p',
} as const
export type Resolution = (typeof RESOLUTIONS)[keyof typeof RESOLUTIONS]

export const CUTS = {
    SUPER_DUPER: 'Super Duper Cut',
    DIRECTORS: "Director's Cut",
    SPECIAL_EDITION: 'Special Edition',
    EXTENDED: 'Extended',
    UNRATED: 'Unrated',
    THREE_D: '3D',
} as const
export type Cut = (typeof CUTS)[keyof typeof CUTS] | undefined

export const HDR_TYPES = {
    DV: 'DV',
    HDR10_PLUS: 'HDR10+',
    HDR10: 'HDR',
    HLG: 'HLG',
} as const
export type HDR = (typeof HDR_TYPES)[keyof typeof HDR_TYPES]

export const VIDEO_CODECS = {
    MPEG_1: 'MPEG-1',
    MPEG_2: 'MPEG-2',
    VC_1: 'VC-1',
    AVC: 'AVC',
    H264: 'H.264',
    HEVC: 'HEVC',
    H265: 'H.265',
    X264: 'x264',
    X265: 'x265',
    VP9: 'VP9',
    AV1: 'AV1',
} as const
export type VideoCodec = (typeof VIDEO_CODECS)[keyof typeof VIDEO_CODECS]

export const AUDIO_CODECS = {
    DD_PLUS: 'DD+',
    DD: 'DD',
    AAC: 'AAC',
    DTS: 'DTS',
    DTS_HD_MA: 'DTS-HD MA',
    FLAC: 'FLAC',
    TRUEHD: 'TrueHD',
} as const
export type AudioCodec = (typeof AUDIO_CODECS)[keyof typeof AUDIO_CODECS]

export const AUDIO_CHANNELS = {
    '1.0': '1.0',
    '2.0': '2.0',
    '3.0': '3.0',
    '5.1': '5.1',
    '6.1': '6.1',
    '7.1': '7.1',
} as const
export type AudioChannels = (typeof AUDIO_CHANNELS)[keyof typeof AUDIO_CHANNELS]

export const AUDIO_METADATA_TYPES = {
    ATMOS: 'Atmos',
    AURO3D: 'Auro3D',
} as const
export type AudioMetadata = (typeof AUDIO_METADATA_TYPES)[keyof typeof AUDIO_METADATA_TYPES] | undefined
